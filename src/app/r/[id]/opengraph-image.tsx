import { loadShared } from "@/lib/chimba/share";
import { formatMs, formatUsd } from "@/lib/format";
import { OG_SIZE, resultImage } from "@/lib/og";
import { serverConfig } from "@/lib/server/config";

export const runtime = "nodejs";
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Resultado del Chimbómetro";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const config = serverConfig();
  const shared = config.ok
    ? await loadShared(config.store, (await params).id).catch(() => null)
    : null;
  if (!shared) {
    return resultImage({
      score: 0,
      band: { id: "decente", label: "Sin datos" },
      verdict: "Este resultado ya no existe.",
      flags: [],
      footer: "Mide tu oferta en el Chimbómetro",
    });
  }
  return resultImage({
    score: shared.score,
    band: shared.band,
    verdict: shared.verdict.label,
    flags: shared.flags.map((f) => f.label.replace(/[“”]/g, "")),
    footer: `Medido con Jev en ${formatMs(shared.jevMs)} por ${formatUsd(shared.costUsd)}`,
  });
}
