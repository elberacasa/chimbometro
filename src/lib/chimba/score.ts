import type { SystemOneResponse } from "@/lib/jev/types";
import { RED_FLAG_QUESTIONS, type Questions, type RedFlagId, type VerdictId } from "./questions";

/**
 * The Chimbómetro score is plain code over Jev's probabilities, so the policy is visible and
 * tunable without calling the model again.
 */

type FlagSpec = { label: string; weight: number };

export const RED_FLAGS: Record<RedFlagId, FlagSpec> = {
  unicornio: { label: "Piden un unicornio", weight: 0.9 },
  multirol: { label: "Varios cargos en uno", weight: 0.7 },
  sueldo_bajo: { label: "Sueldo muy bajo", weight: 0.85 },
  sin_sueldo: { label: "Sueldo escondido", weight: 0.4 },
  trabajo_gratis: { label: "Quieren trabajo gratis", weight: 0.95 },
  pago_bolivares: { label: "Pago en bolívares", weight: 0.5 },
  camiseta: { label: "“Ponte la camiseta”", weight: 0.45 },
  horario_abusivo: { label: "Horario sin límites", weight: 0.6 },
  estafa: { label: "Huele a estafa", weight: 1 },
};

export const VERDICTS: Record<VerdictId, string> = {
  departamento_it: "Quieren un departamento de IT entero",
  explotacion: "Trabajo real, condiciones de explotación",
  estafa: "Esto es una estafa",
  gratis: "Quieren que trabajes gratis",
  decente: "Oferta decente",
  sin_info: "Muy poca información para juzgar",
};

export type Band = { id: "decente" | "sospechosa" | "chimba" | "chimbisima"; label: string };

const BANDS: Array<Band & { from: number }> = [
  { from: 75, id: "chimbisima", label: "Chimbísima" },
  { from: 50, id: "chimba", label: "Chimba" },
  { from: 25, id: "sospechosa", label: "Sospechosa" },
  { from: 0, id: "decente", label: "Decente" },
];

/** Probabilities below this barely count, so noise on many flags can't add up to a verdict. */
export const FLAG_FLOOR = 0.3;
export const ABSURDITY_SHARE = 0.5;

export type FlagResult = { id: RedFlagId; label: string; probability: number; weight: number };

export type ChimbaResult = {
  score: number;
  band: Band;
  verdict: { id: VerdictId; label: string; confidence: number };
  /** Jev's overall unfairness score, 0 (fair) to 3 (absurd). */
  absurdity: number;
  /** Every red flag, most likely first. */
  flags: FlagResult[];
};

export function scoreOffer(answers: SystemOneResponse<Questions>["answers"]): ChimbaResult {
  const flags = (Object.keys(RED_FLAG_QUESTIONS) as RedFlagId[])
    .map((id) => ({ id, ...RED_FLAGS[id], probability: answers[id].noul }))
    .sort((a, b) => b.probability - a.probability);

  // Noisy-OR: each flag independently makes the offer worse, weighted by how bad it is.
  const clean = flags.reduce((acc, f) => acc * (1 - f.weight * aboveFloor(f.probability)), 1);
  const flagIndex = 1 - clean;
  const absurdityIndex = answers.absurdo.score / 3;
  const score = Math.round(
    100 * (ABSURDITY_SHARE * absurdityIndex + (1 - ABSURDITY_SHARE) * flagIndex),
  );

  const verdictId = answers.veredicto.choice as VerdictId;
  return {
    score,
    band: bandFor(score),
    verdict: {
      id: verdictId,
      label: VERDICTS[verdictId],
      confidence: answers.veredicto.confidence,
    },
    absurdity: answers.absurdo.score,
    flags,
  };
}

export function bandFor(score: number): Band {
  const { id, label } = BANDS.find((b) => score >= b.from) ?? BANDS[BANDS.length - 1]!;
  return { id, label };
}

function aboveFloor(p: number) {
  return Math.max(0, (p - FLAG_FLOOR) / (1 - FLAG_FLOOR));
}
