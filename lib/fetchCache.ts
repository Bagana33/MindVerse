/** Short-lived GET cache. Each caller receives an independently readable response. */
type CachedResponse = {
  body: ArrayBuffer;
  status: number;
  statusText: string;
  headers: [string, string][];
  timestamp: number;
};

const pendingRequests = new Map<string, Promise<CachedResponse>>();
const cache = new Map<string, CachedResponse>();
const CACHE_TTL = 15_000;
const REQUEST_TIMEOUT = 15_000;
const MAX_CACHE_ENTRIES = 60;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

function restoreResponse(entry: CachedResponse): Response {
  return new Response([204, 205, 304].includes(entry.status) ? null : entry.body.slice(0), {
    status: entry.status,
    statusText: entry.statusText,
    headers: entry.headers,
  });
}

export async function cachedFetch(url: string, options?: RequestInit): Promise<Response> {
  // Mutations and caller-controlled cancellation must retain native fetch semantics.
  if ((options?.method || 'GET').toUpperCase() !== 'GET' || options?.signal ||
      ['no-store', 'no-cache', 'reload'].includes(options?.cache || '')) {
    return fetch(url, options);
  }

  const headers = Array.from(new Headers(options?.headers).entries()).sort(([a], [b]) => a.localeCompare(b));
  const cacheKey = JSON.stringify([url, { ...options, method: 'GET', headers }]);
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return restoreResponse(cached);
  }
  cache.delete(cacheKey);

  const pending = pendingRequests.get(cacheKey);
  if (pending) return restoreResponse(await pending);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  const request = Promise.resolve().then(async () => {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const entry: CachedResponse = {
      body: await response.arrayBuffer(),
      status: response.status,
      statusText: response.statusText,
      headers: Array.from(response.headers.entries()),
      timestamp: Date.now(),
    };

    // A mutation or session change can invalidate a request while it is in flight.
    // Never let that older response overwrite the newly refreshed cache.
    if (pendingRequests.get(cacheKey) === request && response.ok &&
        !/\b(?:no-store|no-cache)\b/i.test(response.headers.get('cache-control') || '') &&
        entry.body.byteLength <= MAX_RESPONSE_BYTES) {
      for (const [key, value] of cache) {
        if (Date.now() - value.timestamp >= CACHE_TTL) cache.delete(key);
      }
      if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value!);
      cache.set(cacheKey, entry);
    }
    return entry;
  }).finally(() => {
    clearTimeout(timeout);
    if (pendingRequests.get(cacheKey) === request) pendingRequests.delete(cacheKey);
  });

  pendingRequests.set(cacheKey, request);
  return restoreResponse(await request);
}

export function invalidateCache(pattern: string): void {
  for (const key of cache.keys()) {
    if (key.includes(pattern)) cache.delete(key);
  }
  for (const key of pendingRequests.keys()) {
    if (key.includes(pattern)) pendingRequests.delete(key);
  }
}

export function clearCache(): void {
  cache.clear();
  pendingRequests.clear();
}
