import { Logo } from "@/components/Logo";
import { Meter } from "@/components/Meter";
import { BuildCost } from "@/components/sections/BuildCost";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { Subreddit } from "@/components/sections/Subreddit";
import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <a href="#" className={styles.home} aria-label="Chimbómetro, inicio">
          <Logo animated />
        </a>
        <nav aria-label="Secciones">
          <ul className={styles.nav}>
            <li>
              <a href="#como-funciona">Cómo funciona</a>
            </li>
            <li>
              <a href="#el-sub">Por qué existe</a>
            </li>
            <li>
              <a href="#costos">Costos</a>
            </li>
          </ul>
        </nav>
      </header>

      <main>
        <Meter />
        <HowItWorks />
        <Subreddit />
        <BuildCost />
      </main>

      <footer className={styles.footer}>
        <p>
          Hecho en Venezuela por <a href="https://github.com/elberacasa">elberacasa</a> para
          r/dev_venezuela.
        </p>
        <p>
          Funciona con Jev, un modelo de <a href="https://typesafe.ai">TypeSafe AI</a>. Este
          proyecto no está afiliado a TypeSafe. No guardamos el texto de las ofertas que mides.
        </p>
      </footer>
    </div>
  );
}
