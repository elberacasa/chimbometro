import { askJev } from "@/lib/jev/client";
import { costUsd } from "@/lib/jev/pricing";
import type { ChoiceQuestion, SystemOneRequest, SystemOneResponse, Usage } from "@/lib/jev/types";
import {
  evidenceQuestions,
  fragmentState,
  readEvidence,
  splitFragments,
  type Evidence,
  type EvidenceId,
  type Fragment,
} from "./evidence";
import { findSalary, findTechnologies, type Salary } from "./extract";
import { QUESTIONS, type Questions } from "./questions";
import { scoreOffer, type ChimbaResult } from "./score";

export const MODEL = "jev-latest";
export const MIN_OFFER_CHARS = 40;
export const MAX_OFFER_CHARS = 6000;

/** The judgment questions plus one evidence question per red flag, all in one request. */
export type AllQuestions = Questions & Record<EvidenceId, ChoiceQuestion>;

/** Everything the page shows about how the answer was produced. */
export type Receipt = {
  model: string;
  usage: Usage;
  costUsd: number;
  /** Round trip from our server to Jev and back. */
  jevMs: number;
  /** Time spent in our own code turning probabilities into the score (no model involved). */
  scoreMs: number;
  totalMs: number;
  attempts: number;
  questionCount: number;
  request: SystemOneRequest<AllQuestions>;
  response: SystemOneResponse<AllQuestions>;
};

export type Analysis = {
  result: ChimbaResult;
  facts: { salary: Salary | null; technologies: string[] };
  /** The offer split into fragments, with offsets into the original text. */
  fragments: Fragment[];
  /** For each red flag Jev could tie to the text, the fragment that proves it. */
  evidence: Evidence[];
  receipt: Receipt;
};

export function buildRequest(offer: string): {
  request: SystemOneRequest<AllQuestions>;
  fragments: Fragment[];
} {
  const fragments = splitFragments(offer);
  return {
    fragments,
    request: {
      model: MODEL,
      state: { oferta: offer, fragmentos: fragmentState(fragments) },
      questions: { ...QUESTIONS, ...evidenceQuestions(fragments) },
    },
  };
}

type Hooks = {
  /** Called right before the request leaves for Jev. */
  onSend?: (request: SystemOneRequest<AllQuestions>, fragments: Fragment[]) => void;
  /** Called the moment Jev's response arrives, before scoring. */
  onAnswer?: (response: SystemOneResponse<AllQuestions>, jevMs: number) => void;
};

export async function analyzeOffer(
  apiKey: string,
  offer: string,
  hooks: Hooks = {},
): Promise<Analysis> {
  const started = performance.now();
  const { request, fragments } = buildRequest(offer);
  hooks.onSend?.(request, fragments);
  const call = await askJev(apiKey, request);
  hooks.onAnswer?.(call.response, call.latencyMs);

  const scoring = performance.now();
  const result = scoreOffer(call.response.answers);
  const raised = new Set(result.flags.filter((f) => f.probability >= 0.5).map((f) => f.id));
  // Evidence was asked for every flag speculatively; keep it only for flags that are raised.
  const evidence = readEvidence(call.response.answers).filter((e) => raised.has(e.flag));
  const facts = { salary: findSalary(offer), technologies: findTechnologies(offer) };
  const scoreMs = performance.now() - scoring;

  return {
    result,
    facts,
    fragments,
    evidence,
    receipt: {
      model: call.response.model,
      usage: call.response.usage,
      costUsd: costUsd(call.response.usage),
      jevMs: call.latencyMs,
      scoreMs,
      totalMs: Math.round(performance.now() - started),
      attempts: call.attempts,
      questionCount: Object.keys(request.questions).length,
      request: call.request,
      response: call.response,
    },
  };
}
