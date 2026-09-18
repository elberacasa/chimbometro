import type { Usage } from "./types";

/**
 * Jev 1.13 list price from https://docs.typesafe.ai/models (checked 2026-09-18):
 * $0.042 per million input tokens; output tokens are free.
 * Keep in sync with research/typesafe_client.py.
 */
export const USD_PER_MILLION_INPUT_TOKENS = 0.042;

export function costUsd(usage: Usage): number {
  return (usage.input_tokens * USD_PER_MILLION_INPUT_TOKENS) / 1_000_000;
}

/** How many requests like this one fit in one US dollar. */
export function requestsPerDollar(usage: Usage): number {
  const cost = costUsd(usage);
  return cost > 0 ? Math.floor(1 / cost) : Infinity;
}
