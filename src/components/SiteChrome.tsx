import Link from "next/link";
import { Logo } from "./Logo";
import styles from "./SiteChrome.module.css";

type NavItem = { href: string; label: string };

export function SiteHeader({
  nav,
  animatedLogo = false,
}: {
  nav: NavItem[];
  animatedLogo?: boolean;
}) {
  return (
    <header className={styles.header}>
      <Link href="/" className={styles.home} aria-label="Chimbómetro, inicio">
        <Logo animated={animatedLogo} />
      </Link>
      <nav aria-label="Secciones">
        <ul className={styles.nav}>
          {nav.map((item) => (
            <li key={item.href}>
              <Link href={item.href}>{item.label}</Link>
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
        Hecho en Venezuela por <a href="https://github.com/elberacasa">elberacasa</a> para
        r/dev_venezuela.
      </p>
      <p>
        Funciona con Jev, un modelo de <a href="https://typesafe.ai">TypeSafe AI</a>. Este proyecto
        no está afiliado a TypeSafe. No guardamos el texto de las ofertas que mides.
      </p>
    </footer>
  );
}
