// Per-device conveniences only. Every access is guarded: storage can be
// unavailable (private mode, blocked site data) and the app must still work.

export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: ignore */
  }
}

export function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
