import { costUsd } from "@/lib/jev/pricing";
import type { CounterStore } from "@/lib/server/counter-store";
import { recordSpend, spentToday } from "@/lib/server/guard";
import { judgeListing } from "./judge";
import { RADAR_QUESTIONS_VERSION } from "./questions";
import { fetchAll } from "./sources";
import type { Listing, RadarJob, RadarSnapshot, RunSummary, SourceReport } from "./types";

/**
 * One radar update: fetch every source, reuse judgments we already have, ask Jev only about new
 * listings, save the snapshot. Every step is reported through `onEvent` as it happens.
 */

export const SNAPSHOT_KEY = "radar:snapshot";
export const LAST_RUN_KEY = "radar:last-run";
const SNAPSHOT_TTL = 30 * 86_400;
const CONCURRENCY = 8;
/** Keeps a single run's spend bounded even if a source suddenly returns thousands of listings. */
const MAX_JUDGED_PER_RUN = 700;
/** Conservative per-listing cost used to check the budget before spending. */
const ESTIMATED_USD_PER_LISTING = 0.0001;

export type RadarEvent =
  | { type: "start"; t: number; trigger: RunSummary["trigger"] }
  | { type: "source"; t: number; report: SourceReport }
  | { type: "plan"; t: number; fetched: number; reused: number; toJudge: number }
  | {
      type: "judged";
      t: number;
      id: string;
      title: string;
      eligible: boolean;
      isJob: boolean;
      decidedBy: RadarJob["decidedBy"];
      quote: string | null;
      url: string;
      ms: number;
      tokens: number;
    }
  | { type: "done"; t: number; run: RunSummary; eligible: number; jobs: number }
  | { type: "error"; t: number; message: string };

type Options = {
  apiKey: string;
  store: CounterStore;
  budgetUsd: number;
  trigger: RunSummary["trigger"];
  onEvent?: (e: RadarEvent) => void;
};

export async function refreshRadar({ apiKey, store, budgetUsd, trigger, onEvent }: Options) {
  const started = performance.now();
  const startedAt = new Date().toISOString();
  const events: RadarEvent[] = [];
  const t = () => Math.round(performance.now() - started);
  const emit = (e: RadarEvent) => {
    events.push(e);
    onEvent?.(e);
  };

  emit({ type: "start", t: 0, trigger });
  const previous = await store.getJson<RadarSnapshot>(SNAPSHOT_KEY);
  // Judgments made with older questions are not reused.
  const known = new Map(
    previous?.jobs.filter((j) => j.version === RADAR_QUESTIONS_VERSION).map((j) => [j.id, j]) ?? [],
  );

  const { reports, listings } = await fetchAll((report) =>
    emit({ type: "source", t: t(), report }),
  );
  const unique = [...new Map(listings.map((l) => [l.id, l])).values()];
  const reused = unique.filter((l) => known.has(l.id));
  const fresh = unique.filter((l) => !known.has(l.id)).slice(0, MAX_JUDGED_PER_RUN);
  emit({
    type: "plan",
    t: t(),
    fetched: unique.length,
    reused: reused.length,
    toJudge: fresh.length,
  });

  const spent = await spentToday(store);
  if (spent + fresh.length * ESTIMATED_USD_PER_LISTING > budgetUsd) {
    emit({
      type: "error",
      t: t(),
      message: "El presupuesto diario de Jev no alcanza para esta actualización.",
    });
    return { snapshot: previous, events };
  }

  const judged: RadarJob[] = [];
  let inputTokens = 0;
  let model: string | null = null;
  await pool(fresh, CONCURRENCY, async (listing: Listing) => {
    try {
      const { job, latencyMs, usage, model: answeredBy } = await judgeListing(apiKey, listing);
      judged.push(job);
      model = answeredBy;
      inputTokens += usage.input_tokens;
      emit({
        type: "judged",
        t: t(),
        id: job.id,
        title: job.title,
        eligible: job.eligible,
        isJob: job.isJob,
        decidedBy: job.decidedBy,
        quote: job.quote,
        url: job.url,
        ms: latencyMs,
        tokens: usage.input_tokens,
      });
    } catch {
      // A listing Jev could not judge is retried on the next run.
    }
  });

  const cost = costUsd({ input_tokens: inputTokens, output_tokens: 0 });
  await recordSpend(store, cost);

  // Listings that disappeared from their source are dropped; judged ones keep their judgment.
  const jobs = [...reused.map((l) => known.get(l.id)!), ...judged];
  const run: RunSummary = {
    startedAt,
    ms: t(),
    fetched: unique.length,
    reused: reused.length,
    judged: judged.length,
    inputTokens,
    costUsd: cost,
    model,
    trigger,
  };
  const snapshot: RadarSnapshot = {
    updatedAt: new Date().toISOString(),
    sources: reports,
    jobs,
    run,
  };
  await store.setJson(SNAPSHOT_KEY, snapshot, SNAPSHOT_TTL);

  const real = jobs.filter((j) => j.isJob);
  emit({
    type: "done",
    t: t(),
    run,
    jobs: real.length,
    eligible: real.filter((j) => j.eligible).length,
  });
  await store.setJson(LAST_RUN_KEY, events, SNAPSHOT_TTL);
  return { snapshot, events };
}

/** Runs `task` over `items` with at most `limit` in flight. */
async function pool<T>(items: T[], limit: number, task: (item: T) => Promise<void>) {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) await task(items[next++]!);
  });
  await Promise.all(workers);
}
