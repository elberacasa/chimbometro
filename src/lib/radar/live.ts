import type { SourceId } from "./types";

/**
 * The sources the radar uses, chosen with the experiment in scripts/probe-sources.ts (results in
 * src/content/sources-lab.json). Working Nomads, Remote OK and Remotive together gave 9 useful jobs
 * out of 118 judged, at 5 to 13 times Himalayas' cost per useful job, and half of Remotive's were
 * duplicates of other boards. Kept apart from sources.ts so the browser can import it.
 */
export const LIVE_SOURCES: readonly SourceId[] = ["hn", "getonbrd", "himalayas", "jobicy", "wwr"];
