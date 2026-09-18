/** Fixed-window, in-memory rate limiter keyed by client id. */
export class RateLimiter {
  private readonly windows = new Map<string, { start: number; count: number }>();

  constructor(private readonly opts: { limit: number; windowMs: number }) {}

  /** Records a hit. Returns seconds to wait if the client is over the limit, otherwise 0. */
  hit(key: string, now = Date.now()): number {
    const w = this.windows.get(key);
    if (!w || now - w.start >= this.opts.windowMs) {
      this.windows.set(key, { start: now, count: 1 });
      this.sweep(now);
      return 0;
    }
    w.count++;
    return w.count > this.opts.limit ? Math.ceil((w.start + this.opts.windowMs - now) / 1000) : 0;
  }

  private sweep(now: number) {
    if (this.windows.size < 10_000) return;
    for (const [key, w] of this.windows)
      if (now - w.start >= this.opts.windowMs) this.windows.delete(key);
  }
}
