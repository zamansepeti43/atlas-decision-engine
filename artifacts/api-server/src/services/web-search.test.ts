import test from "node:test";
import assert from "node:assert/strict";
import { searchWeb } from "./web-search.js";

test("web search reports unavailable without an API key and returns no fake sources", async () => {
  const result = await searchWeb("güncel spor ayakkabı fiyatları", "");

  assert.equal(result.research.requested, true);
  assert.equal(result.research.status, "unavailable");
  assert.deepEqual(result.sources, []);
});

test("web search distinguishes provider authentication and rate-limit failures", async () => {
  const unauthorized = await searchWeb("test", "key", async () => new Response(null, { status: 401 }));
  assert.equal(unauthorized.research.status, "unavailable");
  assert.equal(unauthorized.research.httpStatus, 401);

  const rateLimited = await searchWeb("test", "key", async () => new Response(null, { status: 429 }));
  assert.equal(rateLimited.research.status, "failed");
  assert.equal(rateLimited.research.httpStatus, 429);
});

test("web search normalizes only HTTP sources returned by the provider", async () => {
  const providerPayload = {
    results: [
      { title: "Kaynak", url: "https://example.com/product", content: "Ürün 1.999 TL", published_date: "2026-08-10" },
      { title: "Geçersiz", url: "javascript:alert(1)", content: "ignore" },
    ],
  };
  const result = await searchWeb("test", "key", async () => new Response(JSON.stringify(providerPayload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  }));

  assert.equal(result.research.status, "completed");
  assert.equal(result.research.provider, "tavily");
  assert.equal(result.sources.length, 1);
  assert.equal(result.sources[0].url, "https://example.com/product");
  assert.ok(result.sources[0].retrievedAt);
});

test("web search forwards explicit domain constraints to Tavily", async () => {
  let requestBody: Record<string, unknown> = {};
  await searchWeb("test", "key", async (_url, init) => {
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(JSON.stringify({ results: [] }), { status: 200 });
  }, { includeDomains: ["shop.example"], excludeDomains: ["social.example"] });

  assert.deepEqual(requestBody.include_domains, ["shop.example"]);
  assert.deepEqual(requestBody.exclude_domains, ["social.example"]);
});