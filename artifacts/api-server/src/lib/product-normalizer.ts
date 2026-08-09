import type { ProductResult, WebSource } from "./chat-types.js";

const REJECTED_DOMAIN = /(^|\.)(youtube\.com|youtu\.be|instagram\.com|facebook\.com|tiktok\.com|twitter\.com|x\.com|reddit\.com|onedio\.com|technopat\.net)$/i;
const REJECTED_PATH = /\/(haber|blog|forum|sosyal|reel|watch|kategori|category)(\/|$)|-x-c\d+(?:\?|$)|\/c-\d+(?:\?|$)/i;
const GENERIC_TITLE = /(modelleri|markaları|fiyatları|en ucuzu|önerileri|önerisi|tavsiye|\baltı\b|altında|bandında|listesi|karşılaştırma|rehberi|kampanyaları)/i;
const LISTING_URL = /(?:-p-\d+|\/dp\/[A-Z0-9]+|\/gp\/product\/|-[pm]-[A-Z0-9]+|\/product\/|\/urun\/|\/products?\/|\/p\/)/i;
const LISTING_EVIDENCE = /(sepete ekle|satın al|stokta|stok mevcut|ürün kodu|model no|sku)/i;
const SALE_PRICE_CONTEXT = /(satış fiyatı|indirimli fiyat|sepette|fiyatı?\s*:|şimdi\s+sadece|bugüne özel)/i;
const RANGE_OR_BUDGET_CONTEXT = /(\baltı\b|altında|\büstü\b|üzerinde|bandında|aralığında|bütçe|\d[\d.,]*\s*(?:TL|TRY|₺)?\s*[-–—]\s*\d)/i;
const NON_SALE_AMOUNT_CONTEXT = /(taksit|\d+\s*x\s*\d|kupon|indirim kodu|kargo|puan)/i;
const KNOWN_BRANDS = ["adidas", "nike", "puma", "skechers", "new balance", "asics", "reebok", "under armour", "vans", "hoka", "apple", "samsung", "xiaomi", "lenovo", "dell", "asus", "acer", "sony", "philips"];
const FEATURE_TERMS = ["hafif", "rahat", "konfor", "koşu", "spor", "günlük", "oyun", "nefes alabilir", "su geçirmez", "dayanıklı"];
const PRICE_PATTERN = /(?:TRY|TL|₺)\s*(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?|\d{3,7}(?:[.,]\d{2})?)|(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?|\d{3,7}(?:[.,]\d{2})?)\s*(?:TRY|TL|₺)/gi;

function parseNumber(raw: string): number | undefined {

  const lastDot = raw.lastIndexOf(".");
  const lastComma = raw.lastIndexOf(",");
  const decimalIndex = Math.max(lastDot, lastComma);
  const hasDecimal = decimalIndex >= 0 && raw.length - decimalIndex - 1 === 2;
  const normalized = hasDecimal
    ? `${raw.slice(0, decimalIndex).replace(/[.,]/g, "")}.${raw.slice(decimalIndex + 1)}`
    : raw.replace(/[.,]/g, "");
  const price = Number(normalized);
  return Number.isFinite(price) && price > 0 ? price : undefined;
}

function parseSalePrice(text: string, listingUrl: boolean): number | undefined {
  for (const match of text.matchAll(PRICE_PATTERN)) {
    const raw = match[1] ?? match[2];
    if (!raw || match.index === undefined) continue;
    const context = text.slice(Math.max(0, match.index - 60), match.index + match[0].length + 60);
    if (RANGE_OR_BUDGET_CONTEXT.test(context) || NON_SALE_AMOUNT_CONTEXT.test(context)) continue;
    if (!listingUrl && !SALE_PRICE_CONTEXT.test(context)) continue;
    const price = parseNumber(raw);
    if (price !== undefined) return price;
  }
  return undefined;
}

function productIdentity(title: string): { brand?: string; model?: string } {
  const cleanTitle = title.split(/\s[|–—-]\s/)[0].trim();
  const lower = cleanTitle.toLocaleLowerCase("tr-TR");
  const brand = KNOWN_BRANDS.find((candidate) => lower.includes(candidate));
  if (!brand) return {};
  const brandIndex = lower.indexOf(brand);
  const model = cleanTitle.slice(brandIndex + brand.length).trim();
  return {
    brand: cleanTitle.slice(brandIndex, brandIndex + brand.length),
    ...(model.length >= 2 && { model }),
  };
}

export function normalizeProductResults(sources: WebSource[]): ProductResult[] {
  return sources.flatMap((source): ProductResult[] => {
    let url: URL;
    try {
      url = new URL(source.url);
    } catch {
      return [];
    }
    if (REJECTED_DOMAIN.test(source.domain) || REJECTED_PATH.test(`${url.pathname}${url.search}`) || GENERIC_TITLE.test(source.title)) return [];
    const evidence = `${source.title} ${source.snippet}`;
    const listingUrl = LISTING_URL.test(url.pathname);
    if (!listingUrl && !LISTING_EVIDENCE.test(evidence)) return [];
    const priceTRY = parseSalePrice(evidence, listingUrl);
    if (priceTRY === undefined) return [];
    const lowerEvidence = evidence.toLocaleLowerCase("tr-TR");
    const features = FEATURE_TERMS.filter((term) => lowerEvidence.includes(term));
    const identity = productIdentity(source.title);
    const availability = /stokta yok|stok dışı|tükendi/i.test(evidence)
      ? "out_of_stock" as const
      : /stokta|stok mevcut|sepete ekle/i.test(evidence)
        ? "in_stock" as const
        : undefined;
    return [{
      title: source.title,
      ...identity,
      url: source.url,
      priceTRY,
      currency: "TRY",
      source: { title: source.title, url: source.url, domain: source.domain },
      features,
      ...(availability && { availability }),
      retrievedAt: source.retrievedAt,
    }];
  });
}