import test from "node:test";
import assert from "node:assert/strict";
import { buildFollowUpNeed, buildMemoryCandidates, planRequest } from "./request-planner.js";

test("simple greetings do not trigger web research", () => {
  const plan = planRequest("Merhaba, nasılsın?");
  assert.equal(plan.intent, "conversation");
  assert.equal(plan.operation, "respond");
  assert.equal(plan.requiresResearch, false);
});

test("temporal wording alone does not turn a writing request into web research", () => {
  const plan = planRequest("Bugün bana kısa bir selamlama yaz.");
  assert.equal(plan.intent, "writing");
  assert.equal(plan.operation, "respond");
  assert.equal(plan.requiresResearch, false);
});

test("current research requests trigger web research", () => {
  const plan = planRequest("Yapay zeka alanındaki en güncel gelişmeleri kaynaklarla araştır");
  assert.equal(plan.intent, "research");
  assert.equal(plan.operation, "web_research");
  assert.equal(plan.requiresResearch, true);
});

test("Turkish product requests trigger product research", () => {
  const plan = planRequest("Ev için uygun bir ürün bul");
  assert.equal(plan.operation, "product_search");
  assert.equal(plan.requiresResearch, true);
});

test("product price requests retain decision intent and extract TRY budget", () => {
  const plan = planRequest("Oyun için 30 bin TL bütçeyle güncel laptop fiyatlarını karşılaştır");
  assert.equal(plan.intent, "decision");
  assert.equal(plan.operation, "price_comparison");
  assert.equal(plan.context.budgetTRY, 30_000);
  assert.deepEqual(plan.context.preferences, ["oyun"]);
});

test("shoe request with a TRY budget plans current price comparison", () => {
  const plan = planRequest("Bugün 2000 TL altında en iyi spor ayakkabıları bul.");
  assert.equal(plan.intent, "decision");
  assert.equal(plan.operation, "price_comparison");
  assert.equal(plan.requiresResearch, true);
  assert.equal(plan.context.category, "spor ayakkabı");
  assert.equal(plan.context.budgetTRY, 2_000);
  assert.match(plan.query ?? "", /spor ayakkabı.*2000 TL altı.*satın al.*tekil ürün sayfası/i);
  assert.match(plan.backfillQuery ?? "", /spor ayakkabı.*sepete ekle.*ürün kodu/i);
  assert.doesNotMatch(plan.backfillQuery ?? "", /2000 TL altı/i);
});

test("specific product identity is preserved in listing queries", () => {
  const plan = planRequest("Samsung Galaxy A16 128 GB telefonun Türkiye satış fiyatını bul.");
  assert.match(plan.query ?? "", /Samsung Galaxy A16 128 GB/i);
  assert.match(plan.backfillQuery ?? "", /Samsung Galaxy A16 128 GB/i);
});

test("budgeted product request requires research without an explicit search word", () => {
  const plan = planRequest("2000 TL bütçem var, rahat ve hafif spor ayakkabı istiyorum.");
  assert.equal(plan.intent, "decision");
  assert.equal(plan.operation, "price_comparison");
  assert.equal(plan.requiresResearch, true);
  assert.equal(plan.context.category, "spor ayakkabı");
  assert.equal(plan.context.budgetTRY, 2_000);
  assert.deepEqual(plan.context.preferences, ["hafif", "rahat"]);
  assert.notEqual(plan.query, plan.backfillQuery);
});

test("preference-only product statement does not trigger unnecessary research", () => {
  const plan = planRequest("Ben hafif ayakkabı istiyorum.");
  assert.equal(plan.operation, "respond");
  assert.equal(plan.requiresResearch, false);
  assert.deepEqual(plan.context.preferences, ["hafif"]);
});

test("explicit follow-up research carries prior user context into its query", () => {
  const plan = planRequest(
    "Bana web taraması yapıp fiyatlarını çıkarır mısın?",
    "2000 TL bütçem var rahat bir ayakkabı istiyorum.\nSpor ayakkabı ve hafiflik",
  );
  assert.equal(plan.operation, "price_comparison");
  assert.equal(plan.context.budgetTRY, 2_000);
  assert.match(plan.query ?? "", /spor ayakkabı/i);
  assert.match(plan.query ?? "", /2000 TL/i);
});

