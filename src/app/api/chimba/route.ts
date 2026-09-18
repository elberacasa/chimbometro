import { NextResponse } from "next/server";
import { analyzeOffer, MAX_OFFER_CHARS, MIN_OFFER_CHARS, MODEL } from "@/lib/chimba/analyze";
import { JEV_ENDPOINT, type ChimbaEvent } from "@/lib/chimba/events";
import { JevError } from "@/lib/jev/client";
import { appendLedger } from "@/lib/ledger";
import { serverConfig } from "@/lib/server/config";
import {
  admit,
  clientIp,
  isSameOrigin,
  MAX_BODY_BYTES,
  recordMeasurement,
} from "@/lib/server/guard";

export const runtime = "nodejs";

const DEV_PURPOSE = "Probar el sitio en el servidor local";

export async function POST(req: Request) {
  const received = performance.now();

  const config = serverConfig();
  if (!config.ok) {
    console.error(JSON.stringify({ event: "chimba.misconfigured", problem: config.problem }));
    return error(503, "El Chimbómetro no está disponible en este momento.");
  }
  const { apiKey, store, limits } = config;

  if (!isSameOrigin(req.headers)) return error(403, "Solicitud rechazada.");

  const raw = await readBody(req, MAX_BODY_BYTES);
  if (raw === null) return error(413, "La oferta es demasiado grande.");

  const ip = clientIp(req.headers);
  const admission = await admit(store, ip, limits).catch((e: Error) => {
    // If the limiter can't be checked, don't spend: fail closed.
    console.error(JSON.stringify({ event: "guard.failed", message: e.message }));
    return null;
  });
  if (!admission) return error(503, "El Chimbómetro no está disponible en este momento.");
  if (!admission.ok) {
    console.warn(JSON.stringify({ event: "chimba.limited", reason: admission.reason }));
    return error(admission.status, admission.message, {
      "Retry-After": String(admission.retryAfter),
    });
  }

  const guardMs = Math.round(performance.now() - received);
  const body = parseJson(raw) as { oferta?: unknown } | null;
  const offer = typeof body?.oferta === "string" ? body.oferta.trim() : "";
  if (offer.length < MIN_OFFER_CHARS) {
    return error(
      400,
      `Pega la oferta completa: hacen falta al menos ${MIN_OFFER_CHARS} caracteres.`,
    );
  }
  if (offer.length > MAX_OFFER_CHARS) {
    return error(
      400,
      `La oferta es muy larga. El máximo es ${MAX_OFFER_CHARS.toLocaleString("es-VE")} caracteres.`,
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const t = () => Math.round((performance.now() - received) * 10) / 10;
      const emit = (event: ChimbaEvent) =>
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));

      emit({ type: "received", t: t(), chars: offer.length, guardMs });
      try {
        const analysis = await analyzeOffer(apiKey, offer, {
          onSend: (request, fragments) =>
            emit({
              type: "sent",
              t: t(),
              model: MODEL,
              endpoint: JEV_ENDPOINT,
              questionIds: Object.keys(request.questions),
              fragments: fragments.length,
            }),
          onAnswer: (response, jevMs) => emit({ type: "answered", t: t(), jevMs, response }),
        });
        emit({ type: "scored", t: t(), analysis });

        const { receipt, result } = analysis;
        await recordMeasurement(store, receipt.costUsd).catch((e: Error) =>
          console.error(JSON.stringify({ event: "budget.record_failed", message: e.message })),
        );
        // One structured line per request: what Jev cost us in production. The offer text is not logged.
        console.log(
          JSON.stringify({
            event: "chimba.analyzed",
            model: receipt.model,
            input_tokens: receipt.usage.input_tokens,
            output_tokens: receipt.usage.output_tokens,
            cost_usd: receipt.costUsd,
            jev_ms: receipt.jevMs,
            attempts: receipt.attempts,
            score: result.score,
            verdict: result.verdict.id,
            chars: offer.length,
          }),
        );
        // While building the site every call also goes to the build-cost ledger shown on the page.
        if (process.env.NODE_ENV === "development") {
          await appendLedger({
            model: receipt.model,
            at: new Date().toISOString(),
            purpose: DEV_PURPOSE,
            script: "src/app/api/chimba/route.ts (dev)",
            calls: 1,
            input_tokens: receipt.usage.input_tokens,
            output_tokens: receipt.usage.output_tokens,
            latency_ms: receipt.jevMs,
            cost_usd: Number(receipt.costUsd.toFixed(8)),
            exact: true,
          }).catch((e: Error) =>
            console.error(JSON.stringify({ event: "ledger.failed", message: e.message })),
          );
        }
      } catch (e) {
        const status = e instanceof JevError ? e.status : null;
        console.error(
          JSON.stringify({ event: "chimba.failed", status, message: (e as Error).message }),
        );
        emit({
          type: "error",
          t: t(),
          message:
            status === 429 || status === 529
              ? "Jev está con mucha demanda. Intenta en unos segundos."
              : "No pudimos consultar a Jev. Intenta de nuevo.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/** Reads the body as text, giving up (null) once it passes `maxBytes`. */
async function readBody(req: Request, maxBytes: number): Promise<string | null> {
  const declared = Number(req.headers.get("content-length"));
  if (declared > maxBytes) return null;
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function error(status: number, message: string, headers?: Record<string, string>) {
  return NextResponse.json({ error: message }, { status, headers });
}
