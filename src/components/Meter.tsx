"use client";

import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { Analysis } from "@/lib/chimba/analyze";
import { EXAMPLES } from "@/lib/chimba/examples";
import { requestMeasurement } from "@/lib/chimba/request";
import { formatInt, formatUsd } from "@/lib/format";
import { redditText } from "@/lib/share";
import { EvidenceMap } from "./EvidenceMap";
import { TodayCounter, useTodayStats } from "./TodayCounter";
import { Gauge, type GaugeState } from "./Gauge";
import { Receipt } from "./Receipt";
import { Trace, type TraceRun } from "./Trace";
import styles from "./Meter.module.css";

const MIN = 40;
const MAX = 6000;

/** `offer` is the exact text that was measured, so edits in the textarea don't shift highlights. */
type Result = { analysis: Analysis; at: string; offer: string; shareId: string | null };

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
      const { analysis, roundTripMs, shareId } = await requestMeasurement(text, (event) =>
        setRun((r) => r && { ...r, events: [...r.events, event] }),
      );
      setRun((r) => r && { ...r, roundTripMs });
      setSession((s) => ({ runs: s.runs + 1, costUsd: s.costUsd + analysis.receipt.costUsd }));
      setResult({ analysis, at: new Date().toISOString(), offer: text, shareId });
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

  const shareUrl = result?.shareId ? `${window.location.origin}/r/${result.shareId}` : null;

  /** The phone's share sheet when there is one (WhatsApp, Telegram, Reddit…), else copy the link. */
  async function share() {
    if (!result || !shareUrl) return;
    const { score, band, verdict } = result.analysis.result;
    const text = `Mi oferta sacó ${score}/100 en el Chimbómetro: ${band.label}. ${verdict.label}.`;
    if (navigator.share) {
      await navigator.share({ title: "Chimbómetro", text, url: shareUrl }).catch(() => {});
      return;
    }
    await navigator.clipboard.writeText(shareUrl);
    setShareNote("Enlace copiado.");
  }

  async function copyForReddit() {
    if (!result) return;
    await navigator.clipboard.writeText(
      redditText(result.analysis, shareUrl ?? window.location.href),
    );
    setShareNote("Copiado. Pégalo en un comentario de Reddit.");
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
                {shareUrl && (
                  <button type="button" className={styles.primaryShare} onClick={share}>
                    Compartir resultado
                  </button>
                )}
                <button type="button" onClick={copyForReddit}>
                  Copiar para Reddit
                </button>
                <p aria-live="polite">{shareNote}</p>
              </div>
              <p className={styles.cost}>
                Esta medición costó {formatUsd(analysis.receipt.costUsd)}. El recibo de al lado
                muestra de dónde sale cada número.
              </p>
            </>
          )}

          <h2 className={styles.h2}>Cómo leer el recibo</h2>
          <dl className={styles.glossary}>
            <div>
              <dt>sí/no</dt>
              <dd>
                La probabilidad de que algo sea cierto, de 0 a 1. Un 0,5 significa que Jev no lo
                sabe, no que la bandera esté «a medias».
              </dd>
            </div>
            <div>
              <dt>escala</dt>
              <dd>Dónde cae la oferta entre niveles descritos, de 0 (justa) a 3 (absurda).</dd>
            </div>
            <div>
              <dt>elección</dt>
              <dd>
                La opción más probable y su probabilidad, entre opciones definidas de antemano.
              </dd>
            </div>
            <div>
              <dt>cita</dt>
              <dd>
                El fragmento de tu oferta que Jev eligió como evidencia de una bandera. Elige entre
                fragmentos reales, así que no puede inventar una cita.
              </dd>
            </div>
            <div>
              <dt>tokens</dt>
              <dd>
                Pedazos de texto que Jev lee. Se cobran solo los de entrada: tu oferta más las
                preguntas. Lo que Jev responde es gratis.
              </dd>
            </div>
          </dl>
        </div>

        <aside className={styles.receipt} aria-label="Recibo de la consulta">
          <Receipt
            data={analysis?.receipt ?? null}
            at={result?.at ?? null}
            cited={analysis?.evidence.map((e) => e.flag) ?? []}
          />
        </aside>
      </section>
    </>
  );
}