test("decision follow-ups do not inherit research signals from conversation history", () => {
  const history = "Bugün 2000 TL altında rahat spor ayakkabı bul.";
  for (const message of [
    "Hangisini almalıyım?",
    "Hangisini seçerdin?",
    "En iyisi hangisi?",
    "İlk sıradaki iyi mi?",
    "Bunu mu alsam?",
  ]) {
    const plan = planRequest(message, history);
    assert.equal(plan.intent, "decision", message);
    assert.equal(plan.requiresResearch, false, message);
    assert.equal(plan.operation, "respond", message);
    assert.equal(plan.context.budgetTRY, 2_000, message);
  }
});

test("planning requests do not search without a current-data requirement", () => {
  const plan = planRequest("Plan yapmama yardım et.");
  assert.equal(plan.intent, "planning");
  assert.equal(plan.operation, "respond");
  assert.equal(plan.requiresResearch, false);
});

test("explicit comfort preference becomes an allow-listed memory candidate", () => {
  const plan = planRequest("Ben rahat ayakkabı seviyorum.");
  const candidates = buildMemoryCandidates(plan.context);
  assert.ok(candidates.some((candidate) => candidate.key === "preference" && candidate.value === "rahat"));
});

test("product request without a property context stays in the general shopping domain", () => {
  const plan = planRequest("Ev için uygun bir ürün bul");
  assert.equal(plan.context.domain, "genel");
  assert.equal(plan.operation, "product_search");
});

test("tech product request detects the technology domain, budget and intent", () => {
  const plan = planRequest("30 bin TL'ye oyun laptopu öner");
  assert.equal(plan.context.domain, "teknoloji");
  assert.equal(plan.context.budgetTRY, 30_000);
  assert.deepEqual(plan.context.preferences, ["oyun"]);
  assert.equal(plan.intent, "decision");
  assert.equal(plan.operation, "price_comparison");
  assert.equal(plan.requiresResearch, true);
});

test("auto part request extracts part and brand and plans product search", () => {
  const plan = planRequest("BMW için fren balatası arıyorum");
  assert.equal(plan.context.domain, "otomobil-parca");
  assert.equal(plan.context.part, "fren balatası");
  assert.equal(plan.context.brand, "bmw");
  assert.equal(plan.operation, "product_search");
  assert.equal(plan.requiresResearch, true);
  assert.match(plan.query ?? "", /bmw.*fren balatası/i);
  assert.equal(buildFollowUpNeed(plan), undefined);
});

test("auto part request without a concrete part is blocked with a single question", () => {
  const plan = planRequest("BMW için bir parça arıyorum");
  assert.equal(plan.context.domain, "otomobil-parca");
  assert.equal(plan.context.part, undefined);
  assert.equal(plan.operation, "respond");
  assert.equal(plan.requiresResearch, false);
  const followUp = buildFollowUpNeed(plan);
  assert.equal(followUp?.blocking, true);
  assert.match(followUp?.question ?? "", /parçaya/i);
});

test("real estate request requires a location before research", () => {
  const plan = planRequest("İstanbul'da güncel satılık daire ilanlarını araştır");
  assert.equal(plan.context.domain, "emlak");
  assert.equal(plan.context.location, "istanbul");
  assert.equal(plan.context.propertyIntent, "satilik");
  assert.equal(plan.operation, "web_research");
  assert.equal(plan.requiresResearch, true);
});

test("real estate request without a location stops with a blocking question", () => {
  const plan = planRequest("Satılık daire bakıyorum");
  assert.equal(plan.context.domain, "emlak");
  assert.equal(plan.context.location, undefined);
  assert.equal(plan.requiresResearch, false);
  const followUp = buildFollowUpNeed(plan);
  assert.equal(followUp?.blocking, true);
  assert.match(followUp?.question ?? "", /şehir/i);
});

test("car request with a stated budget triggers current web research", () => {
  const plan = planRequest("30 bin TL'ye araba almak istiyorum");
  assert.equal(plan.context.domain, "otomobil");
  assert.equal(plan.context.budgetTRY, 30_000);
  assert.equal(plan.operation, "web_research");
  assert.equal(plan.requiresResearch, true);
});

test("career, finance, travel and education requests map to their domains", () => {
  assert.equal(planRequest("İş arıyorum, kariyer planı önerir misin?").context.domain, "kariyer");
  assert.equal(planRequest("Düşük riskli yatırım önerir misin?").context.domain, "finans");
  assert.equal(planRequest("Tatil için nereye gitmeliyim?").context.domain, "seyahat");
  assert.equal(planRequest("İngilizce öğrenmek istiyorum").context.domain, "egitim");
});

