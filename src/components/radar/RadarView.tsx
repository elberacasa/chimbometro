"use client";

import { useEffect, useRef, useState } from "react";
import { formatInt, formatPercent } from "@/lib/format";
import { timeAgo } from "@/lib/radar/labels";
import type { RadarEvent } from "@/lib/radar/refresh";
import type { RadarPayload } from "@/lib/radar/view";
import { readNdjson } from "@/lib/stream/ndjson";
import { JobList } from "./JobList";
import { RadarScope } from "./RadarScope";
import { RefreshConsole, type ConsoleMode } from "./RefreshConsole";
import { SourcesPanel } from "./SourcesPanel";
import styles from "./RadarView.module.css";

type Props = { initial: RadarPayload | null; renderedAt: number };

export function RadarView({ initial, renderedAt }: Props) {
  const [snapshot, setSnapshot] = useState(initial);
  const [events, setEvents] = useState<RadarEvent[]>([]);
  const [mode, setMode] = useState<ConsoleMode>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  // Relative times start from the server render and move forward after each live update.
  const [now, setNow] = useState(renderedAt);
  const timers = useRef<number[]>([]);
  const replayQueue = useRef<RadarEvent[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const push = (e: RadarEvent) => {
    setEvents((prev) => [...prev, e]);
    if (e.type === "judged") setFresh((prev) => new Set(prev).add(e.id));
  };

  async function reloadSnapshot() {
    const res = await fetch("/api/radar", { cache: "no-store" });
    if (res.ok) setSnapshot((await res.json()) as RadarPayload);
    setNow(Date.now());
  }

  async function refresh() {
    setEvents([]);
    setFresh(new Set());
    setMessage(null);
    setMode("live");
    try {
      const res = await fetch("/api/radar/refresh", { method: "POST" });
      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setMessage(body.error ?? "No pudimos actualizar el radar.");
        setMode("idle");
        // Someone refreshed recently: show that run instead of an empty console.
        if (res.status === 429) await replay();
        return;
      }
      for await (const e of readNdjson<RadarEvent>(res.body)) push(e);
      await reloadSnapshot();
    } catch {
      setMessage("Se cortó la conexión con el radar.");
    } finally {
      setMode((m) => (m === "live" ? "idle" : m));
    }
  }

  /** Replays the last run with its original timing. */
  async function replay() {
    const res = await fetch("/api/radar/last-run");
    if (!res.ok) {
      setMessage("Todavía no hay una actualización para repetir.");
      return;
    }
    const recorded = (await res.json()) as RadarEvent[];
    timers.current.forEach(clearTimeout);
    replayQueue.current = recorded;
    setEvents([]);
    setFresh(new Set());
    setMode("replay");
    recorded.forEach((e, i) => {
      timers.current.push(
        window.setTimeout(() => {
          push(e);
          if (i === recorded.length - 1) setMode("idle");
        }, e.t),
      );
    });
  }

  function skip() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setEvents(replayQueue.current);
    setFresh(new Set(replayQueue.current.flatMap((e) => (e.type === "judged" ? [e.id] : []))));
    setMode("idle");
  }

  const jobs = snapshot?.jobs ?? [];
  const eligible = jobs.filter((j) => j.eligible);
  const juniors = eligible.filter((j) => j.seniority === "junior").length;

  return (
    <>
      <section className={styles.hero} aria-labelledby="radar-titulo">
        <div className={styles.intro}>
          <h1 id="radar-titulo" className={styles.title}>
            Empleos remotos que sí aceptan a Venezuela
          </h1>
          {snapshot ? (
            <p className={styles.stat}>
              <strong className="num">{formatInt(eligible.length)}</strong> de{" "}
              {formatInt(jobs.length)} ofertas remotas (
              {formatPercent(eligible.length / Math.max(1, jobs.length))}) te dejan trabajar desde
              Venezuela. {juniors > 0 && `${formatInt(juniors)} son para juniors.`}
            </p>
          ) : (
            <p className={styles.stat}>
              El radar todavía no tiene datos. Pulsa «Actualizar ahora» para llenarlo.
            </p>
          )}
          <p className={styles.lede}>
            Revisamos cuatro bolsas de empleo públicas. Jev lee cada oferta, decide si alguien que
            vive en Venezuela puede aplicar y cita la frase que lo demuestra. Cada oferta enlaza a
            la original.
          </p>
          {snapshot && (
            <p className={styles.updated}>
              Actualizado {timeAgo(snapshot.updatedAt, now)} con {snapshot.sources.length} fuentes.
            </p>
          )}
        </div>
        <RadarScope jobs={jobs} fresh={fresh} sweeping={mode !== "idle"} now={now} />
      </section>

      <RefreshConsole
        events={events}
        mode={mode}
        message={message}
        onRefresh={refresh}
        onReplay={replay}
        onSkip={skip}
      />

      {snapshot && (
        <section className={styles.body} aria-label="Empleos">
          <JobList jobs={snapshot.jobs} now={now} />
          <SourcesPanel snapshot={snapshot} now={now} />
        </section>
      )}
    </>
  );
}
