const LOCATION_CACHE_KEY = "atlas-location-context";
const LOCATION_CACHE_MAX_AGE_MS = 5 * 60 * 1000;

export interface AtlasBrowserLocation { latitude: number; longitude: number; accuracy: number; }

export async function getAtlasBrowserLocation(): Promise<AtlasBrowserLocation | null> {
  if (typeof window === "undefined" || !navigator.geolocation) return null;
  try {
    const cached = window.sessionStorage.getItem(LOCATION_CACHE_KEY);
    if (cached) {
      const value = JSON.parse(cached) as AtlasBrowserLocation & { savedAt: number };
      if (Number.isFinite(value.savedAt) && Date.now() - value.savedAt < LOCATION_CACHE_MAX_AGE_MS) return value;
    }
  } catch { /* ignore invalid cache */ }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const value: AtlasBrowserLocation & { savedAt: number } = { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy, savedAt: Date.now() };
        try { window.sessionStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify(value)); } catch { /* ignore storage errors */ }
        resolve(value);
      },
      () => resolve(null),
      { enableHighAccuracy: false, maximumAge: LOCATION_CACHE_MAX_AGE_MS, timeout: 5000 },
    );
  });
}

export function appendAtlasLocationTag(message: string, location: AtlasBrowserLocation | null): string {
  if (!location) return message;
  return `${message} [ATLAS_LOCATION:${location.latitude.toFixed(6)},${location.longitude.toFixed(6)},${Math.round(location.accuracy)}]`;
}
