import { RadarView } from "@/components/radar/RadarView";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { SNAPSHOT_KEY } from "@/lib/radar/refresh";
import type { RadarSnapshot } from "@/lib/radar/types";
import { toPayload } from "@/lib/radar/view";
import { serverConfig } from "@/lib/server/config";
import styles from "./page.module.css";

// The snapshot changes a few times a day: render once a minute at most, so a traffic spike means
// one Redis read per minute instead of one per visitor. Live updates refetch on the client.
export const dynamic = "force-static";
export const revalidate = 60;

/** The snapshot plus the moment it was read, which relative times ("hace 12 minutos") use. */
async function loadSnapshot() {
  const renderedAt = Date.now();
  const config = serverConfig();
  if (!config.ok) return { snapshot: null, renderedAt };
  const snapshot = await config.store.getJson<RadarSnapshot>(SNAPSHOT_KEY).catch(() => null);
  return { snapshot: snapshot && toPayload(snapshot), renderedAt };
}

export default async function RadarPage() {
  const { snapshot, renderedAt } = await loadSnapshot();
  return (
    <div className={styles.page}>
      <SiteHeader current="radar" animatedLogo />
      <main>
        <RadarView initial={snapshot} renderedAt={renderedAt} />
      </main>
      <SiteFooter />
    </div>
  );
}
