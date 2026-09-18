"use client";

import { useCallback, useEffect, useState } from "react";
import { formatInt, formatUsd } from "@/lib/format";
import styles from "./TodayCounter.module.css";

type Stats = { measured: number; costUsd: number };

/** Today's totals from /api/stats. Returns the stats and a function to refetch them. */
export function useTodayStats(): [Stats | null, () => void] {
  const [stats, setStats] = useState<Stats | null>(null);
  const refresh = useCallback(() => {
    fetch("/api/stats", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<Stats>) : null))
      .then((s) => s && setStats(s))
      .catch(() => {});
  }, []);
  useEffect(refresh, [refresh]);
  return [stats, refresh];
}

/** One quiet line of social proof; renders nothing until real numbers arrive. */
export function TodayCounter({ stats }: { stats: Stats | null }) {
  if (!stats || stats.measured === 0) return null;
  return (
    <p className={styles.today}>
      <span className={styles.dot} aria-hidden="true" />
      Hoy se han medido <strong className="num">{formatInt(stats.measured)}</strong>{" "}
      {stats.measured === 1 ? "oferta" : "ofertas"}, y a Jev le han costado{" "}
      <strong className="num">{formatUsd(stats.costUsd)}</strong> en total.
    </p>
  );
}
