import { describe, expect, it } from "vitest";
import { formatInt, formatMs, formatPercent, formatUsd } from "./format";

describe("format", () => {
  it("groups thousands with dots", () => expect(formatInt(16534)).toBe("16.534"));
  it("keeps three significant digits for sub-cent costs", () =>
    expect(formatUsd(0.00006048)).toBe("$0,0000605"));
  it("shows cents normally", () => expect(formatUsd(0.0163)).toBe("$0,0163"));
  it("rounds percentages", () => expect(formatPercent(0.974)).toBe("97\u00a0%"));
  it("switches to seconds past 1000 ms", () => {
    expect(formatMs(694)).toBe("694 ms");
    expect(formatMs(1520)).toBe("1,52 s");
  });
});
