import test from "node:test";
import assert from "node:assert/strict";
import type { ProductResult } from "./chat-types.js";
import { canonicalizeProductUrl, extractMerchantPagePrice, verifyProductPrice } from "./price-verifier.js";

const product: ProductResult = {
  title: "Puma Anzarun Spor Ayakkabı",
  url: "https://shop.example/urun/puma-anzarun",
  priceTRY: 300,
  currency: "TRY",
  source: {
    title: "Puma Anzarun Spor Ayakkabı",
    url: "https://shop.example/urun/puma-anzarun",
    domain: "shop.example",
  },
  features: [],
  retrievedAt: "2026-09-05T00:00:00.000Z",
};

test("merchant structured price replaces a stale search snapshot price", async () => {
  const fetchImpl: typeof fetch = async () => new Response(
    '<html><script>window.data={"priceAmount":2500.00,"currencySymbol":"TL"}</script></html>',
    { status: 200, headers: { "content-type": "text/html" } },
  );

  const verified = await verifyProductPrice(product, fetchImpl);

  assert.equal(verified?.priceTRY, 2_500);
  assert.equal(verified?.priceVerification, "merchant_page");
  assert.ok(verified?.priceVerifiedAt);
});

test("unverifiable merchant pages do not retain the search snapshot price", async () => {
  const fetchImpl: typeof fetch = async () => new Response(
    "<html><body>Üyelere özel 300 TL avantaj.</body></html>",
    { status: 200, headers: { "content-type": "text/html" } },
  );

  assert.equal(await verifyProductPrice(product, fetchImpl), null);
  assert.equal(extractMerchantPagePrice("Satış fiyatı: 2.500 TL"), 2_500);
});

test("Amazon referral URLs are verified against their canonical path ASIN", () => {
  const url = canonicalizeProductUrl("https://www.amazon.com.tr/Puma/dp/B0FH23K5BH/ref=pd_sbs?pd_rd_i=B0FH27MWH7&psc=1");
  assert.equal(url, "https://www.amazon.com.tr/dp/B0FH23K5BH");
});
