/**
 * Atlas AI — Learning Engine
 *
 * Controlled learning layer that turns *explicit* user statements (preferences,
 * exclusions, re-inclusions, corrections, scoped budgets and decision criteria)
 * into structured memory candidates.
 *
 * Only two sources are ever persisted to user memory:
 *   - explicit_feedback   (açık kullanıcı ifadesi)
 *   - user_correction     (kullanıcı bot cevabını/red düzeltirken verdiği bilgi)
 * `inferred` sources are intentionally unsupported here — nothing inferred is
 * ever written to long-term memory.
 *
 * Confidence:
 *   0.95 — kesin: "istemiyorum", "kendim seçerim", "mutlaka istiyorum"
 *   0.85 — açık tercih / kriter: "tercih ederim", "seviyorum", "önemli"
 *   0.70 — yumuşak: "mümkünse", "belki", "olabilir"
 *   0    — kaldırma (eski bir kaydı iptal / çelişki çözümünde çıkarır)
 */

import type { UserMemory } from "./memory";

export type LearningSource = "explicit_feedback" | "user_correction";
export type Persistence = "long_term" | "temporary";
export type LearningKey =
 | "exclusion"
 | "preferredBrand"
 | "decisionCriterion"
 | "budgetTRY";

export interface LearningContext {
 intent: string;
 domain: string;
 category?: string;
}

export interface LearningCandidate {
 key: LearningKey;
 value: string | number;
 learning: string;
 confidence: number; // 0 = remove
 scope: "user";
 source: LearningSource;
 domain?: string;
 category?: string;
 persistence: Persistence;
}

export interface InteractionInput {
 userMessage: string;
 botReply?: string;
 ctx: LearningContext;
 memory: UserMemory;
}

const BRAND_POOL = [
 "apple", "samsung", "google", "xiaomi", "huawei", "oneplus", "sony", "lg", "nokia",
 "motorola", "dell", "lenovo", "asus", "hp", "acer", "msi", "microsoft", "nike",
 "adidas", "puma", "skecher",
 "bmw", "mercedes", "audi", "toyota", "volkswagen", "vw", "honda", "ford", "tesla",
].sort((a, b) => b.length - a.length);

const STRONG_POSITIVE = /kendim seçerim|kesinlikle tercih ederim|mutlaka istiyorum|kesinlikle istiyorum/i;
const POSITIVE_BRAND = /tercih ederim|seviyorum|sevmeyi tercih ederim|var diye kullanıyorum|memnunum|istiyorum|kullanıyorum/i;
const SOFT_POSITIVE = /mümkünse|belki|olabilir|ihtimal|tercihe bağlı/i;
const STRONG_NEGATIVE = /istemiyorum|önerme|alma|olmasın|tercih etmiyorum/i;
const WEAK_NEGATIVE = /sevmiyorum|hoşlanmıyorum|hariç|dışında/i;

// Karar kriteri kanunları: (canonical, synonym regex). Çıktı tekrarlanmaz.
const DECISION_CRITERIA: Array<[string, RegExp]> = [
 ["battery", /batarya|pil|şarj|dayanıklı/],
 ["value", /değer|fiyat|ucuz|ekonomik|uygun/],
 ["display", /ekran|görüntü/],
 ["camera", /kamera|fotoğraf|selfie|video/],
 ["performance", /performans|hız|hızlı|oyun|gaming/i],
 ["portability", /hafif|taşınabilir|kompakt/],
 ["creativity", /tasarım|yaratıcı|grafik/i],
 ["safety", /güvenlik|emniyet|dayanıklı/],
 ["fuel_economy", /yakıt|elektrik|menzil/],
 ["cooling", /soğutma|sessiz|sessizlik/],
 ["warranty", /garanti/],
];

const INFO_REQUEST = /(hakkında bilgi (ver|al)|nedir|nasıl çalışır|ne işe yarar|tanımlar mısın|ölçülen nedir|nasıl bir)/i;

function mk(value: string | number, key: LearningKey, learning: string, confidence: number, source: LearningSource, domain?: string, category?: string): LearningCandidate {
 return { key, value, learning, confidence, scope: "user", source, persistence: "long_term", domain, category };
}

