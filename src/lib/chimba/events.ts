import type { SystemOneResponse } from "@/lib/jev/types";
import { readNdjson } from "@/lib/stream/ndjson";
import type { AllQuestions, Analysis } from "./analyze";

/**
 * The /api/chimba response is a stream of newline-delimited JSON events, written the moment each
 * step happens. `t` is milliseconds since the server received the request.
 */
export type ChimbaEvent =
  | {
      type: "received";
      t: number;
      chars: number;
      /** Time spent on origin, size and rate-limit checks before anything reached Jev. */
      guardMs: number;
    }
  | {
      type: "sent";
      t: number;
      model: string;
      endpoint: string;
      /** Question ids in request order, so the UI can draw one lane per question. */
      questionIds: string[];
      fragments: number;
    }
  | { type: "answered"; t: number; jevMs: number; response: SystemOneResponse<AllQuestions> }
  | {
      type: "scored";
      t: number;
      analysis: Analysis;
      /** Short id of the saved result, for sharing by link; null if saving failed. */
      shareId: string | null;
    }
  | { type: "error"; t: number; message: string };

export const JEV_ENDPOINT = "api.typesafe.ai/v1/systemone";

/** Reads the /api/chimba stream. */
export function readEvents(body: ReadableStream<Uint8Array>) {
  return readNdjson<ChimbaEvent>(body);
}
