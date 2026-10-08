import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Node >= 25 ships its own (file-backed) localStorage global that shadows jsdom's.
// Replace it with a simple in-memory Storage for tests.
class MemoryStorage implements Storage {
  private m = new Map<string, string>();
  get length() {
    return this.m.size;
  }
  clear() {
    this.m.clear();
  }
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
}
for (const name of ['localStorage', 'sessionStorage'] as const) {
  Object.defineProperty(globalThis, name, { configurable: true, value: new MemoryStorage() });
}

afterEach(() => cleanup());
