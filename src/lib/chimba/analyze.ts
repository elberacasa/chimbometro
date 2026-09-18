import { askJev } from "@/lib/jev/client";
import { costUsd } from "@/lib/jev/pricing";
import type { SystemOneRequest, SystemOneResponse, Usage } from "@/lib/jev/types";
import { findSalary, findTechnologies, type Salary } from "./extract";
import { QUESTIONS, type Questions } from "./questions";
import { scoreOffer, type ChimbaResult } from "./score";

export const MODEL = "jev-latest";
export const MIN_OFFER_CHARS = 40;
export const MAX_OFFER_CHARS = 6000;

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
  request: SystemOneRequest<Questions>;
  response: SystemOneResponse<Questions>;
};

export type Analysis = {
  result: ChimbaResult;
  facts: { salary: Salary | null; technologies: string[] };
  receipt: Receipt;
};

export function buildRequest(offer: string): SystemOneRequest<Questions> {
  return { model: MODEL, state: { oferta: offer }, questions: QUESTIONS };
}

type Hooks = {
  /** Called right before the request leaves for Jev. */
  onSend?: (request: SystemOneRequest<Questions>) => void;
  /** Called the moment Jev's response arrives, before scoring. */
  onAnswer?: (response: SystemOneResponse<Questions>, jevMs: number) => void;
};

export async function analyzeOffer(
  apiKey: string,
  offer: string,
  hooks: Hooks = {},
): Promise<Analysis> {
  const started = performance.now();
  const request = buildRequest(offer);
  hooks.onSend?.(request);
  const call = await askJev(apiKey, request);
  hooks.onAnswer?.(call.response, call.latencyMs);

  const scoring = performance.now();
  const result = scoreOffer(call.response.answers);
  const facts = { salary: findSalary(offer), technologies: findTechnologies(offer) };
  const scoreMs = performance.now() - scoring;

  return {
    result,
    facts,
    receipt: {
      model: call.response.model,
      usage: call.response.usage,
      costUsd: costUsd(call.response.usage),
      jevMs: call.latencyMs,
      scoreMs,
      totalMs: Math.round(performance.now() - started),
      attempts: call.attempts,
      questionCount: Object.keys(QUESTIONS).length,
      request: call.request,
      response: call.response,
    },
  };
}
