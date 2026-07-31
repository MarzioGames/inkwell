import { TRPCError } from "@trpc/server";

/**
 * Simple in-memory rate limiter.
 *
 * Good enough for a single-process deployment. If you scale to multiple
 * server instances, swap the Map below for Redis (e.g. `INCR` + `EXPIRE`) so
 * limits are shared across processes — the `checkRateLimit` call sites don't
 * need to change, only this file.
 */

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

// Periodic cleanup so the Map doesn't grow forever with stale keys.
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}, CLEANUP_INTERVAL_MS).unref();

/**
 * Throws a TRPCError (TOO_MANY_REQUESTS) if `key` has been hit more than
 * `max` times within `windowMs`. Otherwise records the hit and returns.
 *
 * @param key unique identifier for what's being limited, e.g. `signup:${email}`
 *   or `post:${userId}`. Keep the action name inside the key so different
 *   actions don't share a bucket.
 */
export function checkRateLimit(key: string, max: number, windowMs: number): void {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  if (existing.count >= max) {
    const retryAfterSec = Math.ceil((existing.resetAt - now) / 1000);
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Muitas tentativas. Tente novamente em ${retryAfterSec}s.`,
    });
  }

  existing.count += 1;
}

/** Named limits used across the app, kept in one place for easy tuning. */
export const RATE_LIMITS = {
  createPost: { max: 10, windowMs: 60 * 60 * 1000 }, // 10 posts / hour / user
  createComment: { max: 30, windowMs: 30 * 60 * 1000 }, // 30 comments / 30min / user
  createListing: { max: 5, windowMs: 24 * 60 * 60 * 1000 }, // 5 anúncios / 24h / user
  createCheckout: { max: 10, windowMs: 60 * 60 * 1000 }, // 10 checkouts / hour / user
  createReport: { max: 20, windowMs: 60 * 60 * 1000 }, // 20 denúncias / hour / user
} as const;
