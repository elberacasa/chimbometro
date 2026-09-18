import { SNAPSHOT_KEY } from "@/lib/radar/refresh";
import type { RadarSnapshot } from "@/lib/radar/types";
import { toPayload } from "@/lib/radar/view";
import { OG_SIZE, radarImage } from "@/lib/og";
import { serverConfig } from "@/lib/server/config";

export const runtime = "nodejs";
// Regenerated at most once a minute, like the page, so a shared link shows the radar's current
// numbers and crawlers still never hit Redis directly.
export const dynamic = "force-static";
export const revalidate = 60;
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Chamba: empleos remotos que sí aceptan a Venezuela";

/** The home preview carries the live stat. */
export default async function Image() {
  const config = serverConfig();
  const snapshot = config.ok
    ? await config.store.getJson<RadarSnapshot>(SNAPSHOT_KEY).catch(() => null)
    : null;
  // Same filter as the page: real job posts in technology roles.
  const jobs = snapshot ? toPayload(snapshot).jobs : [];
  const eligible = jobs.filter((j) => j.eligible);
  return radarImage({
    eligible: eligible.length,
    total: jobs.length,
    juniors: eligible.filter((j) => j.juniorFriendly).length,
    footer: "Jev leyó cada oferta y citó la frase que lo demuestra",
  });
}
