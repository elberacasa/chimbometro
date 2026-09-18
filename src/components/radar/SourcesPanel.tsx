import { formatInt, formatUsd } from "@/lib/format";
import { timeAgo } from "@/lib/radar/labels";
import type { RadarPayload } from "@/lib/radar/view";
import styles from "./SourcesPanel.module.css";

/** Where every listing comes from: the exact URLs our server requested, and how that went. */
export function SourcesPanel({ snapshot, now }: { snapshot: RadarPayload; now: number }) {
  const { run } = snapshot;
  return (
    <aside className={styles.panel} aria-labelledby="fuentes-titulo">
      <h2 id="fuentes-titulo" className={styles.h2}>
        Fuentes
      </h2>
      <p className={styles.sub}>
        Jev no navega: nuestro servidor pide estas URLs públicas y Jev lee el texto de cada oferta.
      </p>
      <ul className={styles.list}>
        {snapshot.sources.map((s) => {
          const jobs = snapshot.jobs.filter((j) => j.source === s.id);
          const ok = jobs.filter((j) => j.eligible).length;
          return (
            <li key={s.id}>
              <div className={styles.head}>
                <a href={s.homepage}>{s.name}</a>
                <span className={s.status === "ok" ? styles.ok : styles.failed}>
                  {s.status === "ok" ? `${formatInt(s.ms)} ms` : "falló"}
                </span>
              </div>
              <p className={styles.numbers}>
                <strong className="num">{formatInt(ok)}</strong> de {formatInt(jobs.length)} aceptan
                Venezuela
              </p>
              <ul className={styles.urls}>
                {s.requested.map((u) => (
                  <li key={u}>
                    <a href={u}>{u.replace(/^https:\/\//, "")}</a>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
      <dl className={styles.run}>
        <div>
          <dt>Última actualización</dt>
          <dd>
            {timeAgo(snapshot.updatedAt, now)}
            {run.trigger === "cron"
              ? ", programada"
              : run.trigger === "visitor"
                ? ", pedida por un visitante"
                : ""}
          </dd>
        </div>
        <div>
          <dt>Ofertas nuevas leídas por Jev</dt>
          <dd className="num">{formatInt(run.judged)}</dd>
        </div>
        <div>
          <dt>Costo de esa actualización</dt>
          <dd className="num">{formatUsd(run.costUsd)}</dd>
        </div>
      </dl>
    </aside>
  );
}
