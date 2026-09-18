import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryStore, UpstashStore } from "./counter-store";
import {
  admit,
  clientIp,
  isSameOrigin,
  recordMeasurement,
  recordSpend,
  spentToday,
  todayStats,
  type Limits,
} from "./guard";

const T0 = Date.UTC(2026, 8, 18, 12, 0, 10); // 12:00:10 UTC
const limits: Limits = {
  perIpPerMinute: 2,
  perIpPerDay: 3,
  globalPerMinute: 4,
  dailyBudgetUsd: 0.001,
};

function setup() {
  let now = T0;
  const store = new MemoryStore(() => now);
  return { store, at: (ms: number) => (now = ms) };
}

describe("admit", () => {
  it("limits each IP per minute and says how long to wait", async () => {
    const { store } = setup();
    expect((await admit(store, "1.1.1.1", limits, T0)).ok).toBe(true);
    expect((await admit(store, "1.1.1.1", limits, T0)).ok).toBe(true);
    expect(await admit(store, "1.1.1.1", limits, T0)).toMatchObject({
      ok: false,
      status: 429,
      reason: "ip-minute",
      retryAfter: 50,
    });
    expect((await admit(store, "2.2.2.2", limits, T0)).ok).toBe(true);
  });

  it("limits each IP per day across minutes", async () => {
    const { store, at } = setup();
    for (let i = 0; i < 3; i++) {
      const now = at(T0 + i * 60_000);
      expect((await admit(store, "1.1.1.1", limits, now)).ok).toBe(true);
    }
    const now = at(T0 + 3 * 60_000);
    expect(await admit(store, "1.1.1.1", limits, now)).toMatchObject({
      ok: false,
      reason: "ip-day",
    });
  });

  it("caps total traffic per minute even when every request comes from a new IP", async () => {
    const { store } = setup();
    for (let i = 0; i < 4; i++)
      expect((await admit(store, `10.0.0.${i}`, limits, T0)).ok).toBe(true);
    expect(await admit(store, "10.0.0.99", limits, T0)).toMatchObject({
      ok: false,
      status: 503,
      reason: "global",
    });
  });

  it("stops everything once today's spend reaches the budget, and resets the next UTC day", async () => {
    const { store, at } = setup();
    await recordSpend(store, 0.0006, T0);
    expect((await admit(store, "1.1.1.1", limits, T0)).ok).toBe(true);
    await recordSpend(store, 0.0005, T0);
    expect(await spentToday(store, T0)).toBeCloseTo(0.0011);
    expect(await admit(store, "3.3.3.3", limits, T0)).toMatchObject({
      ok: false,
      status: 503,
      reason: "budget",
    });

    const tomorrow = at(Date.UTC(2026, 8, 19, 0, 0, 1));
    expect((await admit(store, "3.3.3.3", limits, tomorrow)).ok).toBe(true);
  });

  it("does not count requests rejected by the budget against anyone", async () => {
    const { store } = setup();
    await recordSpend(store, 1, T0);
    await admit(store, "1.1.1.1", limits, T0);
    await admit(store, "1.1.1.1", limits, T0);
    await recordSpend(store, -1, T0); // budget "reset" for the test
    expect((await admit(store, "1.1.1.1", limits, T0)).ok).toBe(true);
  });
});

describe("MemoryStore values and locks", () => {
  it("stores JSON with expiry and hands a lock to one holder at a time", async () => {
    const { store, at } = setup();
    await store.setJson("snap", { n: 1 }, 60);
    expect(await store.getJson("snap")).toEqual({ n: 1 });
    expect(await store.claim("lock", 60)).toBe(true);
    expect(await store.claim("lock", 60)).toBe(false);
    await store.release("lock");
    expect(await store.claim("lock", 60)).toBe(true);
    at(T0 + 61_000);
    expect(await store.getJson("snap")).toBeNull();
    expect(await store.claim("lock", 60)).toBe(true);
  });
});

describe("todayStats", () => {
  it("counts measurements and their cost for the current UTC day only", async () => {
    const { store } = setup();
    await recordMeasurement(store, 0.00015, T0);
    await recordMeasurement(store, 0.00015, T0);
    expect(await todayStats(store, T0)).toEqual({
      day: "2026-09-18",
      measured: 2,
      costUsd: 0.0003,
    });
    expect((await todayStats(store, Date.UTC(2026, 8, 19, 1))).measured).toBe(0);
  });

  it("does not count other spending, like radar updates, as measurement cost", async () => {
    const { store } = setup();
    await recordSpend(store, 0.05, T0);
    await recordMeasurement(store, 0.00015, T0);
    expect(await todayStats(store, T0)).toMatchObject({ measured: 1, costUsd: 0.00015 });
    expect(await spentToday(store, T0)).toBeCloseTo(0.05015);
  });
});

describe("clientIp", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("trusts the platform header over a client-supplied x-forwarded-for", () => {
    const h = new Headers({ "x-forwarded-for": "6.6.6.6", "x-vercel-forwarded-for": "8.8.8.8" });
    expect(clientIp(h)).toBe("8.8.8.8");
  });

  it("ignores x-forwarded-for in production, putting unknown clients in one bucket", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(clientIp(new Headers({ "x-forwarded-for": "6.6.6.6" }))).toBe("unknown");
  });
});

describe("isSameOrigin", () => {
  it.each([
    [{ origin: "https://chimbometro.app", host: "chimbometro.app" }, true],
    [{ origin: "https://evil.example", host: "chimbometro.app" }, false],
    [{ host: "chimbometro.app" }, false],
    [{ origin: "not a url", host: "chimbometro.app" }, false],
  ])("%j → %s", (headers, expected) => {
    expect(isSameOrigin(new Headers(headers))).toBe(expected);
  });
});

describe("UpstashStore", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("increments and sets the expiry only on first use, in one pipeline call", async () => {
    const fetchMock = vi.fn(async () => Response.json([{ result: 3 }, { result: 0 }]));
    vi.stubGlobal("fetch", fetchMock);
    const store = new UpstashStore("https://redis.example", "tok");

    expect(await store.increment("k", 1, 60)).toBe(3);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://redis.example/pipeline");
    expect(JSON.parse(init.body as string)).toEqual([
      ["INCRBY", "k", "1"],
      ["EXPIRE", "k", "60", "NX"],
    ]);
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
  });

  it("claims a lock with SET NX EX and reports whether it got it", async () => {
    const fetchMock = vi.fn(async () => Response.json({ result: null }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await new UpstashStore("https://redis.example", "tok").claim("lock", 900)).toBe(false);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual(["SET", "lock", "1", "NX", "EX", "900"]);
  });

  it("throws on HTTP errors so the route can fail closed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 500 })),
    );
    await expect(new UpstashStore("https://redis.example", "tok").get("k")).rejects.toThrow(
      "Upstash HTTP 500",
    );
  });
});
