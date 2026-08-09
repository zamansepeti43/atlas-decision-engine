import test from "node:test";
import assert from "node:assert/strict";
import { buildDecision, rankProducts } from "./decision-scoring.js";
import { normalizeProductResults } from "./product-normalizer.js";
import type { WebSource } from "./chat-types.js";

const retrievedAt = "2026-08-09T00:00:00.000Z";
const sources: WebSource[] = [
  { title: "Lenovo Legion 16 Laptop", url: "https://shop.example/product/lenovo-legion-16", snippet: "32 GB oyun laptop. Satış fiyatı: 29.999 TL. Stokta.", domain: "shop.example", retrievedAt },
  { title: "Dell XPS 13 Laptop", url: "https://store.example/urun/dell-xps-13", snippet: "Hafif bilgisayar. Sepette TRY 35,000.", domain: "store.example", retrievedAt },
  { title: "Laptop pazarı büyüyor", url: "https://news.example/report", snippet: "Sektör araştırma raporu yayımlandı.", domain: "news.example", retrievedAt },
];

test("normalization keeps only plausible products and explicit TRY prices", () => {
  const products = normalizeProductResults(sources);
  assert.equal(products.length, 2);
  assert.equal(products[0].priceTRY, 29_999);
  assert.equal(products[0].currency, "TRY");
  assert.equal(products[0].source.url, sources[0].url);
  assert.equal(products[0].retrievedAt, retrievedAt);
  assert.equal(products[1].priceTRY, 35_000);
  assert.equal("seller" in products[0], false);
  assert.equal("rating" in products[0], false);
});

test("ranking transparently favors available budget and textual use-case evidence", () => {
  const ranked = rankProducts(normalizeProductResults(sources), {
    budgetTRY: 30_000,
    preferences: ["oyun"],
    useCase: "oyun oynamak",
  });
  assert.equal(ranked[0].title, "Lenovo Legion 16 Laptop");
  assert.equal(ranked[0].scoreComponents.budgetFit, 35);
  assert.ok(ranked[0].scoreComponents.preferenceFit > 0);
  assert.ok(ranked[0].confidence > ranked[1].confidence);
  assert.equal(buildDecision(ranked)?.recommendedProductUrl, ranked[0].url);
  assert.equal(buildDecision(ranked)?.recommendation?.url, ranked[0].url);
});

test("missing price is never inferred or exposed as a grounded product", () => {
  const products = normalizeProductResults([{ ...sources[0], snippet: "32 GB oyun laptop modeli stokta." }]);
  assert.deepEqual(products, []);
});

test("categories, articles, forums, social media, videos, and price ranges remain sources only", () => {
  const rejected: WebSource[] = [
    { title: "Spor Ayakkabı Modelleri ve Fiyatları", url: "https://shop.example/spor-ayakkabi-x-c109", snippet: "900 TL - 2000 TL", domain: "shop.example", retrievedAt },
    { title: "2000 TL Altı Spor Ayakkabılar", url: "https://news.example/haber/shoes", snippet: "Nike ve Adidas önerileri", domain: "news.example", retrievedAt },
    { title: "2000-3000 TL bandında ayakkabı önerisi", url: "https://technopat.net/sosyal/konu/shoes", snippet: "Ürün tavsiyesi", domain: "technopat.net", retrievedAt },
    { title: "Ayakkabı önerileri", url: "https://instagram.com/reel/example", snippet: "2000 TL altında", domain: "instagram.com", retrievedAt },
    { title: "En rahat ayakkabılar", url: "https://youtube.com/watch?v=example", snippet: "5.000 TL seviyesinde", domain: "youtube.com", retrievedAt },
  ];
  assert.deepEqual(normalizeProductResults(rejected), []);
});

test("budget and range expressions are never parsed as product sale prices", () => {
  const rangeSources: WebSource[] = [
    { title: "Nike Revolution 7", url: "https://shop.example/product/nike-revolution-7", snippet: "Bütçe: 2000 TL altı. Stokta.", domain: "shop.example", retrievedAt },
    { title: "Adidas Runfalcon 3", url: "https://shop.example/product/adidas-runfalcon-3", snippet: "1.500-2.000 TL aralığında. Sepete ekle.", domain: "shop.example", retrievedAt },
  ];
  assert.deepEqual(normalizeProductResults(rangeSources), []);
});

test("installment amounts are never parsed as full product sale prices", () => {
  const installment: WebSource = {
    title: "Nike Revolution 7 Erkek Koşu Ayakkabısı",
    url: "https://shop.example/product/nike-revolution-7",
    snippet: "Peşin fiyatına 3 taksit 3x 1.257,98 TL. Son 1 ürün. 150 TL kupon fırsatı.",
    domain: "shop.example",
    retrievedAt,
  };
  assert.deepEqual(normalizeProductResults([installment]), []);
});