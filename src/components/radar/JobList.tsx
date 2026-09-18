"use client";

import { useMemo, useState } from "react";
import { formatInt, formatPercent } from "@/lib/format";
import {
  englishLabel,
  needsConfirmation,
  ROLE_LABEL,
  SENIORITY_LABEL,
  SOURCE_LABEL,
  timeAgo,
  WHERE_LABEL,
} from "@/lib/radar/labels";
import type { RadarJob, Role, Seniority, SourceId } from "@/lib/radar/types";
import styles from "./JobList.module.css";

const PAGE = 30;
const SENIORITIES: Seniority[] = ["junior", "mid", "senior", "lead_or_staff"];
const ROLES: Role[] = [
  "frontend",
  "backend",
  "fullstack",
  "mobile",
  "data_ml",
  "devops",
  "qa",
  "design",
  "product",
  "other",
];
const SOURCES: SourceId[] = ["hn", "getonbrd", "wwr", "remotive"];
const ENGLISH_MAX = [
  { value: 3, label: "Cualquier nivel" },
  { value: 2.49, label: "Hasta profesional" },
  { value: 1.49, label: "Hasta básico" },
  { value: 0.74, label: "Sin inglés" },
];

type Filters = {
  onlyEligible: boolean;
  usd: boolean;
  seniority: Set<Seniority>;
  roles: Set<Role>;
  sources: Set<SourceId>;
  englishMax: number;
  query: string;
};

const INITIAL: Filters = {
  onlyEligible: true,
  usd: false,
  seniority: new Set(),
  roles: new Set(),
  sources: new Set(),
  englishMax: 3,
  query: "",
};

export function JobList({ jobs, now }: { jobs: RadarJob[]; now: number }) {
  const [f, setF] = useState<Filters>(INITIAL);
  const [shown, setShown] = useState(PAGE);

  const real = useMemo(() => jobs.filter((j) => j.isJob), [jobs]);
  const visible = useMemo(() => {
    const q = f.query.trim().toLowerCase();
    return real
      .filter(
        (j) =>
          (!f.onlyEligible || j.eligible) &&
          (!f.usd || j.usd >= 0.5 || j.salary) &&
          (f.seniority.size === 0 || f.seniority.has(j.seniority)) &&
          (f.roles.size === 0 || f.roles.has(j.role)) &&
          (f.sources.size === 0 || f.sources.has(j.source)) &&
          j.english <= f.englishMax &&
          (!q || `${j.title} ${j.company} ${j.excerpt}`.toLowerCase().includes(q)),
      )
      .sort((a, b) => (b.postedAt ?? "").localeCompare(a.postedAt ?? ""));
  }, [real, f]);

  const update = (patch: Partial<Filters>) => {
    setF((prev) => ({ ...prev, ...patch }));
    setShown(PAGE);
  };
  const toggle = <T,>(set: Set<T>, value: T) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.filters} role="group" aria-label="Filtros">
        <div className={styles.row}>
          <label className={styles.switch}>
            <input
              type="checkbox"
              checked={f.onlyEligible}
              onChange={(e) => update({ onlyEligible: e.target.checked })}
            />
            Solo los que aceptan Venezuela
          </label>
          <label className={styles.switch}>
            <input
              type="checkbox"
              checked={f.usd}
              onChange={(e) => update({ usd: e.target.checked })}
            />
            Pagan en dólares
          </label>
          <label className={styles.select}>
            <span className="visually-hidden">Inglés</span>
            <select
              value={f.englishMax}
              onChange={(e) => update({ englishMax: Number(e.target.value) })}
            >
              {ENGLISH_MAX.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.value === 3 ? "Inglés: cualquier nivel" : `Inglés: ${o.label.toLowerCase()}`}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.search}>
            <span className="visually-hidden">Buscar</span>
            <input
              type="search"
              placeholder="Buscar: react, python, empresa…"
              value={f.query}
              onChange={(e) => update({ query: e.target.value })}
            />
          </label>
        </div>
        <Chips
          label="Nivel"
          options={SENIORITIES}
          selected={f.seniority}
          labels={SENIORITY_LABEL}
          onToggle={(v) => update({ seniority: toggle(f.seniority, v) })}
        />
        <Chips
          label="Rol"
          options={ROLES}
          selected={f.roles}
          labels={ROLE_LABEL}
          onToggle={(v) => update({ roles: toggle(f.roles, v) })}
        />
        <Chips
          label="Fuente"
          options={SOURCES}
          selected={f.sources}
          labels={SOURCE_LABEL}
          onToggle={(v) => update({ sources: toggle(f.sources, v) })}
        />
      </div>

      <p className={styles.count} aria-live="polite">
        {formatInt(visible.length)} {visible.length === 1 ? "empleo" : "empleos"}
        {visible.length !== real.length && <span> de {formatInt(real.length)}</span>}
      </p>

      {visible.length === 0 ? (
        <p className={styles.empty}>
          Ningún empleo cumple todos esos filtros. Quita alguno, por ejemplo el de nivel o el de
          inglés.
        </p>
      ) : (
        <ol className={styles.list}>
          {visible.slice(0, shown).map((j) => (
            <JobRow key={j.id} job={j} now={now} />
          ))}
        </ol>
      )}
      {visible.length > shown && (
        <button type="button" className={styles.more} onClick={() => setShown((n) => n + PAGE)}>
          Mostrar {formatInt(Math.min(PAGE, visible.length - shown))} más
        </button>
      )}
    </div>
  );
}

