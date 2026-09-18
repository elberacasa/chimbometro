/**
 * A full radar update from the command line, reviewed before it goes live.
 *
 *   npm run radar:refresh              judges every listing into a memory store and saves the run
 *                                      to research/data/radar-run.json (and the ledger)
 *   npm run radar:refresh -- --publish writes that saved run to production Redis, without asking
 *                                      Jev again
 *
 * The first form never touches production. The second needs the Redis credentials that
 * `vercel env pull` writes to .env.local.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { appendLedger } from "@/lib/ledger";
import { RADAR_QUESTIONS_VERSION } from "@/lib/radar/questions";
import { LAST_RUN_KEY, refreshRadar, SNAPSHOT_KEY, type RadarEvent } from "@/lib/radar/refresh";
import type { RadarSnapshot } from "@/lib/radar/types";
import { MemoryStore, UpstashStore } from "@/lib/server/counter-store";
import { recordSpend } from "@/lib/server/guard";
import { requireKey } from "./env";

const RUN_FILE = "research/data/radar-run.json";
const TTL = 30 * 86_400;

type SavedRun = { snapshot: RadarSnapshot; events: RadarEvent[] };

if (process.argv.includes("--publish")) {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    console.error("Redis credentials missing: run `vercel env pull .env.local` first.");
    process.exit(1);
  }
  const { snapshot, events } = JSON.parse(readFileSync(RUN_FILE, "utf8")) as SavedRun;
  const store = new UpstashStore(url, token);
  await store.setJson(SNAPSHOT_KEY, snapshot, TTL);
  await store.setJson(LAST_RUN_KEY, events, TTL);
  // The run was paid for; production's daily budget should know.
  await recordSpend(store, snapshot.run.costUsd);
  console.log(`Published ${snapshot.jobs.length} jobs from ${snapshot.run.startedAt}.`);
} else {
  const { snapshot, events } = await refreshRadar({
    apiKey: requireKey(),
    store: new MemoryStore(),
    budgetUsd: 1,
    trigger: "script",
    onEvent: (e) => {
      if (e.type === "source") {
        console.log(`${e.report.status.padEnd(6)} ${e.report.name}: ${e.report.listings} listings`);
      }
      if (e.type === "error") console.error(e.message);
    },
  });
  if (!snapshot) process.exit(1);
  writeFileSync(RUN_FILE, JSON.stringify({ snapshot, events } satisfies SavedRun));

  const { run } = snapshot;
  const tech = snapshot.jobs.filter((j) => j.isJob && j.techRole);
  const eligible = tech.filter((j) => j.eligible);
  console.log(
    `\n${run.judged} judged in ${(run.ms / 1000).toFixed(1)} s · $${run.costUsd.toFixed(4)} · ` +
      `${eligible.length} of ${tech.length} tech jobs accept Venezuela, ` +
      `${eligible.filter((j) => j.juniorFriendly).length} take juniors. Saved to ${RUN_FILE}.`,
  );
  if (run.model) {
    await appendLedger({
      model: run.model,
      at: run.startedAt,
      purpose: `Actualizar Chamba Radar desde la terminal (${run.judged} ofertas, preguntas v${RADAR_QUESTIONS_VERSION})`,
      script: "scripts/refresh-radar.ts",
      calls: run.judged,
      input_tokens: run.inputTokens,
      cost_usd: Number(run.costUsd.toFixed(8)),
      exact: true,
    });
  }
}
