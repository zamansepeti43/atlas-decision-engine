import type { WebSource } from "./chat-types.js";
import { normalizeProductCandidates } from "./product-normalizer.js";
import { verifyProductPrice } from "./price-verifier.js";
import { searchWeb } from "../services/web-search.js";
import { lookupMerchantStoreProduct, type StoreProductSnapshot } from "./merchant-store-adapters.js";

export interface UserLocation { latitude: number; longitude: number; accuracy?: number; }
export interface NearbyMarket {
  id: string; name: string; latitude: number; longitude: number; distanceMeters: number; address?: string; source: "google" | "osm";
}
export interface NearbyPrice {
  market: NearbyMarket; productName: string; priceTRY: number; url: string; source: WebSource; retrievedAt: string; exactMatch: boolean; verification: "merchant_page" | "search_snapshot" | "official_store_feed"; stockStatus?: "in_stock" | "out_of_stock" | "unknown"; stockQuantity?: number; storeId?: string;
}

function distanceMeters(a: UserLocation, b: { latitude: number; longitude: number }) {
  const R = 6371000; const dLat = ((b.latitude - a.latitude) * Math.PI) / 180; const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180; const lat2 = (b.latitude * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

// Atlas only treats these supported chains as "market" comparison targets.
// Other grocery/supermarket businesses returned by Google/OSM are intentionally ignored.
const SUPPORTED_MARKET_KEYS = [
  "migros", "carrefoursa", "carrefour", "bim", "a101", "sok", "şok",
  "file", "hakmar", "onur", "tarim kredi", "tarım kredi",
];

const MARKET_DOMAINS: Record<string, string[]> = {
  migros: ["migros.com.tr"], "carrefoursa": ["carrefoursa.com"], "carrefour": ["carrefoursa.com"],
  bim: ["bim.com.tr"], a101: ["a101.com.tr"], "şok": ["sokmarket.com.tr"], "sok": ["sokmarket.com.tr"],
  file: ["file.com.tr"], hakmar: ["hakmar.com.tr"], onur: ["onurmarket.com"], "tarım kredi": ["tkkoop.com.tr"],
  "tarim kredi": ["tkkoop.com.tr"],
};

function normalizeMarketName(name: string): string {
  return name.toLocaleLowerCase("tr-TR").replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c").replace(/[^a-z0-9]+/g, " ").trim();
}

function isSupportedMarket(name: string): boolean {
  const normalized = normalizeMarketName(name);
  return SUPPORTED_MARKET_KEYS.some((key) => normalized.includes(normalizeMarketName(key)));
}

function marketDomains(name: string): string[] {
  const lower = normalizeMarketName(name);
  const hit = Object.entries(MARKET_DOMAINS).find(([key]) => lower.includes(normalizeMarketName(key)));
  return hit?.[1] ?? [];
}

export async function findNearbyMarkets(location: UserLocation, radiusMeters = 1000): Promise<NearbyMarket[]> {
  let markets: NearbyMarket[] = [];
  const googleKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (googleKey) {
    const response = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
      method: "POST", headers: { "Content-Type": "application/json", "X-Goog-Api-Key": googleKey, "X-Goog-FieldMask": "places.id,places.displayName,places.location,places.formattedAddress" },
      body: JSON.stringify({ includedTypes: ["supermarket", "grocery_store", "convenience_store"], maxResultCount: 20, locationRestriction: { circle: { center: { latitude: location.latitude, longitude: location.longitude }, radius: radiusMeters } } }),
    });
    if (response.ok) {
      const data = await response.json() as { places?: Array<{ id?: string; displayName?: { text?: string }; location?: { latitude?: number; longitude?: number }; formattedAddress?: string }> };
      markets = (data.places ?? []).filter((p) => p.location?.latitude != null && p.location?.longitude != null && isSupportedMarket(p.displayName?.text ?? "")).map((p) => ({ id: p.id ?? `${p.location!.latitude}:${p.location!.longitude}`, name: p.displayName?.text ?? "Market", latitude: p.location!.latitude!, longitude: p.location!.longitude!, distanceMeters: distanceMeters(location, { latitude: p.location!.latitude!, longitude: p.location!.longitude! }), address: p.formattedAddress, source: "google" as const }));
    }
  }
  if (!markets.length) {
    const query = `[out:json][timeout:10];(nwr[shop~"^(supermarket|convenience|grocery)$"](around:${Math.min(radiusMeters, 5000)},${location.latitude},${location.longitude}););out center tags;`;
    const response = await fetch("https://overpass-api.de/api/interpreter", { method: "POST", headers: { "Content-Type": "text/plain" }, body: query });
    if (!response.ok) throw new Error("Yakındaki marketler alınamadı.");
    const data = await response.json() as { elements?: Array<{ id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }> };
    markets = (data.elements ?? []).map((item) => { const latitude = item.lat ?? item.center?.lat; const longitude = item.lon ?? item.center?.lon; const name = item.tags?.name ?? "Market"; return latitude == null || longitude == null || !isSupportedMarket(name) ? null : { id: String(item.id), name, latitude, longitude, distanceMeters: distanceMeters(location, { latitude, longitude }), address: [item.tags?.["addr:street"], item.tags?.["addr:housenumber"], item.tags?.["addr:city"]].filter(Boolean).join(" ") || undefined, source: "osm" as const }; }).filter((x): x is NearbyMarket => Boolean(x));
  }
  return markets.sort((a, b) => a.distanceMeters - b.distanceMeters);
}

