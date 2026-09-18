import { NextResponse } from "next/server";
import { analyzeOffer, MAX_OFFER_CHARS, MIN_OFFER_CHARS, MODEL } from "@/lib/chimba/analyze";
import { JEV_ENDPOINT, type ChimbaEvent } from "@/lib/chimba/events";
import { JevError } from "@/lib/jev/client";
import { appendLedger } from "@/lib/ledger";
import { RateLimiter } from "@/lib/rate-limit";

export const runtime = "nodejs";

// Per instance. Enough to stop a loop from burning the key; put a shared store in front at scale.
const limiter = new RateLimiter({ limit: 12, windowMs: 60_000 });
const DEV_PURPOSE = "Probar el sitio en el servidor local";

export async function POST(req: Request) {
  const received = performance.now();
  const apiKey = process.env.TYPESAFE_API_KEY;
  if (!apiKey) return error(500, "El servidor no tiene configurada la API key de TypeSafe.");

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const retryAfter = limiter.hit(ip);
  if (retryAfter) {
    return error(429, `Muchas ofertas seguidas. Prueba otra vez en ${retryAfter} s.`, {
      "Retry-After": String(retryAfter),
    });
  }

  const body = (await req.json().catch(() => null)) as { oferta?: unknown } | null;
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

      emit({ type: "received", t: t(), chars: offer.length });
      try {
        const analysis = await analyzeOffer(apiKey, offer, {
          onSend: (request) =>
            emit({
              type: "sent",
              t: t(),
              model: MODEL,
              questions: Object.keys(request.questions).length,
              endpoint: JEV_ENDPOINT,
            }),
          onAnswer: (response, jevMs) => emit({ type: "answered", t: t(), jevMs, response }),
        });
        emit({ type: "scored", t: t(), analysis });

        const { receipt, result } = analysis;
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

function error(status: number, message: string, headers?: Record<string, string>) {
  return NextResponse.json({ error: message }, { status, headers });
}
