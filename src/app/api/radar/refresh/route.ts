import { NextResponse } from "next/server";
import { appendLedger } from "@/lib/ledger";
import { refreshRadar, type RadarEvent } from "@/lib/radar/refresh";
import { serverConfig } from "@/lib/server/config";
import { admit, clientIp, isSameOrigin } from "@/lib/server/guard";

export const runtime = "nodejs";
// A first run judges ~500 listings; later runs only the new ones.
export const maxDuration = 300;

const LOCK_KEY = "radar:lock";
const COOLDOWN_KEY = "radar:cooldown";
/** Anyone can watch an update live, but at most one every 15 minutes for everybody. */
const COOLDOWN_SECONDS = 15 * 60;

/** Visitor-triggered update, streamed as NDJSON so the page can show every step live. */
export async function POST(req: Request) {
  const config = serverConfig();
  if (!config.ok) return error(503, "El radar no está disponible en este momento.");
  if (!isSameOrigin(req.headers)) return error(403, "Solicitud rechazada.");

  const admission = await admit(config.store, clientIp(req.headers), config.limits).catch(
    () => null,
  );
  if (!admission) return error(503, "El radar no está disponible en este momento.");
  if (!admission.ok) return error(admission.status, admission.message);

  if (!(await config.store.claim(COOLDOWN_KEY, COOLDOWN_SECONDS))) {
    return error(
      429,
      "El radar se actualizó hace poco. Puedes ver la repetición de la última actualización.",
    );
  }
  if (!(await config.store.claim(LOCK_KEY, maxDuration))) {
    return error(409, "Ya hay una actualización en curso.");
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: RadarEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      try {
        const { events } = await refreshRadar({
          apiKey: config.apiKey,
          store: config.store,
          budgetUsd: config.limits.dailyBudgetUsd,
          trigger: "visitor",
          onEvent: send,
        });
        await logRun(events);
      } catch (e) {
        send({ type: "error", t: 0, message: "La actualización falló. Intenta más tarde." });
        console.error(JSON.stringify({ event: "radar.failed", message: (e as Error).message }));
        // A failed run should not block the next visitor for 15 minutes.
        await config.store.release(COOLDOWN_KEY).catch(() => {});
      } finally {
        await config.store.release(LOCK_KEY).catch(() => {});
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/** Scheduled update from Vercel Cron, authenticated with CRON_SECRET. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return error(401, "No autorizado.");
  }
  const config = serverConfig();
  if (!config.ok) return error(503, config.problem);
  if (!(await config.store.claim(LOCK_KEY, maxDuration)))
    return error(409, "Ya hay una actualización en curso.");
  try {
    const { snapshot, events } = await refreshRadar({
      apiKey: config.apiKey,
      store: config.store,
      budgetUsd: config.limits.dailyBudgetUsd,
      trigger: "cron",
    });
    await logRun(events);
    return NextResponse.json({ run: snapshot?.run ?? null });
  } finally {
    await config.store.release(LOCK_KEY).catch(() => {});
  }
}

/** One structured log line per run; in development the run also goes to the build ledger. */
async function logRun(events: RadarEvent[]) {
  const done = events.find((e) => e.type === "done");
  if (!done || done.type !== "done") return;
  const { run } = done;
  console.log(
    JSON.stringify({ event: "radar.refreshed", ...run, eligible: done.eligible, jobs: done.jobs }),
  );
  if (process.env.NODE_ENV === "development" && run.judged > 0) {
    await appendLedger({
      model: run.model ?? "unknown",
      at: run.startedAt,
      purpose: "Actualizar Chamba Radar en el servidor local",
      script: "src/app/api/radar/refresh/route.ts (dev)",
      calls: run.judged,
      input_tokens: run.inputTokens,
      cost_usd: Number(run.costUsd.toFixed(8)),
      exact: true,
    }).catch(() => {});
  }
}

function error(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}