function JobRow({ job, now }: { job: RadarJob; now: number }) {
  const confirm = needsConfirmation(job);
  return (
    <li className={styles.job}>
      <div className={styles.head}>
        <a href={job.url} className={styles.title} target="_blank" rel="noreferrer">
          {job.title}
        </a>
        <span className={styles.when}>
          {SOURCE_LABEL[job.source]}
          {job.postedAt && `, ${timeAgo(job.postedAt, now)}`}
        </span>
      </div>
      <ul className={styles.tags} aria-label="Detalles">
        <li className={job.eligible ? styles.yes : styles.noTag}>
          {job.eligible ? "Acepta Venezuela" : "No acepta Venezuela"}
        </li>
        <li>{whereLabel(job)}</li>
        {job.seniority !== "unclear" && <li>{SENIORITY_LABEL[job.seniority]}</li>}
        <li>{ROLE_LABEL[job.role]}</li>
        <li>{englishLabel(job.english)}</li>
        {job.salary && (
          <li className="num">
            {formatInt(job.salary.min)}–{formatInt(job.salary.max)} USD/mes
          </li>
        )}
        {confirm && <li className={styles.confirm}>Por confirmar</li>}
      </ul>
      {job.decidedBy === "source" ? (
        <p className={`${styles.quote} ${styles.fromSource}`}>
          <span className={styles.claim}>
            Según {SOURCE_LABEL[job.source]}:{" "}
            {job.eligible ? "remoto desde cualquier país" : "solo residentes del país o presencial"}
          </span>
          <span>Dato estructurado de la fuente, no una lectura de Jev</span>
        </p>
      ) : (
        job.quote && (
          <p className={styles.quote}>
            <q>{job.quote}</q>
            <span>Frase citada por Jev, confianza {formatPercent(job.whereConfidence)}</span>
          </p>
        )
      )}
    </li>
  );
}

/** When the source decided, its field is the truth; otherwise Jev's reading of the text. */
function whereLabel(job: RadarJob) {
  if (job.excludesVenezuela >= 0.5) return "El texto excluye a Venezuela";
  if (job.decidedBy === "source") {
    return job.eligible ? WHERE_LABEL.anywhere : "Solo residentes del país o presencial";
  }
  return WHERE_LABEL[job.where];
}

function Chips<T extends string>({
  label,
  options,
  selected,
  labels,
  onToggle,
}: {
  label: string;
  options: T[];
  selected: Set<T>;
  labels: Record<T, string>;
  onToggle: (v: T) => void;
}) {
  return (
    <div className={styles.chips} role="group" aria-label={label}>
      <span className={styles.chipsLabel}>{label}</span>
      {options.map((o) => (
        <button key={o} type="button" aria-pressed={selected.has(o)} onClick={() => onToggle(o)}>
          {labels[o]}
        </button>
      ))}
    </div>
  );
}
