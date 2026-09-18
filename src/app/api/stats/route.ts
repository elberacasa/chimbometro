import { NextResponse } from "next/server";
import { serverConfig } from "@/lib/server/config";
import { todayStats } from "@/lib/server/guard";

export const runtime = "nodejs";

/** Today's public totals: how many offers were measured and what Jev charged for them. */
export async function GET() {
  const config = serverConfig();
  if (!config.ok) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  try {
    const stats = await todayStats(config.store);
    // Shared cache for 10 s so a crowd of visitors becomes one Redis read.
    return NextResponse.json(stats, {
      headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30" },
    });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
