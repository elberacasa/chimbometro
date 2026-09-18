import { createHash } from "node:crypto";
import type { CounterStore } from "./counter-store";

/**
 * What stands between the public endpoint and the TypeSafe API key: per-IP and global rate
 * limits, plus a daily spending cap that bounds the worst case even if an attacker rotates IPs.
 */

export type Limits = {
  perIpPerMinute: number;
  perIpPerDay: number;
  globalPerMinute: number;
  dailyBudgetUsd: number;
};

export const DEFAULT_LIMITS: Limits = {
  perIpPerMinute: 10,
  perIpPerDay: 100,
  // TypeSafe allows 1,200 requests/min per key; stay well under it.
  globalPerMinute: 600,
  // ≈ 33,000 measurements at ~$0.00015 each.
  dailyBudgetUsd: 5,
};

export type Admission =
  | { ok: true }
  | {
      ok: false;
      status: 429 | 503;
      reason: "ip-minute" | "ip-day" | "global" | "budget";
      message: string;
      retryAfter: number;
    };

/** 6,000 characters of offer, JSON-escaped, fit comfortably; anything larger is not a real offer. */
export const MAX_BODY_BYTES = 32_000;

const MINUTE = 60;
const DAY = 86_400;

export async function admit(
  store: CounterStore,
  ip: string,
  limits: Limits = DEFAULT_LIMITS,
  now = Date.now(),
): Promise<Admission> {
  const id = hashIp(ip);
  const minute = Math.floor(now / 60_000);
  const day = utcDay(now);
  const toNextMinute = MINUTE - Math.floor((now / 1000) % MINUTE);
  const toNextDay = Math.ceil((Date.UTC(...nextDayParts(now)) - now) / 1000);

  // Checked first and without counting, so rejected traffic can't push the budget further.
  if ((await store.get(budgetKey(day))) >= toMicros(limits.dailyBudgetUsd)) {
    return reject(
      503,
      "budget",
      "El Chimbómetro llegó a su límite de gasto de hoy. Vuelve mañana.",
      toNextDay,
    );
  }
  if ((await store.increment(`rl:ip:${id}:m:${minute}`, 1, MINUTE)) > limits.perIpPerMinute) {
    return reject(
      429,
      "ip-minute",
      `Muchas ofertas seguidas. Prueba otra vez en ${toNextMinute} s.`,
      toNextMinute,
    );
  }
  if ((await store.increment(`rl:ip:${id}:d:${day}`, 1, DAY)) > limits.perIpPerDay) {
    return reject(
      429,
      "ip-day",
      "Llegaste al máximo de ofertas por hoy. Vuelve mañana.",
      toNextDay,
    );
  }
  if ((await store.increment(`rl:all:m:${minute}`, 1, MINUTE)) > limits.globalPerMinute) {
    return reject(
      503,
      "global",
      "Hay mucha gente midiendo ofertas. Prueba en unos segundos.",
      toNextMinute,
    );
  }
  return { ok: true };
}

/** Adds the real cost of a Jev call to today's spend. Stored in micro-dollars to keep integers. */
export async function recordSpend(store: CounterStore, costUsd: number, now = Date.now()) {
  await store.increment(budgetKey(utcDay(now)), toMicros(costUsd), 2 * DAY);
}

/** Counts one successful measurement and records what it cost. */
export async function recordMeasurement(store: CounterStore, costUsd: number, now = Date.now()) {
  await Promise.all([
    recordSpend(store, costUsd, now),
    store.increment(measuredKey(utcDay(now)), 1, 2 * DAY),
  ]);
}

export type TodayStats = { day: string; measured: number; costUsd: number };

export async function todayStats(store: CounterStore, now = Date.now()): Promise<TodayStats> {
  const day = utcDay(now);
  const [measured, micros] = await Promise.all([
    store.get(measuredKey(day)),
    store.get(budgetKey(day)),
  ]);
  return { day, measured, costUsd: micros / 1_000_000 };
}

export async function spentToday(store: CounterStore, now = Date.now()) {
  return (await store.get(budgetKey(utcDay(now)))) / 1_000_000;
}

/**
 * The client IP as reported by the hosting platform. Vercel sets x-vercel-forwarded-for and
 * x-real-ip itself; the first x-forwarded-for entry is client-controlled, so it is only a fallback
 * for local development. Unknown clients share one bucket, which is the strict choice.
 */
export function clientIp(headers: Headers): string {
  const platform = headers.get("x-vercel-forwarded-for") ?? headers.get("x-real-ip");
  if (platform) return platform.split(",")[0]!.trim();
  if (process.env.NODE_ENV !== "production") {
    const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (forwarded) return forwarded;
  }
  return "unknown";
}

/**
 * Browsers always send Origin on a POST from fetch. Requiring it to match the host stops other
 * websites from spending the key through visitors' browsers. (A script can forge it; the rate
 * limits and the budget cover that case.)
 */
export function isSameOrigin(headers: Headers): boolean {
  const origin = headers.get("origin");
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** IPs are hashed before they become keys, so the store never holds a raw address. */
function hashIp(ip: string) {
  return createHash("sha256").update(ip).digest("base64url").slice(0, 22);
}

function measuredKey(day: string) {
  return `stats:measured:${day}`;
}

function budgetKey(day: string) {
  return `budget:usd-micros:${day}`;
}

function toMicros(usd: number) {
  return Math.ceil(usd * 1_000_000);
}

function utcDay(now: number) {
  return new Date(now).toISOString().slice(0, 10);
}

function nextDayParts(now: number): [number, number, number] {
  const d = new Date(now);
  return [d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1];
}

function reject(
  status: 429 | 503,
  reason: Extract<Admission, { ok: false }>["reason"],
  message: string,
  retryAfter: number,
): Admission {
  return { ok: false, status, reason, message, retryAfter };
}
