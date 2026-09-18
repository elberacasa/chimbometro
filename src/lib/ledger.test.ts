import { describe, expect, it } from "vitest";
import { groupLedger, ledgerTotals, type LedgerEntry } from "./ledger";

const entry = (over: Partial<LedgerEntry>): LedgerEntry => ({
  model: "jev-1.13.0",
  at: "2026-09-18T17:00:00.000Z",
  purpose: "Probar el sitio en el servidor local",
  script: "dev",
  calls: 1,
  input_tokens: 1000,
  cost_usd: 0.000042,
  exact: true,
  ...over,
});

describe("groupLedger", () => {
  it("merges same-day entries with the same purpose and keeps totals", () => {
    const entries = [
      entry({}),
      entry({ at: "2026-09-18T18:00:00.000Z", exact: false }),
      entry({ purpose: "Otra cosa" }),
    ];
    const grouped = groupLedger(entries);
    expect(grouped).toHaveLength(2);
    expect(grouped[0]).toMatchObject({ calls: 2, input_tokens: 2000, exact: false });
    expect(ledgerTotals(grouped)).toEqual(ledgerTotals(entries));
  });

  it("does not mutate the input", () => {
    const entries = [entry({}), entry({})];
    groupLedger(entries);
    expect(entries[0]!.calls).toBe(1);
  });
});
