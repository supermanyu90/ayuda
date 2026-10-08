// Manual location search (locality, landmark, PIN code, city) via OpenStreetMap
// Nominatim. Server-side so we can set a proper User-Agent, cache results and
// respect Nominatim's 1 request/second policy.

export interface Place {
  label: string;
  lat: number;
  lng: number;
}

export class GeocoderUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeocoderUnavailableError';
  }
}

export interface Geocoder {
  search(query: string): Promise<Place[]>;
}

export class NominatimGeocoder implements Geocoder {
  private readonly cache = new Map<string, { at: number; places: Place[] }>();
  private nextSlot = 0;

  constructor(
    private readonly baseUrl: string,
    private readonly userAgent: string,
    private readonly countryCodes = '',
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly ttlMs = 24 * 3600_000,
  ) {}

  async search(query: string): Promise<Place[]> {
    const key = query.trim().toLowerCase();
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < this.ttlMs) return hit.places;

    // Serialise to at most one upstream request per second.
    const wait = Math.max(0, this.nextSlot - Date.now());
    this.nextSlot = Math.max(Date.now(), this.nextSlot) + 1000;
    if (wait) await new Promise((r) => setTimeout(r, wait));

    const url = new URL('/search', this.baseUrl);
    const params = new URLSearchParams({ q: query, format: 'jsonv2', limit: '5', addressdetails: '0' });
    if (this.countryCodes) params.set('countrycodes', this.countryCodes);
    url.search = params.toString();
    let res: Response;
    try {
      res = await this.fetchImpl(url, { headers: { 'user-agent': this.userAgent, 'accept-language': 'en' }, signal: AbortSignal.timeout(8000) });
    } catch {
      throw new GeocoderUnavailableError('Location search is unavailable');
    }
    if (!res.ok) throw new GeocoderUnavailableError(`Location search failed (HTTP ${res.status})`);
    const rows = (await res.json()) as { display_name?: unknown; lat?: unknown; lon?: unknown }[];
    const places = (Array.isArray(rows) ? rows : [])
      .map((r) => ({ label: String(r.display_name ?? '').slice(0, 200), lat: Number(r.lat), lng: Number(r.lon) }))
      .filter((p) => p.label && Number.isFinite(p.lat) && Number.isFinite(p.lng));
    if (this.cache.size > 1000) this.cache.clear();
    this.cache.set(key, { at: Date.now(), places });
    return places;
  }
}
