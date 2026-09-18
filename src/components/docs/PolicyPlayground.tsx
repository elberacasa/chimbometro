"use client";

import { useState } from "react";
import { RED_FLAG_QUESTIONS, type RedFlagId } from "@/lib/chimba/questions";
import {
  DEFAULT_POLICY,
  RED_FLAGS,
  scoreOffer,
  type Policy,
  type ScoredAnswers,
} from "@/lib/chimba/score";
import { formatDecimal } from "@/lib/format";
import styles from "./Docs.module.css";

type Run = { id: string; label: string; answers: ScoredAnswers };

const FLAG_IDS = Object.keys(RED_FLAG_QUESTIONS) as RedFlagId[];

/**
 * The real scoring function with every constant on a slider. It runs over Jev's saved answers
 * from the last eval, so moving a slider never calls the model: the policy is code.
 */
export function PolicyPlayground({ runs }: { runs: Run[] }) {
  const [policy, setPolicy] = useState<Policy>(DEFAULT_POLICY);
  const changed = JSON.stringify(policy) !== JSON.stringify(DEFAULT_POLICY);

  const setWeight = (id: RedFlagId, weight: number) =>
    setPolicy((p) => ({ ...p, weights: { ...p.weights, [id]: weight } }));

  return (
    <div className={styles.playground}>
      <fieldset className={styles.controls}>
        <legend className="visually-hidden">Constantes de la fórmula</legend>
        <Slider
          label="Peso de la opinión general"
          value={policy.absurdityShare}
          onChange={(v) => setPolicy((p) => ({ ...p, absurdityShare: v }))}
        />
        <Slider
          label="Umbral de ruido"
          value={policy.floor}
          max={0.9}
          onChange={(v) => setPolicy((p) => ({ ...p, floor: v }))}
        />
        <p className={styles.controlsHeading}>Peso de cada bandera</p>
        {FLAG_IDS.map((id) => (
          <Slider
            key={id}
            label={RED_FLAGS[id].label}
            value={policy.weights[id]}
            onChange={(v) => setWeight(id, v)}
          />
        ))}
        <button
          type="button"
          className={styles.reset}
          onClick={() => setPolicy(DEFAULT_POLICY)}
          disabled={!changed}
        >
          Volver a la política original
        </button>
      </fieldset>

      <div className={styles.outcomes} aria-live="polite">
        <p className={styles.outcomesNote}>
          Puntaje de cada oferta de ejemplo con tu política. La marca vertical es el puntaje
          original.
        </p>
        <ul>
          {runs.map((r) => {
            const base = scoreOffer(r.answers).score;
            const now = scoreOffer(r.answers, policy);
            return (
              <li key={r.id}>
                <span className={styles.outcomeLabel}>{r.label}</span>
                <span className={styles.outcomeTrack} aria-hidden="true">
                  <span
                    className={styles[`fill_${now.band.id}`]}
                    style={{ width: `${now.score}%` }}
                  />
                  <i style={{ left: `${base}%` }} />
                </span>
                <span className={`${styles.outcomeValue} num`}>
                  {now.score}
                  <small>{now.band.label}</small>
                </span>
              </li>
            );
          })}
        </ul>
        <p className={styles.caption}>
          Ninguna de estas cuentas llama a Jev: usan las respuestas guardadas de la última
          evaluación.
        </p>
      </div>
    </div>
  );
}

function Slider({
  label,
  value,
  onChange,
  max = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  max?: number;
}) {
  return (
    <label className={styles.slider}>
      <span>{label}</span>
      <input
        type="range"
        min={0}
        max={max}
        step={0.05}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <output className="num">{formatDecimal(value)}</output>
    </label>
  );
}
