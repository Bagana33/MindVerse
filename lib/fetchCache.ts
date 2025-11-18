/**
 * Simple in-memory fetch cache with deduplication
 * Prevents multiple simultaneous requests to the same endpoint
 */

const pendingRequests = new Map<string, Promise<any>>();
const cache = new Map<string, { data: any; timestamp: number }>();

const CACHE_TTL = 15000; // 15 seconds for client-side cache

export async function cachedFetch(url: string, options?: RequestInit): Promise<Response> {
  const cacheKey = `${url}:${JSON.stringify(options || {})}`;
  
  // Check if request is already pending
  if (pendingRequests.has(cacheKey)) {
    const data = await pendingRequests.get(cacheKey);
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Check in-memory cache
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return new Response(JSON.stringify(cached.data), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Create new request
  const promise = fetch(url, options)
    .then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      
      // Store in cache
      cache.set(cacheKey, { data, timestamp: Date.now() });
      
      // Remove from pending
      pendingRequests.delete(cacheKey);
      
      return data;
    })
    .catch((err) => {
      pendingRequests.delete(cacheKey);
      throw err;
    });

  pendingRequests.set(cacheKey, promise);
  
  const data = await promise;
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Clear cache for specific URL pattern
 */
export function invalidateCache(pattern: string) {
  for (const key of cache.keys()) {
    if (key.includes(pattern)) {
      cache.delete(key);
    }
  }
}

/**
 * Clear all cache
 */
export function clearCache() {
  cache.clear();
  pendingRequests.clear();
}
