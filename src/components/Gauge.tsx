"use client";

import { useEffect, useRef } from "react";
import { arcPath, needleRotation, polar, valueToAngle } from "@/lib/dial";
import styles from "./Gauge.module.css";

const CX = 220;
const CY = 232;
const R = 196;
const GAP = 0.9;

// Three hues; the last band is told apart by width and its label, not by a fourth color.
const BANDS = [
  { from: 0, to: 25, color: "var(--good)", width: 9 },
  { from: 25, to: 50, color: "var(--warn)", width: 9 },
  { from: 50, to: 75, color: "var(--bad)", width: 9 },
  { from: 75, to: 100, color: "var(--bad)", width: 17 },
];
const LABELS = [0, 25, 50, 75, 100];
const TICKS = Array.from({ length: 51 }, (_, i) => i * 2);
/** Like a real meter, the needle rests on a stop peg just below zero, clear of the "0" label. */
const REST = -5;

export type GaugeState = "idle" | "measuring" | "done";

type Props = { value: number | null; state: GaugeState; label: string };

export function Gauge({ value, state, label }: Props) {
  const needleRef = useRef<SVGGElement>(null);
  const readoutRef = useRef<HTMLSpanElement>(null);
  // The animation loop reads the latest props from a ref so it never restarts mid-swing.
  const target = useRef({ state, value });
  useEffect(() => {
    target.current = { state, value };
  }, [state, value]);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let x = REST;
    let v = 0;
    let last = performance.now();
    let frame = 0;

    const draw = (pos: number) => {
      needleRef.current?.setAttribute("transform", `rotate(${needleRotation(pos)} ${CX} ${CY})`);
      if (readoutRef.current) {
        const { state: s } = target.current;
        readoutRef.current.textContent =
          s === "idle" ? "" : String(Math.round(Math.min(100, Math.max(0, pos))));
      }
    };

    const tick = (now: number) => {
      const dt = Math.min(0.032, (now - last) / 1000);
      last = now;
      const { state: s, value: val } = target.current;
      // While Jev is thinking the needle hunts around the middle of the dial.
      const goal =
        s === "measuring"
          ? 34 + 22 * Math.sin(now / 260)
          : s === "done" && val !== null
            ? val
            : REST;

      if (reduced) {
        x = s === "measuring" ? x : goal;
      } else {
        // Underdamped spring: overshoots a little and settles, like a real meter.
        const stiffness = s === "measuring" ? 60 : 110;
        const damping = s === "measuring" ? 14 : 9;
        v += (stiffness * (goal - x) - damping * v) * dt;
        x += v * dt;
      }
      draw(Math.min(104, Math.max(REST, x)));
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div
      className={styles.gauge}
      role="meter"
      aria-label="Chimbómetro"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={state === "done" && value !== null ? value : undefined}
      aria-valuetext={
        state === "done" && value !== null ? `${value} de 100, ${label}` : "Sin medir"
      }
      aria-busy={state === "measuring"}
    >
      <svg viewBox="0 0 440 262" className={styles.svg} aria-hidden="true">
        <path className={styles.track} d={arcPath(CX, CY, R + 14, 180, 0)} />

        {BANDS.map((b) => (
          <path
            key={b.from}
            d={arcPath(
              CX,
              CY,
              R - b.width / 2 + 4.5,
              valueToAngle(b.from) - (b.from ? GAP : 0),
              valueToAngle(b.to) + (b.to < 100 ? GAP : 0),
            )}
            stroke={b.color}
            strokeWidth={b.width}
            fill="none"
          />
        ))}

        {TICKS.map((t) => {
          const major = t % 10 === 0;
          const [x1, y1] = polar(CX, CY, R - 12, valueToAngle(t));
          const [x2, y2] = polar(CX, CY, R - (major ? 26 : 19), valueToAngle(t));
          return (
            <line
              key={t}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              className={major ? styles.major : styles.minor}
            />
          );
        })}

        {LABELS.map((t) => {
          const [x, y] = polar(CX, CY, R - 46, valueToAngle(t));
          return (
            <text
              key={t}
              x={x}
              y={y}
              className={styles.scale}
              textAnchor="middle"
              dominantBaseline="central"
            >
              {t}
            </text>
          );
        })}

        <g ref={needleRef} transform={`rotate(${needleRotation(REST)} ${CX} ${CY})`}>
          <path
            className={styles.needle}
            d={`M ${CX - 5} ${CY} L ${CX - 1} ${CY - R + 22} L ${CX + 1} ${CY - R + 22} L ${CX + 5} ${CY} Z`}
          />
        </g>
        <circle cx={CX} cy={CY} r={13} className={styles.hub} />
        <circle cx={CX} cy={CY} r={4} className={styles.hubDot} />
      </svg>
      <p className={styles.readout} aria-hidden="true">
        <span ref={readoutRef} className={styles.value} />
        <span className={styles.band}>
          {state === "done" ? label : state === "measuring" ? "Midiendo…" : "Sin medir"}
        </span>
      </p>
    </div>
  );
}
