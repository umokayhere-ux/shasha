import { prisma } from "./db";
import { ApiError } from "./api";

/**
 * Database-backed fixed-window limiter.
 *
 * An in-memory map is worthless on serverless: each Vercel invocation may get a
 * fresh instance, so per-instance counters never accumulate and brute-force
 * protection silently disappears. Persisting the window in MongoDB makes the
 * limit hold across every instance.
 *
 * Fails OPEN — if the limiter itself errors we log and allow the request rather
 * than locking every customer out of the platform.
 */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<void> {
  const now = new Date();

  try {
    const existing = await prisma.rateLimit.findUnique({ where: { key } });

    if (!existing || existing.resetAt <= now) {
      const resetAt = new Date(now.getTime() + windowMs);
      await prisma.rateLimit.upsert({
        where: { key },
        create: { key, count: 1, resetAt },
        update: { count: 1, resetAt },
      });
      return;
    }

    const updated = await prisma.rateLimit.update({
      where: { key },
      data: { count: { increment: 1 } },
    });

    if (updated.count > limit) {
      throw new ApiError("Too many requests. Please slow down and try again.", 429);
    }
  } catch (err) {
    if (err instanceof ApiError) throw err;
    console.error("[rate-limit] check failed for %s, allowing request", key, err);
  }
}

/** Drops expired windows. Called from the scheduled cron route. */
export async function pruneRateLimits(): Promise<number> {
  const { count } = await prisma.rateLimit.deleteMany({
    where: { resetAt: { lt: new Date() } },
  });
  return count;
}
