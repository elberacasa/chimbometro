"use client";

import { SOURCE_LABEL } from "@/lib/radar/labels";
import type { RadarJob, SourceId } from "@/lib/radar/types";
import styles from "./RadarScope.module.css";

/**
 * The radar as a chart: one dot per listing. The quadrant is the source, the distance from the
 * center is the listing's age (newest in the middle), and green means it accepts someone living in
 * Venezuela. During a live update the beam sweeps and freshly judged listings ping.
 */

const C = 160;
const R = 138;
const INNER = 18;
const MAX_AGE_DAYS = 45;
const QUADRANT: Record<SourceId, number> = { hn: -90, getonbrd: 0, wwr: 90, remotive: 180 };
const CORNER: Record<SourceId, [number, number, "start" | "end"]> = {
  hn: [320, 6, "end"],
  getonbrd: [320, 318, "end"],
  wwr: [0, 318, "start"],
  remotive: [0, 6, "start"],
};
const RINGS = [
  { days: 7, label: "1 semana" },
  { days: 30, label: "1 mes" },
];

type Dot = Pick<RadarJob, "id" | "source" | "eligible" | "postedAt" | "title">;

type Props = {
  jobs: Dot[];
  /** Ids judged in the current live run, so they can ping. */
  fresh: Set<string>;
  sweeping: boolean;
  now: number;
};

export function RadarScope({ jobs, fresh, sweeping, now }: Props) {
  const eligible = jobs.filter((j) => j.eligible).length;
  return (
    <figure className={styles.figure}>
      <svg
        viewBox="-6 -6 332 332"
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
              {/* On the left axis, which no listing occupies. */}
              <text x={C - r + 4} y={C - 4} className={styles.ringLabel}>
                {ring.label}
              </text>
            </g>
          );
        })}
        <line x1={C - R} y1={C} x2={C + R} y2={C} className={styles.axis} />
        <line x1={C} y1={C - R} x2={C} y2={C + R} className={styles.axis} />

        {(Object.keys(QUADRANT) as SourceId[]).map((s) => {
          // Each source is named in the corner of its quadrant, outside the scope.
          const [x, y, anchor] = CORNER[s];
          return (
            <text key={s} x={x} y={y} className={styles.sourceLabel} textAnchor={anchor}>
              {SOURCE_LABEL[s]}
            </text>
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
          const [x, y] = position(j, now);
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
      </svg>
      <figcaption className={styles.legend}>
        <span className={styles.keyHit}>acepta Venezuela</span>
        <span className={styles.keyMiss}>no acepta</span>
        <span>más cerca del centro, más reciente</span>
      </figcaption>
    </figure>
  );
}

function position(j: Dot, now: number): [number, number] {
  const h = hash(j.id);
  const angle = QUADRANT[j.source] + 5 + (h % 800) / 10;
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
