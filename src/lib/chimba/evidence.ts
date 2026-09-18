import type { ChoiceQuestion } from "@/lib/jev/types";
import type { RedFlagId } from "./questions";

/**
 * Evidence: which part of the offer triggered each red flag. Code splits the offer into
 * fragments; Jev picks the fragment that best proves each flag ("select instead of generate"), so
 * every highlight on the page points at text the author actually wrote.
 */

export type Fragment = { id: string; text: string; start: number; end: number };

/** Upper bound so long offers can't make the question set explode. */
export const MAX_FRAGMENTS = 32;
const NONE = "ninguno";

// A fragment ends at sentence punctuation followed by whitespace (so "2.200" and "Node.js" stay
// whole), at a line break, or at a bullet.
const BOUNDARY = /[^\n•]+?(?:[.!?;:]+(?=\s|$)|(?=\n|•|$))/g;

export function splitFragments(text: string): Fragment[] {
  const fragments: Fragment[] = [];
  for (const m of text.matchAll(BOUNDARY)) {
    const raw = m[0];
    const lead = raw.length - raw.trimStart().length;
    const trimmed = raw.trim();
    if (trimmed.replace(/[^\p{L}\p{N}]/gu, "").length < 3) continue;
    const start = m.index + lead;
    fragments.push({ id: "", text: trimmed, start, end: start + trimmed.length });
  }
  // Merge the tail into the last allowed fragment instead of dropping text.
  if (fragments.length > MAX_FRAGMENTS) {
    const last = fragments[MAX_FRAGMENTS - 1]!;
    const tail = fragments[fragments.length - 1]!;
    last.end = tail.end;
    last.text = text.slice(last.start, last.end);
    fragments.length = MAX_FRAGMENTS;
  }
  return fragments.map((f, i) => ({ ...f, id: `f${i + 1}` }));
}

/** What each flag's evidence looks like, phrased for Jev. */
const TARGETS: Record<RedFlagId, string> = {
  unicornio: "asks for far more skills or experience than the level or pay justifies",
  multirol: "expects one person to do several distinct jobs",
  sueldo_bajo: "offers pay that is too low for the work requested",
  sin_sueldo: "hides or omits the salary",
  trabajo_gratis: "asks for unpaid work, an unpaid trial, or pay in equity or exposure",
  pago_bolivares: "pays in bolívares or ties pay to a bolívar exchange rate",
  camiseta: "uses emotional pressure such as 'somos una familia' or 'ponte la camiseta'",
  horario_abusivo: "demands excessive hours, weekends or constant availability",
  estafa: "shows a scam signal such as upfront payments or requests for bank or identity data",
};

export type EvidenceId = `evidencia_${RedFlagId}`;

export function evidenceQuestions(fragments: Fragment[]): Record<EvidenceId, ChoiceQuestion> {
  const criteria: Record<string, string> = Object.fromEntries(
    fragments.map((f) => [f.id, `The fragment \`fragmentos.${f.id}\`.`]),
  );
  criteria[NONE] = "No fragment shows this.";

  return Object.fromEntries(
    (Object.keys(TARGETS) as RedFlagId[]).map((flag) => [
      `evidencia_${flag}`,
      {
        type: "choice",
        instructions:
          "`fragmentos` are consecutive pieces of the job offer in `oferta`. Which fragment is the " +
          `strongest evidence that the offer ${TARGETS[flag]}?`,
        criteria,
      } satisfies ChoiceQuestion,
    ]),
  ) as Record<EvidenceId, ChoiceQuestion>;
}

export function fragmentState(fragments: Fragment[]): Record<string, string> {
  return Object.fromEntries(fragments.map((f) => [f.id, f.text]));
}

export type Evidence = { flag: RedFlagId; fragmentId: string; probability: number };

/** The chosen fragment per flag, skipping "none" and choices Jev is unsure about. */
export function readEvidence(
  answers: Record<
    string,
    { type: string; choice?: string; probabilities?: Record<string, number> }
  >,
  minProbability = 0.35,
): Evidence[] {
  return (Object.keys(TARGETS) as RedFlagId[]).flatMap((flag) => {
    const a = answers[`evidencia_${flag}`];
    if (!a || a.type !== "choice" || !a.choice || a.choice === NONE) return [];
    const probability = a.probabilities?.[a.choice] ?? 0;
    return probability >= minProbability ? [{ flag, fragmentId: a.choice, probability }] : [];
  });
}
