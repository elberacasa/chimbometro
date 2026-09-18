import { describe, expect, it } from "vitest";
import { MemoryStore } from "@/lib/server/counter-store";
import type { Analysis } from "./analyze";
import { loadShared, newShareId, saveShared, toShared } from "./share";

const analysis = {
  result: {
    score: 94,
    band: { id: "chimbisima", label: "Chimbísima" },
    verdict: {
      id: "departamento_it",
      label: "Quieren un departamento de IT entero",
      confidence: 0.6,
    },
    absurdity: 2.9,
    flags: [
      { id: "unicornio", label: "Piden un unicornio", probability: 0.97, weight: 0.9 },
      { id: "estafa", label: "Huele a estafa", probability: 0.1, weight: 1 },
    ],
  },
  facts: { salary: { currency: "USD", amounts: [250] }, technologies: ["React", "Vue"] },
  fragments: [{ id: "f1", text: "Empresa Secreta C.A. busca junior", start: 0, end: 33 }],
  evidence: [],
  receipt: { jevMs: 600, costUsd: 0.00015, questionCount: 20 },
} as unknown as Analysis;

describe("shared results", () => {
  it("makes 8-character ids from an unambiguous alphabet", () => {
    const id = newShareId();
    expect(id).toMatch(/^[a-zA-Z0-9]{8}$/);
    expect(id).not.toMatch(/[0O1lI]/);
  });

  it("keeps only raised flags and never the offer text", () => {
    const shared = toShared("abcdefgh", analysis);
    expect(shared.flags).toEqual([{ label: "Piden un unicornio", probability: 0.97 }]);
    expect(JSON.stringify(shared)).not.toContain("Empresa Secreta");
  });

  it("round-trips through the store and rejects malformed ids", async () => {
    const store = new MemoryStore();
    await saveShared(store, toShared("abcdefgh", analysis));
    expect((await loadShared(store, "abcdefgh"))?.score).toBe(94);
    expect(await loadShared(store, "../etc")).toBeNull();
  });
});
