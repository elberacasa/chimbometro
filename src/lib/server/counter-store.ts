/**
 * Counters with expiry, shared by the rate limits and the daily spend cap. Production uses
 * Upstash Redis over REST (no client library, works on serverless); development and tests use
 * memory.
 */
export interface CounterStore {
  /** Adds `by` to `key` and returns the new total. The key expires `ttlSeconds` after first use. */
  increment(key: string, by: number, ttlSeconds: number): Promise<number>;
  get(key: string): Promise<number>;
}

export class MemoryStore implements CounterStore {
  private readonly counters = new Map<string, { value: number; expires: number }>();

  constructor(private readonly now: () => number = Date.now) {}

  async increment(key: string, by: number, ttlSeconds: number) {
    const now = this.now();
    const current = this.counters.get(key);
    const entry =
      current && current.expires > now ? current : { value: 0, expires: now + ttlSeconds * 1000 };
    entry.value += by;
    this.counters.set(key, entry);
    if (this.counters.size > 50_000) this.sweep(now);
    return entry.value;
  }

  async get(key: string) {
    const entry = this.counters.get(key);
    return entry && entry.expires > this.now() ? entry.value : 0;
  }

  private sweep(now: number) {
    for (const [key, e] of this.counters) if (e.expires <= now) this.counters.delete(key);
  }
}

export class UpstashStore implements CounterStore {
  constructor(
    private readonly url: string,
    private readonly token: string,
  ) {}

  async increment(key: string, by: number, ttlSeconds: number) {
    const [incr] = await this.call<[{ result: number }, { result: number }]>("/pipeline", [
      ["INCRBY", key, String(by)],
      // NX: only set the expiry on the first increment of the window.
      ["EXPIRE", key, String(ttlSeconds), "NX"],
    ]);
    return incr.result;
  }

  async get(key: string) {
    const { result } = await this.call<{ result: string | null }>("", ["GET", key]);
    return result === null ? 0 : Number(result);
  }

  private async call<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(this.url + path, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(2_000),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Upstash HTTP ${res.status}`);
    return (await res.json()) as T;
  }
}
