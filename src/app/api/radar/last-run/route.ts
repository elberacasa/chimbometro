import { NextResponse } from "next/server";
import { LAST_RUN_KEY, type RadarEvent } from "@/lib/radar/refresh";
import { serverConfig } from "@/lib/server/config";

export const runtime = "nodejs";

/** Every event of the latest radar update, with its original timing, so the page can replay it. */
export async function GET() {
  const config = serverConfig();
  if (!config.ok) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  const events = await config.store.getJson<RadarEvent[]>(LAST_RUN_KEY).catch(() => null);
  if (!events) return NextResponse.json({ error: "empty" }, { status: 404 });
  return NextResponse.json(events, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
  });
}
