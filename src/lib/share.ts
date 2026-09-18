import type { Analysis } from "@/lib/chimba/analyze";
import { formatMs, formatPercent, formatUsd } from "@/lib/format";

const RAISED = 0.5;

/** Markdown that pastes cleanly into a Reddit comment. */
export function redditText({ result, receipt }: Analysis, siteUrl: string): string {
  const raised = result.flags.filter((f) => f.probability >= RAISED);
  const lines = [
    `**Chimbómetro: ${result.score}/100 (${result.band.label})**`,
    "",
    `> ${result.verdict.label}`,
    "",
    ...(raised.length
      ? raised.map((f) => `- ${f.label.replace(/[“”]/g, '"')}: ${formatPercent(f.probability)}`)
      : ["- Ninguna bandera roja pasó del 50 %"]),
    "",
    `^(Medido con Jev en ${formatMs(receipt.jevMs)} por ${formatUsd(receipt.costUsd)}. ${siteUrl})`,
  ];
  return lines.join("\n");
}
