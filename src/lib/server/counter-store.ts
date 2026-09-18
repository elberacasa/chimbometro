/**
 * Shared state with expiry: counters for rate limits and the daily spend cap, JSON values for the
 * radar snapshot, and a lock so only one refresh runs at a time. Production uses Upstash Redis
 * over REST (no client library, works on serverless); development and tests use memory.
 */
export interface CounterStore {
  /** Adds `by` to `key` and returns the new total. The key expires `ttlSeconds` after first use. */
  increment(key: string, by: number, ttlSeconds: number): Promise<number>;
  get(key: string): Promise<number>;
  getJson<T>(key: string): Promise<T | null>;
  setJson(key: string, value: unknown, ttlSeconds: number): Promise<void>;
  /** Takes `key` for `ttlSeconds` if nobody holds it. Returns whether it was taken. */
  claim(key: string, ttlSeconds: number): Promise<boolean>;
  release(key: string): Promise<void>;
}

export class MemoryStore implements CounterStore {
  private readonly counters = new Map<string, { value: number; expires: number }>();
  private readonly values = new Map<string, { json: string; expires: number }>();

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

  async getJson<T>(key: string) {
    const entry = this.values.get(key);
    return entry && entry.expires > this.now() ? (JSON.parse(entry.json) as T) : null;
  }

  async setJson(key: string, value: unknown, ttlSeconds: number) {
    this.values.set(key, { json: JSON.stringify(value), expires: this.now() + ttlSeconds * 1000 });
  }

  async claim(key: string, ttlSeconds: number) {
    if ((await this.getJson(key)) !== null) return false;
    await this.setJson(key, 1, ttlSeconds);
    return true;
  }

  async release(key: string) {
    this.values.delete(key);
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

  async getJson<T>(key: string) {
    const { result } = await this.call<{ result: string | null }>("", ["GET", key]);
    return result === null ? null : (JSON.parse(result) as T);
  }

  async setJson(key: string, value: unknown, ttlSeconds: number) {
    await this.call("", ["SET", key, JSON.stringify(value), "EX", String(ttlSeconds)], 10_000);
  }

  async claim(key: string, ttlSeconds: number) {
    const { result } = await this.call<{ result: string | null }>("", [
      "SET",
      key,
      "1",
      "NX",
      "EX",
      String(ttlSeconds),
    ]);
    return result === "OK";
  }

  async release(key: string) {
    await this.call("", ["DEL", key]);
  }

  private async call<T>(path: string, body: unknown, timeoutMs = 2_000): Promise<T> {
    const res = await fetch(this.url + path, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Upstash HTTP ${res.status}`);
    return (await res.json()) as T;
  }
}
