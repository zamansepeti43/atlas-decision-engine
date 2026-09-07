import test from "node:test";
import assert from "node:assert/strict";
import { searchWeb } from "./web-search.js";

test("web search reports unavailable when cloud search is empty and Tavily is not configured", async () => {
  const result = await searchWeb("güncel spor ayakkabı fiyatları", "", async () => new Response(JSON.stringify({ results: [] }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  }));

  assert.equal(result.research.requested, true);
  assert.equal(result.research.status, "unavailable");
  assert.deepEqual(result.sources, []);
});

test("web search falls back to Tavily on SearXNG failure", async () => {
  const unauthorized = await searchWeb("test", "key", async (url) => {
    if (String(url).includes("api.tavily.com")) return new Response(null, { status: 401 });
    return new Response(null, { status: 503 });
  });
  assert.equal(unauthorized.research.status, "unavailable");
  assert.equal(unauthorized.research.httpStatus, 401);
  assert.equal(unauthorized.research.provider, "tavily");

  const rateLimited = await searchWeb("test", "key", async (url) => {
    if (String(url).includes("api.tavily.com")) return new Response(null, { status: 429 });
    return new Response(null, { status: 503 });
  });
  assert.equal(rateLimited.research.status, "failed");
  assert.equal(rateLimited.research.httpStatus, 429);
  assert.equal(rateLimited.research.provider, "tavily");
});

test("web search normalizes SearXNG sources and filters non-HTTP URLs", async () => {
  const providerPayload = {
    results: [
      { title: "Kaynak", url: "https://example.com/product", content: "Ürün 1.999 TL", publishedDate: "2026-08-10" },
      { title: "Geçersiz", url: "javascript:alert(1)", content: "ignore" },
    ],
  };
  const result = await searchWeb("test", "", async () => new Response(JSON.stringify(providerPayload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  }));

  assert.equal(result.research.status, "completed");
  assert.equal(result.research.provider, "searxng");
  assert.equal(result.sources.length, 1);
  assert.equal(result.sources[0].url, "https://example.com/product");
  assert.ok(result.sources[0].retrievedAt);
});

test("web search applies explicit domain constraints to SearXNG results", async () => {
  const result = await searchWeb("test", "", async () => new Response(JSON.stringify({
    results: [
      { title: "Allowed", url: "https://shop.example/product", content: "ok" },
      { title: "Blocked", url: "https://social.example/post", content: "no" },
    ],
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  }), { includeDomains: ["shop.example"], excludeDomains: ["social.example"], searchDepth: "advanced" });

  assert.equal(result.sources.length, 1);
  assert.equal(result.sources[0].domain, "shop.example");
});

test("web search forwards Tavily constraints when it is used as the fallback", async () => {
  let requestBody: Record<string, unknown> = {};
  await searchWeb("test", "key", async (url, init) => {
    if (String(url).includes("api.tavily.com")) {
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(JSON.stringify({ results: [] }), { status: 200 });
    }
    return new Response(JSON.stringify({ results: [] }), { status: 200 });
  }, { includeDomains: ["shop.example"], excludeDomains: ["social.example"], searchDepth: "advanced" });

  assert.deepEqual(requestBody.include_domains, ["shop.example"]);
  assert.deepEqual(requestBody.exclude_domains, ["social.example"]);
  assert.equal(requestBody.search_depth, "advanced");
});
