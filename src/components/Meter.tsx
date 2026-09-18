"use client";

import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { Analysis } from "@/lib/chimba/analyze";
import { EXAMPLES } from "@/lib/chimba/examples";
import { requestMeasurement } from "@/lib/chimba/request";
import { formatInt, formatUsd } from "@/lib/format";
import { redditText, shareImage } from "@/lib/share";
import { EvidenceMap } from "./EvidenceMap";
import { TodayCounter, useTodayStats } from "./TodayCounter";
import { Gauge, type GaugeState } from "./Gauge";
import { Receipt } from "./Receipt";
import { Trace, type TraceRun } from "./Trace";
import styles from "./Meter.module.css";

const MIN = 40;
const MAX = 6000;

/** `offer` is the exact text that was measured, so edits in the textarea don't shift highlights. */
type Result = { analysis: Analysis; at: string; offer: string };

export function Meter() {
  const [offer, setOffer] = useState("");
  const [state, setState] = useState<GaugeState>("idle");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const [run, setRun] = useState<TraceRun | null>(null);
  const [session, setSession] = useState({ runs: 0, costUsd: 0 });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dialRef = useRef<HTMLDivElement>(null);
  const [today, refreshToday] = useTodayStats();

  const chars = offer.trim().length;
  const tooShort = chars < MIN;

  async function measure(text: string) {
    setState("measuring");
    setError(null);
    setShareNote(null);
    setRun({ events: [], roundTripMs: null });
    // On narrow screens the dial sits below the form; bring it into view so the needle and the trace are seen live.
    if (window.matchMedia("(max-width: 900px)").matches) {
      dialRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    try {
      const { analysis, roundTripMs } = await requestMeasurement(text, (event) =>
        setRun((r) => r && { ...r, events: [...r.events, event] }),
      );
      setRun((r) => r && { ...r, roundTripMs });
      setSession((s) => ({ runs: s.runs + 1, costUsd: s.costUsd + analysis.receipt.costUsd }));
      setResult({ analysis, at: new Date().toISOString(), offer: text });
      refreshToday();
      setState("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos medir la oferta.");
      setState(result ? "done" : "idle");
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!tooShort && state !== "measuring") void measure(offer.trim());
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onSubmit(e);
  }

  function tryExample(text: string) {
    setOffer(text);
    textareaRef.current?.focus({ preventScroll: true });
    void measure(text);
  }

  async function copyForReddit() {
    if (!result) return;
    await navigator.clipboard.writeText(redditText(result.analysis, window.location.origin));
    setShareNote("Copiado. Pégalo en un comentario de Reddit.");
  }

  async function downloadImage() {
    if (!result) return;
    const css = getComputedStyle(document.body);
    const blob = await shareImage(result.analysis, {
      display: css.getPropertyValue("--font-big-shoulders").trim(),
      body: css.getPropertyValue("--font-hanken").trim(),
    });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), {
      href: url,
      download: `chimbometro-${result.analysis.result.score}.png`,
    });
    a.click();
    URL.revokeObjectURL(url);
    setShareNote("Imagen descargada.");
  }

  const analysis = result?.analysis ?? null;

  return (
    <>
      <section className={styles.tool} aria-labelledby="titulo">
        <div className={styles.intro}>
          <h1 id="titulo" className={styles.title}>
            ¿Qué tan chimba es esa oferta?
          </h1>
          <p className={styles.lede}>
            Pega una oferta de trabajo. Jev la lee en menos de un segundo, busca nueve banderas
            rojas y te dice qué tan mala es, con cada probabilidad a la vista.
          </p>

          <TodayCounter stats={today} />

          <form className={styles.form} onSubmit={onSubmit}>
            <label htmlFor="oferta" className="visually-hidden">
              Texto de la oferta
            </label>
            <textarea
              id="oferta"
              ref={textareaRef}
              className={styles.textarea}
              value={offer}
              onChange={(e) => setOffer(e.target.value)}
              onKeyDown={onKeyDown}
              maxLength={MAX}
              rows={7}
              placeholder="Se busca desarrollador junior con 5 años de experiencia en…"
              aria-describedby="oferta-ayuda"
            />
            <div className={styles.actions}>
              <button
                type="submit"
                className={styles.submit}
                disabled={tooShort || state === "measuring"}
              >
                {state === "measuring" ? "Midiendo…" : "Medir oferta"}
              </button>
              <p id="oferta-ayuda" className={`${styles.hint} num`}>
                {chars > 0 && tooShort
                  ? `Faltan ${MIN - chars} caracteres`
                  : `${formatInt(chars)} / ${formatInt(MAX)} · ⌘ + Enter para medir`}
              </p>
            </div>
            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
          </form>

          <div className={styles.examples}>
            <p id="ejemplos">¿No tienes una a mano? Prueba con una de estas:</p>
            <ul aria-labelledby="ejemplos">
              {EXAMPLES.map((ex) => (
                <li key={ex.id}>
                  <button
                    type="button"
                    onClick={() => tryExample(ex.text)}
                    disabled={state === "measuring"}
                  >
                    {ex.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div ref={dialRef} className={styles.dial}>
          <Gauge
            value={analysis?.result.score ?? null}
            state={state}
            label={analysis?.result.band.label ?? ""}
          />
          <p className={styles.verdict} aria-live="polite">
            {analysis ? analysis.result.verdict.label : "Pega una oferta para mover la aguja."}
          </p>
          <Trace run={run} running={state === "measuring"} session={session} />
        </div>
      </section>

      <section className={styles.evidence} aria-label="Evidencia">
        <EvidenceMap analysis={analysis} offer={result?.offer ?? null} />
      </section>

      <section className={styles.results} aria-label="Resultado">
        <div className={styles.detail}>
          {!analysis && (
            <p className={styles.sub}>
              Cuando midas una oferta, aquí verás lo que el código leyó sin modelo y cómo compartir
              el resultado.
            </p>
          )}
          {analysis && (
            <>
              <h2 className={styles.h2}>Lo que dice el texto</h2>
              <p className={styles.sub}>Esto lo lee el código, sin modelo.</p>
              <dl className={styles.facts}>
                <div>
                  <dt>Sueldo</dt>
                  <dd>
                    {analysis.facts.salary
                      ? `${analysis.facts.salary.amounts.map(formatInt).join(" a ")} ${analysis.facts.salary.currency}`
                      : "No aparece un monto en el texto"}
                  </dd>
                </div>
                <div>
                  <dt>Tecnologías</dt>
                  <dd>
                    {analysis.facts.technologies.length ? (
                      <>
                        <strong className="num">{analysis.facts.technologies.length}</strong>{" "}
                        {analysis.facts.technologies.join(", ")}
                      </>
                    ) : (
                      "No menciona tecnologías concretas"
                    )}
                  </dd>
                </div>
              </dl>

              <div className={styles.share}>
                <button type="button" onClick={copyForReddit}>
                  Copiar para Reddit
                </button>
                <button type="button" onClick={downloadImage}>
                  Descargar imagen
                </button>
                <p aria-live="polite">{shareNote}</p>
              </div>
              <p className={styles.cost}>
                Esta medición costó {formatUsd(analysis.receipt.costUsd)}. El recibo de al lado
                muestra de dónde sale cada número.
              </p>
            </>
          )}
        </div>

        <aside className={styles.receipt} aria-label="Recibo de la consulta">
          <Receipt data={analysis?.receipt ?? null} at={result?.at ?? null} />
        </aside>
      </section>
    </>
  );
}
