/**
 * Runs every example offer through the real pipeline and checks Jev's verdict against the accepted
 * ones. Appends the run to the ledger. Usage: npm run jev:eval
 */
import { analyzeOffer } from "@/lib/chimba/analyze";
import { EXAMPLES } from "@/lib/chimba/examples";
import { costUsd } from "@/lib/jev/pricing";
import { appendLedger } from "@/lib/ledger";
import { requireKey } from "./env";

const apiKey = requireKey();
const runs = await Promise.all(
  EXAMPLES.map(async (ex) => ({ ex, a: await analyzeOffer(apiKey, ex.text) })),
);

let passed = 0;
for (const { ex, a } of runs) {
  const ok = ex.accepted.includes(a.result.verdict.id);
  passed += Number(ok);
  const top = a.result.flags
    .slice(0, 3)
    .map((f) => `${f.id} ${f.probability.toFixed(2)}`)
    .join(", ");
  console.log(
    `${ok ? "✓" : "✗"} ${ex.id.padEnd(10)} ${String(a.result.score).padStart(3)} ${a.result.band.label.padEnd(11)} ` +
      `${a.result.verdict.id} (${a.result.verdict.confidence.toFixed(2)}) | ${top} | ` +
      `${a.receipt.usage.input_tokens} tok ${a.receipt.jevMs}ms`,
  );
}

const inputTokens = runs.reduce((n, r) => n + r.a.receipt.usage.input_tokens, 0);
const outputTokens = runs.reduce((n, r) => n + r.a.receipt.usage.output_tokens, 0);
const cost = costUsd({ input_tokens: inputTokens, output_tokens: outputTokens });
console.log(
  `\n${passed}/${runs.length} verdicts as expected · ${inputTokens} input tokens · $${cost.toFixed(6)}`,
);

await appendLedger({
  model: runs[0]!.a.receipt.model,
  at: new Date().toISOString(),
  purpose: `Evaluar el Chimbómetro con ${runs.length} ofertas de ejemplo (${passed}/${runs.length} veredictos correctos)`,
  script: "scripts/eval-offers.ts",
  calls: runs.length,
  input_tokens: inputTokens,
  output_tokens: outputTokens,
  latency_ms: runs.reduce((n, r) => n + r.a.receipt.jevMs, 0),
  cost_usd: Number(cost.toFixed(8)),
  exact: true,
});

process.exitCode = passed === runs.length ? 0 : 1;
