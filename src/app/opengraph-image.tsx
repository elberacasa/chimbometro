import { SNAPSHOT_KEY } from "@/lib/radar/refresh";
import type { RadarSnapshot } from "@/lib/radar/types";
import { OG_SIZE, radarImage } from "@/lib/og";
import { serverConfig } from "@/lib/server/config";

export const runtime = "nodejs";
// Regenerated at most hourly, so link crawlers never hit Redis directly.
export const dynamic = "force-static";
export const revalidate = 3600;
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Chamba: empleos remotos que sí aceptan a Venezuela";

/** The home preview carries the live stat, refreshed hourly. */
export default async function Image() {
  const config = serverConfig();
  const snapshot = config.ok
    ? await config.store.getJson<RadarSnapshot>(SNAPSHOT_KEY).catch(() => null)
    : null;
  const jobs = snapshot?.jobs.filter((j) => j.isJob) ?? [];
  const eligible = jobs.filter((j) => j.eligible);
  return radarImage({
    eligible: eligible.length,
    total: jobs.length,
    juniors: eligible.filter((j) => j.seniority === "junior").length,
    footer: "Jev leyó cada oferta y citó la frase que lo demuestra",
  });
}
