"use client";

import { useEffect, useRef } from "react";
import { costUsd } from "@/lib/jev/pricing";
import { formatInt, formatUsd } from "@/lib/format";
import type { RadarEvent } from "@/lib/radar/refresh";
import styles from "./RefreshConsole.module.css";

export type ConsoleMode = "idle" | "live" | "replay";

type Props = {
  events: RadarEvent[];
  /** Ids the radar shows (tech roles), to label older recorded runs that lack `techRole`. */
  techIds: Set<string>;
  mode: ConsoleMode;
  message: string | null;
  onRefresh: () => void;
  onReplay: () => void;
  onSkip: () => void;
};

/** Lines kept on screen; the full run is always summarized in the counters above them. */
const VISIBLE_LINES = 80;

/**
 * The radar update as a terminal: which URLs our server requested, what came back, and every
 * listing Jev judged, as it happens (live) or with its original timing (replay).
 */
export function RefreshConsole({
  events,
  techIds,
  mode,
  message,
  onRefresh,
  onReplay,
  onSkip,
}: Props) {
  const logRef = useRef<HTMLOListElement>(null);
  const busy = mode !== "idle";

  const sources = events.filter((e) => e.type === "source");
  const plan = events.find((e) => e.type === "plan");
  const judged = events.filter((e) => e.type === "judged");
  const done = events.find((e) => e.type === "done");
  const tokens = judged.reduce((n, e) => n + e.tokens, 0);
  const elapsed = events.at(-1)?.t ?? 0;
  const firstVisible = Math.max(0, events.length - VISIBLE_LINES);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [events.length]);

  return (
    <section className={styles.console} aria-label="Actualización del radar">
      <header className={styles.bar}>
        <span className={styles.title}>
          {mode === "live"
            ? "actualizando en vivo"
            : mode === "replay"
              ? "repetición de la última actualización"
              : "actualización del radar"}
        </span>
        <span className={styles.actions}>
          {busy ? (
            mode === "replay" && (
              <button type="button" onClick={onSkip}>
                Saltar al final
              </button>
            )
          ) : (
            <>
              <button type="button" onClick={onReplay}>
                Ver la última
              </button>
              <button type="button" className={styles.primary} onClick={onRefresh}>
                Actualizar ahora
              </button>
            </>
          )}
        </span>
      </header>

      <dl className={styles.meters}>
        <div>
          <dt>fuentes</dt>
          <dd className="num">
            {sources.filter((s) => s.type === "source" && s.report.status === "ok").length}/4
          </dd>
        </div>
        <div>
          <dt>ofertas</dt>
          <dd className="num">{plan ? formatInt(plan.fetched) : "–"}</dd>
        </div>
        <div>
          <dt>jev evaluó</dt>
          <dd className="num">
            {plan ? `${formatInt(judged.length)}/${formatInt(plan.toJudge)}` : "–"}
          </dd>
        </div>
        <div>
          <dt>tokens</dt>
          <dd className="num">{formatInt(tokens)}</dd>
        </div>
        <div>
          <dt>costo</dt>
          <dd className="num">{formatUsd(costUsd({ input_tokens: tokens, output_tokens: 0 }))}</dd>
        </div>
        <div>
          <dt>tiempo</dt>
          <dd className="num">{(elapsed / 1000).toFixed(1).replace(".", ",")} s</dd>
        </div>
      </dl>
      {plan && plan.toJudge > 0 && (
        <div className={styles.progress} aria-hidden="true">
          <span style={{ width: `${(judged.length / plan.toJudge) * 100}%` }} />
        </div>
      )}

      <ol ref={logRef} className={styles.log} aria-live="off">
        {events.length === 0 && (
          <li className={styles.idle}>
            {message ??
              "Pulsa «Actualizar ahora» para ver al radar buscar y a Jev leer cada oferta en vivo."}
          </li>
        )}
        {events.slice(firstVisible).map((e, i) => (
          // Keyed by position in the whole run, so lines already on screen never remount (and
          // never replay their fade-in) as new ones arrive.
          <Line key={firstVisible + i} e={e} techIds={techIds} />
        ))}
        {message && events.length > 0 && <li className={styles.err}>{message}</li>}
      </ol>

      {done && done.type === "done" && (
        <p className={styles.summary} aria-live="polite">
          {formatInt(done.eligible)} de {formatInt(done.jobs)} empleos aceptan a alguien en
          Venezuela.{" "}
          {done.run.judged > 0
            ? `Jev leyó ${formatInt(done.run.judged)} ofertas nuevas en ${(done.run.ms / 1000).toFixed(1).replace(".", ",")} s por ${formatUsd(done.run.costUsd)}.`
            : "No había ofertas nuevas: todo venía de la actualización anterior."}
        </p>
      )}
    </section>
  );
}

function Line({ e, techIds }: { e: RadarEvent; techIds: Set<string> }) {
  const t = <span className={`${styles.t} num`}>+{formatInt(e.t)} ms</span>;
  switch (e.type) {
    case "start":
      return (
        <li>
          {t}
          <span>
            inicio{" "}
            {e.trigger === "cron"
              ? "(programado)"
              : e.trigger === "visitor"
                ? "(pedido por un visitante)"
                : ""}
          </span>
        </li>
      );
    case "source":
      return (
        <li>
          {t}
          <span>
            <span className={e.report.status === "ok" ? styles.ok : styles.err}>
              {e.report.status === "ok" ? "GET 200" : "GET falló"}
            </span>{" "}
            {e.report.requested.map((u) => (
              <a key={u} href={u} className={styles.url}>
                {shortUrl(u)}
              </a>
            ))}{" "}
            <span className={styles.dim}>
              {formatInt(e.report.listings)} ofertas en {formatInt(e.report.ms)} ms
            </span>
          </span>
        </li>
      );
    case "plan":
      return (
        <li>
          {t}
          <span>
            {formatInt(e.fetched)} ofertas únicas:{" "}
            <span className={styles.dim}>{formatInt(e.reused)} ya evaluadas,</span>{" "}
            <span className={styles.hot}>{formatInt(e.toJudge)} nuevas para Jev</span>
          </span>
        </li>
      );
    case "judged": {
      const tech = e.techRole ?? techIds.has(e.id);
      const verdict = !e.isJob
        ? "no es empleo"
        : !tech
          ? "no es tech"
          : e.eligible
            ? "acepta VE"
            : "no acepta";
      return (
        <li>
          {t}
          <span>
            <span
              className={
                verdict === "acepta VE"
                  ? styles.ok
                  : verdict === "no acepta"
                    ? styles.no
                    : styles.dim
              }
            >
              {verdict}
            </span>{" "}
            <a href={e.url} className={styles.job}>
              {e.title.slice(0, 70)}
            </a>
            {e.quote && <span className={styles.quote}> «{e.quote.slice(0, 60)}»</span>}
            <span className={styles.dim}>
              {" "}
              {formatInt(e.ms)} ms{e.decidedBy === "source" ? ", ubicación por la fuente" : ""}
            </span>
          </span>
        </li>
      );
    }
    case "done":
      return (
        <li>
          {t}
          <span className={styles.ok}>listo</span>
        </li>
      );
    case "error":
      return (
        <li className={styles.err}>
          {t}
          <span>{e.message}</span>
        </li>
      );
  }
}

function shortUrl(u: string) {
  const url = new URL(u);
  const path = url.pathname.length > 28 ? `${url.pathname.slice(0, 28)}…` : url.pathname;
  return `${url.host}${path}${url.search ? "?…" : ""} `;
}
