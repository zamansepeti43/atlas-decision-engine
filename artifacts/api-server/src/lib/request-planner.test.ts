import test from "node:test";
import assert from "node:assert/strict";
import { buildMemoryCandidates, planRequest } from "./request-planner.js";

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