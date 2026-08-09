import { Router, type Request, type Response } from "express";
import { buildAtlasPrompt } from "../lib/atlas-prompt.js";
import { parseChatInput } from "../lib/chat-input.js";
import type { AtlasChatErrorResponse, AtlasChatResponse, ComparisonResult, RankedProduct, ResearchStatus, WebSource } from "../lib/chat-types.js";
import { buildDecision, rankProducts } from "../lib/decision-scoring.js";
import { searchProducts } from "../lib/product-search.js";
import { buildMemoryCandidates, planRequest } from "../lib/request-planner.js";
import { askGroq } from "../services/groq.js";
import { searchWeb } from "../services/web-search.js";

const router = Router();

type VercelRequest = Request & { body: unknown };
type VercelResponse = Response & {
  status(code: number): VercelResponse;
  json(body: unknown): VercelResponse;
};

function responseConfidence(products: RankedProduct[], sources: WebSource[], research: ResearchStatus): number {
  if (products.length) return products[0].confidence;
  if (research.status === "completed") return sources.length ? 0.7 : 0.45;
  if (research.status === "failed" || research.status === "unavailable") return 0.35;
  return 0.6;
}

router.post("/", async (req: VercelRequest, res: VercelResponse) => {
  const parsed = parseChatInput(req.body);
  if (!parsed.ok) {
    return res.status(400).json({
      success: false,
      error: parsed.error,
      message: "İstek doğrulanamadı.",
      sources: [],
      products: [],
      confidence: 0,
      memoryCandidates: [],
      research: { requested: false, status: "not_requested" },
    } satisfies AtlasChatErrorResponse);
  }

  const { message, history, memorySummary, priorProducts } = parsed;
  const conversationContext = history
    .filter((entry) => entry.role === "user")
    .slice(-4)
    .map((entry) => entry.content)
    .join("\n");
  const initialPlan = planRequest(message, conversationContext);
  const plan = priorProducts.length > 0 && initialPlan.intent === "decision" && !initialPlan.requiresResearch
    ? { ...initialPlan, operation: "price_comparison" as const }
    : initialPlan;
  const memoryCandidates = buildMemoryCandidates(plan.context);
  let sources: WebSource[] = [];
  let research: ResearchStatus = { requested: false, status: "not_requested" };
  const isProductOperation = plan.operation === "product_search" || plan.operation === "price_comparison";
  let normalizedProducts = !plan.requiresResearch && isProductOperation ? priorProducts : [];

  if (plan.requiresResearch && plan.query) {
    if (isProductOperation) {
      const searchResult = await searchProducts(plan.query, plan.backfillQuery);
      sources = searchResult.sources;
      research = searchResult.research;
      normalizedProducts = searchResult.products;
    } else {
      const searchResult = await searchWeb(plan.query);
      sources = searchResult.sources;
      research = searchResult.research;
    }
  }

  const products = rankProducts(normalizedProducts, plan.context);
  const decision = buildDecision(products);
  const comparison: ComparisonResult | undefined = products.length > 1 ? {
    criteria: ["budgetFit", "preferenceFit", "useCaseFit", "featureFit", "valueScore"],
    products,
  } : undefined;
  const confidence = responseConfidence(products, sources, research);
  const followUpQuestion = plan.intent === "decision" && plan.context.budgetTRY === undefined
    ? "Yaklaşık TL bütçeniz nedir?"
    : plan.intent === "decision" && plan.context.preferences.length === 0
      ? "Sizin için en önemli kullanım veya özellik nedir?"
      : undefined;
  const prompt = buildAtlasPrompt({ message, history, memorySummary, plan, sources, products, decision, research });

  let reply: string;
  if (plan.requiresResearch && research.status !== "completed") {
    reply = research.status === "unavailable"
      ? "Web araştırması şu anda kullanılamıyor. Bu nedenle güncel ürün, fiyat, mağaza veya kaynak doğrulayamıyorum."
      : "Web araştırması tamamlanamadı. Bu nedenle güncel ürün, fiyat, mağaza veya kaynak doğrulayamıyorum.";
  } else if (plan.requiresResearch && sources.length === 0) {
    reply = "Web araştırması tamamlandı ancak bu sorgu için doğrulanabilir güncel kaynak bulunamadı.";
  } else if (isProductOperation) {
    reply = decision?.recommendation
      ? `Gerçek kaynaklardan ${products.length} fiyatlı ürün doğrulandı. Benim önerim: ${decision.recommendation.title}. ${decision.summary}`
      : "Web kaynakları tarandı ancak açık ürün adı, doğrulanabilir TL fiyatı ve kaynak URL'si birlikte bulunan bir sonuç çıkarılamadı.";
  } else if (!plan.requiresResearch && plan.intent === "conversation" && memoryCandidates.length > 0) {
    reply = "Tercihinizi anladım. Güncel ürün veya fiyat önermeden bu bilgiyi sonraki karşılaştırmada kullanabilirim.";
  } else {
    try {
      reply = await askGroq(prompt);
    } catch (error) {
      console.error("[Atlas AI] AI provider request failed", error);
      const body: AtlasChatErrorResponse = {
        success: false,
        error: "AI servisi kullanılamıyor.",
        message: "Atlas şu anda yanıt üretemiyor. Lütfen daha sonra tekrar deneyin.",
        intent: plan.intent,
        sources,
        products,
        confidence,
        memoryCandidates,
        research,
      };
      return res.status(503).json(body);
    }
  }

  const responseHistory = [...history, { role: "user" as const, content: message }, { role: "assistant" as const, content: reply }];
  const body: AtlasChatResponse = {
    success: true,
    message: reply,
    reply,
    intent: plan.intent,
    operation: plan.operation,
    sources,
    products,
    ...(comparison && { comparison }),
    ...(decision && { decision }),
    confidence,
    memoryCandidates,
    ...(memoryCandidates.length > 0 && { memoryUpdated: false }),
    ...(followUpQuestion && { followUpQuestion }),
    research,
    history: responseHistory,
  };
  return res.json(body);
});

export default router;