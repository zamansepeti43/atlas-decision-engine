import type { AtlasIntent, AtlasOperation, MemoryCandidate, RequestContext, RequestPlan } from "./chat-types.js";

const INTENT_SIGNALS: Array<[AtlasIntent, RegExp]> = [
  ["problem-solving", /(sorun|problem|hata|çalışmıyor|cozum|çözüm|debug|fix)/i],
  ["decision", /(hangisi|karar|seç|sec|seçerdin|secerdin|almalı|almalıyım|alsam|karşılaştır|karsilastir|öner|oner|tavsiye|en iyisi|en uygun|en ucuz|ilk sıradaki|ilk siradaki|bunu mu|iyi mi|ar[iı]yorum|bak[iı]yorum)/i],
  ["writing", /(yaz|metin|e-?posta|makale|taslak|düzenle|duzenle)/i],
  ["planning", /(plan|yol haritası|takvim|program|strateji)/i],
  ["research", /(araştır|arastir|research|kaynak|incele|güncel|guncel|latest)/i],
  ["learning", /(nedir|nasıl çalışır|nasil calisir|anlat|öğret|ogret|açıkla|acikla)/i],
];

const RESEARCH_SIGNAL = /güncel|guncel|en son|latest|fiyat|price|en uygun|en ucuz|ürün|urun|product|araştır|arastir|research|kaynak|internette|webde|\bweb\b/i;
const TEMPORAL_SIGNAL = /bugün|bugun|şu an|su an/i;
const PRODUCT_SIGNAL = /(ürün|urun|product|telefon|laptop|bilgisayar|kulaklık|kulaklik|tablet|televizyon|kamera|monitör|monitor|saat|ayakkabı|ayakkabi)|\btv\b|(fren balatası|balata|fren|filtre|tampon|egzoz|amortisör|triger|silecek|akü|şanzıman|kavrama|marş|buji|radyatör|yedek parça)/i;
const PRICE_SIGNAL = /fiyat|price|kaç tl|kac tl|ne kadar|bütçe|butce|en uygun|en ucuz|₺|\btl\b/i;
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

