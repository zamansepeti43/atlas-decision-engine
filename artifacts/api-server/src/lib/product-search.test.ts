import test from "node:test";
import assert from "node:assert/strict";
import type { WebSource } from "./chat-types.js";
import { searchProducts } from "./product-search.js";
import type { WebSearchOptions } from "../services/web-search.js";

const retrievedAt = "2026-08-10T00:00:00.000Z";

function source(title: string, url: string, snippet: string): WebSource {
  return { title, url, snippet, domain: new URL(url).hostname, retrievedAt };
}

test("product search backfills once when the primary result has no grounded listings", async () => {
  const queries: string[] = [];
  const options: Array<WebSearchOptions | undefined> = [];
  const result = await searchProducts("primary", "backfill", async (query, searchOptions) => {
    queries.push(query);
    options.push(searchOptions);
    return query === "primary"
      ? {
          sources: [source("Spor Ayakkabı Modelleri ve Fiyatları", "https://shop.example/kategori", "Genel kategori")],
          research: { requested: true, status: "completed", provider: "tavily", retrievedAt },
        }
      : {
          sources: [source("Nike Run Defy Erkek Koşu Ayakkabısı", "https://shop.example/urun/nike-run-defy", "Sepete ekle. Satış fiyatı: 1.899 TL. Stokta.")],
          research: { requested: true, status: "completed", provider: "tavily", retrievedAt },
        };
  });

  assert.deepEqual(queries, ["primary", "backfill"]);
  assert.ok(options[0]?.excludeDomains);
  assert.ok(options[1]?.includeDomains);
  assert.equal(result.sources.length, 2);
  assert.equal(result.products.length, 1);
  assert.equal(result.products[0].priceTRY, 1_899);
});

test("product search stops after the primary result has enough grounded listings", async () => {
  let attempts = 0;
  const listings = [
    source("Nike Run Defy Erkek Koşu Ayakkabısı", "https://shop.example/urun/nike-run-defy", "Sepete ekle. Satış fiyatı: 1.899 TL. Stokta."),
    source("Adidas Duramo Erkek Koşu Ayakkabısı", "https://store.example/urun/adidas-duramo", "Sepete ekle. Satış fiyatı: 1.999 TL. Stokta."),
  ];
  const result = await searchProducts("primary", "backfill", async () => {
    attempts += 1;
    return { sources: listings, research: { requested: true, status: "completed", provider: "tavily", retrievedAt } };
  });

  assert.equal(attempts, 1);
  assert.equal(result.products.length, 2);
});