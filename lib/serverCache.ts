// High-performance Server-Side Memory Cache for Concurrent Users
type CacheEntry<T> = {
  data: T;
  timestamp: number;
  ttlMs: number;
};

const cache = new Map<string, CacheEntry<any>>();

// Periodic cleanup of stale cache entries
let lastPurge = Date.now();
function purgeExpired() {
  const now = Date.now();
  if (now - lastPurge < 30_000) return;
  lastPurge = now;
  for (const [key, entry] of cache.entries()) {
    if (now - entry.timestamp > entry.ttlMs) {
      cache.delete(key);
    }
  }
}

/**
 * Retrieve cached item if valid within TTL
 */
export function getCached<T>(key: string, ttlMs = 15_000): T | null {
  purgeExpired();
  const entry = cache.get(key);
  if (!entry) return null;
  const maxAge = entry.ttlMs || ttlMs;
  if (Date.now() - entry.timestamp > maxAge) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

/**
 * Store data in server memory with TTL
 */
export function setCached<T>(key: string, data: T, ttlMs = 15_000): void {
  cache.set(key, { data, timestamp: Date.now(), ttlMs });
}

/**
 * Invalidate cache by prefix or clear all
 */
export function invalidateServerCache(prefix?: string): void {
  if (!prefix) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.includes(prefix)) {
      cache.delete(key);
    }
  }
}

