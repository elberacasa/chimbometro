import type { Question, SystemOneRequest, SystemOneResponse } from "./types";

const API_URL = "https://api.typesafe.ai/v1/systemone";
const RETRYABLE = new Set([429, 500, 502, 503, 529]);
const MAX_ATTEMPTS = 4;
const TIMEOUT_MS = 20_000;

export class JevError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
    this.name = "JevError";
  }
}

export type JevCall<Qs extends Record<string, Question>> = {
  request: SystemOneRequest<Qs>;
  response: SystemOneResponse<Qs>;
  /** Round trip of the successful attempt, measured from our side. */
  latencyMs: number;
  attempts: number;
};

/**
 * Sends one System One request. Retries rate limits and overloads with exponential backoff;
 * any other failure throws a JevError. Works in Node scripts and in route handlers.
 */
export async function askJev<Qs extends Record<string, Question>>(
  apiKey: string,
  request: SystemOneRequest<Qs>,
): Promise<JevCall<Qs>> {
  const body = JSON.stringify(request);

  for (let attempt = 1; ; attempt++) {
    const started = performance.now();
    let res: Response;
    try {
      res = await fetch(API_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      if (attempt < MAX_ATTEMPTS) {
        await backoff(attempt);
        continue;
      }
      throw new JevError(`Jev is unreachable: ${(error as Error).message}`, null);
    }

    if (res.ok) {
      const response = (await res.json()) as SystemOneResponse<Qs>;
      return {
        request,
        response,
        latencyMs: Math.round(performance.now() - started),
        attempts: attempt,
      };
    }
    if (RETRYABLE.has(res.status) && attempt < MAX_ATTEMPTS) {
      await backoff(attempt);
      continue;
    }
    throw new JevError(
      `Jev returned HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`,
      res.status,
    );
  }
}

function backoff(attempt: number) {
  const ms = 2 ** (attempt - 1) * 400 + Math.random() * 250;
  return new Promise((resolve) => setTimeout(resolve, ms));
}
