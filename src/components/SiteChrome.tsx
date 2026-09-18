import Link from "next/link";
import { Brand } from "./Brand";
import styles from "./SiteChrome.module.css";

const PRODUCTS = [
  { id: "radar", href: "/", label: "Radar de empleos" },
  { id: "chimbometro", href: "/chimbometro", label: "Chimbómetro" },
  { id: "docs", href: "/docs", label: "Laboratorio" },
] as const;

export type ProductId = (typeof PRODUCTS)[number]["id"];

export function SiteHeader({
  current,
  animatedLogo = false,
}: {
  current: ProductId;
  animatedLogo?: boolean;
}) {
  return (
    <header className={styles.header}>
      <Link href="/" className={styles.home} aria-label="Chamba, inicio">
        <Brand animated={animatedLogo} />
      </Link>
      <nav aria-label="Herramientas">
        <ul className={styles.nav}>
          {PRODUCTS.map((p) => (
            <li key={p.id}>
              <Link href={p.href} aria-current={p.id === current ? "page" : undefined}>
                {p.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <p>
        Chamba es un proyecto de <a href="https://github.com/elberacasa">elberacasa</a> para
        r/dev_venezuela.
      </p>
      <p>
        Funciona con Jev, un modelo de <a href="https://typesafe.ai">TypeSafe AI</a>. No está
        afiliado a TypeSafe. No guardamos el texto de las ofertas que mides en el Chimbómetro.
      </p>
    </footer>
  );
}
