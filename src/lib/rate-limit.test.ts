import { describe, expect, it } from "vitest";
import { RateLimiter } from "./rate-limit";

describe("RateLimiter", () => {
  it("allows up to the limit, then asks the client to wait until the window ends", () => {
    const limiter = new RateLimiter({ limit: 2, windowMs: 60_000 });
    expect(limiter.hit("a", 0)).toBe(0);
    expect(limiter.hit("a", 1_000)).toBe(0);
    expect(limiter.hit("a", 10_000)).toBe(50);
    expect(limiter.hit("b", 10_000)).toBe(0);
  });

  it("starts a new window after it expires", () => {
    const limiter = new RateLimiter({ limit: 1, windowMs: 1_000 });
    limiter.hit("a", 0);
    expect(limiter.hit("a", 500)).toBe(1);
    expect(limiter.hit("a", 1_000)).toBe(0);
  });
});
