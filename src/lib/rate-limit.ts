import { ApiError } from "./api";

type Bucket = { count: number; resetAt: number };

/**
 * In-memory fixed-window limiter. Adequate for a single instance; swap the
 * store for Redis before running more than one app process.
 */
const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, limit: number, windowMs: number): void {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    throw new ApiError("Too many requests. Please slow down and try again.", 429);
  }
}

/** Opportunistic cleanup so the map cannot grow without bound. */
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
}, 60_000).unref?.();
