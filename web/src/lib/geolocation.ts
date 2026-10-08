export type GeoError = 'unsupported' | 'denied' | 'timeout' | 'unavailable';

export function getPosition(timeoutMs = 10_000): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject('unsupported' satisfies GeoError);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (e) => reject((e.code === e.PERMISSION_DENIED ? 'denied' : e.code === e.TIMEOUT ? 'timeout' : 'unavailable') satisfies GeoError),
      // Coarse accuracy is enough and faster; we round to ~110 m anyway.
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 5 * 60_000 },
    );
  });
}

export const GEO_MESSAGES: Record<GeoError, string> = {
  unsupported: "This browser can't share location. Search for your area instead.",
  denied: 'Location permission was declined. No problem: search for your area, landmark or PIN code instead.',
  timeout: 'Finding your location took too long. Search for your area instead, or try again.',
  unavailable: "Your location isn't available right now. Search for your area instead.",
};
