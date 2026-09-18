/**
 * The experiment that chose the radar's sources. For every candidate source, Jev judges its newest
 * listings and we measure what a candidate in Venezuela would get out of it: tech jobs, jobs that
 * accept Venezuela, jobs open to juniors, and what each useful job costs. Where a source states the
 * location in a field, Jev also reads the text on its own, and every disagreement is saved for
 * review: that is how mistakes in the questions (or in a source) are found.
 *
 * Writes src/content/sources-lab.json and appends the run to the ledger.
 * Usage: npm run jev:sources [-- --sample 80]
 */
import { writeFileSync } from "node:fs";
import { costUsd } from "@/lib/jev/pricing";
import { appendLedger } from "@/lib/ledger";
import { judgeListing } from "@/lib/radar/judge";
import { RADAR_QUESTIONS_VERSION } from "@/lib/radar/questions";
import { dedupe } from "@/lib/radar/refresh";
import { CANDIDATE_SOURCES, fetchAll } from "@/lib/radar/sources";
import type { Listing, RadarJob } from "@/lib/radar/types";
import { requireKey } from "./env";

const apiKey = requireKey();
const flag = process.argv.indexOf("--sample");
const SAMPLE = flag > -1 ? Number(process.argv[flag + 1]) : 80;
const CONCURRENCY = 8;

const { reports, listings } = await fetchAll({ sources: CANDIDATE_SOURCES });
// Cross-source duplicates are measured on everything fetched, in the radar's priority order.
const kept = new Set(dedupe(listings).map((l) => l.id));

type Judged = { listing: Listing; job: RadarJob; ms: number; tokens: number };
const judged: Judged[] = [];
let model = "";
const queue = CANDIDATE_SOURCES.flatMap((s) =>
  listings
    .filter((l) => l.source === s.id)
    .filter((l, i, all) => all.findIndex((x) => x.id === l.id) === i)
    .sort((a, b) => (b.postedAt ?? "").localeCompare(a.postedAt ?? ""))
    .slice(0, SAMPLE),
);
let next = 0;
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (next < queue.length) {
      const listing = queue[next++]!;
      try {
        const r = await judgeListing(apiKey, listing);
        model = r.model;
        judged.push({ listing, job: r.job, ms: r.latencyMs, tokens: r.usage.input_tokens });
      } catch (e) {
        console.error(`✗ ${listing.id}: ${(e as Error).message}`);
      }
    }
  }),
);

/** What Jev concludes from the text alone, ignoring any structured field. */
const jevSays = (j: RadarJob) =>
  (j.where === "anywhere" || j.where === "americas_or_latam") && j.excludesVenezuela < 0.5;

const sources = CANDIDATE_SOURCES.map((s) => {
  const report = reports.find((r) => r.id === s.id)!;
  const all = listings.filter((l) => l.source === s.id);
  const rows = judged.filter((r) => r.listing.source === s.id);
  const tech = rows.filter((r) => r.job.isJob && r.job.techRole);
  const eligible = tech.filter((r) => r.job.eligible);
  const juniors = eligible.filter((r) => r.job.juniorFriendly);
  const tokens = rows.reduce((n, r) => n + r.tokens, 0);
  const cost = costUsd({ input_tokens: tokens, output_tokens: 0 });
  const structured = rows.filter((r) => r.listing.structuredWhere);
  const disagreements = structured
    .filter((r) => (r.listing.structuredWhere === "anywhere") !== jevSays(r.job))
    .map((r) => ({
      title: r.job.title.slice(0, 140),
      url: r.job.url,
      field: r.listing.structuredWhere,
      location: r.listing.location.slice(0, 80),
      jevWhere: r.job.where,
      excludesVenezuela: r.job.excludesVenezuela,
      quote: r.job.quote?.slice(0, 200) ?? null,
    }));
  const ms = rows.map((r) => r.ms).sort((a, b) => a - b);
  return {
    id: s.id,
    name: s.name,
    homepage: s.homepage,
    status: report.status,
    requests: report.requested.length,
    fetched: new Set(all.map((l) => l.id)).size,
    duplicates: all.filter((l) => !kept.has(l.id)).length,
    sampled: rows.length,
    tech: tech.length,
    eligible: eligible.length,
    juniors: juniors.length,
    structuredWhere: structured.length,
    structuredLevels: rows.filter((r) => r.listing.levels).length,
    costUsd: cost,
    costPerEligible: eligible.length ? cost / eligible.length : null,
    medianMs: ms[Math.floor(ms.length / 2)] ?? null,
    disagreements,
  };
});

const tokens = judged.reduce((n, r) => n + r.tokens, 0);
const cost = costUsd({ input_tokens: tokens, output_tokens: 0 });
const out = {
  at: new Date().toISOString(),
  model,
  questionsVersion: RADAR_QUESTIONS_VERSION,
  sample: SAMPLE,
  judged: judged.length,
  inputTokens: tokens,
  costUsd: cost,
  sources,
};
writeFileSync("src/content/sources-lab.json", `${JSON.stringify(out, null, 2)}\n`);

console.log("source          fetched  sample  tech  elig  junior  dup  field  $/useful   disagree");
for (const s of sources) {
  console.log(
    `${s.id.padEnd(15)} ${String(s.fetched).padStart(7)} ${String(s.sampled).padStart(7)} ${String(s.tech).padStart(5)} ${String(s.eligible).padStart(5)} ${String(s.juniors).padStart(7)} ${String(s.duplicates).padStart(4)} ${String(s.structuredWhere).padStart(6)}  ${s.costPerEligible ? s.costPerEligible.toFixed(5) : "   -   "}  ${String(s.disagreements.length).padStart(8)}`,
  );
}
console.log(`\n${judged.length} listings judged · ${tokens} input tokens · $${cost.toFixed(4)}`);

await appendLedger({
  model,
  at: new Date().toISOString(),
  purpose: `Comparar ${sources.length} fuentes de empleos con Jev (${judged.length} ofertas)`,
  script: "scripts/probe-sources.ts",
  calls: judged.length,
  input_tokens: tokens,
  cost_usd: Number(cost.toFixed(8)),
  exact: true,
});
