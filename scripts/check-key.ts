/** Verifies TYPESAFE_API_KEY with one tiny request. Never prints the key. Usage: npm run jev:check */
import { askJev, JevError } from "@/lib/jev/client";
import { costUsd } from "@/lib/jev/pricing";
import { appendLedger } from "@/lib/ledger";
import { requireKey } from "./env";

try {
  const call = await askJev(requireKey(), {
    model: "jev-latest",
    state: "I was charged twice for my order.",
    questions: { billing: { type: "noul", instructions: "Is this message about billing?" } },
  });
  const { model, usage, answers } = call.response;
  console.log(
    `Key is active. ${model} answered billing=${answers.billing.noul.toFixed(2)} in ${call.latencyMs}ms`,
  );
  await appendLedger({
    model,
    at: new Date().toISOString(),
    purpose: "Verificar que la API key funciona",
    script: "scripts/check-key.ts",
    calls: 1,
    input_tokens: usage.input_tokens,
    output_tokens: usage.output_tokens,
    latency_ms: call.latencyMs,
    cost_usd: Number(costUsd(usage).toFixed(8)),
    exact: true,
  });
} catch (error) {
  if (error instanceof JevError && error.status === 401)
    console.error("Key rejected (401): invalid or revoked.");
  else console.error((error as Error).message);
  process.exitCode = 1;
}
