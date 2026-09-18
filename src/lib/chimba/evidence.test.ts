import { describe, expect, it } from "vitest";
import { EXAMPLES } from "./examples";
import { MAX_FRAGMENTS, evidenceQuestions, readEvidence, splitFragments } from "./evidence";

describe("splitFragments", () => {
  it("splits on sentences, colons and line breaks, keeping exact offsets", () => {
    const text = "Se busca Junior. Requisitos: React y Vue.\nSueldo: 250$ al mes";
    const fragments = splitFragments(text);
    expect(fragments.map((f) => f.text)).toEqual([
      "Se busca Junior.",
      "Requisitos:",
      "React y Vue.",
      "Sueldo:",
      "250$ al mes",
    ]);
    for (const f of fragments) expect(text.slice(f.start, f.end)).toBe(f.text);
    expect(fragments.map((f) => f.id)).toEqual(["f1", "f2", "f3", "f4", "f5"]);
  });

  it("never exceeds the fragment cap and keeps the tail text", () => {
    const text = Array.from({ length: 50 }, (_, i) => `Frase número ${i}.`).join(" ");
    const fragments = splitFragments(text);
    expect(fragments).toHaveLength(MAX_FRAGMENTS);
    expect(fragments.at(-1)!.text.endsWith("Frase número 49.")).toBe(true);
  });

  it("covers every example offer without losing words", () => {
    for (const ex of EXAMPLES) {
      const joined = splitFragments(ex.text)
        .map((f) => f.text)
        .join(" ");
      expect(joined.replace(/\s+/g, "")).toBe(ex.text.replace(/\s+/g, ""));
    }
  });
});

describe("evidence questions", () => {
  it("asks one choice per flag with every fragment plus a none option", () => {
    const qs = evidenceQuestions(splitFragments("Uno dos tres. Cuatro cinco seis."));
    expect(Object.keys(qs)).toHaveLength(9);
    expect(Object.keys(qs.evidencia_estafa.criteria)).toEqual(["f1", "f2", "ninguno"]);
  });

  it("reads confident choices and skips none or unsure ones", () => {
    const answers = {
      evidencia_unicornio: { type: "choice", choice: "f2", probabilities: { f2: 0.8 } },
      evidencia_estafa: { type: "choice", choice: "ninguno", probabilities: { ninguno: 0.9 } },
      evidencia_multirol: { type: "choice", choice: "f1", probabilities: { f1: 0.2 } },
    };
    expect(readEvidence(answers)).toEqual([
      { flag: "unicornio", fragmentId: "f2", probability: 0.8 },
    ]);
  });
});
