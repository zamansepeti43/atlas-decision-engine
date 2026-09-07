export interface UserLocation {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
}

export interface NearbyMarket {
  id: string;
  name: string;
  brand?: string;
  latitude: number;
  longitude: number;
  address?: string;
  distanceMeters: number;
  source: "openstreetmap" | "google" | "merchant";
}

export interface NearbyPriceCandidate {
  market: NearbyMarket;
  productName: string;
  priceTRY: number;
  url?: string;
  retrievedAt: string;
  verification: "merchant_page" | "search_snapshot" | "unknown";
  isExactProduct: boolean;
}

export interface NearbyMarketSearchResult {
  markets: NearbyMarket[];
  provider: "openstreetmap" | "google";
  radiusMeters: number;
  searchedAt: string;
}

const DEFAULT_RADIUS_METERS = 1500;

function clampRadius(radiusMeters: number | undefined): number {
  if (!Number.isFinite(radiusMeters)) return DEFAULT_RADIUS_METERS;
  return Math.max(100, Math.min(5000, Math.round(radiusMeters!)));
}

function validCoordinate(value: number): boolean {
  return Number.isFinite(value);
}

export function validateUserLocation(location: UserLocation): void {
  if (!validCoordinate(location.latitude) || location.latitude < -90 || location.latitude > 90) {
    throw new Error("Geçerli bir enlem gerekli.");
  }
  if (!validCoordinate(location.longitude) || location.longitude < -180 || location.longitude > 180) {
    throw new Error("Geçerli bir boylam gerekli.");
  }
}

export function haversineDistanceMeters(a: UserLocation, b: Pick<NearbyMarket, "latitude" | "longitude">): number {
  const R = 6371000;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

function escapeOverpass(value: string): string {
  return value.replace(/[\\"\n\r]/g, "\\$&");
}

export async function searchNearbyOpenStreetMap(location: UserLocation, radiusMeters = DEFAULT_RADIUS_METERS): Promise<NearbyMarketSearchResult> {
  validateUserLocation(location);
  const radius = clampRadius(radiusMeters);
  const query = `[out:json][timeout:12];(nwr(around:${radius},${location.latitude},${location.longitude})[shop=supermarket];nwr(around:${radius},${location.latitude},${location.longitude})[shop=convenience];nwr(around:${radius},${location.latitude},${location.longitude})[name~"BİM|BIM|A101|ŞOK|SOK|MİGROS|MIGROS|CARREFOUR|FILE|HAKMAR|ONUR|TARIM KREDİ",i];);out center tags;`;
  const response = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
    body: `data=${encodeURIComponent(query)}`,
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`OpenStreetMap Overpass ${response.status} döndürdü.`);
  const data = (await response.json()) as { elements?: Array<Record<string, unknown>> };
  const markets: NearbyMarket[] = [];
  for (const element of data.elements ?? []) {
    const tags = (element.tags ?? {}) as Record<string, string>;
    const center = (element.center ?? {}) as Record<string, number>;
    const latitude = typeof element.lat === "number" ? element.lat : center.lat;
    const longitude = typeof element.lon === "number" ? element.lon : center.lon;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !tags.name) continue;
    markets.push({
      id: `osm-${String(element.type)}-${String(element.id)}`,
      name: tags.name,
      brand: tags.brand,
      latitude,
      longitude,
      address: [tags["addr:street"], tags["addr:housenumber"], tags["addr:district"]].filter(Boolean).join(" ") || undefined,
      distanceMeters: haversineDistanceMeters(location, { latitude, longitude }),
      source: "openstreetmap",
    });
  }
  return { markets: markets.sort((a, b) => a.distanceMeters - b.distanceMeters), provider: "openstreetmap", radiusMeters: radius, searchedAt: new Date().toISOString() };
}

export async function searchNearbyGoogle(location: UserLocation, radiusMeters = DEFAULT_RADIUS_METERS): Promise<NearbyMarketSearchResult> {
  validateUserLocation(location);
  const key = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!key) throw new Error("GOOGLE_MAPS_API_KEY yapılandırılmamış.");
  const radius = clampRadius(radiusMeters);
  const response = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location",
    },
    body: JSON.stringify({
      includedTypes: ["supermarket", "grocery_store", "convenience_store"],
      maxResultCount: 20,
      locationRestriction: { circle: { center: { latitude: location.latitude, longitude: location.longitude }, radius } },
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Google Places ${response.status} döndürdü.`);
  const data = (await response.json()) as { places?: Array<{ id?: string; displayName?: { text?: string }; formattedAddress?: string; location?: { latitude?: number; longitude?: number } }> };
  const markets = (data.places ?? []).flatMap((place): NearbyMarket[] => {
    const latitude = place.location?.latitude;
    const longitude = place.location?.longitude;
    if (!place.id || !place.displayName?.text || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
    return [{ id: `google-${place.id}`, name: place.displayName.text, latitude: latitude!, longitude: longitude!, address: place.formattedAddress, distanceMeters: haversineDistanceMeters(location, { latitude: latitude!, longitude: longitude: longitude! }), source: "google" }];
  }).sort((a, b) => a.distanceMeters - b.distanceMeters);
  return { markets, provider: "google", radiusMeters: radius, searchedAt: new Date().toISOString() };
}

export function dedupeMarkets(markets: NearbyMarket[]): NearbyMarket[] {
  const result: NearbyMarket[] = [];
  for (const market of [...markets].sort((a, b) => a.distanceMeters - b.distanceMeters)) {
    const duplicate = result.some((existing) => existing.name.toLowerCase() === market.name.toLowerCase() && existing.distanceMeters - market.distanceMeters < 75);
    if (!duplicate) result.push(market);
  }
  return result;
}

export function buildNearbyPriceAdvice(currentPriceTRY: number, currentProductName: string, candidates: NearbyPriceCandidate[]): string {
  const valid = candidates.filter((candidate) => Number.isFinite(candidate.priceTRY) && candidate.priceTRY > 0).sort((a, b) => a.priceTRY - b.priceTRY);
  if (!valid.length) return "Yakın çevrede doğrulanabilir alternatif fiyat bulamadım.";
  const best = valid[0];
  const saving = Math.round(currentPriceTRY - best.priceTRY);
  const distance = best.market.distanceMeters;
  const productLabel = best.isExactProduct ? "aynı ürün" : "benzer/alternatif ürün";
  if (saving > 0) return `${currentProductName} için ${distance} metre ileride ${best.market.name} mağazasında ${productLabel} ${best.priceTRY.toLocaleString("tr-TR")} TL görünüyor. Yaklaşık ${saving.toLocaleString("tr-TR")} TL daha ucuz. Mağaza içi fiyat ve stok değişebilir.`;
  return `Yakın çevrede ${best.market.name} mağazasında ${productLabel} ${best.priceTRY.toLocaleString("tr-TR")} TL görünüyor; mevcut ${currentPriceTRY.toLocaleString("tr-TR")} TL fiyatından daha ucuz değil. Mağaza içi fiyat ve stok değişebilir.`;
}

export function normalizeBrandName(name: string): string {
  return escapeOverpass(name.trim()).replace(/\s+/g, " ");
}
