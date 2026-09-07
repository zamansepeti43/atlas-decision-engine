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

const SHOK_DOMAINS = ["sokmarket.com.tr"];

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
  const matches = sourceText.match(/\b\d{1,4}(?:[.,]\d{2})?\s*(?:₺|TL)\b/gi) ?? [];
  const prices = matches.map(parsePrice).filter((value): value is number => value !== undefined);
  return prices[0];
}

async function officialShokCatalogLookup(context: StoreAdapterContext): Promise<StoreProductSnapshot[]> {
  const result = await searchWeb(`${context.product} site:sokmarket.com.tr`, process.env.TAVILY_API_KEY, fetch, {
    includeDomains: SHOK_DOMAINS,
    searchDepth: "advanced",
  });
  const checkedAt = new Date().toISOString();
  const query = normalizeText(context.product);
  return result.sources
    .filter((source) => source.url.includes("sokmarket.com.tr") && source.url.includes("-p-"))
    .slice(0, 5)
    .map((source) => {
      const title = source.title || context.product;
      const text = `${source.title ?? ""} ${source.snippet ?? ""}`;
      return {
        merchant: "ŞOK",
        storeName: context.market.name,
        productName: title,
        productUrl: source.url,
        priceTRY: inferPrice(text),
        stockStatus: inferOfficialAvailability(text),
        exactMatch: normalizeText(title).includes(query) || query.includes(normalizeText(title)),
        source: "official_product_page" as const,
        checkedAt,
      };
    });
}

async function configuredShokStoreFeed(context: StoreAdapterContext): Promise<StoreProductSnapshot[]> {
  const endpoint = process.env.ATLAS_SHOK_STORE_API_URL?.trim();
  if (!endpoint) return [];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const url = new URL(endpoint);
    url.searchParams.set("latitude", String(context.location.latitude));
    url.searchParams.set("longitude", String(context.location.longitude));
    url.searchParams.set("storeName", context.market.name);
    url.searchParams.set("product", context.product);
    const response = await fetch(url, { headers: { Accept: "application/json" }, signal: controller.signal });
    if (!response.ok) return [];
    const data = await response.json() as { products?: Array<{ storeId?: string; storeName?: string; productName: string; productUrl?: string; priceTRY?: number; stockStatus?: StoreStockStatus; stockQuantity?: number; exactMatch?: boolean }> };
    return (data.products ?? []).map((item) => ({
      merchant: "ŞOK",
      storeId: item.storeId,
      storeName: item.storeName ?? context.market.name,
      productName: item.productName,
      productUrl: item.productUrl ?? "https://www.sokmarket.com.tr/",
      priceTRY: item.priceTRY,
      stockStatus: item.stockStatus ?? "unknown",
      stockQuantity: item.stockQuantity,
      exactMatch: item.exactMatch ?? true,
      source: "official_store_feed" as const,
      checkedAt: new Date().toISOString(),
    }));
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

export const shokStoreAdapter: MerchantStoreAdapter = {
  merchant: "ŞOK",
  supports: (market) => normalizeText(market.name).includes("sok"),
  lookup: async (context) => {
    const liveStore = await configuredShokStoreFeed(context);
    if (liveStore.length) return liveStore;
    return officialShokCatalogLookup(context);
  },
};

export const merchantStoreAdapters: MerchantStoreAdapter[] = [shokStoreAdapter];

export async function lookupMerchantStoreProduct(context: StoreAdapterContext): Promise<StoreProductSnapshot[]> {
  const adapter = merchantStoreAdapters.find((candidate) => candidate.supports(context.market));
  return adapter ? adapter.lookup(context) : [];
}
