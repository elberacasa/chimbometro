"use client";

import { useEffect, useRef } from "react";
import type { ChimbaEvent } from "@/lib/chimba/events";
import type { ChoiceAnswer, NoulAnswer, ScoreAnswer } from "@/lib/jev/types";
import { costUsd } from "@/lib/jev/pricing";
import { formatDecimal, formatInt, formatPercent, formatUsd } from "@/lib/format";
import styles from "./Trace.module.css";

type Answer = NoulAnswer | ChoiceAnswer | ScoreAnswer;

export type TraceRun = {
  events: ChimbaEvent[];
  /** Client-side round trip, set once the stream ends. */
  roundTripMs: number | null;
};

type Props = { run: TraceRun | null; running: boolean; session: { runs: number; costUsd: number } };

/**
 * Live log of one measurement. Every timestamp is real: `+n ms` is server time since the request
 * arrived, and the waiting counter ticks against the browser clock until Jev answers.
 */
export function Trace({ run, running, session }: Props) {
  const events = run?.events ?? [];
  const sent = events.find((e) => e.type === "sent");
  const answered = events.find((e) => e.type === "answered");
  const scored = events.find((e) => e.type === "scored");
  const failed = events.find((e) => e.type === "error");
  const waiting = running && sent && !answered && !failed;

  return (
    <div className={styles.trace} aria-label="Traza en vivo de la consulta">
      <div className={styles.bar}>
        <span className={styles.title}>traza en vivo</span>
        <span className="num">
          {session.runs > 0
            ? `${session.runs} ${session.runs === 1 ? "consulta" : "consultas"}  ${formatUsd(session.costUsd)} en total`
            : "sin consultas aún"}
        </span>
      </div>

      <ol className={styles.log} aria-live="polite">
        {!run && (
          <li className={styles.idle}>
            <Time />
            <span>
              esperando una oferta
              <span className={styles.cursor} aria-hidden="true" />
            </span>
          </li>
        )}

        {events.map((e) => {
          switch (e.type) {
            case "received":
              return (
                <li key="received">
                  <Time t={e.t} />
                  <span>
                    POST /api/chimba <Dim>{formatInt(e.chars)} caracteres</Dim>
                  </span>
                </li>
              );
            case "sent":
              return (
                <li key="sent">
                  <Time t={e.t} />
                  <span>
                    → {e.endpoint}{" "}
                    <Dim>
                      {e.model}, {e.questions} preguntas en un solo request
                    </Dim>
                  </span>
                </li>
              );
            case "answered":
              return (
                <li key="answered" className={styles.block}>
                  <Time t={e.t} />
                  <span>
                    <Ok>← 200</Ok> {e.response.model} en <Hot>{formatInt(e.jevMs)} ms</Hot>{" "}
                    <Dim>
                      {formatInt(e.response.usage.input_tokens)} tokens,{" "}
                      {formatUsd(costUsd(e.response.usage))}
                    </Dim>
                  </span>
                  <Answers answers={e.response.answers as Record<string, Answer>} />
                </li>
              );
            case "scored":
              return (
                <li key="scored">
                  <Time t={e.t} />
                  <span>
                    fórmula → <Hot>{e.analysis.result.score} / 100</Hot>{" "}
                    <Dim>en {formatDecimal(e.analysis.receipt.scoreMs)} ms, código sin modelo</Dim>
                  </span>
                </li>
              );
            case "error":
              return (
                <li key="error" className={styles.err}>
                  <Time t={e.t} />
                  <span>{e.message}</span>
                </li>
              );
          }
        })}

        {waiting && <Waiting />}

        {run?.roundTripMs != null && scored && (
          <li>
            <Time />
            <span>
              <Ok>listo</Ok>{" "}
              <Dim>{formatInt(run.roundTripMs)} ms de ida y vuelta desde tu navegador</Dim>
            </span>
          </li>
        )}
      </ol>
    </div>
  );
}

function Answers({ answers }: { answers: Record<string, Answer> }) {
  const entries = Object.entries(answers);
  return (
    <div className={styles.answers}>
      <p className={styles.note}>{entries.length} respuestas, llegaron juntas:</p>
      <ul>
        {entries.map(([id, a], i) => (
          <li key={id} style={{ ["--i" as string]: i }}>
            <span className={styles.qid}>{id}</span>
            <AnswerValue a={a} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function AnswerValue({ a }: { a: Answer }) {
  if (a.type === "noul") {
    return (
      <>
        <span
          className={`${styles.meter} ${a.noul >= 0.5 ? styles.meterHot : ""}`}
          aria-hidden="true"
        >
          <span style={{ width: `${a.noul * 100}%` }} />
        </span>
        <span className="num">{formatDecimal(a.noul)}</span>
      </>
    );
  }
  if (a.type === "score") {
    return (
      <>
        <span className={styles.meter} aria-hidden="true">
          <span style={{ width: `${(a.score / 3) * 100}%` }} />
        </span>
        <span className="num">{formatDecimal(a.score)}/3</span>
      </>
    );
  }
  return (
    <span className={styles.choice}>
      {a.choice} <Dim>{formatPercent(a.probabilities[a.choice] ?? a.confidence)}</Dim>
    </span>
  );
}

function Waiting() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      if (ref.current) ref.current.textContent = formatInt(now - start);
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <li className={styles.waiting}>
      <Time />
      <span>
        esperando a Jev…{" "}
        <span ref={ref} className="num">
          0
        </span>{" "}
        ms
        <span className={styles.cursor} aria-hidden="true" />
      </span>
    </li>
  );
}

function Time({ t }: { t?: number }) {
  return (
    <span className={`${styles.time} num`}>
      {t === undefined ? "" : `+${formatInt(Math.round(t))} ms`}
    </span>
  );
}

const Dim = ({ children }: { children: React.ReactNode }) => (
  <span className={styles.dim}>{children}</span>
);
const Ok = ({ children }: { children: React.ReactNode }) => (
  <span className={styles.ok}>{children}</span>
);
const Hot = ({ children }: { children: React.ReactNode }) => (
  <span className={styles.hot}>{children}</span>
);
