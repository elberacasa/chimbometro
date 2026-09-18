import { formatInt, formatUsd } from "@/lib/format";
import styles from "./Docs.module.css";

/**
 * Small, single-series charts drawn as SVG/HTML. One ink color, values labeled directly, and a
 * table view for each so no number depends on reading a bar length.
 */

type Bin = { fromMs: number; count: number };

export function LatencyHistogram({
  bins,
  p50,
  p90,
  eval20Median,
}: {
  bins: Bin[];
  p50: number;
  p90: number;
  /** Median round trip of the latest 20-question eval, for comparison. */
  eval20Median: number;
}) {
  const W = 640;
  const H = 220;
  const pad = { l: 36, r: 12, t: 24, b: 40 };
  const max = Math.max(...bins.map((b) => b.count));
  const bw = (W - pad.l - pad.r) / bins.length;
  const x = (ms: number) => pad.l + ((ms - bins[0]!.fromMs) / 50) * bw;
  const y = (n: number) => pad.t + (1 - n / max) * (H - pad.t - pad.b);

  return (
    <figure className={styles.figure}>
      <figcaption className={styles.chartTitle}>
        Tiempo de ida y vuelta a Jev, 206 consultas reales
      </figcaption>
      <div className={styles.scroll}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className={styles.chart}
          role="img"
          aria-label={`Histograma de latencia. Mediana ${p50} ms, percentil 90 ${p90} ms.`}
        >
          {[0, Math.round(max / 2), max].map((n) => (
            <g key={n}>
              <line x1={pad.l} x2={W - pad.r} y1={y(n)} y2={y(n)} className={styles.grid} />
              <text x={pad.l - 8} y={y(n) + 4} className={styles.axisLabel} textAnchor="end">
                {n}
              </text>
            </g>
          ))}
          {bins.map((b) => (
            <rect
              key={b.fromMs}
              x={x(b.fromMs) + 1}
              y={y(b.count)}
              width={bw - 2}
              height={H - pad.b - y(b.count)}
              rx={3}
              className={styles.bar}
            >
              <title>{`${b.fromMs}–${b.fromMs + 49} ms: ${b.count} consultas`}</title>
            </rect>
          ))}
          {bins.map((b, i) =>
            i % 2 === 0 ? (
              <text
                key={b.fromMs}
                x={x(b.fromMs)}
                y={H - pad.b + 18}
                className={styles.axisLabel}
                textAnchor="middle"
              >
                {b.fromMs}
              </text>
            ) : null,
          )}
          <text x={W - pad.r} y={H - 6} className={styles.axisLabel} textAnchor="end">
            milisegundos
          </text>
          {[
            { v: p50, label: `mediana ${p50} ms` },
            { v: p90, label: `p90 ${p90} ms` },
          ].map((m) => (
            <g key={m.label}>
              <line
                x1={x(m.v)}
                x2={x(m.v)}
                y1={pad.t - 8}
                y2={H - pad.b}
                className={styles.marker}
              />
              <text x={x(m.v) + 6} y={pad.t - 10} className={styles.markerLabel}>
                {m.label}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <p className={styles.caption}>
        De la investigación del sub: 7 preguntas por consulta, 6 consultas a la vez. En la última
        evaluación, con 20 preguntas por consulta, la mediana fue {eval20Median} ms: casi el triple
        de preguntas prácticamente no cambia el tiempo, porque Jev las responde en paralelo. Son
        corridas distintas, con otra concurrencia, así que tómalo como orden de magnitud.
      </p>
      <TableToggle
        head={["Rango", "Consultas"]}
        rows={bins.map((b) => [`${b.fromMs}–${b.fromMs + 49} ms`, String(b.count)])}
      />
    </figure>
  );
}

type Run = {
  id: string;
  label: string;
  jevMs: number;
  inputTokens: number;
  costUsd: number;
  score: number;
};

export function EvalRuns({ runs, at }: { runs: Run[]; at: string }) {
  const max = Math.max(...runs.map((r) => r.jevMs));
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.chartTitle}>
        Las 5 ofertas de ejemplo, 20 preguntas cada una
      </figcaption>
      <ul className={styles.hbars}>
        {runs.map((r) => (
          <li key={r.id}>
            <span className={styles.hbarLabel}>{r.label}</span>
            <span className={styles.hbarTrack} aria-hidden="true">
              <span style={{ width: `${(r.jevMs / max) * 100}%` }} />
            </span>
            <span className={`${styles.hbarValue} num`}>{formatInt(r.jevMs)} ms</span>
            <span className={`${styles.hbarMeta} num`}>
              {formatInt(r.inputTokens)} tokens, {formatUsd(r.costUsd)}
            </span>
          </li>
        ))}
      </ul>
      <p className={styles.caption}>
        Última evaluación: {new Date(at).toLocaleDateString("es-VE", { dateStyle: "long" })}, con{" "}
        <code>npm run jev:eval</code>.
      </p>
    </figure>
  );
}

type CostRow = { purpose: string; calls: number; costUsd: number };

export function CostBars({ rows }: { rows: CostRow[] }) {
  const max = Math.max(...rows.map((r) => r.costUsd));
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.chartTitle}>
        Costo en Jev por tarea, desde el registro
      </figcaption>
      <ul className={styles.hbars}>
        {rows.map((r) => (
          <li key={r.purpose}>
            <span className={styles.hbarLabel}>{r.purpose}</span>
            <span className={styles.hbarTrack} aria-hidden="true">
              <span style={{ width: `${Math.max((r.costUsd / max) * 100, 0.8)}%` }} />
            </span>
            <span className={`${styles.hbarValue} num`}>{formatUsd(r.costUsd)}</span>
            <span className={`${styles.hbarMeta} num`}>
              {formatInt(r.calls)} {r.calls === 1 ? "consulta" : "consultas"}
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

function TableToggle({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <details className={styles.tableToggle}>
      <summary>Ver como tabla</summary>
      <table>
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r[0]}>
              {r.map((c, i) => (
                <td key={i} className="num">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
