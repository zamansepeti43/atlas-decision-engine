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
    source("Puma Anzarun Erkek Koşu Ayakkabısı", "https://merchant.example/urun/puma-anzarun", "Sepete ekle. Satış fiyatı: 2.199 TL. Stokta."),
    source("Asics Gel Contend Koşu Ayakkabısı", "https://seller.example/urun/asics-gel-contend", "Sepete ekle. Satış fiyatı: 2.399 TL. Stokta."),
    source("Reebok Energen Koşu Ayakkabısı", "https://retailer.example/urun/reebok-energen", "Sepete ekle. Satış fiyatı: 2.099 TL. Stokta."),
  ];
  const result = await searchProducts("primary", "backfill", async () => {
    attempts += 1;
    return { sources: listings, research: { requested: true, status: "completed", provider: "tavily", retrievedAt } };
  });

  assert.equal(attempts, 1);
  assert.equal(result.products.length, 5);
});

test("product search rejects listings that mismatch an explicitly requested brand", async () => {
  const result = await searchProducts("Samsung Galaxy A16 telefon", undefined, async () => ({
    sources: [source("Apple iPhone 16", "https://shop.example/urun/apple-iphone-16", "Sepete ekle. Satış fiyatı: 59.999 TL. Stokta.")],
    research: { requested: true, status: "completed", provider: "tavily", retrievedAt },
  }));

  assert.deepEqual(result.products, []);
});

test("product search rejects listings that mismatch an explicit model identifier", async () => {
  const result = await searchProducts("Samsung Galaxy A16 telefon", undefined, async () => ({
    sources: [
      source("Samsung Galaxy A14", "https://shop.example/urun/samsung-galaxy-a14", "Sepette 7.600 TL. Stokta."),
      source("Samsung Galaxy A16", "https://shop.example/urun/samsung-galaxy-a16", "Sepette 11.039,04 TL. Stokta."),
    ],
    research: { requested: true, status: "completed", provider: "tavily", retrievedAt },
  }));

  assert.equal(result.products.length, 1);
  assert.equal(result.products[0].title, "Samsung Galaxy A16");
});

test("product search honors an explicit brand constraint from the caller", async () => {
  const result = await searchProducts(
    "fren balatası satış fiyatı TL",
    undefined,
    async () => ({
      sources: [
        source("BMW Fren Balatası Seti", "https://shop.example/urun/bmw-balata", "Sepete ekle. Satış fiyatı: 2.400 TL. Stokta."),
        source("Mercedes Fren Balatası", "https://shop.example/urun/mercedes-balata", "Sepete ekle. Satış fiyatı: 2.800 TL. Stokta."),
      ],
      research: { requested: true, status: "completed", provider: "tavily", retrievedAt },
    }),
    { brand: "bmw" },
  );

  assert.equal(result.products.length, 1);
  assert.match(result.products[0].title, /BMW/i);
});

test("product search filters explicitly rejected brands", async () => {
  const result = await searchProducts(
    "telefon öner",
    undefined,
    async () => ({
      sources: [
        source("Samsung Galaxy A16", "https://shop.example/urun/samsung-galaxy-a16", "Sepete ekle. Satış fiyatı: 11.039 TL. Stokta."),
        source("Apple iPhone 16", "https://shop.example/urun/apple-iphone-16", "Sepete ekle. Satış fiyatı: 59.999 TL. Stokta."),
      ],
      research: { requested: true, status: "completed", provider: "tavily", retrievedAt },
    }),
    { excludeBrands: ["apple"] },
  );

  assert.equal(result.products.length, 1);
  assert.match(result.products[0].title, /Samsung/i);
});

test("product search keeps only results relevant to the requested category", async () => {
  const result = await searchProducts(
    "laptop öner",
    undefined,
    async () => ({
      sources: [
        source("Lenovo Legion 16 Laptop", "https://shop.example/urun/lenovo-legion-16", "Sepete ekle. Satış fiyatı: 29.999 TL. Stokta."),
        source("Babycim Piyanolu Oyun Halısı - Baykuş Desenli - Fiyatı, Yorumları", "https://shop.example/urun/babycim-hali", "Sepete ekle. Satış fiyatı: 1.999 TL. Stokta."),
      ],
      research: { requested: true, status: "completed", provider: "tavily", retrievedAt },
    }),
    { category: "laptop" },
  );

  assert.equal(result.products.length, 1);
  assert.match(result.products[0].title, /Lenovo/i);
});

test("product pages without a snippet price are offered to the merchant verifier", async () => {
  let verifiedUrl: string | undefined;
  const result = await searchProducts(
    "Puma Anzarun ayakkabı en uygun",
    undefined,
    async () => ({
      sources: [source("Puma Anzarun Lite Spor Ayakkabı", "https://shop.example/urun/puma-anzarun", "Ürün detayları ve beden seçenekleri")],
      research: { requested: true, status: "completed", provider: "tavily", retrievedAt },
    }),
    { brand: "puma", category: "ayakkabı" },
    async (candidate) => {
      verifiedUrl = candidate.url;
      return { ...candidate, priceTRY: 2_100, currency: "TRY", priceVerification: "merchant_page", priceVerifiedAt: retrievedAt };
    },
  );

  assert.equal(verifiedUrl, "https://shop.example/urun/puma-anzarun");
  assert.equal(result.products[0]?.priceTRY, 2_100);
});