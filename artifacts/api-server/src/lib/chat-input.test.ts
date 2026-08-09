import test from "node:test";
import assert from "node:assert/strict";
import { parseChatInput } from "./chat-input.js";

test("parseChatInput removes a duplicated current user turn", () => {
  const parsed = parseChatInput({
    message: "Aynı mesaj",
    history: [
      { role: "assistant", content: "Önceki yanıt" },
      { role: "user", content: "Aynı mesaj" },
    ],
  });
  assert.equal(parsed.ok, true);
  if (parsed.ok) assert.deepEqual(parsed.history, [{ role: "assistant", content: "Önceki yanıt" }]);
});

test("parseChatInput limits history and ignores malformed entries", () => {
  const history = Array.from({ length: 25 }, (_, index) => ({ role: "user", content: `Mesaj ${index}` }));
  const parsed = parseChatInput({ message: "Yeni mesaj", history: [{ role: "system", content: "ignored" }, ...history] });
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.history.length, 20);
    assert.equal(parsed.history[0].content, "Mesaj 5");
  }
});

test("parseChatInput rejects empty and oversized messages", () => {
  assert.equal(parseChatInput({ message: " " }).ok, false);
  assert.equal(parseChatInput({ message: "x".repeat(4_001) }).ok, false);
});

test("parseChatInput accepts only valid prior products", () => {
  const parsed = parseChatInput({
    message: "Hangisini almalıyım?",
    priorProducts: [
      {
        title: "Ayakkabı A",
        url: "https://example.com/a",
        priceTRY: 1_999,
        source: { title: "A", url: "https://example.com/a", domain: "example.com" },
        features: ["hafif"],
        retrievedAt: "2026-08-10T00:00:00.000Z",
      },
      { title: "Geçersiz", url: "javascript:alert(1)", priceTRY: 1_000 },
    ],
  });

  assert.equal(parsed.ok, true);
  if (parsed.ok) assert.equal(parsed.priorProducts.length, 1);
});