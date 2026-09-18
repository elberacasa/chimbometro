import { describe, expect, it } from "vitest";
import type { RadarJob, RadarSnapshot } from "./types";
import { toPayload } from "./view";

const job = (over: Partial<RadarJob>): RadarJob => ({
  id: "hn-1",
  source: "hn",
  title: "Acme | Engineer | REMOTE (worldwide)",
  company: "Acme",
  location: "",
  url: "https://news.ycombinator.com/item?id=1",
  postedAt: null,
  excerpt: "long text ".repeat(30),
  salary: null,
  isJob: true,
  eligible: true,
  decidedBy: "jev",
  where: "anywhere",
  whereConfidence: 0.97,
  excludesVenezuela: 0.1,
  usd: 0.9,
  seniority: "senior",
  role: "backend",
  english: 2,
  quote: "REMOTE (worldwide)",
  judgedAt: "2026-09-18T00:00:00Z",
  inputTokens: 2000,
  ...over,
});

const snapshot = (jobs: RadarJob[]): RadarSnapshot => ({
  updatedAt: "2026-09-18T00:00:00Z",
  sources: [],
  jobs,
  run: {
    startedAt: "",
    ms: 0,
    fetched: 0,
    reused: 0,
    judged: 0,
    inputTokens: 0,
    costUsd: 0,
    model: null,
    trigger: "cron",
  },
});

describe("toPayload", () => {
  it("keeps only real job posts and drops fields the page never reads", () => {
    const payload = toPayload(snapshot([job({}), job({ id: "hn-2", isJob: false })]));
    expect(payload.jobs.map((j) => j.id)).toEqual(["hn-1"]);
    expect(payload.jobs[0]).not.toHaveProperty("excerpt");
    expect(payload.jobs[0]).not.toHaveProperty("inputTokens");
  });

  it("clips long titles and quotes", () => {
    const payload = toPayload(snapshot([job({ title: "x".repeat(400), quote: "y".repeat(400) })]));
    expect(payload.jobs[0]!.title).toHaveLength(160);
    expect(payload.jobs[0]!.quote!.endsWith("…")).toBe(true);
  });
});
