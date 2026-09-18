import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryStore } from "@/lib/server/counter-store";
import { recordSpend } from "@/lib/server/guard";
import { RADAR_QUESTIONS_VERSION } from "./questions";
import type { Listing, RadarJob, SourceReport } from "./types";

const fetched: { listings: Listing[]; reports: SourceReport[] } = { listings: [], reports: [] };
const judgedIds: string[] = [];

vi.mock("./sources", () => ({
  fetchAll: async (onSource: (r: SourceReport) => void) => {
    fetched.reports.forEach(onSource);
    return fetched;
  },
}));

vi.mock("./judge", () => ({
  judgeListing: async (_key: string, l: Listing) => {
    judgedIds.push(l.id);
    return {
      job: {
        id: l.id,
        title: l.title,
        isJob: true,
        eligible: l.id.endsWith("ok"),
        version: RADAR_QUESTIONS_VERSION,
        decidedBy: "jev",
        quote: null,
        url: l.url,
      } as RadarJob,
      latencyMs: 500,
      usage: { input_tokens: 2000, output_tokens: 100 },
      model: "jev-test",
    };
  },
}));

const { refreshRadar, SNAPSHOT_KEY } = await import("./refresh");

const listing = (id: string): Listing => ({
  id,
  source: "hn",
  title: id,
  company: "",
  location: "",
  text: "",
  url: `https://x/${id}`,
  postedAt: null,
  salary: null,
  structuredWhere: null,
});
const report: SourceReport = {
  id: "hn",
  name: "HN",
  homepage: "",
  requested: ["u"],
  status: "ok",
  listings: 0,
  ms: 5,
};

beforeEach(() => {
  judgedIds.length = 0;
  fetched.reports = [report];
});

describe("refreshRadar", () => {
  it("judges only new listings, reuses known ones and drops the ones that disappeared", async () => {
    const store = new MemoryStore();
    fetched.listings = [listing("a-ok"), listing("b")];
    await refreshRadar({ apiKey: "k", store, budgetUsd: 5, trigger: "script" });
    expect(judgedIds).toEqual(["a-ok", "b"]);

    judgedIds.length = 0;
    fetched.listings = [listing("a-ok"), listing("c-ok")];
    const events: string[] = [];
    const { snapshot } = await refreshRadar({
      apiKey: "k",
      store,
      budgetUsd: 5,
      trigger: "script",
      onEvent: (e) => events.push(e.type),
    });

    expect(judgedIds).toEqual(["c-ok"]);
    expect(snapshot!.jobs.map((j) => j.id).sort()).toEqual(["a-ok", "c-ok"]);
    expect(snapshot!.run).toMatchObject({ fetched: 2, reused: 1, judged: 1, inputTokens: 2000 });
    expect(events).toEqual(["start", "source", "plan", "judged", "done"]);
    expect(await store.getJson(SNAPSHOT_KEY)).toEqual(snapshot);
  });

  it("re-judges listings judged with an older version of the questions", async () => {
    const store = new MemoryStore();
    fetched.listings = [listing("a-ok")];
    await refreshRadar({ apiKey: "k", store, budgetUsd: 5, trigger: "script" });
    const snap = await store.getJson<{ jobs: RadarJob[] }>(SNAPSHOT_KEY);
    await store.setJson(
      SNAPSHOT_KEY,
      { ...snap, jobs: snap!.jobs.map((j) => ({ ...j, version: 1 })) },
      60,
    );
    judgedIds.length = 0;
    await refreshRadar({ apiKey: "k", store, budgetUsd: 5, trigger: "script" });
    expect(judgedIds).toEqual(["a-ok"]);
  });

  it("stops before calling Jev when the daily budget cannot cover the run", async () => {
    const store = new MemoryStore();
    await recordSpend(store, 4.99);
    fetched.listings = Array.from({ length: 200 }, (_, i) => listing(`j${i}`));
    const events: string[] = [];
    await refreshRadar({
      apiKey: "k",
      store,
      budgetUsd: 5,
      trigger: "visitor",
      onEvent: (e) => events.push(e.type),
    });
    expect(judgedIds).toEqual([]);
    expect(events.at(-1)).toBe("error");
  });

  it("reports a failed source without failing the run", async () => {
    const store = new MemoryStore();
    fetched.reports = [report, { ...report, id: "wwr", status: "failed", error: "HTTP 503" }];
    fetched.listings = [listing("a-ok")];
    const { snapshot } = await refreshRadar({ apiKey: "k", store, budgetUsd: 5, trigger: "cron" });
    expect(snapshot!.sources.map((s) => s.status)).toEqual(["ok", "failed"]);
    expect(snapshot!.jobs).toHaveLength(1);
  });
});
