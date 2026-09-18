import { describe, expect, it } from "vitest";
import type { SystemOneResponse } from "@/lib/jev/types";
import type { Questions, RedFlagId } from "./questions";
import { bandFor, DEFAULT_POLICY, scoreOffer } from "./score";

type Answers = SystemOneResponse<Questions>["answers"];

function answers(
  flags: Partial<Record<RedFlagId, number>>,
  absurdo: number,
  veredicto = "decente",
): Answers {
  const noul = (p = 0.05) => ({ type: "noul" as const, noul: p });
  return {
    unicornio: noul(flags.unicornio),
    multirol: noul(flags.multirol),
    sueldo_bajo: noul(flags.sueldo_bajo),
    sin_sueldo: noul(flags.sin_sueldo),
    trabajo_gratis: noul(flags.trabajo_gratis),
    pago_bolivares: noul(flags.pago_bolivares),
    camiseta: noul(flags.camiseta),
    horario_abusivo: noul(flags.horario_abusivo),
    estafa: noul(flags.estafa),
    absurdo: { type: "score", score: absurdo, legend: {}, probabilities: {}, confidence: 0.9 },
    veredicto: { type: "choice", choice: veredicto, probabilities: {}, confidence: 0.9 },
  };
}

describe("scoreOffer", () => {
  // Probabilities below mirror what Jev returned for the offers in examples.ts.
  it("scores the junior unicorn offer as chimbísima", () => {
    const r = scoreOffer(
      answers(
        { unicornio: 0.97, multirol: 0.45, sueldo_bajo: 0.95, horario_abusivo: 0.86 },
        2.99,
        "departamento_it",
      ),
    );
    expect(r.score).toBeGreaterThanOrEqual(90);
    expect(r.band.id).toBe("chimbisima");
    expect(r.flags[0]?.id).toBe("unicornio");
    expect(r.verdict.label).toBe("Quieren un departamento de IT entero");
  });

  it("keeps a decent offer in the decent band even with low-level noise on every flag", () => {
    const noise = {
      unicornio: 0.1,
      multirol: 0.05,
      sueldo_bajo: 0.23,
      sin_sueldo: 0.02,
      estafa: 0.08,
      horario_abusivo: 0.09,
    };
    const r = scoreOffer(answers(noise, 0.45));
    expect(r.score).toBeLessThan(25);
    expect(r.band.id).toBe("decente");
  });

  it("stays between 0 and 100", () => {
    const all = Object.fromEntries(
      [
        "unicornio",
        "multirol",
        "sueldo_bajo",
        "sin_sueldo",
        "trabajo_gratis",
        "pago_bolivares",
        "camiseta",
        "horario_abusivo",
        "estafa",
      ].map((k) => [k, 1]),
    );
    expect(scoreOffer(answers(all, 3)).score).toBe(100);
    expect(scoreOffer(answers({}, 0)).score).toBe(0);
  });
});

describe("policy", () => {
  const unicorn = answers({ unicornio: 0.97, sueldo_bajo: 0.95 }, 1.5, "departamento_it");

  it("with zero flag weights, only the absurdity share counts", () => {
    const weights = Object.fromEntries(
      Object.keys(DEFAULT_POLICY.weights).map((k) => [k, 0]),
    ) as typeof DEFAULT_POLICY.weights;
    expect(scoreOffer(unicorn, { ...DEFAULT_POLICY, weights }).score).toBe(25);
  });

  it("with the absurdity share at 1, flags stop mattering", () => {
    expect(scoreOffer(unicorn, { ...DEFAULT_POLICY, absurdityShare: 1 }).score).toBe(50);
  });

  it("a floor of 1 ignores every flag instead of dividing by zero", () => {
    expect(scoreOffer(unicorn, { ...DEFAULT_POLICY, floor: 1 }).score).toBe(25);
  });
});

describe("bandFor", () => {
  it.each([
    [0, "decente"],
    [24, "decente"],
    [25, "sospechosa"],
    [50, "chimba"],
    [75, "chimbisima"],
    [100, "chimbisima"],
  ])("%i → %s", (score, id) => expect(bandFor(score).id).toBe(id));
});
