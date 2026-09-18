/**
 * Runs the radar's tricky cases through the real judge and checks techRole, eligibility and
 * seniority. Appends the run to the ledger. Usage: npm run jev:eval-radar
 */
import { costUsd } from "@/lib/jev/pricing";
import { appendLedger } from "@/lib/ledger";
import { RADAR_CASES } from "@/lib/radar/eval-cases";
import { judgeListing } from "@/lib/radar/judge";
import { requireKey } from "./env";

const apiKey = requireKey();
const runs = await Promise.all(
  RADAR_CASES.map(async (c) => ({
    c,
    r: await judgeListing(apiKey, {
      ...c.listing,
      id: c.id,
      url: "",
      postedAt: null,
      salary: null,
    }),
  })),
);

let passed = 0;
for (const { c, r } of runs) {
  const j = r.job;
  const misses = [
    j.techRole !== c.expect.techRole && `techRole=${j.techRole}`,
    j.eligible !== c.expect.eligible && `eligible=${j.eligible}`,
    c.expect.seniority && j.seniority !== c.expect.seniority && `seniority=${j.seniority}`,
    c.expect.juniorFriendly !== undefined &&
      j.juniorFriendly !== c.expect.juniorFriendly &&
      `juniorFriendly=${j.juniorFriendly}`,
  ].filter(Boolean);
  if (misses.length === 0) passed++;
  console.log(
    `${misses.length ? "✗" : "✓"} ${c.id.padEnd(20)} tech=${j.techRole} eligible=${j.eligible} ` +
      `excl=${j.excludesVenezuela.toFixed(2)} ${j.seniority} junior=${j.juniorFriendly}${misses.length ? `  MISS: ${misses.join(", ")}` : ""}`,
  );
}

const inputTokens = runs.reduce((n, x) => n + x.r.usage.input_tokens, 0);
const cost = costUsd({ input_tokens: inputTokens, output_tokens: 0 });
console.log(
  `\n${passed}/${runs.length} cases as expected · ${inputTokens} input tokens · $${cost.toFixed(6)}`,
);

await appendLedger({
  model: runs[0]!.r.model,
  at: new Date().toISOString(),
  purpose: `Evaluar el radar con ${runs.length} casos difíciles (${passed}/${runs.length} correctos)`,
  script: "scripts/eval-radar.ts",
  calls: runs.length,
  input_tokens: inputTokens,
  cost_usd: Number(cost.toFixed(8)),
  exact: true,
});

process.exitCode = passed === runs.length ? 0 : 1;
