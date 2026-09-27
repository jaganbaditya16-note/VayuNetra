type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

type CacheStore = Map<string, CacheEntry<unknown>>;

const globalState = globalThis as typeof globalThis & {
  __vayunetraEnvironmentalCache?: CacheStore;
};

const cache: CacheStore =
  globalState.__vayunetraEnvironmentalCache ??
  new Map<string, CacheEntry<unknown>>();

globalState.__vayunetraEnvironmentalCache = cache;

function pruneExpired() {
  const now = Date.now();

  for (const [key, entry] of cache.entries()) {
    if (entry.expiresAt <= now) {
      cache.delete(key);
    }
  }
}

export function environmentalCacheKey(
  latitude: number,
  longitude: number,
) {
  return `env:${latitude.toFixed(4)}:${longitude.toFixed(4)}`;
}

export function getEnvironmentalCache<T>(key: string): T | null {
  pruneExpired();

  const entry = cache.get(key);

  if (!entry || entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }

  return entry.value as T;
}

export function setEnvironmentalCache<T>(
  key: string,
  value: T,
  ttlMs = 15 * 60_000,
) {
  cache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
}