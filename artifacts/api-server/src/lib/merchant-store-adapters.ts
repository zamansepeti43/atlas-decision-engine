import { searchWeb } from "../services/web-search.js";
import type { NearbyMarket, UserLocation } from "./local-market-runtime.js";

export type StoreStockStatus = "in_stock" | "out_of_stock" | "unknown";

export interface StoreProductSnapshot {
  merchant: string;
  storeId?: string;
  storeName: string;
  productName: string;
  productUrl: string;
  priceTRY?: number;
  stockStatus: StoreStockStatus;
  stockQuantity?: number;
  exactMatch: boolean;
  source: "official_store_feed" | "official_product_page";
  checkedAt: string;
}

export interface StoreAdapterContext {
  market: NearbyMarket;
  product: string;
  location: UserLocation;
}

export interface MerchantStoreAdapter {
  merchant: string;
  supports(market: NearbyMarket): boolean;
  lookup(context: StoreAdapterContext): Promise<StoreProductSnapshot[]>;
}

const MARKET_OFFICIAL_DOMAINS: Record<string, string[]> = {
  migros: ["migros.com.tr"],
  carrefoursa: ["carrefoursa.com"],
  carrefour: ["carrefoursa.com"],
  bim: ["bim.com.tr"],
  a101: ["a101.com.tr"],
  sok: ["sokmarket.com.tr"],
  file: ["file.com.tr"],
  hakmar: ["hakmar.com.tr"],
  onur: ["onurmarket.com"],
  "tarim kredi": ["tkkoop.com.tr"],
};

function normalizeText(value: string): string {
  return value.toLocaleLowerCase("tr-TR").replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c").replace(/[^a-z0-9]+/g, " ").trim();
}

function parsePrice(value: string): number | undefined {
  const cleaned = value.replace(/\s/g, "").replace(/₺|TL|TRY/gi, "");
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  const decimal = Math.max(lastComma, lastDot);
  const normalized = decimal >= 0 && cleaned.length - decimal - 1 === 2
    ? `${cleaned.slice(0, decimal).replace(/[.,]/g, "")}.${cleaned.slice(decimal + 1)}`
    : cleaned.replace(/[.,]/g, "");
  const price = Number(normalized);
  return Number.isFinite(price) && price > 0 ? price : undefined;
}

function inferOfficialAvailability(sourceText: string): StoreStockStatus {
  const text = normalizeText(sourceText);
  if (text.includes("gelince haber ver") || text.includes("tukendi") || text.includes("stokta yok")) return "out_of_stock";
  if (text.includes("sepete ekle") || text.includes("hemen al") || text.includes("siparis ver")) return "in_stock";
  return "unknown";
}

function inferPrice(sourceText: string): number | undefined {
  const matches = sourceText.match(/\b\d{1,5}(?:[.,]\d{2})?\s*(?:₺|TL|TRY)\b/gi) ?? [];
  return matches.map(parsePrice).find((value): value is number => value !== undefined);
}

function domainsForMarket(name: string): string[] {
  const normalized = normalizeText(name);
  const entry = Object.entries(MARKET_OFFICIAL_DOMAINS).find(([key]) => normalized.includes(key));
  return entry?.[1] ?? [];
}

async function officialMarketCatalogLookup(context: StoreAdapterContext, merchant: string): Promise<StoreProductSnapshot[]> {
  const domains = domainsForMarket(context.market.name);
  if (!domains.length) return [];
  const result = await searchWeb(`${context.product} fiyat`, process.env.TAVILY_API_KEY, fetch, {
    includeDomains: domains,
    searchDepth: "basic",
  });
  const checkedAt = new Date().toISOString();
  const query = normalizeText(context.product);
  return result.sources
    .filter((source) => domains.some((domain) => source.url.includes(domain)))
    .slice(0, 5)
    .map((source) => {
      const title = source.title || context.product;
      const text = `${source.title ?? ""} ${source.snippet ?? ""}`;
      return {
        merchant,
        storeName: context.market.name,
        productName: title,
        productUrl: source.url,
        priceTRY: inferPrice(text),
        // Branch stock is deliberately not inferred from an official web result.
        // The official product page is a price source, not proof of this branch's stock.
        stockStatus: "unknown" as const,
        exactMatch: normalizeText(title).includes(query) || query.includes(normalizeText(title)),
        source: "official_product_page" as const,
        checkedAt,
      };
    })
    .filter((item) => item.priceTRY !== undefined);
}

const supportedMerchants = [
  { merchant: "Migros", keys: ["migros"] },
  { merchant: "CarrefourSA", keys: ["carrefoursa", "carrefour"] },
  { merchant: "BİM", keys: ["bim"] },
  { merchant: "A101", keys: ["a101"] },
  { merchant: "ŞOK", keys: ["sok"] },
  { merchant: "File", keys: ["file"] },
  { merchant: "Hakmar", keys: ["hakmar"] },
  { merchant: "Onur Market", keys: ["onur"] },
  { merchant: "Tarım Kredi Kooperatif Market", keys: ["tarim kredi"] },
] as const;

export const merchantStoreAdapters: MerchantStoreAdapter[] = supportedMerchants.map(({ merchant, keys }) => ({
  merchant,
  supports: (market) => {
    const normalized = normalizeText(market.name);
    return keys.some((key) => normalized.includes(key));
  },
  lookup: (context) => officialMarketCatalogLookup(context, merchant),
}));

export async function lookupMerchantStoreProduct(context: StoreAdapterContext): Promise<StoreProductSnapshot[]> {
  const adapter = merchantStoreAdapters.find((candidate) => candidate.supports(context.market));
  return adapter ? adapter.lookup(context) : [];
}
