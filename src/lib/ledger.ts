import { appendFile, readFile } from "node:fs/promises";
import path from "node:path";

/**
 * ledger/jev-usage.jsonl records every Jev call made while building this project (one line per
 * run), so the site can show what it cost to make. Production traffic is logged separately.
 */

export type LedgerEntry = {
  model: string;
  at: string;
  purpose: string;
  script: string;
  calls: number;
  input_tokens: number;
  output_tokens?: number;
  latency_ms?: number;
  cost_usd: number;
  /** False when the numbers were reconstructed after the fact. */
  exact: boolean;
  note?: string;
};

const LEDGER_PATH = path.join(process.cwd(), "ledger", "jev-usage.jsonl");

export async function readLedger(): Promise<LedgerEntry[]> {
  const raw = await readFile(LEDGER_PATH, "utf8");
  return raw
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as LedgerEntry);
}

export async function appendLedger(entry: LedgerEntry): Promise<void> {
  await appendFile(LEDGER_PATH, JSON.stringify(entry) + "\n");
}

export function ledgerTotals(entries: LedgerEntry[]) {
  return entries.reduce(
    (t, e) => ({
      calls: t.calls + e.calls,
      inputTokens: t.inputTokens + e.input_tokens,
      costUsd: t.costUsd + e.cost_usd,
    }),
    { calls: 0, inputTokens: 0, costUsd: 0 },
  );
}

/** Merges entries with the same purpose on the same day, so many one-call dev runs read as one row. */
export function groupLedger(entries: LedgerEntry[]): LedgerEntry[] {
  const groups = new Map<string, LedgerEntry>();
  for (const e of entries) {
    const key = `${e.at.slice(0, 10)}|${e.purpose}`;
    const g = groups.get(key);
    if (!g) {
      groups.set(key, { ...e });
      continue;
    }
    g.calls += e.calls;
    g.input_tokens += e.input_tokens;
    g.cost_usd += e.cost_usd;
    g.output_tokens = (g.output_tokens ?? 0) + (e.output_tokens ?? 0);
    g.exact = g.exact && e.exact;
  }
  return [...groups.values()];
}
