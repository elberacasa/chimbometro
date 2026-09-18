/**
 * Runs every example offer through the real pipeline and checks Jev's verdict against the accepted
 * ones. Appends the run to the ledger. Usage: npm run jev:eval
 */
import { analyzeOffer } from "@/lib/chimba/analyze";
import { EXAMPLES } from "@/lib/chimba/examples";
import { costUsd } from "@/lib/jev/pricing";
import { writeFile } from "node:fs/promises";
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
  for (const e of a.evidence) {
    const fragment = a.fragments.find((f) => f.id === e.fragmentId);
    console.log(`    ${e.flag.padEnd(16)} ${e.probability.toFixed(2)}  «${fragment?.text}»`);
  }
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

// The docs page charts the latest eval: timings, tokens, and the raw probabilities per offer.
await writeFile(
  "src/content/eval.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      model: runs[0]!.a.receipt.model,
      passed,
      total: runs.length,
      runs: runs.map(({ ex, a }) => ({
        id: ex.id,
        label: ex.label,
        accepted: ex.accepted,
        chars: ex.text.length,
        fragments: a.fragments.length,
        questions: a.receipt.questionCount,
        inputTokens: a.receipt.usage.input_tokens,
        jevMs: a.receipt.jevMs,
        costUsd: a.receipt.costUsd,
        score: a.result.score,
        verdict: a.result.verdict,
        answers: a.receipt.response.answers,
      })),
    },
    null,
    2,
  ) + "\n",
);

process.exitCode = passed === runs.length ? 0 : 1;
