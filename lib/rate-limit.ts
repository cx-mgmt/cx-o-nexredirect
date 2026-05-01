// In-memory token bucket. Simple per-key sliding limit.

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of buckets.entries()) {
      if (v.resetAt < now) buckets.delete(k);
    }
  }, 60_000).unref?.();
}

export function checkLimit(key: string, limit: number, windowMs: number): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const cur = buckets.get(key);
  if (!cur || cur.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }
  cur.count++;
  if (cur.count > limit) {
    return { allowed: false, retryAfterSec: Math.ceil((cur.resetAt - now) / 1000) };
  }
  return { allowed: true };
}

export function resetLimit(key: string) {
  buckets.delete(key);
}
