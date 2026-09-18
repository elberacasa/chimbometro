import { fragmentState, splitFragments } from "@/lib/chimba/evidence";
import { askJev } from "@/lib/jev/client";
import type { ChoiceAnswer, NoulAnswer, ScoreAnswer } from "@/lib/jev/types";
import { RADAR_QUESTIONS, RADAR_QUESTIONS_VERSION, whereEvidenceQuestion } from "./questions";
import type { Listing, RadarJob, Role, Seniority, Where } from "./types";

const MODEL = "jev-latest";
/** Where the location usually is stated; later fragments rarely matter and cost tokens. */
const EVIDENCE_FRAGMENTS = 24;
const MAX_TEXT = 6000;
const EXCERPT = 260;
/** Below this, a location judgment is shown as "confirmar". */
export const LOW_CONFIDENCE = 0.6;

export type Judgment = {
  is_job: NoulAnswer;
  tech_role: NoulAnswer;
  where: ChoiceAnswer;
  excludes_venezuela: NoulAnswer;
  junior_friendly: NoulAnswer;
  usd: NoulAnswer;
  seniority: ChoiceAnswer;
  role: ChoiceAnswer;
  english: ScoreAnswer;
  evidencia_where: ChoiceAnswer;
};

/** Code decides from a structured field when the source has one; otherwise Jev's reading counts. */
export function decideEligibility(
  listing: Pick<Listing, "structuredWhere">,
  j: Pick<Judgment, "where" | "excludes_venezuela">,
): { eligible: boolean; decidedBy: RadarJob["decidedBy"] } {
  const excluded = j.excludes_venezuela.noul >= 0.5;
  if (listing.structuredWhere) {
    return { eligible: listing.structuredWhere === "anywhere" && !excluded, decidedBy: "source" };
  }
  const where = j.where.choice as Where;
  return {
    eligible: (where === "anywhere" || where === "americas_or_latam") && !excluded,
    decidedBy: "jev",
  };
}

/** Levels stated in a source field win; otherwise Jev's reading counts. */
export function decideLevel(
  listing: Pick<Listing, "levels">,
  j: Pick<Judgment, "seniority" | "junior_friendly">,
): { seniority: Seniority; juniorFriendly: boolean } {
  const levels = listing.levels ?? [];
  if (levels.length > 0) {
    return {
      seniority: levels.length === 1 ? levels[0]! : (j.seniority.choice as Seniority),
      juniorFriendly: levels.includes("junior"),
    };
  }
  const seniority = j.seniority.choice as Seniority;
  return { seniority, juniorFriendly: seniority === "junior" || j.junior_friendly.noul >= 0.5 };
}

export async function judgeListing(apiKey: string, listing: Listing) {
  const source = [listing.title, listing.location && `Location: ${listing.location}`, listing.text]
    .filter(Boolean)
    .join("\n")
    .slice(0, MAX_TEXT);
  const fragments = splitFragments(source).slice(0, EVIDENCE_FRAGMENTS);

  const call = await askJev(apiKey, {
    model: MODEL,
    state: {
      job: {
        title: listing.title,
        company: listing.company,
        location: listing.location,
        text: source,
      },
      fragmentos: fragmentState(fragments),
    },
    questions: { ...RADAR_QUESTIONS, evidencia_where: whereEvidenceQuestion(fragments) },
  });
  const j = call.response.answers as unknown as Judgment;
  const { eligible, decidedBy } = decideEligibility(listing, j);
  const { seniority, juniorFriendly } = decideLevel(listing, j);
  const quoteId = j.evidencia_where.choice;
  const quote =
    quoteId !== "ninguno" && (j.evidencia_where.probabilities[quoteId] ?? 0) >= 0.35
      ? (fragments.find((f) => f.id === quoteId)?.text ?? null)
      : null;

  const job: RadarJob = {
    id: listing.id,
    source: listing.source,
    title: listing.title,
    company: listing.company,
    location: listing.location,
    url: listing.url,
    postedAt: listing.postedAt,
    excerpt: excerpt(listing.text),
    salary: listing.salary,
    isJob: j.is_job.noul >= 0.5,
    techRole: j.tech_role.noul >= 0.5,
    eligible,
    decidedBy,
    where: j.where.choice as Where,
    whereConfidence: round(j.where.confidence),
    excludesVenezuela: round(j.excludes_venezuela.noul),
    usd: round(j.usd.noul),
    seniority,
    juniorFriendly,
    role: j.role.choice as Role,
    english: round(j.english.score),
    quote,
    judgedAt: new Date().toISOString(),
    inputTokens: call.response.usage.input_tokens,
    version: RADAR_QUESTIONS_VERSION,
  };
  return { job, latencyMs: call.latencyMs, usage: call.response.usage, model: call.response.model };
}

function excerpt(text: string) {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > EXCERPT ? `${flat.slice(0, EXCERPT).replace(/\s\S*$/, "")}…` : flat;
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}
