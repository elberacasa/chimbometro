import { describe, expect, it } from "vitest";
import { englishLabel, needsConfirmation, timeAgo } from "./labels";

describe("labels", () => {
  it.each([
    [0.2, "Sin inglés"],
    [1, "Inglés básico"],
    [2.1, "Inglés profesional"],
    [2.8, "Inglés nativo"],
  ])("english %d → %s", (score, label) => expect(englishLabel(score)).toBe(label));

  it("only asks to confirm Jev's own low-confidence readings, never source fields", () => {
    expect(needsConfirmation({ decidedBy: "jev", whereConfidence: 0.4 })).toBe(true);
    expect(needsConfirmation({ decidedBy: "jev", whereConfidence: 0.9 })).toBe(false);
    expect(needsConfirmation({ decidedBy: "source", whereConfidence: 0.2 })).toBe(false);
  });

  it("formats relative times in Spanish", () => {
    const now = Date.UTC(2026, 8, 18, 12);
    expect(timeAgo(new Date(now - 12 * 60_000).toISOString(), now)).toBe("hace 12 minutos");
    expect(timeAgo(new Date(now - 86_400_000).toISOString(), now)).toBe("ayer");
  });
});
