import { Meter } from "@/components/Meter";
import { BuildCost } from "@/components/sections/BuildCost";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { Subreddit } from "@/components/sections/Subreddit";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import styles from "./page.module.css";

const NAV = [
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "#el-sub", label: "Por qué existe" },
  { href: "#costos", label: "Costos" },
  { href: "/docs", label: "Documentación" },
];

export default function Home() {
  return (
    <div className={styles.page}>
      <SiteHeader nav={NAV} animatedLogo />
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