const PART_TERMS = ["fren balatası", "balata", "fren", "yağ filtresi", "hava filtresi", "kabin filtresi", "filtre", "tampon", "egzoz", "amortisör", "triger", "silecek", "akü", "şanzıman", "kavrama", "debriyaj", "marş", "alternatör", "buji", "radyatör"];
const AUTO_BRANDS = ["bmw", "mercedes", "audi", "toyota", "volkswagen", "vw", "honda", "ford", "renault", "fiat", "hyundai", "kia", "volvo", "skoda", "seat", "opel", "dacia", "nissan", "mazda", "peugeot", "citroen", "porsche", "tesla", "togg"];
const PRODUCT_BRANDS = ["samsung", "apple", "iphone", "google", "xiaomi", "huawei", "oneplus", "sony", "lg", "nokia", "motorola", "dell", "lenovo", "asus", "hp", "acer", "msi", "microsoft", "surface", "macbook", "nike", "adidas", "puma", "skechers", "new balance", "asics", "reebok"];
const BRAND_POOL = [...AUTO_BRANDS, ...PRODUCT_BRANDS].sort((left, right) => right.length - left.length);
const LOCATIONS = ["istanbul", "ankara", "izmir", "antalya", "bodrum", "marmaris", "kapadokya", "bursa", "adana", "gaziantep", "konya", "kayseri", "trabzon", "eskişehir", "muğla", "paris", "londra", "roma", "barcelona", "amsterdam", "prag", "dubai", "bali", "new york", "tokyo", "berlin", "lizbon", "atina"];
const DOMAIN_SIGNALS: Array<[RequestContext["domain"], RegExp]> = [
  ["otomobil-parca", /(fren balatası|balata|fren|filtre|tampon|egzoz|amortisör|triger|silecek|akü|şanzıman|kavrama|debriyaj|marş|alternatör|buji|radyatör|yedek parça|parça aray|parça arıyorum|parça bakıyorum)/i],
  ["otomobil", /(araba|araç|arac|otomobil|suv|sedan|hibrit|hybrid|elektrikli araç|dizel|benzinli|otomatik vites|manuel vites)|bmw|mercedes|audi|toyota|volkswagen|honda|ford|tesla|togg/i],
  ["finans", /(yatırım|borsa|hisse|kripto|bitcoin|döviz|dolar|euro|altın|faiz|birikim|tasarruf|kredi|borç|sigorta|emeklilik|fon|banka|finans)/i],
  ["seyahat", /(tatil|seyahat|gezi|uçak|otel|tur|balayı|vize|pasaport|destinasyon|kiralık araç)/i],
  ["kariyer", /(kariyer|meslek|maaş|terfi|istifa|işe gir|işten ayrıl|freelance|remote|startup|cv|mülakat|staj|iş başvurusu|iş arıyorum|iş bul)/i],
  ["egitim", /(okul|üniversite|master|yüksek lisans|doktora|bölüm|sınav|ders|kurs|sertifika|öğrenci|burs|dil okulu|ingilizce|almanca|eğitim|öğrenmek istiyorum)/i],
  ["emlak", /(ev|daire|konut|kira|kiralık|satılık|gayrimenkul|rezidans|müstakil|metrekare|tapu|ipotek|emlak)/i],
  ["teknoloji", /(telefon|laptop|bilgisayar|tablet|akıllı saat|iphone|samsung galaxy|xiaomi|huawei|macbook|dell|lenovo|asus|hp|acer|monitör|kulaklık|televizyon|kamera|gaming|işlemci|ram|gpu)/i],
];
const PRODUCT_SHOPPING_SIGNAL = /(ürün|urun|telefon|laptop|bilgisayar|kulaklık|tablet|televizyon|kamera|monitör|ayakkabı|macbook|gaming|akıllı saat|samsung|xiaomi|iphone|apple|asus|lenovo|dell|nike|adidas|puma)/i;
const TECH_CATEGORY_SIGNAL = /(telefon|laptop|bilgisayar|kulaklık|tablet|televizyon|kamera|monitör|macbook|gaming|akıllı saat|samsung|xiaomi|iphone|apple|asus|lenovo|dell)/i;
const BUDGET_PATTERN = /(?:bütçe[m]?[^\d]*)?(\d[\d.]*(?:,\d+)?)\s*(bin)?\s*(?:tl|lira|₺)/i;
const TIMELINE_PATTERN = /(\d+)\s*(hafta|ay|yıl|gun|gün)/i;

export function displayBrand(brand: string): string {
  const normalized = brand.toLocaleLowerCase("tr-TR");
  return normalized.length <= 3
    ? normalized.toUpperCase()
    : normalized.charAt(0).toLocaleUpperCase("tr-TR") + normalized.slice(1);
}

function detectDomain(message: string): RequestContext["domain"] {
  const lower = message.toLocaleLowerCase("tr-TR");
  if (DOMAIN_SIGNALS[0][1].test(lower)) return "otomobil-parca";
  if (DOMAIN_SIGNALS[1][1].test(lower)) return "otomobil";
  if (PRODUCT_SHOPPING_SIGNAL.test(lower)) return TECH_CATEGORY_SIGNAL.test(lower) ? "teknoloji" : "genel";
  return DOMAIN_SIGNALS.slice(2).find(([, signal]) => signal.test(lower))?.[0] ?? "genel";
}

function detectBrand(message: string): string | undefined {
  const lower = message.toLocaleLowerCase("tr-TR");
  return BRAND_POOL.find((brand) => lower.includes(brand));
}

