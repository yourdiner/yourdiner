/**
 * Shared sliding-window rate limiter for Edge middleware.
 *
 * Prefer Upstash Redis (UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN)
 * so limits are enforced across all serverless instances.
 * Falls back to in-memory when Redis is not configured (local/dev).
 * On Redis errors, fails open so auth still works.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type Bucket = { timestamps: number[] };

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

/** Cache Ratelimit instances by "limit:windowMs" so prefixes stay consistent. */
const upstashLimiters = new Map<string, Ratelimit>();

function pruneIfNeeded() {
  if (buckets.size <= MAX_BUCKETS) return;
  const excess = buckets.size - MAX_BUCKETS;
  let i = 0;
  for (const key of buckets.keys()) {
    buckets.delete(key);
    if (++i >= excess) break;
  }
}

function hasUpstashEnv(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim() &&
      process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  );
}

function getUpstashLimiter(limit: number, windowMs: number): Ratelimit | null {
  if (!hasUpstashEnv()) return null;

  const cacheKey = `${limit}:${windowMs}`;
  const existing = upstashLimiters.get(cacheKey);
  if (existing) return existing;

  const windowSec = Math.max(1, Math.ceil(windowMs / 1000));
  const limiter = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(limit, `${windowSec} s`),
    prefix: "cafe-pos:rl",
    analytics: false,
  });
  upstashLimiters.set(cacheKey, limiter);
  return limiter;
}

/** Sync in-memory limiter (single isolate). Kept for tests and local fallback. */
export function checkSlidingWindowLimit(input: {
  key: string;
  limit: number;
  windowMs: number;
  now?: number;
}): { allowed: boolean; retryAfterSec: number } {
  const now = input.now ?? Date.now();
  const windowStart = now - input.windowMs;
  let bucket = buckets.get(input.key);
  if (!bucket) {
    bucket = { timestamps: [] };
    buckets.set(input.key, bucket);
    pruneIfNeeded();
  }

  bucket.timestamps = bucket.timestamps.filter((t) => t > windowStart);

  if (bucket.timestamps.length >= input.limit) {
    const oldest = bucket.timestamps[0] ?? now;
    const retryAfterSec = Math.max(1, Math.ceil((oldest + input.windowMs - now) / 1000));
    return { allowed: false, retryAfterSec };
  }

  bucket.timestamps.push(now);
  return { allowed: true, retryAfterSec: 0 };
}

/**
 * Shared sliding-window check. Uses Upstash when configured; otherwise memory.
 * Same limits/semantics as {@link checkSlidingWindowLimit}.
 */
export async function checkSharedSlidingWindowLimit(input: {
  key: string;
  limit: number;
  windowMs: number;
  now?: number;
}): Promise<{ allowed: boolean; retryAfterSec: number }> {
  const limiter = getUpstashLimiter(input.limit, input.windowMs);
  if (!limiter) {
    return checkSlidingWindowLimit(input);
  }

  try {
    const result = await limiter.limit(input.key);
    if (result.success) {
      return { allowed: true, retryAfterSec: 0 };
    }
    const retryAfterSec = Math.max(
      1,
      Math.ceil((result.reset - Date.now()) / 1000)
    );
    return { allowed: false, retryAfterSec };
  } catch {
    // Redis unavailable — do not block legitimate logins
    return checkSlidingWindowLimit(input);
  }
}

/** Whether shared (Upstash) backend is active. */
export function isSharedRateLimitEnabled(): boolean {
  return hasUpstashEnv();
}

/** Client IP for rate limiting (best-effort behind proxies). */
export function getClientIpFromHeaders(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() || "unknown";
}
