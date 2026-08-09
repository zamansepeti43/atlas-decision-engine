import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import app from "../app.js";

let server: Server;
let baseUrl: string;

before(async () => {
  server = await new Promise<Server>((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

async function postChat(body: Record<string, unknown>) {
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() as Record<string, unknown> };
}

test("budgeted product research fails closed without a provider key", async () => {
  const result = await postChat({
    message: "Bugün 2000 TL altında rahat ve hafif spor ayakkabı bul.",
    history: [],
    memorySummary: "",
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);
  assert.equal(result.body.operation, "price_comparison");
  assert.deepEqual(result.body.products, []);
  assert.deepEqual(result.body.sources, []);
  assert.match(String(result.body.message), /güncel ürün, fiyat, mağaza veya kaynak doğrulayamıyorum/i);
  assert.doesNotMatch(String(result.body.message), /Nike|Adidas|\d+[.-]\d+\s*TL/i);
});

test("preference-only product statement records context without search", async () => {
  const result = await postChat({ message: "Ben hafif ayakkabı istiyorum.", history: [], memorySummary: "" });
  const research = result.body.research as Record<string, unknown>;
  const candidates = result.body.memoryCandidates as Array<Record<string, unknown>>;

  assert.equal(result.status, 200);
  assert.equal(result.body.operation, "respond");
  assert.equal(research.status, "not_requested");
  assert.ok(candidates.some((candidate) => candidate.key === "preference" && candidate.value === "hafif"));
  assert.doesNotMatch(String(result.body.message), /Nike|Adidas|\d+[.-]\d+\s*TL/i);
});

test("decision follow-up reuses only grounded prior products without a new search", async () => {
  const retrievedAt = "2026-08-10T00:00:00.000Z";
  const priorProducts = [
    {
      title: "Koşu Ayakkabısı A",
      url: "https://shop.example/a",
      priceTRY: 1899,
      source: { title: "A ürün sayfası", url: "https://shop.example/a", domain: "shop.example" },
      features: ["hafif", "rahat", "spor"],
      availability: "in_stock",
      retrievedAt,
    },
    {
      title: "Koşu Ayakkabısı B",
      url: "https://store.example/b",
      priceTRY: 1999,
      source: { title: "B ürün sayfası", url: "https://store.example/b", domain: "store.example" },
      features: ["spor"],
      availability: "in_stock",
      retrievedAt,
    },
  ];
  const history = [
    { role: "user", content: "Bugün 2000 TL altında rahat spor ayakkabı bul." },
    { role: "assistant", content: "İki doğrulanmış ürün bulundu." },
  ];

  for (const message of ["Hangisini almalıyım?", "Hangisini seçerdin?"]) {
    const result = await postChat({ message, history, memorySummary: "", priorProducts });
    const research = result.body.research as Record<string, unknown>;
    const decision = result.body.decision as Record<string, unknown>;

    assert.equal(result.status, 200, message);
    assert.equal(result.body.operation, "price_comparison", message);
    assert.equal(research.requested, false, message);
    assert.equal(research.status, "not_requested", message);
    assert.equal((result.body.products as unknown[]).length, 2, message);
    assert.equal((decision.recommendation as Record<string, unknown>).url, "https://shop.example/a", message);
    assert.match(String(result.body.message), /Benim önerim/i, message);
  }
});
