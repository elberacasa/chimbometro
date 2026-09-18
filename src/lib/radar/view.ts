import type { RadarJob, RadarSnapshot } from "./types";

/**
 * What the browser receives: only the fields the page renders or filters on, and only real job
 * posts. The stored snapshot keeps everything; this keeps phones from parsing half a megabyte.
 */
export type JobView = Pick<
  RadarJob,
  | "id"
  | "source"
  | "title"
  | "company"
  | "url"
  | "postedAt"
  | "salary"
  | "eligible"
  | "decidedBy"
  | "where"
  | "whereConfidence"
  | "excludesVenezuela"
  | "usd"
  | "seniority"
  | "juniorFriendly"
  | "location"
  | "role"
  | "english"
  | "quote"
>;

export type RadarPayload = Pick<RadarSnapshot, "updatedAt" | "sources" | "run"> & {
  jobs: JobView[];
};

const MAX_TEXT = 160;

export function toPayload(snapshot: RadarSnapshot): RadarPayload {
  return {
    updatedAt: snapshot.updatedAt,
    sources: snapshot.sources,
    run: snapshot.run,
    jobs: snapshot.jobs
      // A radar for developers: non-tech roles (sales, support, admin) are left out entirely.
      .filter((j) => j.isJob && j.techRole)
      .map((j) => ({
        id: j.id,
        source: j.source,
        title: clip(j.title),
        company: clip(j.company),
        url: j.url,
        postedAt: j.postedAt,
        salary: j.salary,
        eligible: j.eligible,
        decidedBy: j.decidedBy,
        where: j.where,
        whereConfidence: j.whereConfidence,
        excludesVenezuela: j.excludesVenezuela,
        usd: j.usd,
        seniority: j.seniority,
        // Judgments stored before v3 had no junior question.
        juniorFriendly: j.juniorFriendly ?? j.seniority === "junior",
        location: clip(j.location),
        role: j.role,
        english: j.english,
        quote: j.quote && clip(j.quote),
      })),
  };
}

function clip(s: string) {
  return s.length > MAX_TEXT ? `${s.slice(0, MAX_TEXT - 1).trimEnd()}…` : s;
}