test("memory budget is reused when the message itself lacks a budget", () => {
  const plan = planRequest("Rahat spor ayakkabı istiyorum", "", "Bütçe: 30.000 TL");
  assert.equal(plan.context.budgetTRY, 30_000);
  const candidates = buildMemoryCandidates(plan.context);
  assert.ok(candidates.some((candidate) => candidate.key === "budgetTRY" && candidate.value === 30_000));
});

test("tech request without a budget gets a non-blocking follow-up question", () => {
  const plan = planRequest("Laptop öner");
  assert.equal(plan.context.domain, "teknoloji");
  const followUp = buildFollowUpNeed(plan);
  assert.equal(followUp?.blocking, false);
  assert.match(followUp?.question ?? "", /bütçe/i);
});

test("explicit brand rejection becomes a confidence-scored exclusion candidate", () => {
  const plan = planRequest("Ben Apple istemiyorum.");
  assert.deepEqual(plan.context.excludedBrands, ["apple"]);
  const exclusion = buildMemoryCandidates(plan.context).find((candidate) => candidate.key === "exclusion");

  assert.ok(exclusion);
  assert.equal(exclusion.value, "apple");
  assert.equal(exclusion.confidence, 0.95);
  assert.equal(exclusion.source, "explicit_feedback");
  assert.equal(exclusion.scope, "user");
  assert.match(String(exclusion.reason), /Apple/i);
});

test("positive brand statements never create exclusions", () => {
  for (const message of ["Apple öner.", "Apple alabilirim.", "Apple da olabilir.", "Apple'ı seviyorum."]) {
    const plan = planRequest(message);
    assert.deepEqual(plan.context.excludedBrands, [], message);
    const candidates = buildMemoryCandidates(plan.context);
    assert.ok(!candidates.some((candidate) => candidate.key === "exclusion"), message);
  }
});

test("imperative brand rejection creates an exclusion", () => {
  const plan = planRequest("Samsung alma.");
  assert.deepEqual(plan.context.excludedBrands, ["samsung"]);
  const exclusion = buildMemoryCandidates(plan.context).find((candidate) => candidate.key === "exclusion");
  assert.equal(exclusion?.value, "samsung");
  assert.equal(exclusion?.confidence, 0.95);
});

test("hariç and dışında constructions create weaker exclusions", () => {
  const plan = planRequest("Apple hariç telefon öner.");
  assert.deepEqual(plan.context.excludedBrands, ["apple"]);
  const exclusion = buildMemoryCandidates(plan.context).find((candidate) => candidate.key === "exclusion");
  assert.equal(exclusion?.value, "apple");
  assert.equal(exclusion?.confidence, 0.85);

  const plan2 = planRequest("Samsung dışında bir telefon bakıyorum.");
  assert.deepEqual(plan2.context.excludedBrands, ["samsung"]);
});

test("negative statements without a brand never create exclusions", () => {
  const plan = planRequest("istemiyorum.");
  assert.deepEqual(plan.context.excludedBrands, []);
  const candidates = buildMemoryCandidates(plan.context);
  assert.ok(!candidates.some((candidate) => candidate.key === "exclusion"));
});

test("brand exclusions in the memory summary are applied without being re-emitted", () => {
  const plan = planRequest("Rahat ayakkabı istiyorum", "", "Hariç: Apple");
  assert.deepEqual(plan.context.excludedBrands, ["apple"]);
  const candidates = buildMemoryCandidates(plan.context);
  assert.ok(!candidates.some((candidate) => candidate.key === "exclusion"));
});

test("an explicit re-inclusion removes a stored exclusion from memory", () => {
  const plan = planRequest("Apple da olabilir", "", "Hariç: Apple");
  assert.deepEqual(plan.context.excludedBrands, []);
  const removal = buildMemoryCandidates(plan.context).find((candidate) => candidate.key === "exclusion");
  assert.equal(removal?.value, "apple");
  assert.equal(removal?.confidence, 0);
});

test("en uygun wording triggers a current product price comparison", () => {
  const plan = planRequest("Puma Anzarun ayakkabının en uygununu bul");

  assert.equal(plan.intent, "decision");
  assert.equal(plan.operation, "price_comparison");
  assert.equal(plan.requiresResearch, true);
  assert.match(plan.query ?? "", /Puma/i);
});