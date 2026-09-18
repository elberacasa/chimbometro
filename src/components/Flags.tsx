import { RED_FLAG_QUESTIONS, type RedFlagId } from "@/lib/chimba/questions";
import { RED_FLAGS, type FlagResult } from "@/lib/chimba/score";
import { formatPercent } from "@/lib/format";
import styles from "./Flags.module.css";

/** Probability at which a flag is drawn as raised. Matches the formula's floor in spirit. */
const RAISED = 0.5;

const IDS = Object.keys(RED_FLAG_QUESTIONS) as RedFlagId[];

/** All nine checks, always visible: empty before a measurement, filled with Jev's probabilities after. */
export function Flags({ flags }: { flags: FlagResult[] | null }) {
  const rows = flags ?? IDS.map((id) => ({ id, ...RED_FLAGS[id], probability: null }));
  return (
    <ol className={styles.flags} aria-label="Banderas rojas, de la más probable a la menos">
      {rows.map((f) => {
        const p = f.probability;
        const raised = p !== null && p >= RAISED;
        return (
          <li key={f.id} className={raised ? styles.raised : undefined}>
            <span className={styles.label}>{f.label}</span>
            <span className={styles.bar} aria-hidden="true">
              <span style={{ width: p === null ? 0 : `${Math.max(p * 100, 1.5)}%` }} />
            </span>
            <span className={`${styles.value} num`}>{p === null ? "–" : formatPercent(p)}</span>
          </li>
        );
      })}
    </ol>
  );
}
