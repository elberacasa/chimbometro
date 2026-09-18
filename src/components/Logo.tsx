import { arcPath } from "@/lib/dial";
import styles from "./Logo.module.css";

/**
 * The mark is a three-zone dial with its needle in the red. Each part is its own element so it
 * can be animated: arcs draw in (pathLength=1), then the needle swings from zero and settles.
 */

const CX = 24;
const CY = 27;
const R = 19;
const ZONES = [
  { from: 180, to: 128, color: "var(--good)" },
  { from: 118, to: 66, color: "var(--warn)" },
  { from: 56, to: 0, color: "var(--bad)" },
];

export function LogoMark({ animated = false, size = 40 }: { animated?: boolean; size?: number }) {
  return (
    <svg
      className={animated ? `${styles.mark} ${styles.animated}` : styles.mark}
      viewBox="0 0 48 32"
      width={size}
      height={(size * 32) / 48}
      aria-hidden="true"
    >
      {ZONES.map((z, i) => (
        <path
          key={z.color}
          className={styles.zone}
          style={{ ["--i" as string]: i }}
          d={arcPath(CX, CY, R, z.from, z.to)}
          pathLength={1}
          stroke={z.color}
        />
      ))}
      <g className={styles.needle}>
        <line x1={CX} y1={CY} x2={CX} y2={CY - 15.5} />
      </g>
      <circle className={styles.pivot} cx={CX} cy={CY} r={3.4} />
    </svg>
  );
}

export function Logo({ animated = false }: { animated?: boolean }) {
  return (
    <span className={styles.logo}>
      <LogoMark animated={animated} />
      <span className={styles.wordmark}>chimbómetro</span>
    </span>
  );
}
