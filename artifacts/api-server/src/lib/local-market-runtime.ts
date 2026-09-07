export interface UserLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export interface NearbyMarket {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  address?: string;
  source: "google" | "osm";
}

function distanceMeters(a: UserLocation, b: { latitude: number; longitude: number }) {
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

export async function findNearbyMarkets(location: UserLocation, radiusMeters = 1000): Promise<NearbyMarket[]> {
  const googleKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (googleKey) {
    const response = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": googleKey,
        "X-Goog-FieldMask": "places.id,places.displayName,places.location,places.formattedAddress",
      },
      body: JSON.stringify({
        includedTypes: ["supermarket", "grocery_store", "convenience_store"],
        maxResultCount: 20,
        locationRestriction: { circle: { center: { latitude: location.latitude, longitude: location.longitude }, radius: radiusMeters } },
      }),
    });
    if (response.ok) {
      const data = (await response.json()) as { places?: Array<{ id?: string; displayName?: { text?: string }; location?: { latitude?: number; longitude?: number }; formattedAddress?: string }> };
      return (data.places ?? []).filter((p) => p.location?.latitude != null && p.location?.longitude != null).map((p) => ({
        id: p.id ?? `${p.location!.latitude}:${p.location!.longitude}`,
        name: p.displayName?.text ?? "Market",
        latitude: p.location!.latitude!,
        longitude: p.location!.longitude!,
        distanceMeters: distanceMeters(location, { latitude: p.location!.latitude!, longitude: p.location!.longitude! }),
        address: p.formattedAddress,
        source: "google" as const,
      })).sort((a, b) => a.distanceMeters - b.distanceMeters);
    }
  }

  const query = `[out:json][timeout:10];(nwr[shop~"^(supermarket|convenience|grocery)$"](around:${Math.min(radiusMeters, 5000)},${location.latitude},${location.longitude}););out center tags;`;
  const response = await fetch("https://overpass-api.de/api/interpreter", { method: "POST", headers: { "Content-Type": "text/plain" }, body: query });
  if (!response.ok) throw new Error("Yakındaki marketler alınamadı.");
  const data = (await response.json()) as { elements?: Array<{ id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }> };
  return (data.elements ?? []).map((item) => {
    const latitude = item.lat ?? item.center?.lat;
    const longitude = item.lon ?? item.center?.lon;
    return latitude == null || longitude == null ? null : {
      id: String(item.id), name: item.tags?.name ?? "Market", latitude, longitude,
      distanceMeters: distanceMeters(location, { latitude, longitude }),
      address: [item.tags?."addr:street", item.tags?."addr:housenumber", item.tags?."addr:city"].filter(Boolean).join(" ") || undefined,
      source: "osm" as const,
    };
  }).filter((x): x is NearbyMarket => Boolean(x)).sort((a, b) => a.distanceMeters - b.distanceMeters);
}

export async function compareNearbyProduct(product: string, location: UserLocation, radiusMeters = 1000) {
  const markets = await findNearbyMarkets(location, radiusMeters);
  return { product: product.trim(), markets, checkedAt: new Date().toISOString(), note: "Market konumu gerçek zamanlı; fiyatlar ayrıca canlı mağaza kaynağından doğrulanmalıdır." };
}
