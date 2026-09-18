import { describe, expect, it } from "vitest";
import { decideEligibility } from "./judge";

const where = (choice: string) => ({
  type: "choice" as const,
  choice,
  probabilities: {},
  confidence: 0.9,
});
const excl = (p: number) => ({ type: "noul" as const, noul: p });

describe("decideEligibility", () => {
  it("trusts a structured source field over Jev's reading", () => {
    // Get on Board says "remote only for residents"; Jev read the text as "anywhere".
    expect(
      decideEligibility(
        { structuredWhere: "country_only" },
        { where: where("anywhere"), excludes_venezuela: excl(0.1) },
      ),
    ).toEqual({
      eligible: false,
      decidedBy: "source",
    });
    expect(
      decideEligibility(
        { structuredWhere: "anywhere" },
        { where: where("unclear"), excludes_venezuela: excl(0.1) },
      ).eligible,
    ).toBe(true);
  });

  it("still honors an explicit exclusion in the text of a worldwide listing", () => {
    expect(
      decideEligibility(
        { structuredWhere: "anywhere" },
        { where: where("anywhere"), excludes_venezuela: excl(0.8) },
      ).eligible,
    ).toBe(false);
  });

  it.each([
    ["anywhere", true],
    ["americas_or_latam", true],
    ["us_or_canada", false],
    ["europe", false],
    ["specific_countries", false],
    ["onsite_or_hybrid", false],
    ["unclear", false],
  ])("uses Jev's location when the source has no field: %s → %s", (choice, eligible) => {
    expect(
      decideEligibility(
        { structuredWhere: null },
        { where: where(choice), excludes_venezuela: excl(0.1) },
      ),
    ).toEqual({
      eligible,
      decidedBy: "jev",
    });
  });
});
