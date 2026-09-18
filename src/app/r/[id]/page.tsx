import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Gauge } from "@/components/Gauge";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { loadShared } from "@/lib/chimba/share";
import { formatInt, formatMs, formatPercent, formatUsd } from "@/lib/format";
import { serverConfig } from "@/lib/server/config";
import pageStyles from "../../page.module.css";
import styles from "./page.module.css";

type Params = { params: Promise<{ id: string }> };

async function load(id: string) {
  const config = serverConfig();
  if (!config.ok) return null;
  return loadShared(config.store, id).catch(() => null);
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const shared = await load((await params).id);
  if (!shared) return { title: "Resultado no encontrado" };
  const title = `${shared.score}/100 ${shared.band.label}: ${shared.verdict.label}`;
  return {
    title: `${title} · Chimbómetro`,
    description: `Una oferta medida con el Chimbómetro. ${shared.flags.map((f) => f.label).join(", ") || "Sin banderas rojas"}.`,
    openGraph: { title, type: "article", locale: "es_VE" },
    twitter: { card: "summary_large_image", title },
  };
}

export default async function SharedResultPage({ params }: Params) {
  const shared = await load((await params).id);
  if (!shared) notFound();

  return (
    <div className={pageStyles.page}>
      <SiteHeader current="chimbometro" />
      <main className={styles.main}>
        <p className={styles.kicker}>Alguien midió una oferta con el Chimbómetro</p>
        <div className={styles.grid}>
          <div className={styles.dial}>
            <Gauge value={shared.score} state="done" label={shared.band.label} />
            <p className={styles.verdict}>{shared.verdict.label}</p>
          </div>
          <div>
            <h1 className={styles.title}>Banderas rojas</h1>
            {shared.flags.length ? (
              <ul className={styles.flags}>
                {shared.flags.map((f) => (
                  <li key={f.label}>
                    <span>{f.label}</span>
                    <span className="num">{formatPercent(f.probability)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.none}>Ninguna bandera roja pasó del 50 %.</p>
            )}
            <dl className={styles.facts}>
              {shared.salary && (
                <div>
                  <dt>Sueldo en el texto</dt>
                  <dd>
                    {shared.salary.amounts.map(formatInt).join(" a ")} {shared.salary.currency}
                  </dd>
                </div>
              )}
              <div>
                <dt>Tecnologías que pide</dt>
                <dd className="num">{shared.technologies}</dd>
              </div>
              <div>
                <dt>Jev respondió {shared.questions} preguntas en</dt>
                <dd className="num">{formatMs(shared.jevMs)}</dd>
              </div>
              <div>
                <dt>Costo de la medición</dt>
                <dd className="num">{formatUsd(shared.costUsd)}</dd>
              </div>
            </dl>
            <p className={styles.privacy}>
              Este enlace muestra el resultado, no el texto de la oferta: ese nunca se guarda.
            </p>
            <div className={styles.actions}>
              <Link href="/chimbometro" className={styles.primary}>
                Mide tu propia oferta
              </Link>
              <Link href="/" className={styles.secondary}>
                Ver empleos que sí aceptan Venezuela
              </Link>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
