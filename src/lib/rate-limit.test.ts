import { describe, expect, it } from "vitest";
import {
  checkSharedSlidingWindowLimit,
  checkSlidingWindowLimit,
  isSharedRateLimitEnabled,
} from "@/lib/rate-limit";

describe("rate-limit memory fallback", () => {
  it("allows up to limit then blocks within the window", () => {
    const key = `test-mem:${Date.now()}-${Math.random()}`;
    const windowMs = 60_000;
    const limit = 5;
    const now = 1_700_000_000_000;

    for (let i = 0; i < limit; i++) {
      const result = checkSlidingWindowLimit({ key, limit, windowMs, now: now + i });
      expect(result.allowed).toBe(true);
    }

    const blocked = checkSlidingWindowLimit({
      key,
      limit,
      windowMs,
      now: now + limit,
    });
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThanOrEqual(1);
  });

  it("shared check matches memory when Upstash is not configured", async () => {
    expect(isSharedRateLimitEnabled()).toBe(false);
    const key = `test-shared:${Date.now()}-${Math.random()}`;
    const result = await checkSharedSlidingWindowLimit({
      key,
      limit: 3,
      windowMs: 60_000,
    });
    expect(result.allowed).toBe(true);
  });
});
