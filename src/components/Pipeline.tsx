"use client";

import { useEffect, useRef } from "react";
import type { ChimbaEvent } from "@/lib/chimba/events";
import { formatInt } from "@/lib/format";
import styles from "./Pipeline.module.css";

/**
 * The request as a live diagram: the offer fans out into one lane per question, all lanes reach
 * Jev in a single request, and the answers color the lanes the moment the response lands. Every
 * state change is driven by a real stream event; the waiting counter runs on the browser clock.
 */

const W = 560;
const H = 176;
const OFFER = { x: 6, y: 44, w: 92, h: 92 };
const JEV = { x: 300, y: 52, w: 100, h: 76 };
const FORMULA = { x: 430, y: 72, w: 58, h: 36 };
const SCORE = { cx: 526, cy: 90, r: 28 };
/** How far apart the lanes get at their widest, between the two nodes. */
const SPREAD: [number, number] = [6, H - 30];
const LANE_SPREAD_END: [number, number] = [JEV.y + 8, JEV.y + JEV.h - 8];
const PLACEHOLDER_LANES = 20;

type Answer = {
  type: string;
  noul?: number;
  choice?: string;
  probabilities?: Record<string, number>;
};
type Phase = "idle" | "waiting" | "answered" | "scored" | "error";

type Props = { events: ChimbaEvent[]; running: boolean };

export function Pipeline({ events, running }: Props) {
  const sent = events.find((e) => e.type === "sent");
  const answered = events.find((e) => e.type === "answered");
  const scored = events.find((e) => e.type === "scored");
  const failed = events.some((e) => e.type === "error");

  const phase: Phase = failed
    ? "error"
    : scored
      ? "scored"
      : answered
        ? "answered"
        : sent && running
          ? "waiting"
          : "idle";

  const ids = sent?.questionIds ?? Array.from({ length: PLACEHOLDER_LANES }, (_, i) => `q${i}`);
  const answers = (answered?.response.answers ?? {}) as Record<string, Answer>;
  const analysis = scored?.analysis;
  const raised = new Set(
    analysis?.result.flags.filter((f) => f.probability >= 0.5).map((f) => f.id),
  );
  const evidenced = new Set(analysis?.evidence.map((e) => `evidencia_${e.flag}`));

  return (
    <figure className={styles.figure} data-phase={phase}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className={styles.svg}
        role="img"
        aria-label={describe(phase, ids.length, answered?.jevMs)}
      >
        {ids.map((id, i) => (
          <path
            key={id}
            d={lanePath(i, ids.length)}
            className={`${styles.lane} ${laneClass(id, answers[id], raised, evidenced)}`}
            style={{ ["--i" as string]: i }}
          />
        ))}

        <Node box={OFFER}>
          <text x={OFFER.x + OFFER.w / 2} y={OFFER.y + 40} className={styles.nodeTitle}>
            oferta
          </text>
          <text x={OFFER.x + OFFER.w / 2} y={OFFER.y + 60} className={styles.nodeSub}>
            {sent ? `${sent.fragments} fragmentos` : "tu texto"}
          </text>
        </Node>

        <Node box={JEV} className={styles.jev}>
          <text x={JEV.x + JEV.w / 2} y={JEV.y + 30} className={styles.nodeTitle}>
            jev
          </text>
          <text x={JEV.x + JEV.w / 2} y={JEV.y + 52} className={styles.nodeMetric}>
            {phase === "waiting" ? (
              <LiveMs />
            ) : answered ? (
              `${formatInt(answered.jevMs)} ms`
            ) : (
              "system one"
            )}
          </text>
        </Node>

        <path
          d={`M ${JEV.x + JEV.w} ${JEV.y + JEV.h / 2} H ${FORMULA.x}`}
          className={styles.link}
        />
        <Node box={FORMULA} className={styles.formula}>
          <text x={FORMULA.x + FORMULA.w / 2} y={FORMULA.y + 23} className={styles.nodeSmall}>
            fórmula
          </text>
        </Node>
        <path
          d={`M ${FORMULA.x + FORMULA.w} ${SCORE.cy} H ${SCORE.cx - SCORE.r}`}
          className={styles.link}
        />

        <circle
          cx={SCORE.cx}
          cy={SCORE.cy}
          r={SCORE.r}
          className={`${styles.score} ${analysis ? styles[analysis.result.band.id] : ""}`}
        />
        <text x={SCORE.cx} y={SCORE.cy + 8} className={styles.scoreValue}>
          {analysis ? analysis.result.score : "–"}
        </text>

        <text x={(OFFER.x + OFFER.w + JEV.x) / 2} y={H - 4} className={styles.caption}>
          {ids.length} preguntas en un solo request
        </text>
      </svg>
      <figcaption className={styles.legend}>
        <span className={styles.keyBad}>bandera activada</span>
        <span className={styles.keyOk}>evidencia encontrada en el texto</span>
        <span className={styles.keyDim}>no aplica</span>
      </figcaption>
    </figure>
  );
}

function Node({
  box,
  className,
  children,
}: {
  box: typeof OFFER;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <g className={className}>
      <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={10} className={styles.node} />
      {children}
    </g>
  );
}

/** Ticks against the browser clock while mounted. */
function LiveMs() {
  const ref = useRef<SVGTSpanElement>(null);
  useEffect(() => {
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      if (ref.current) ref.current.textContent = `${formatInt(now - start)} ms`;
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  return <tspan ref={ref}>0 ms</tspan>;
}

/** Lanes leave the offer from one point, spread wide, and converge on Jev: a visible fan-out. */
function lanePath(i: number, n: number) {
  const t = n === 1 ? 0.5 : i / (n - 1);
  const x0 = OFFER.x + OFFER.w;
  const y0 = OFFER.y + OFFER.h / 2;
  const x1 = JEV.x;
  const y1 = LANE_SPREAD_END[0] + t * (LANE_SPREAD_END[1] - LANE_SPREAD_END[0]);
  const wide = SPREAD[0] + t * (SPREAD[1] - SPREAD[0]);
  return `M ${x0} ${y0} C ${x0 + 70} ${wide} ${x1 - 70} ${wide} ${x1} ${y1}`;
}

function laneClass(id: string, a: Answer | undefined, raised: Set<string>, evidenced: Set<string>) {
  if (!a) return "";
  if (a.type === "noul") return raised.has(id) ? styles.bad : styles.dim;
  if (id.startsWith("evidencia_")) return evidenced.has(id) ? styles.ok : styles.dim;
  return styles.neutral;
}

function describe(phase: Phase, n: number, jevMs?: number) {
  if (phase === "waiting") return `Enviando ${n} preguntas a Jev en un solo request`;
  if (jevMs !== undefined) return `Jev respondió ${n} preguntas en ${jevMs} milisegundos`;
  return `Diagrama: la oferta se divide en ${n} preguntas que Jev responde en paralelo`;
}
