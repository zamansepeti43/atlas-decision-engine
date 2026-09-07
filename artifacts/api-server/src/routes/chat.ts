import { Router, type Request, type Response } from "express";
import { buildAtlasPrompt } from "../lib/atlas-prompt.js";
import { parseChatInput } from "../lib/chat-input.js";
import type { AtlasChatErrorResponse, AtlasChatResponse, ComparisonResult, RankedProduct, ResearchStatus, WebSource } from "../lib/chat-types.js";
import { buildDecision, rankProducts } from "../lib/decision-scoring.js";
import { searchProducts } from "../lib/product-search.js";
import { searchMerchantNetwork } from "../lib/merchant-network.js";
import { buildFollowUpNeed, buildMemoryCandidates, planRequest } from "../lib/request-planner.js";
import { askGroq } from "../services/groq.js";
import { searchWeb } from "../services/web-search.js";

const router = Router();
type VercelRequest = Request & { body: unknown };
type VercelResponse = Response & { status(code: number): VercelResponse; json(body: unknown): VercelResponse };

function responseConfidence(products: RankedProduct[], sources: WebSource[], research: ResearchStatus): number {
  if (products.length) return products[0].confidence;
  if (research.status === "completed") return sources.length ? 0.7 : 0.45;
  if (research.status === "failed" || research.status === "unavailable") return 0.35;
  return 0.6;
}

router.post("/", async (req: VercelRequest, res: VercelResponse) => {
  const parsed = parseChatInput(req.body);
  if (!parsed.ok) return res.status(400).json({ success: false, error: parsed.error, message: "İstek doğrulanamadı.", sources: [], products: [], confidence: 0, memoryCandidates: [], research: { requested: false, status: "not_requested" } } satisfies AtlasChatErrorResponse);

  const { message, history, memorySummary, priorProducts } = parsed;
  const conversationContext = history.filter((entry) => entry.role === "user").slice(-6).map((entry) => entry.content).join("\n");
  const initialPlan = planRequest(message, conversationContext, memorySummary);
  const plan = priorProducts.length > 0 && initialPlan.intent === "decision" && !initialPlan.requiresResearch ? { ...initialPlan, operation: "price_comparison" as const } : initialPlan;
  const followUp = buildFollowUpNeed(plan);
  const blockingFollowUp = followUp?.blocking === true;
  const memoryCandidates = buildMemoryCandidates(plan.context);
  let sources: WebSource[] = [];
  let research: ResearchStatus = { requested: false, status: "not_requested" };
  const isProductOperation = plan.operation === "product_search" || plan.operation === "price_comparison";
  let normalizedProducts = !plan.requiresResearch && isProductOperation ? priorProducts : [];

  if (plan.requiresResearch && plan.query && !blockingFollowUp) {
    if (isProductOperation) {
      const searchResult = await searchProducts(plan.query, plan.backfillQuery, undefined, {
        ...(plan.context.brand && { brand: plan.context.brand }),
        ...(plan.context.category && { category: plan.context.category }),
        ...(plan.context.excludedBrands.length > 0 && { excludeBrands: plan.context.excludedBrands }),
      });
      sources = searchResult.sources;
      research = searchResult.research;
      normalizedProducts = searchResult.products;
      if (normalizedProducts.length === 0 && process.env.ATLAS_MULTI_MERCHANT_SEARCH !== "false") {
        const merchantResult = await searchMerchantNetwork(plan.query, plan.context.category, plan.context.excludedBrands);
        sources = [...new Map([...sources, ...merchantResult.sources].map((source) => [source.url, source])).values()];
        normalizedProducts = merchantResult.products;
        if (merchantResult.research.status === "completed") research = merchantResult.research;
      }
    } else {
      const searchResult = await searchWeb(plan.query);
      sources = searchResult.sources;
      research = searchResult.research;
    }
  }

  const pricePriority = plan.operation === "price_comparison";
  const products = rankProducts(normalizedProducts, plan.context, { pricePriority });
  const decision = buildDecision(products, { pricePriority });
  const comparison: ComparisonResult | undefined = products.length > 1 ? { criteria: ["budgetFit", "preferenceFit", "useCaseFit", "featureFit", "valueScore"], products } : undefined;
  const confidence = responseConfidence(products, sources, research);
  const followUpQuestion = followUp?.question;
  const prompt = buildAtlasPrompt({ message, history, memorySummary, plan, sources, products, decision, research });

  let reply: string;
  if (blockingFollowUp) reply = "Aramaya ve karşılaştırmaya geçmeden önce tek bir bilgiye ihtiyacım var:";
  else if (plan.requiresResearch && research.status !== "completed") reply = research.status === "unavailable" ? "Web araştırması şu anda kullanılamıyor. Bu nedenle güncel ürün, fiyat, mağaza veya kaynak doğrulayamıyorum." : "Web araştırması tamamlanamadı. Bu nedenle güncel ürün, fiyat, mağaza veya kaynak doğrulayamıyorum.";
  else if (plan.requiresResearch && sources.length === 0) reply = "Araştırma tamamlandı ancak bu sorgu için doğrulanabilir güncel kaynak bulunamadı.";
  else if (isProductOperation) {
    const merchantVerifiedCount = products.filter((product) => product.priceVerification === "merchant_page").length;
    reply = decision?.recommendation ? `Güncel kaynaklardan ${products.length} fiyatlı seçenek bulundu${merchantVerifiedCount ? `; ${merchantVerifiedCount} fiyat mağaza sayfasından doğrulandı` : "; bazı fiyatlar arama anındaki kaynak görüntüsüdür"}. Benim önerim: ${decision.recommendation.title}. ${decision.summary}` : "Mağazalar tarandı ancak doğrulanabilir ürün adı, TL fiyatı ve kaynak URL'si birlikte bulunan sonuç çıkarılamadı.";
  } else if (!plan.requiresResearch && plan.intent === "conversation" && memoryCandidates.length > 0) reply = "Tercihini anladım. Bunu sonraki karar ve karşılaştırmalarda kullanacağım.";
  else {
    try { reply = await askGroq(prompt); }
    catch (error) {
      console.error("[Atlas AI] AI provider request failed", error);
      return res.status(503).json({ success: false, error: "AI servisi kullanılamıyor.", message: "Atlas şu anda yanıt üretemiyor. Lütfen daha sonra tekrar deneyin.", intent: plan.intent, domain: plan.context.domain, sources, products, confidence, memoryCandidates, research } satisfies AtlasChatErrorResponse);
    }
  }

  const responseHistory = [...history, { role: "user" as const, content: message }, { role: "assistant" as const, content: reply }];
  const body: AtlasChatResponse = { success: true, message: reply, reply, intent: plan.intent, domain: plan.context.domain, operation: plan.operation, sources, products, ...(comparison && { comparison }), ...(decision && { decision }), confidence, memoryCandidates, ...(memoryCandidates.length > 0 && { memoryUpdated: false }), ...(followUpQuestion && { followUpQuestion }), research, history: responseHistory };
  return res.json(body);
});

export default router;