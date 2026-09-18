import type { Metadata } from "next";
import { Meter } from "@/components/Meter";
import { BuildCost } from "@/components/sections/BuildCost";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { Subreddit } from "@/components/sections/Subreddit";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import styles from "../page.module.css";

export const metadata: Metadata = {
  title: "Chimbómetro: ¿qué tan chimba es esa oferta?",
  description:
    "Pega una oferta de trabajo y Jev te dice en menos de un segundo qué tan mala es, con cada probabilidad, cita y centavo a la vista.",
};

export default function Home() {
  return (
    <div className={styles.page}>
      <SiteHeader current="chimbometro" />
      <main>
        <Meter />
        <HowItWorks />
        <Subreddit />
        <BuildCost />
      </main>
      <SiteFooter />
    </div>
  );
}
