import type { AtlasIntent, AtlasOperation, MemoryCandidate, RequestContext, RequestPlan } from "./chat-types.js";

const INTENT_SIGNALS: Array<[AtlasIntent, RegExp]> = [
  ["problem-solving", /(sorun|problem|hata|çalışmıyor|cozum|çözüm|debug|fix)/i],
  ["decision", /(hangisi|karar|seç|sec|seçerdin|secerdin|almalı|almalıyım|alsam|karşılaştır|karsilastir|öner|oner|tavsiye|en iyisi|ilk sıradaki|ilk siradaki|bunu mu|iyi mi)/i],
  ["writing", /(yaz|metin|e-?posta|makale|taslak|düzenle|duzenle)/i],
  ["planning", /(plan|yol haritası|takvim|program|strateji)/i],
  ["research", /(araştır|arastir|research|kaynak|incele|güncel|guncel|latest)/i],
  ["learning", /(nedir|nasıl çalışır|nasil calisir|anlat|öğret|ogret|açıkla|acikla)/i],
];

const RESEARCH_SIGNAL = /güncel|guncel|en son|latest|fiyat|price|ürün|urun|product|araştır|arastir|research|kaynak|internette|webde|\bweb\b/i;
const TEMPORAL_SIGNAL = /bugün|bugun|şu an|su an/i;
const PRODUCT_SIGNAL = /(ürün|urun|product|telefon|laptop|bilgisayar|kulaklık|kulaklik|tablet|televizyon|kamera|monitör|monitor|saat|ayakkabı|ayakkabi)|\btv\b/i;
const PRICE_SIGNAL = /fiyat|price|kaç tl|kac tl|ne kadar|bütçe|butce|₺|\btl\b/i;
const PREFERENCE_TERMS = ["kamera", "batarya", "pil", "oyun", "performans", "hafif", "taşınabilir", "tasarım", "ekran", "dayanıklı", "sessiz", "hızlı", "ucuz", "rahat", "konforlu"];
const PRODUCT_CATEGORIES: Array<[string, RegExp]> = [
  ["spor ayakkabı", /spor ayakkab[ıi]/i],
  ["koşu ayakkabısı", /koşu ayakkab[ıi]/i],
  ["ayakkabı", /ayakkab[ıi]/i],
  ["kulaklık", /kulakl[ıi]k/i],
  ["televizyon", /televizyon|\btv\b/i],
  ["bilgisayar", /bilgisayar/i],
  ["laptop", /laptop/i],
  ["telefon", /telefon/i],
  ["tablet", /tablet/i],
  ["kamera", /kamera/i],
  ["monitör", /monit[oö]r/i],
  ["saat", /saat/i],
];

function buildProductQueries(context: RequestContext, fallback: string): { query: string; backfillQuery: string } {
  const normalizedFallback = fallback.toLocaleLowerCase("tr-TR");
  const subject = context.category && !normalizedFallback.includes(context.category.toLocaleLowerCase("tr-TR"))
    ? `${fallback} ${context.category}`
    : fallback;
  const productNeeds = [
    ...context.preferences,
    context.useCase,
  ].filter((value): value is string => Boolean(value));
  const base = [subject, ...productNeeds].join(" ");
  const backfillBase = base.replace(/\d[\d.,]*(?:\s*bin)?\s*(?:TL|lira|₺)\s*(?:altı(?:nda)?|üstü(?:nde)?)?/gi, "").replace(/\s+/g, " ").trim();
  const budget = context.budgetTRY !== undefined ? `${context.budgetTRY} TL altı` : "";
  return {
    query: `${base} ${budget} satın al tekil ürün sayfası satış fiyatı TL stokta Türkiye`.replace(/\s+/g, " ").trim(),
    backfillQuery: `${backfillBase} sepete ekle ürün kodu model satış fiyatı TL Türkiye`,
  };
}

export function extractRequestContext(message: string): RequestContext {
  const budgetMatch = message.match(/(?:bütçe[m]?[^\d]*)?(\d[\d.]*(?:,\d+)?)\s*(bin)?\s*(?:tl|lira|₺)/i);
  let budgetTRY: number | undefined;
  if (budgetMatch) {
    const parsed = Number(budgetMatch[1].replace(/\./g, "").replace(",", "."));
    if (Number.isFinite(parsed)) budgetTRY = parsed * (budgetMatch[2] ? 1_000 : 1);
  }

  const lower = message.toLocaleLowerCase("tr-TR");
  const preferences = PREFERENCE_TERMS.filter((term) => lower.includes(term));
  const useCaseMatch = message.match(/(?:için|amacıyla|kullanacağım|kullanmak için)\s+([^.!?]{3,80})/i);
  const category = PRODUCT_CATEGORIES.find(([, signal]) => signal.test(message))?.[0];

  return {
    ...(category && { category }),
    ...(budgetTRY !== undefined && { budgetTRY }),
    preferences,
    ...(useCaseMatch && { useCase: useCaseMatch[1].trim() }),
  };
}

export function planRequest(message: string, conversationContext = ""): RequestPlan {
  const trimmed = message.trim();
  const contextualMessage = [conversationContext.trim(), trimmed].filter(Boolean).join("\n");
  const intent = INTENT_SIGNALS.find(([, signal]) => signal.test(trimmed))?.[0] ?? "conversation";
  const currentIsProduct = PRODUCT_SIGNAL.test(trimmed);
  const currentIsPrice = PRICE_SIGNAL.test(trimmed);
  const isProduct = PRODUCT_SIGNAL.test(contextualMessage);
  const isPrice = PRICE_SIGNAL.test(contextualMessage);
  const requiresResearch = RESEARCH_SIGNAL.test(trimmed)
    || (TEMPORAL_SIGNAL.test(trimmed) && intent !== "writing" && intent !== "planning")
    || (currentIsProduct && currentIsPrice);
  let operation: AtlasOperation = "respond";

  if (requiresResearch) {
    operation = isProduct && isPrice ? "price_comparison" : isProduct ? "product_search" : "web_research";
  }
  const context = extractRequestContext(contextualMessage);
  const productQueries = operation === "price_comparison" || operation === "product_search"
    ? buildProductQueries(context, trimmed)
    : undefined;

  return {
    intent: operation === "price_comparison" || operation === "product_search" ? "decision" : intent,
    operation,
    requiresResearch,
    ...(requiresResearch && { query: productQueries?.query ?? `${contextualMessage} güncel Türkiye` }),
    ...(requiresResearch && productQueries && { backfillQuery: productQueries.backfillQuery }),
    context,
  };
}

export function buildMemoryCandidates(context: RequestContext): MemoryCandidate[] {
  const candidates: MemoryCandidate[] = [];
  if (context.budgetTRY !== undefined) {
    candidates.push({ key: "budgetTRY", value: context.budgetTRY, reason: "Kullanıcı açık bir TL bütçesi belirtti." });
  }
  for (const preference of context.preferences) {
    candidates.push({ key: "preference", value: preference, reason: "Kullanıcı bu tercihi açıkça belirtti." });
  }
  if (context.useCase) {
    candidates.push({ key: "useCase", value: context.useCase, reason: "Kullanıcı kullanım amacını açıkça belirtti." });
  }
  return candidates;
}