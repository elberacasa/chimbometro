import type { SystemOneResponse } from "@/lib/jev/types";
import type { Analysis } from "./analyze";
import type { Questions } from "./questions";

/**
 * The /api/chimba response is a stream of newline-delimited JSON events, written the moment each
 * step happens. `t` is milliseconds since the server received the request.
 */
export type ChimbaEvent =
  | { type: "received"; t: number; chars: number }
  | { type: "sent"; t: number; model: string; questions: number; endpoint: string }
  | { type: "answered"; t: number; jevMs: number; response: SystemOneResponse<Questions> }
  | { type: "scored"; t: number; analysis: Analysis }
  | { type: "error"; t: number; message: string };

export const JEV_ENDPOINT = "api.typesafe.ai/v1/systemone";

/** Reads an NDJSON body, yielding events as their lines arrive. */
export async function* readEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<ChimbaEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline: number;
    while ((newline = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) yield JSON.parse(line) as ChimbaEvent;
    }
  }
  if (buffer.trim()) yield JSON.parse(buffer) as ChimbaEvent;
}