function extractBudget(text: string): number | undefined {
  const match = text.match(BUDGET_PATTERN);
  if (!match) return undefined;
  const parsed = Number(match[1].replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed * (match[2] ? 1_000 : 1) : undefined;
}

function extractBrandExclusions(message: string) {
  const lower = message.toLocaleLowerCase("tr-TR");
  return BRAND_POOL.flatMap((brand) => {
    const escaped = brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = lower.match(new RegExp(`(?:^|[\\s.,;!?()"'-])(${escaped})(?:['’]y?[ıiuü])?\\s*(istemiyorum|sevmiyorum|hoşlanmıyorum|alma|önerme|tercih etmiyorum|hariç|dışında|olmasın)(?![\\p{L}\\p{N}])`, "iu"));
    if (!match) return [];
    return [{ brand, confidence: /(istemiyorum|önerme|alma|olmasın|tercih etmiyorum)/i.test(match[2]) ? 0.95 : 0.85, phrase: match[0].trim() }];
  });
}

function extractBrandReInclusions(message: string): string[] {
  const lower = message.toLocaleLowerCase("tr-TR");
  return BRAND_POOL.filter((brand) => new RegExp(`(?:^|[\\s.,;!?()"'-])${brand}(?:['’]y?[ıiuü])?\\s*(?:(?:da|de)\\s+)?(?:olabilir|olur|alabilirim|seviyorum|tercih ederim)`, "iu").test(lower));
}

function extractMemoryExclusions(memoryContext: string): string[] {
  const line = memoryContext.match(/^Hariç:\s*(.+)$/im);
  return line ? line[1].split(",").map((value) => value.trim().toLocaleLowerCase("tr-TR")).filter((brand) => BRAND_POOL.includes(brand)) : [];
}

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

export function extractRequestContext(message: string, memoryContext = ""): RequestContext {
  const budgetTRY = extractBudget(message) ?? extractBudget(memoryContext);
  const lower = message.toLocaleLowerCase("tr-TR");
  const domain = detectDomain(message);
  const preferences = PREFERENCE_TERMS.filter((term) => lower.includes(term));
  const useCaseMatch = domain === "otomobil-parca"
    ? null
    : message.match(/(?:için|amacıyla|kullanacağım|kullanmak için)\s+([^.!?]{3,80})/i);
  const category = PRODUCT_CATEGORIES.find(([, signal]) => signal.test(message))?.[0];
  const brand = detectBrand(message);
  const part = domain === "otomobil-parca" ? PART_TERMS.find((term) => lower.includes(term)) : undefined;
  const location = domain === "emlak" ? LOCATIONS.find((place) => lower.includes(place)) : undefined;
  const destination = domain === "seyahat" ? LOCATIONS.find((place) => lower.includes(place)) : undefined;
  const propertyIntent = domain === "emlak"
    ? (/kiralık|kira/i.test(lower) ? "kiralik" as const : /satılık|satın al/i.test(lower) ? "satilik" as const : undefined)
    : undefined;
  const risk = domain === "finans"
    ? (/düşük risk|risk sevmem|güvenli/i.test(lower) ? "dusuk" as const : /yüksek risk|agresif/i.test(lower) ? "yuksek" as const : /risk/i.test(lower) ? "orta" as const : undefined)
    : undefined;
  const timelineMatch = message.match(TIMELINE_PATTERN);
  const newExclusions = extractBrandExclusions(message);
  const reInclusions = extractBrandReInclusions(message);
  const memoryExclusions = extractMemoryExclusions(memoryContext);
  const excludedBrands = [...new Set([
    ...memoryExclusions,
    ...newExclusions.map((item) => item.brand),
  ].filter((item) => !reInclusions.includes(item)))];
  const removedExclusions = reInclusions.filter((item) => memoryExclusions.includes(item));

  return {
    domain,
    ...(category && { category }),
    ...(budgetTRY !== undefined && { budgetTRY }),
    preferences,
    excludedBrands,
    ...(newExclusions.length > 0 && { newExclusions }),
    ...(removedExclusions.length > 0 && { removedExclusions }),
    ...(useCaseMatch && { useCase: useCaseMatch[1].trim() }),
    ...(brand && { brand }),
    ...(part && { part }),
    ...(location && { location }),
    ...(propertyIntent && { propertyIntent }),
    ...(destination && { destination }),
    ...(risk && { risk }),
    ...(timelineMatch && { timeline: `${timelineMatch[1]} ${timelineMatch[2]}` }),
  };
}

export function planRequest(message: string, conversationContext = "", memoryContext = ""): RequestPlan {
  const trimmed = message.trim();
  const contextualMessage = [conversationContext.trim(), trimmed].filter(Boolean).join("\n");
  const context = extractRequestContext(contextualMessage, memoryContext);
  const intent = INTENT_SIGNALS.find(([, signal]) => signal.test(trimmed))?.[0] ?? "conversation";
  const currentIsProduct = PRODUCT_SIGNAL.test(trimmed);
  const currentIsPrice = PRICE_SIGNAL.test(trimmed);
  const isProduct = PRODUCT_SIGNAL.test(contextualMessage);
  const isPrice = PRICE_SIGNAL.test(contextualMessage);
  let requiresResearch: boolean;
  if (context.domain === "otomobil-parca") requiresResearch = Boolean(context.part);
  else if (context.domain === "emlak") requiresResearch = Boolean(context.location) && (RESEARCH_SIGNAL.test(trimmed) || TEMPORAL_SIGNAL.test(trimmed));
  else if (context.domain === "seyahat") requiresResearch = Boolean(context.destination) && (RESEARCH_SIGNAL.test(trimmed) || TEMPORAL_SIGNAL.test(trimmed));
  else if (context.domain === "otomobil" && context.budgetTRY !== undefined) requiresResearch = true;
  else requiresResearch = RESEARCH_SIGNAL.test(trimmed)
    || (TEMPORAL_SIGNAL.test(trimmed) && intent !== "writing" && intent !== "planning")
    || (currentIsProduct && currentIsPrice);
  let operation: AtlasOperation = "respond";

  if (requiresResearch) {
    if (context.domain === "otomobil-parca") operation = "product_search";
    else if (["otomobil", "emlak", "seyahat"].includes(context.domain)) operation = "web_research";
    else operation = isProduct && isPrice ? "price_comparison" : isProduct ? "product_search" : "web_research";
  }
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

export function buildFollowUpNeed(plan: RequestPlan) {
  if (plan.intent !== "decision") return undefined;
  const { context } = plan;
  if (context.domain === "otomobil-parca") {
    if (!context.part) return { question: "Hangi parçaya ihtiyacınız var?", blocking: true };
    if (!context.brand && !context.model) return { question: "Bu parça hangi marka ve model araç için?", blocking: true };
    return undefined;
  }
  if (context.domain === "emlak") {
    if (!context.location) return { question: "Hangi şehir veya bölgede bakıyorsunuz?", blocking: true };
    if (!context.propertyIntent) return { question: "Satılık mı yoksa kiralık mı arıyorsunuz?", blocking: true };
    if (context.budgetTRY === undefined) return { question: "Yaklaşık bütçe veya kira aralığınız nedir?", blocking: false };
    return undefined;
  }
  if (context.domain === "seyahat" && !context.destination) return { question: "Nereye gitmeyi planlıyorsunuz?", blocking: true };
  if (context.domain === "finans" && !context.risk) return { question: "Risk toleransınız nasıl? (düşük / orta / yüksek)", blocking: false };
  if (["teknoloji", "otomobil"].includes(context.domain) && context.budgetTRY === undefined) return { question: "Yaklaşık TL bütçeniz nedir?", blocking: false };
  return undefined;
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
  for (const exclusion of context.newExclusions ?? []) {
    candidates.push({
      key: "exclusion",
      value: exclusion.brand,
      reason: `Kullanıcı açıkça dışladı: "${exclusion.phrase}"`,
      learning: `Kullanıcı ${displayBrand(exclusion.brand)} ürünlerini tercih etmiyor.`,
      confidence: exclusion.confidence,
      scope: "user",
      source: "explicit_feedback",
    });
  }
  for (const brand of context.removedExclusions ?? []) {
    candidates.push({
      key: "exclusion",
      value: brand,
      reason: `Kullanıcı ${displayBrand(brand)} markasını yeniden değerlendiriyor.`,
      learning: `Kullanıcı ${displayBrand(brand)} markasını yeniden değerlendiriyor.`,
      confidence: 0,
      scope: "user",
      source: "explicit_feedback",
    });
  }
  return candidates;
}