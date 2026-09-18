"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { Analysis } from "@/lib/chimba/analyze";
import { RED_FLAG_QUESTIONS, type RedFlagId } from "@/lib/chimba/questions";
import { RED_FLAGS, type FlagResult } from "@/lib/chimba/score";
import { formatPercent } from "@/lib/format";
import styles from "./EvidenceMap.module.css";

/** Probability at which a flag is drawn as raised. */
const RAISED = 0.5;
const FLAG_IDS = Object.keys(RED_FLAG_QUESTIONS) as RedFlagId[];

type Props = { analysis: Analysis | null; offer: string | null };
type Link = { flag: RedFlagId; d: string; end: [number, number] };

/**
 * The offer on the left, the red flags on the right, and a line from each raised flag to the
 * fragment Jev chose as its evidence. Positions are measured from the DOM, so the lines follow
 * the text however it wraps.
 */
export function EvidenceMap({ analysis, offer }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [links, setLinks] = useState<Link[]>([]);
  const [focus, setFocus] = useState<RedFlagId | null>(null);

  const flags: Array<FlagResult | { id: RedFlagId; label: string; probability: null }> =
    analysis?.result.flags ??
    FLAG_IDS.map((id) => ({ id, label: RED_FLAGS[id].label, probability: null }));
  const evidence = new Map(analysis?.evidence.map((e) => [e.flag, e]) ?? []);
  const fragmentText = new Map(analysis?.fragments.map((f) => [f.id, f.text]) ?? []);
  const citedBy = new Map<string, RedFlagId[]>();
  for (const e of analysis?.evidence ?? [])
    citedBy.set(e.fragmentId, [...(citedBy.get(e.fragmentId) ?? []), e.flag]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || !analysis) return;
    const measure = () => {
      const box = root.getBoundingClientRect();
      const text = root.querySelector<HTMLElement>("[data-offer-text]");
      // Lines stop at the text column's right margin so they never cross the words.
      const margin = text ? text.getBoundingClientRect().right - box.left + 14 : null;
      const next: Link[] = [];
      for (const e of analysis.evidence) {
        const from = root.querySelector<HTMLElement>(`[data-flag-anchor="${e.flag}"]`);
        const to = root.querySelector<HTMLElement>(`[data-fragment="${e.fragmentId}"]`);
        if (!from || !to || !from.offsetParent) continue;
        const a = from.getBoundingClientRect();
        // Aim at the last line box of the fragment, where the eye finishes reading it.
        const rects = to.getClientRects();
        const b = rects[rects.length - 1] ?? to.getBoundingClientRect();
        const x1 = a.left - box.left;
        const y1 = a.top + a.height / 2 - box.top;
        const x2 = margin ?? b.right - box.left + 4;
        const y2 = b.top + b.height / 2 - box.top;
        const bend = Math.max(40, (x1 - x2) * 0.45);
        next.push({
          flag: e.flag,
          d: `M ${x1} ${y1} C ${x1 - bend} ${y1} ${x2 + bend} ${y2} ${x2} ${y2}`,
          end: [x2, y2],
        });
      }
      setLinks(next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, [analysis]);

  return (
    <div ref={rootRef} className={styles.map} data-focus={focus ?? undefined}>
      <div className={styles.offer}>
        <h3 className={styles.heading}>La oferta</h3>
        <p className={styles.sub}>
          {analysis
            ? `Jev la leyó en ${analysis.fragments.length} fragmentos y citó ${analysis.evidence.length} como evidencia.`
            : "Aquí aparece tu oferta con la evidencia marcada."}
        </p>
        {analysis && offer ? (
          <p className={styles.text} data-offer-text>
            {renderOffer(offer, analysis, citedBy, focus, setFocus)}
          </p>
        ) : (
          <div className={styles.placeholder} aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        )}
      </div>

      <div className={styles.flags}>
        <h3 className={styles.heading}>Banderas rojas</h3>
        <p className={styles.sub}>Probabilidad de que cada una aplique, según Jev.</p>
        <ol aria-label="Banderas rojas, de la más probable a la menos">
          {flags.map((f) => {
            const p = f.probability;
            const raised = p !== null && p >= RAISED;
            const e = evidence.get(f.id);
            const quote = e ? fragmentText.get(e.fragmentId) : undefined;
            return (
              <li
                key={f.id}
                className={raised ? styles.raised : undefined}
                data-active={focus === f.id || undefined}
                onPointerEnter={e ? () => setFocus(f.id) : undefined}
                onPointerLeave={e ? () => setFocus(null) : undefined}
              >
                {e && <span className={styles.anchor} data-flag-anchor={f.id} aria-hidden="true" />}
                <span className={styles.label}>{f.label}</span>
                <span className={styles.bar} aria-hidden="true">
                  <span style={{ width: p === null ? 0 : `${Math.max(p * 100, 1.5)}%` }} />
                </span>
                <span className={`${styles.value} num`}>{p === null ? "–" : formatPercent(p)}</span>
                {quote && <q className={styles.quote}>{quote}</q>}
              </li>
            );
          })}
        </ol>
      </div>

      <svg className={styles.links} aria-hidden="true">
        {links.map((l, i) => (
          <path
            key={l.flag}
            d={l.d}
            pathLength={1}
            className={styles.link}
            data-active={focus === l.flag || undefined}
            style={{ ["--i" as string]: i }}
          />
        ))}
        {links.map((l, i) => (
          <circle
            key={`${l.flag}-end`}
            cx={l.end[0]}
            cy={l.end[1]}
            r={3}
            className={styles.linkEnd}
            data-active={focus === l.flag || undefined}
            style={{ ["--i" as string]: i }}
          />
        ))}
      </svg>
    </div>
  );
}

function renderOffer(
  offer: string,
  analysis: Analysis,
  citedBy: Map<string, RedFlagId[]>,
  focus: RedFlagId | null,
  setFocus: (f: RedFlagId | null) => void,
) {
  const out: React.ReactNode[] = [];
  let cursor = 0;
  for (const f of analysis.fragments) {
    if (f.start > cursor) out.push(offer.slice(cursor, f.start));
    const flags = citedBy.get(f.id);
    out.push(
      flags ? (
        <mark
          key={f.id}
          data-fragment={f.id}
          className={styles.cited}
          data-active={(focus && flags.includes(focus)) || undefined}
          onPointerEnter={() => setFocus(flags[0]!)}
          onPointerLeave={() => setFocus(null)}
        >
          {f.text}
        </mark>
      ) : (
        <span key={f.id} data-fragment={f.id}>
          {f.text}
        </span>
      ),
    );
    cursor = f.end;
  }
  if (cursor < offer.length) out.push(offer.slice(cursor));
  return out;
}
