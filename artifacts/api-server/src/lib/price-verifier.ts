import type { ProductResult } from "./chat-types.js";
import type { ProductCandidate } from "./product-normalizer.js";

const MAX_PAGE_BYTES = 3_000_000;
const PRICE_VALUE = "(\\d{1,3}(?:[.,]\\d{3})+(?:[.,]\\d{2})?|\\d{3,7}(?:[.,]\\d{2})?)";
const STRUCTURED_PRICE_PATTERNS = [
  new RegExp(`"priceAmount"\\s*:\\s*"?${PRICE_VALUE}`, "i"),
  new RegExp(`"displayPrice"\\s*:\\s*"${PRICE_VALUE}(?:\\s*(?:TL|TRY|₺))?`, "i"),
  new RegExp(`"price"\\s*:\\s*"?${PRICE_VALUE}"?\\s*,\\s*"priceCurrency"\\s*:\\s*"(?:TRY|TL)"`, "i"),
  new RegExp(`(?:tek seferlik satın alma|satış fiyatı|indirimli fiyat|sepette)\\s*:?\\s*${PRICE_VALUE}\\s*(?:TL|TRY|₺)`, "i"),
];

function parsePrice(raw: string): number | undefined {
  const lastDot = raw.lastIndexOf(".");
  const lastComma = raw.lastIndexOf(",");
  const decimalIndex = Math.max(lastDot, lastComma);
  const hasDecimal = decimalIndex >= 0 && raw.length - decimalIndex - 1 === 2;
  const normalized = hasDecimal
    ? `${raw.slice(0, decimalIndex).replace(/[.,]/g, "")}.${raw.slice(decimalIndex + 1)}`
    : raw.replace(/[.,]/g, "");
  const value = Number(normalized);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

export function extractMerchantPagePrice(html: string): number | undefined {
  for (const pattern of STRUCTURED_PRICE_PATTERNS) {
    const match = html.match(pattern);
    const raw = match?.[1];
    if (!raw) continue;
    const price = parsePrice(raw);
    if (price !== undefined) return price;
  }
  return undefined;
}

export type ProductPriceVerifier = (product: ProductCandidate) => Promise<ProductResult | null>;

interface MerchantPageResponse {
  ok: boolean;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}

type MerchantFetch = (
  url: string,
  options: {
    headers: Record<string, string>;
    redirect: "follow";
    signal: AbortSignal;
  },
) => Promise<MerchantPageResponse>;

export function canonicalizeProductUrl(value: string): string {
  const url = new URL(value);
  const amazonAsin = url.hostname.endsWith("amazon.com.tr")
    ? url.pathname.match(/\/dp\/([A-Z0-9]{10})(?:\/|$)/i)?.[1]
    : undefined;
  if (amazonAsin) {
    url.pathname = `/dp/${amazonAsin}`;
    url.search = "";
    url.hash = "";
  }
  return url.toString();
}

export async function verifyProductPrice(
  product: ProductCandidate,
  fetchImpl: MerchantFetch = fetch as unknown as MerchantFetch,
): Promise<ProductResult | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7_000);
  try {
    const verificationUrl = canonicalizeProductUrl(product.url);
    const response = await fetchImpl(verificationUrl, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "Mozilla/5.0 (compatible; AtlasPriceVerifier/1.0)",
      },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const contentLength = Number(response.headers.get("content-length") ?? 0);
    if (contentLength > MAX_PAGE_BYTES) return null;
    const html = (await response.text()).slice(0, MAX_PAGE_BYTES);
    const priceTRY = extractMerchantPagePrice(html);
    if (priceTRY === undefined) return null;
    const verifiedAt = new Date().toISOString();
    return {
      ...product,
      priceTRY,
      currency: "TRY",
      retrievedAt: verifiedAt,
      priceVerification: "merchant_page",
      priceVerifiedAt: verifiedAt,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
