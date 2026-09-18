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

/**
 * Draws a 1200×630 share card with the page's own fonts (already loaded by next/font) and returns
 * it as a PNG blob.
 */
export async function shareImage(
  { result, receipt }: Analysis,
  fonts: { display: string; body: string },
): Promise<Blob> {
  await document.fonts.ready;
  const W = 1200;
  const H = 630;
  const canvas = document.createElement("canvas");
  canvas.width = W * 2;
  canvas.height = H * 2;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(2, 2);

  // The card is always drawn in the light palette so it reads the same wherever it is posted.
  const c = {
    paper: "#f2f3ef",
    ink: "#0f1b2d",
    ink2: "#45526a",
    bad: "#e3342f",
    warn: "#e0a100",
    good: "#1e9e5a",
  };
  ctx.fillStyle = c.paper;
  ctx.fillRect(0, 0, W, H);

  // Dial on the right.
  const cx = 880;
  const cy = 430;
  const r = 230;
  const bands: Array<[number, number, string, number]> = [
    [0, 25, c.good, 14],
    [25, 50, c.warn, 14],
    [50, 75, c.bad, 14],
    [75, 100, c.bad, 26],
  ];
  const angle = (v: number) => Math.PI + (v / 100) * Math.PI;
  for (const [from, to, color, width] of bands) {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.arc(cx, cy, r - width / 2, angle(from) + 0.012, angle(to) - 0.012);
    ctx.stroke();
  }
  for (let t = 0; t <= 100; t += 10) {
    const a = angle(t);
    ctx.beginPath();
    ctx.strokeStyle = c.ink;
    ctx.lineWidth = 2;
    ctx.moveTo(cx + Math.cos(a) * (r - 34), cy + Math.sin(a) * (r - 34));
    ctx.lineTo(cx + Math.cos(a) * (r - 52), cy + Math.sin(a) * (r - 52));
    ctx.stroke();
  }
  const na = angle(result.score);
  ctx.fillStyle = c.ink;
  ctx.beginPath();
  ctx.moveTo(cx + Math.cos(na + Math.PI / 2) * 7, cy + Math.sin(na + Math.PI / 2) * 7);
  ctx.lineTo(cx + Math.cos(na) * (r - 30), cy + Math.sin(na) * (r - 30));
  ctx.lineTo(cx + Math.cos(na - Math.PI / 2) * 7, cy + Math.sin(na - Math.PI / 2) * 7);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, 18, 0, Math.PI * 2);
  ctx.fill();

  ctx.textAlign = "center";
  ctx.font = `800 150px ${fonts.display}`;
  ctx.fillText(String(result.score), cx, cy + 170);

  // Text on the left.
  ctx.textAlign = "left";
  ctx.fillStyle = c.ink2;
  ctx.font = `700 34px ${fonts.display}`;
  ctx.fillText("chimbómetro", 72, 100);

  ctx.fillStyle = c.ink;
  ctx.font = `800 96px ${fonts.display}`;
  ctx.fillText(result.band.label, 72, 230);

  ctx.font = `600 34px ${fonts.body}`;
  wrap(ctx, result.verdict.label, 72, 290, 520, 44);

  ctx.font = `500 24px ${fonts.body}`;
  const raised = result.flags.filter((f) => f.probability >= RAISED).slice(0, 4);
  raised.forEach((f, i) => {
    ctx.fillStyle = c.bad;
    ctx.fillRect(72, 408 + i * 40, 10, 10);
    ctx.fillStyle = c.ink;
    ctx.fillText(
      `${f.label.replace(/[“”]/g, '"')}  ${formatPercent(f.probability)}`,
      96,
      420 + i * 40,
    );
  });

  ctx.fillStyle = c.ink2;
  ctx.font = `500 20px ${fonts.body}`;
  ctx.fillText(
    `Medido con Jev en ${formatMs(receipt.jevMs)} por ${formatUsd(receipt.costUsd)}`,
    72,
    590,
  );

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("No se pudo crear la imagen"))),
      "image/png",
    ),
  );
}

function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  max: number,
  lh: number,
) {
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > max && line) {
      ctx.fillText(line, x, y);
      line = word;
      y += lh;
    } else line = next;
  }
  ctx.fillText(line, x, y);
}
