import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import pageStyles from "./page.module.css";
import styles from "./not-found.module.css";

export default function NotFound() {
  return (
    <div className={pageStyles.page}>
      <SiteHeader current="radar" />
      <main className={styles.main}>
        <p className={styles.code} aria-hidden="true">
          404
        </p>
        <h1 className={styles.title}>Se fue la luz en esta página.</h1>
        <p className={styles.lede}>
          O nunca existió. Si llegaste desde un resultado compartido, puede que haya vencido: se
          guardan seis meses.
        </p>
        <div className={styles.actions}>
          <Link href="/" className={styles.primary}>
            Ver empleos que sí aceptan Venezuela
          </Link>
          <Link href="/chimbometro" className={styles.secondary}>
            Medir una oferta
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
