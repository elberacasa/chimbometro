import styles from "./Brand.module.css";

/**
 * The Chamba mark: a radar scope. The sweep makes one pass on load and the blip lights up as it
 * passes, the same thing the radar page does with real listings.
 */
export function RadarMark({ animated = false, size = 30 }: { animated?: boolean; size?: number }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={animated ? `${styles.mark} ${styles.animated}` : styles.mark}
      aria-hidden="true"
    >
      <circle cx="16" cy="16" r="14" className={styles.ring} />
      <circle cx="16" cy="16" r="8.5" className={styles.ringInner} />
      <g className={styles.sweep}>
        <path d="M16 16 L16 2 A14 14 0 0 1 28.1 9 Z" className={styles.wedge} />
        <line x1="16" y1="16" x2="16" y2="2" className={styles.beam} />
      </g>
      <circle cx="22.5" cy="9.5" r="2.4" className={styles.blip} />
      <circle cx="16" cy="16" r="1.8" className={styles.center} />
    </svg>
  );
}

export function Brand({ animated = false }: { animated?: boolean }) {
  return (
    <span className={styles.brand}>
      <RadarMark animated={animated} />
      <span className={styles.wordmark}>chamba</span>
    </span>
  );
}