function snapshotToNearbyPrice(snapshot: StoreProductSnapshot, market: NearbyMarket, fallbackSource?: WebSource): NearbyPrice | null {
  if (snapshot.priceTRY === undefined) return null;
  return {
    market,
    productName: snapshot.productName,
    priceTRY: snapshot.priceTRY,
    url: snapshot.productUrl,
    source: fallbackSource ?? { url: snapshot.productUrl, title: snapshot.productName, domain: marketDomains(market.name)[0] ?? "" },
    retrievedAt: snapshot.checkedAt,
    exactMatch: snapshot.exactMatch,
    verification: snapshot.source === "official_store_feed" ? "official_store_feed" : "merchant_page",
    stockStatus: snapshot.stockStatus,
    stockQuantity: snapshot.stockQuantity,
    storeId: snapshot.storeId,
  };
}

export async function compareNearbyProduct(product: string, location: UserLocation, radiusMeters = 1000) {
  const markets = await findNearbyMarkets(location, radiusMeters);
  const searchable = markets.filter((market) => marketDomains(market.name).length).slice(0, 10);
  const priceResults = await Promise.all(searchable.map(async (market): Promise<NearbyPrice[]> => {
    try {
      const storeSnapshots = await lookupMerchantStoreProduct({ market, product, location });
      const official = storeSnapshots.map((snapshot) => snapshotToNearbyPrice(snapshot, market)).filter((item): item is NearbyPrice => Boolean(item));
      if (official.length) return official;
    } catch (error) {
      console.warn(`[Atlas AI] official market lookup failed for ${market.name}`, error);
    }

    const domains = marketDomains(market.name);
    const result = await searchWeb(`${product} fiyat`, process.env.TAVILY_API_KEY, fetch, { includeDomains: domains, searchDepth: "basic" });
    const candidates = normalizeProductCandidates(result.sources, undefined, []);
    const verified = await Promise.all(candidates.map((candidate) => verifyProductPrice(candidate)));
    return verified.filter(Boolean).map((item) => ({ market, productName: item!.title, priceTRY: item!.priceTRY, url: item!.url, source: result.sources.find((source) => source.url === item!.url) ?? result.sources[0], retrievedAt: item!.retrievedAt, exactMatch: item!.title.toLowerCase().includes(product.toLowerCase()), verification: item!.priceVerification === "merchant_page" ? "merchant_page" as const : "search_snapshot" as const, stockStatus: "unknown" as const }));
  }));
  const prices = priceResults.flat().sort((a, b) => a.priceTRY - b.priceTRY);
  const inStock = prices.filter((price) => price.stockStatus === "in_stock");
  return {
    product: product.trim(),
    markets,
    prices,
    inStock,
    checkedAt: new Date().toISOString(),
    note: "Atlas yalnızca desteklenen zincir marketleri karşılaştırır. Fiyat için ilgili marketin resmî sitesini/ürün sayfasını kullanır. Şube bazlı canlı stok veya şube fiyatı doğrulanmadıkça bunları kesin kabul etmez; yakın şube yalnızca mesafe bilgisi olarak gösterilir.",
  };
}
