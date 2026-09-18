"use client";

import { SOURCE_LABEL } from "@/lib/radar/labels";
import type { SourceId } from "@/lib/radar/types";
import type { JobView } from "@/lib/radar/view";
import styles from "./RadarScope.module.css";

/**
 * The radar as a chart: one dot per listing. Each source gets a sector, named along the rim; the
 * distance from the center is the listing's age (newest in the middle), and green means it accepts
 * someone living in Venezuela. During a live update the beam sweeps and freshly judged listings ping.
 */

const C = 160;
const R = 138;
const INNER = 18;
const MAX_AGE_DAYS = 45;
/** Dots keep this many degrees away from sector edges, so sectors read as groups. */
const EDGE = 4;
/** Every source in a fixed order, so a source keeps its sector as others come and go. */
const ORDER = Object.keys(SOURCE_LABEL) as SourceId[];
const RINGS = [
  { days: 7, label: "1 semana" },
  { days: 30, label: "1 mes" },
];

type Dot = Pick<JobView, "id" | "source" | "eligible" | "postedAt" | "title">;

type Props = {
  jobs: Dot[];
  /** Ids judged in the current live run, so they can ping. */
  fresh: Set<string>;
  sweeping: boolean;
  now: number;
};

export function RadarScope({ jobs, fresh, sweeping, now }: Props) {
  const eligible = jobs.filter((j) => j.eligible).length;
  const sources = ORDER.filter((s) => jobs.some((j) => j.source === s));
  const step = 360 / Math.max(1, sources.length);
  const startOf = (s: SourceId) => -90 + sources.indexOf(s) * step;
  return (
    <figure className={styles.figure}>
      <svg
        viewBox="-16 -16 352 352"
        className={`${styles.svg} ${sweeping ? styles.sweeping : ""}`}
        role="img"
        aria-label={`Radar: ${jobs.length} empleos, ${eligible} aceptan a alguien en Venezuela.`}
      >
        <defs>
          <radialGradient id="scope-bg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--scope-glow)" />
            <stop offset="100%" stopColor="var(--scope-bg)" />
          </radialGradient>
          <linearGradient id="beam" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--scope-beam)" stopOpacity="0" />
            <stop offset="100%" stopColor="var(--scope-beam)" stopOpacity="0.35" />
          </linearGradient>
        </defs>

        <circle cx={C} cy={C} r={R} fill="url(#scope-bg)" className={styles.rim} />
        {RINGS.map((ring) => {
          const r = radiusFor(ring.days);
          return (
            <g key={ring.days}>
              <circle cx={C} cy={C} r={r} className={styles.ring} />
            </g>
          );
        })}
        {sources.map((s) => {
          const start = startOf(s);
          const [ex, ey] = polar(start, R);
          // Names read left to right: arcs on the lower half run the other way, a bit further out.
          const mid = start + step / 2;
          const lower = mid > 0 && mid < 180;
          const r = lower ? R + 12 : R + 5;
          const [ax, ay] = polar(lower ? start + step : start, r);
          const [bx, by] = polar(lower ? start : start + step, r);
          return (
            <g key={s}>
              <line x1={C} y1={C} x2={ex} y2={ey} className={styles.axis} />
              <path
                id={`sector-${s}`}
                d={`M ${ax} ${ay} A ${r} ${r} 0 0 ${lower ? 0 : 1} ${bx} ${by}`}
                fill="none"
              />
              <text className={styles.sourceLabel}>
                <textPath href={`#sector-${s}`} startOffset="50%" textAnchor="middle">
                  {SOURCE_LABEL[s]}
                </textPath>
              </text>
            </g>
          );
        })}

        <g className={styles.beam}>
          <path
            d={`M ${C} ${C} L ${C + R} ${C} A ${R} ${R} 0 0 0 ${polar(-40, R).join(" ")} Z`}
            fill="url(#beam)"
          />
          <line x1={C} y1={C} x2={C + R} y2={C} className={styles.beamLine} />
        </g>

        {jobs.map((j) => {
          const [x, y] = position(j, now, startOf(j.source), step);
          const isFresh = fresh.has(j.id);
          return (
            <circle
              key={j.id}
              cx={x}
              cy={y}
              r={j.eligible ? 2.9 : 2}
              className={`${j.eligible ? styles.hit : styles.miss} ${isFresh ? styles.ping : ""}`}
            >
              <title>{j.title}</title>
            </circle>
          );
        })}
        <circle cx={C} cy={C} r={3} className={styles.center} />
        {/* Drawn last, left of the top sector edge where dots are sparse, outlined to stay legible. */}
        {RINGS.map((ring) => (
          <text
            key={ring.days}
            x={C - 4}
            y={C - radiusFor(ring.days) - 3}
            textAnchor="end"
            className={styles.ringLabel}
          >
            {ring.label}
          </text>
        ))}
      </svg>
      <figcaption className={styles.legend}>
        <span className={styles.keyHit}>acepta Venezuela</span>
        <span className={styles.keyMiss}>no acepta</span>
        <span>más cerca del centro, más reciente</span>
      </figcaption>
    </figure>
  );
}

function position(j: Dot, now: number, start: number, step: number): [number, number] {
  const h = hash(j.id);
  const span = Math.max(1, step - 2 * EDGE);
  const angle = start + EDGE + ((h % 1000) / 1000) * span;
  const age = j.postedAt ? (now - new Date(j.postedAt).getTime()) / 86_400_000 : 20 + (h % 20);
  // Small jitter so listings posted the same day don't stack.
  const r = radiusFor(Math.max(0, age)) + ((h >> 8) % 7) - 3;
  return polar(angle, Math.min(R - 4, Math.max(INNER, r)));
}

function radiusFor(days: number) {
  return INNER + (Math.min(days, MAX_AGE_DAYS) / MAX_AGE_DAYS) * (R - INNER - 6);
}

function polar(deg: number, r: number): [number, number] {
  const rad = (deg * Math.PI) / 180;
  return [
    Math.round((C + r * Math.cos(rad)) * 10) / 10,
    Math.round((C + r * Math.sin(rad)) * 10) / 10,
  ];
}

/** Stable per-id number, so a listing keeps its place between visits. */
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
