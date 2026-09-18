import { randomBytes } from "node:crypto";
import type { CounterStore } from "@/lib/server/counter-store";
import type { Analysis } from "./analyze";

/**
 * A measurement that can be shared by link. It is saved by the server at scoring time, so a
 * shared card is always a real result, and it holds no offer text: only the score, the verdict and
 * the raised flags.
 */
export type SharedResult = {
  id: string;
  at: string;
  score: number;
  band: Analysis["result"]["band"];
  verdict: { label: string; confidence: number };
  flags: Array<{ label: string; probability: number }>;
  technologies: number;
  salary: Analysis["facts"]["salary"];
  jevMs: number;
  costUsd: number;
  questions: number;
};

const TTL_SECONDS = 180 * 86_400;
const RAISED = 0.5;
const ID_ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ID_PATTERN = /^[a-zA-Z0-9]{8}$/;

export function newShareId(): string {
  // 57^8 ≈ 1.1e14 ids; unguessable enough for public, non-sensitive cards.
  return Array.from(randomBytes(8), (b) => ID_ALPHABET[b % ID_ALPHABET.length]).join("");
}

export function toShared(id: string, analysis: Analysis): SharedResult {
  const { result, facts, receipt } = analysis;
  return {
    id,
    at: new Date().toISOString(),
    score: result.score,
    band: result.band,
    verdict: { label: result.verdict.label, confidence: result.verdict.confidence },
    flags: result.flags
      .filter((f) => f.probability >= RAISED)
      .map((f) => ({ label: f.label, probability: f.probability })),
    technologies: facts.technologies.length,
    salary: facts.salary,
    jevMs: receipt.jevMs,
    costUsd: receipt.costUsd,
    questions: receipt.questionCount,
  };
}

export async function saveShared(store: CounterStore, shared: SharedResult) {
  await store.setJson(`share:${shared.id}`, shared, TTL_SECONDS);
}

export async function loadShared(store: CounterStore, id: string) {
  if (!ID_PATTERN.test(id)) return null;
  return store.getJson<SharedResult>(`share:${id}`);
}
