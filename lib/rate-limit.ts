// Simple in-memory rate limiter (best-effort for serverless)
// Sliding window with fixed bucket granularity
// Note: In-memory cache resets per server instance; combine with s-maxage caching elsewhere.

export type RateLimitOptions = {
  windowMs: number; // e.g., 30_000
  max: number;      // e.g., 5 requests per window
};

type Entry = { count: number; expiresAt: number };

const buckets = new Map<string, Entry>();

export function rateLimit(key: string, opts: RateLimitOptions): {
  ok: boolean;
  remaining: number;
  retryAfterSec?: number;
} {
  const now = Date.now();
  const entry = buckets.get(key);
  if (!entry || entry.expiresAt <= now) {
    // start new window
    buckets.set(key, { count: 1, expiresAt: now + opts.windowMs });
    return { ok: true, remaining: opts.max - 1 };
  }
  if (entry.count < opts.max) {
    entry.count += 1;
    return { ok: true, remaining: opts.max - entry.count };
  }
  const retryAfterSec = Math.ceil((entry.expiresAt - now) / 1000);
  return { ok: false, remaining: 0, retryAfterSec };
}

export function getClientKey(req: Request, extra?: string) {
  const fwd = req.headers.get('x-forwarded-for') || '';
  const ip = fwd.split(',')[0].trim() || 'unknown';
  return extra ? `${ip}:${extra}` : ip;
}
