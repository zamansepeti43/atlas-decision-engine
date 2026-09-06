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
    domain: "genel",
    budgetTRY: 30_000,
    preferences: ["oyun"],
    useCase: "oyun oynamak",
    excludedBrands: [],
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
    { title: "Paten Ayakkabı Al", url: "https://www.trendyol.com/paten-ayakkabi-y-s28913", snippet: "Sepete ekle 1.978,02 TL", domain: "trendyol.com", retrievedAt },
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

test("promotional savings and add-on service fees are never parsed as sale prices", () => {
  const nonSaleAmounts: WebSource[] = [
    { title: "Samsung Galaxy A16", url: "https://shop.example/urun/samsung-galaxy-a16", snippet: "8.500 TL'ye varan kazançla eski telefonunu yenile.", domain: "shop.example", retrievedAt },
    { title: "Samsung Galaxy A16", url: "https://shop.example/urun/samsung-galaxy-a16", snippet: "Ek Hizmetler. 1 Yıl Ek Garanti. 334 TL. 2 ay ücretsiz Premium.", domain: "shop.example", retrievedAt },
    { title: "Puma Anzarun Spor Ayakkabı", url: "https://shop.example/urun/puma-anzarun", snippet: "Üyelere özel 300 TL avantaj. Ürünü hemen inceleyin.", domain: "shop.example", retrievedAt },
  ];
  assert.deepEqual(normalizeProductResults(nonSaleAmounts), []);
});

test("a sole amount on an exact product page can be retained as snapshot evidence", () => {
  const result = normalizeProductResults([
    { title: "Puma Anzarun Lite Spor Ayakkabı", url: "https://shop.example/urun/puma-anzarun", snippet: "1.958,26 TL", domain: "shop.example", retrievedAt },
  ]);

  assert.equal(result[0]?.priceTRY, 1_958.26);
});

test("ranking excludes brands the user explicitly rejected even if the search let them through", () => {
  const withApple: WebSource[] = [
    { title: "Apple iPhone 16", url: "https://shop.example/product/apple-iphone-16", snippet: "Telefon. Satış fiyatı: 59.999 TL. Stokta.", domain: "shop.example", retrievedAt },
    { title: "Samsung Galaxy A16", url: "https://store.example/urun/samsung-galaxy-a16", snippet: "Telefon. Satış fiyatı: 11.039 TL. Stokta.", domain: "store.example", retrievedAt },
  ];
  const ranked = rankProducts(normalizeProductResults(withApple), {
    domain: "teknoloji",
    preferences: [],
    excludedBrands: ["apple"],
  });

  assert.equal(ranked.length, 1);
  assert.match(ranked[0].title, /Samsung/i);
});

test("ranking drops products irrelevant to the requested category before scoring", () => {
  const mixed: WebSource[] = [
    { title: "Lenovo Legion 16 Laptop", url: "https://shop.example/product/lenovo-legion-16", snippet: "32 GB oyun laptop. Satış fiyatı: 29.999 TL. Stokta.", domain: "shop.example", retrievedAt },
    { title: "Babycim Piyanolu Oyun Halısı - Baykuş Desenli - Fiyatı, Yorumları", url: "https://shop.example/urun/babycim-hali", snippet: "Sepete ekle. Satış fiyatı: 1.999 TL. Stokta.", domain: "shop.example", retrievedAt },
  ];
  const ranked = rankProducts(normalizeProductResults(mixed), {
    domain: "teknoloji",
    category: "laptop",
    preferences: [],
    excludedBrands: [],
  });

  assert.equal(ranked.length, 1);
  assert.match(ranked[0].title, /Lenovo/i);
});

  test("price comparison recommends the cheapest verified listing for the same product", () => {
    const products = normalizeProductResults([
      { title: "Puma Anzarun Lite", url: "https://first.example/urun/puma-anzarun", snippet: "Satış fiyatı: 2.500 TL", domain: "first.example", retrievedAt },
      { title: "Puma Anzarun Lite", url: "https://second.example/urun/puma-anzarun", snippet: "Satış fiyatı: 2.200 TL", domain: "second.example", retrievedAt },
    ]).map((product) => ({ ...product, priceVerification: "merchant_page" as const }));

    const ranked = rankProducts(products, {
      domain: "genel",
      preferences: [],
      excludedBrands: [],
    }, { pricePriority: true });
    const decision = buildDecision(ranked, { pricePriority: true });

    assert.equal(ranked[0].priceTRY, 2_200);
    assert.equal(decision?.recommendation?.source.domain, "second.example");
    assert.match(decision?.summary ?? "", /300 TL daha uygun/);
  });