import { NextResponse } from "next/server";
import { SNAPSHOT_KEY } from "@/lib/radar/refresh";
import type { RadarSnapshot } from "@/lib/radar/types";
import { toPayload } from "@/lib/radar/view";
import { serverConfig } from "@/lib/server/config";

export const runtime = "nodejs";

/** The latest radar snapshot. Cached at the edge for a minute; the data changes a few times a day. */
export async function GET() {
  const config = serverConfig();
  if (!config.ok) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  const snapshot = await config.store.getJson<RadarSnapshot>(SNAPSHOT_KEY).catch(() => null);
  if (!snapshot) return NextResponse.json({ error: "empty" }, { status: 404 });
  return NextResponse.json(toPayload(snapshot), {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
  });
}