function containsBrand(text: string, brand: string): number | -1 {
 const i = text.indexOf(brand);
 if (i < 0) return -1;
 const before = i === 0 ? " " : text[i - 1];
 if (before !== " " && !/[,.;!?("'/'']/.test(before)) return -1;
 // brand sonrasının aynı kelime olup olmadığını kontrol et (örn. "apples" eşleşmesin).
 const rest = text.slice(i + brand.length);
 if (/[a-zçğıöşü]/i.test(rest[0] || "")) return -1;
 return i;
}

function brandIn(textLower: string): string | null {
 for (const b of BRAND_POOL) {
  if (containsBrand(textLower, b) >= 0) return b;
 }
 return null;
}

/** Pozitif marka tercihlerini bulur. */
export function detectPositiveBrandPreferences(message: string): LearningCandidate[] {
 const lower = message.toLocaleLowerCase("tr-TR");
 const results: LearningCandidate[] = [];
 for (const brand of BRAND_POOL) {
  const i = containsBrand(lower, brand);
  if (i < 0) continue;
  if (STRONG_NEGATIVE.test(lower.slice(0, i + brand.length + 30))) continue; // istemiyorum apple → exclusion, pozitif değil
  const tail = lower.slice(i + brand.length);
  if (STRONG_POSITIVE.test(tail.slice(0, 40))) results.push(mk(brand, "preferredBrand", `Kullanıcı ${brand} markasını kesinlikle tercih ediyor.`, 0.95, "explicit_feedback"));
  else if (POSITIVE_BRAND.test(tail.slice(0, 40))) results.push(mk(brand, "preferredBrand", `Kullanıcı ${brand} markasını tercih ediyor.`, 0.85, "explicit_feedback"));
  else if (SOFT_POSITIVE.test(tail.slice(0, 40))) results.push(mk(brand, "preferredBrand", `Kullanıcı ${brand} markasını yumuşakça kabul ediyor.`, 0.70, "explicit_feedback"));
 }
 return results;
}

/** Re-inclusion: daha önce dışlanmış bir markanın kabul edildiğini ifade eden "da olabilir/te olabilir". */
export function detectReInclusions(message: string): LearningCandidate[] {
 const lower = message.toLocaleLowerCase("tr-TR");
 const results: LearningCandidate[] = [];
 if (!(/\b(da\s+olabilir|te\s+olabililir|da\s+tercih|te\s+tercih|da\s+seçebilirim|ihtiyac.*yok.*değil|da\s+kabul edilebilir)/i.test(lower))) return results;
 for (const brand of BRAND_POOL) {
  const i = containsBrand(lower, brand);
  if (i < 0) continue;
  results.push(mk(brand, "exclusion", `Kullanıcı ${brand} markasının dışlanmamasını istiyor (re-inclusion).`, 0, "explicit_feedback"));
 }
 return results;
}

/** Negatif marka dışlamaları (mevcut exclusion sistemiyle bütünleşik). */
export function detectExclusions(message: string): LearningCandidate[] {
 const lower = message.toLocaleLowerCase("tr-TR");
 const results: LearningCandidate[] = [];
 for (const brand of BRAND_POOL) {
  const i = containsBrand(lower, brand);
  if (i < 0) continue;
  const tail = lower.slice(i + brand.length);
  const phraseMatch = tail.match(STRONG_NEGATIVE);
    if (!phraseMatch || (phraseMatch.index ?? Number.POSITIVE_INFINITY) > 40) continue;
  const confidence = STRONG_NEGATIVE.test(phraseMatch[0]) ? 0.95 : 0.85;
  results.push(mk(brand, "exclusion", `Kullanıcı ${brand} markasını dışlıyor: "${phraseMatch[0].trim()}"`, confidence, "explicit_feedback"));
 }
 return results;
}

/** Açıkça belirtilen karar kriterleri (canonical, tekrarlanmaz). */
export function detectDecisionCriteria(message: string): LearningCandidate[] {
 const lower = message.toLocaleLowerCase("tr-TR");
 const results: LearningCandidate[] = [];
 const seen = new Set<string>();
 for (const [canonical, re] of DECISION_CRITERIA) {
  if (seen.has(canonical)) continue;
  if (re.test(lower)) {
   const strength = /(önemli|kritik|öncelik|esaslı)/i.test(lower) ? 0.85 : 0.70;
   results.push(mk(canonical, "decisionCriterion", `Kullanıcı "${canonical}" kriterini belirtti.`, strength, "explicit_feedback"));
   seen.add(canonical);
  }
 }
 return results;
}

/** Bütçe (domain/category kapsamlı); mevcut flat budget davranışıyla uyumludur. */
export function detectBudget(message: string): LearningCandidate[] {
 const m = message.match(/(\d[\d.]*(?:,\d+)?)\s*(bin)?\s*(tl|lira|₺)/i);
 if (!m) return [];
 let raw = m[1].replace(/\./g, "");
 if (raw.includes(",")) raw = raw.replace(",", ".");
 let amount = parseFloat(raw);
 if (!Number.isFinite(amount)) return [];
 if ((m[2] || "").toLowerCase() === "bin") amount *= 1000;
 return [mk(amount, "budgetTRY", `Kullanıcı açık bir TL bütçesi belirtti: ${Math.round(amount).toLocaleString("tr-TR")} TL.`, 0.95, "explicit_feedback")];
}

/** Soru / bilgi isteyen ifadeler öğrenme tetiklemez. */
export function shouldLearn(message: string): boolean {
 const lower = message.toLocaleLowerCase("tr-TR");
 if (INFO_REQUEST.test(lower)) return false;
 return (
  !!detectPositiveBrandPreferences(message).length ||
  !!detectExclusions(message).length ||
  !!detectDecisionCriteria(message).length ||
  !!detectBudget(message).length ||
  message.toLocaleLowerCase("tr-TR").split(" ").length > 0 && (STRONG_NEGATIVE.test(lower) || STRONG_POSITIVE.test(lower))
 );
}

/**
 * Mevcut memory'ye göre yeni adayları çelişki çözümler:
 *  - aynı (key,value[,domain,category]) tekrar eklenirse (idempotent),
 *  - confidence 0 → kaldırma (listeden çıkarılır),
 *  - yeni preferredBrand (farklı marka, aynı domain/category) → eski preferredBrand kaldırılır
 *    (current message wins — #15),
 *  - exclusion yapılan marka preferredBrands listesindeyse → kaldır,
 * - isCorrection=true → kaldırma adaylarının source'u `user_correction` olur.
 */
export function resolveMemoryConflict(existing: UserMemory, candidates: LearningCandidate[], isCorrection = false): LearningCandidate[] {
 const adds: LearningCandidate[] = [];
 const removes: LearningCandidate[] = [];
 const presentAdd = (c: LearningCandidate) =>
  adds.some((a) => a.key === c.key && String(a.value) === String(c.value) && (a.domain || "") === (c.domain || "") && (a.category || "") === (c.category || ""));

 for (const c of candidates) {
  if (Math.abs(c.confidence) < 1e-9) { removes.push(c); continue; }
  if (!presentAdd(c)) adds.push(c);
 }

 // Çelişki çözümü: aynı alan için yeni preferredBrand geldiyse eskiyi kaldır.
 const newPreferred = adds.filter((c) => c.key === "preferredBrand");
 for (const c of newPreferred) {
  for (const old of existing.preferredBrands) {
   if (old.toLowerCase() !== String(c.value).toLowerCase()) {
    removes.push({ ...c, key: "preferredBrand", value: old, confidence: 0, source: isCorrection ? "user_correction" : "explicit_feedback", learning: "conflict resolution: açık yeni tercih eskiyi geçersiz kılıyor." });
   }
  }
 }
 // exclusion yapılan marka preferredBrands'daysa → tercih listesinden çıkar (conflict).
 for (const c of adds.filter((c) => c.key === "exclusion")) {
  if (existing.preferredBrands.map((p) => p.toLowerCase()).includes(String(c.value).toLowerCase())) {
   removes.push({ ...c, key: "preferredBrand", value: c.value, confidence: 0, source: isCorrection ? "user_correction" : "explicit_feedback", learning: "conflict resolution: dışlanan marka tercih listesinden çıkarılıyor." });
  }
 }

 return [...removes, ...adds];
}

/**
 * Tek bir etkileşim turunu; bot yanıtını düzeltme tespitinde kullanır.
 */
export function analyzeInteraction(input: InteractionInput): LearningCandidate[] {
 const { userMessage, botReply, ctx } = input;
 if (!input.memory.permissionGranted) return [];
 if (!shouldLearn(userMessage)) return [];

 const list: LearningCandidate[] = [];
 const withCtx = (c: LearningCandidate) => ({ ...c, domain: ctx.domain, category: ctx.category });

 list.push(...detectExclusions(userMessage).map(withCtx));
 list.push(...detectReInclusions(userMessage).map(withCtx));
 list.push(...detectPositiveBrandPreferences(userMessage).map(withCtx));
 list.push(...detectDecisionCriteria(userMessage).map(withCtx));
 for (const b of detectBudget(userMessage)) list.push(withCtx(b));

 const isCorrection = !!botReply && /^hayır(?:,|\.|\s|$)/i.test(userMessage.trim().toLocaleLowerCase("tr-TR"));
 return resolveMemoryConflict(input.memory, list, isCorrection);
}
