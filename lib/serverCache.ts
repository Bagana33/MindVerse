// Per-instance memory cache: short TTLs bound staleness across serverless instances.
type CacheEntry<T> = { data: T; timestamp: number; ttlMs: number };
const cache = new Map<string, CacheEntry<unknown>>();
const pendingLoads = new Map<string, Promise<unknown>>();
const MAX_CACHE_ENTRIES = 250;

export function getCached<T>(key: string, ttlMs = 15_000): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp >= Math.min(entry.ttlMs, ttlMs)) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setCached<T>(key: string, data: T, ttlMs = 15_000): void {
  // Explicit writes take precedence over any older pending loader.
  pendingLoads.delete(key);
  const now = Date.now();
  for (const [cachedKey, entry] of cache) {
    if (now - entry.timestamp >= entry.ttlMs) cache.delete(cachedKey);
  }
  cache.delete(key);
  if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value!);
  if (ttlMs > 0) cache.set(key, { data, timestamp: now, ttlMs });
}

/** Share concurrent reads, but never restore data invalidated during the read. */
export async function getOrLoadCached<T>(key: string, loader: () => Promise<T>, ttlMs = 15_000): Promise<T> {
  const cached = getCached<T>(key, ttlMs);
  if (cached !== null) return cached;
  const pending = pendingLoads.get(key);
  if (pending) return pending as Promise<T>;

  const request = Promise.resolve().then(loader).then((data) => {
    if (pendingLoads.get(key) === request) setCached(key, data, ttlMs);
    return data;
  }).finally(() => {
    if (pendingLoads.get(key) === request) pendingLoads.delete(key);
  });
  pendingLoads.set(key, request);
  return request;
}

export function invalidateServerCache(prefix?: string): void {
  if (!prefix) {
    cache.clear();
    pendingLoads.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.includes(prefix)) {
      cache.delete(key);
    }
  }
  for (const key of pendingLoads.keys()) {
    if (key.includes(prefix)) pendingLoads.delete(key);
  }
}
