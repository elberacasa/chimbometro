import type { Question } from "@/lib/jev/types";

/**
 * Everything Jev is asked about an offer, sent together in one request so the questions run in
 * parallel. Question ids are for our code only; each instruction carries its full meaning.
 * Tested against research/data/sample_offers.json with `npm run jev:eval`.
 */

const CONTEXT =
  "`oferta` is a job offer shared by a Venezuelan software developer. Judge it from the point " +
  "of view of a developer in Venezuela deciding whether the offer is fair.";

const noul = (instruction: string) => ({
  type: "noul" as const,
  instructions: [CONTEXT, instruction],
});

export const RED_FLAG_QUESTIONS = {
  unicornio: noul(
    "Does `oferta` ask for far more skills or experience than the stated level or pay justifies, " +
      "for example a junior role that expects senior full-stack, DevOps, cloud and data skills?",
  ),
  multirol: noul(
    "Does `oferta` expect one person to cover several distinct jobs (for example developer plus " +
      "designer, community manager, IT support, or sales)?",
  ),
  sueldo_bajo: noul(
    "Is the pay in `oferta` clearly too low for the work and experience requested, judged against " +
      "what developers in Venezuela or LATAM remote roles usually earn in US dollars?",
  ),
  sin_sueldo: noul(
    "Does `oferta` omit the salary or hide it behind phrases like 'a convenir' or 'según experiencia'?",
  ),
  trabajo_gratis: noul(
    "Does `oferta` ask for unpaid work: a large test project, a free trial period, or payment only " +
      "in exposure, equity or future profits?",
  ),
  pago_bolivares: noul(
    "Does `oferta` pay in bolívares, or tie the pay to a bolívar exchange rate instead of a fixed " +
      "USD amount?",
  ),
  camiseta: noul(
    "Does `oferta` lean on emotional pressure instead of compensation, such as 'somos una familia', " +
      "'ponte la camiseta', 'buscamos gente apasionada que no mire el reloj'?",
  ),
  horario_abusivo: noul(
    "Does `oferta` require excessive hours, weekend work, or constant availability?",
  ),
  estafa: noul(
    "Does `oferta` show signs of a scam: upfront payments by the candidate, requests for bank or " +
      "identity data, crypto schemes, or promises of income that are too good to be true?",
  ),
} satisfies Record<string, Question>;

export const QUESTIONS = {
  ...RED_FLAG_QUESTIONS,
  absurdo: {
    type: "score",
    instructions: [CONTEXT, "Overall, how unfair is `oferta` for the candidate?"],
    criteria: [
      "Fair: pay, requirements and conditions are reasonable for the role.",
      "Some issues: one or two weak points, but a developer could reasonably accept it.",
      "Bad: several unfair conditions; most experienced developers would decline.",
      "Absurd: the demands and the pay or conditions are so mismatched it reads like a joke.",
    ],
  },
  veredicto: {
    type: "choice",
    instructions: [CONTEXT, "Which description best summarizes `oferta`?"],
    criteria: {
      departamento_it: "They want a whole IT department in one person.",
      explotacion: "A real, paid job whose salary or conditions are exploitative.",
      estafa: "Likely a scam or not a real job.",
      gratis:
        "They want work for free: an unpaid test project that is real product work, an unpaid trial, or pay only in equity, exposure or future promises.",
      decente: "A reasonable, decent offer.",
      sin_info: "Not enough information to judge.",
    },
  },
} satisfies Record<string, Question>;

export type Questions = typeof QUESTIONS;
export type RedFlagId = keyof typeof RED_FLAG_QUESTIONS;
export type VerdictId = keyof Questions["veredicto"]["criteria"];
