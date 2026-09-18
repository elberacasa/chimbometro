import type { Analysis } from "./analyze";
import { readEvents, type ChimbaEvent } from "./events";

export type Measurement = { analysis: Analysis; roundTripMs: number; shareId: string | null };

/**
 * Calls /api/chimba from the browser and reports each streamed event as it arrives.
 * Throws with a user-facing message on any failure.
 */
export async function requestMeasurement(
  offer: string,
  onEvent: (event: ChimbaEvent) => void,
): Promise<Measurement> {
  const started = performance.now();
  const res = await fetch("/api/chimba", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ oferta: offer }),
  });
  if (!res.ok || !res.body) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "No pudimos medir la oferta.");
  }

  let analysis: Analysis | null = null;
  let shareId: string | null = null;
  for await (const event of readEvents(res.body)) {
    onEvent(event);
    if (event.type === "error") throw new Error(event.message);
    if (event.type === "scored") {
      analysis = event.analysis;
      shareId = event.shareId;
    }
  }
  if (!analysis) throw new Error("La respuesta llegó incompleta. Intenta de nuevo.");
  return { analysis, roundTripMs: Math.round(performance.now() - started), shareId };
}
