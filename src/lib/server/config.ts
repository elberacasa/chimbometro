import "server-only";
import { MemoryStore, UpstashStore, type CounterStore } from "./counter-store";
import { DEFAULT_LIMITS, type Limits } from "./guard";

/**
 * Server configuration. Importing this module from client code fails the build, so the API key
 * can never be bundled for the browser.
 */

export type ServerConfig =
  | { ok: true; apiKey: string; store: CounterStore; limits: Limits }
  | { ok: false; problem: string };

let memoryStore: MemoryStore | undefined;

export function serverConfig(): ServerConfig {
  const apiKey = process.env.TYPESAFE_API_KEY;
  if (!apiKey) return { ok: false, problem: "TYPESAFE_API_KEY is not set" };

  const limits: Limits = {
    ...DEFAULT_LIMITS,
    dailyBudgetUsd: positiveNumber(process.env.DAILY_BUDGET_USD) ?? DEFAULT_LIMITS.dailyBudgetUsd,
  };

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) return { ok: true, apiKey, store: new UpstashStore(url, token), limits };

  // Fail closed: per-instance memory can't enforce limits on serverless, so production refuses
  // to call Jev until the shared store is configured.
  if (process.env.NODE_ENV === "production") {
    return { ok: false, problem: "UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are not set" };
  }
  memoryStore ??= new MemoryStore();
  return { ok: true, apiKey, store: memoryStore, limits };
}

function positiveNumber(raw: string | undefined) {
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : undefined;
}
