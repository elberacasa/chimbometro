import type { Metadata, Viewport } from "next";
import { Big_Shoulders, Hanken_Grotesk, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const bigShoulders = Big_Shoulders({
  subsets: ["latin"],
  axes: ["opsz"],
  variable: "--font-big-shoulders",
  display: "swap",
});

const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Chimbómetro: ¿qué tan chimba es esa oferta?",
  description:
    "Pega una oferta de trabajo y Jev te dice en menos de un segundo qué tan mala es, con cada probabilidad, token y centavo a la vista.",
  authors: [{ name: "elberacasa", url: "https://github.com/elberacasa" }],
  openGraph: {
    title: "Chimbómetro",
    description: "¿Qué tan chimba es esa oferta? Pégala y Jev la mide en menos de un segundo.",
    locale: "es_VE",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f3ef" },
    { media: "(prefers-color-scheme: dark)", color: "#0c1320" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es-VE"
      className={`${bigShoulders.variable} ${hanken.variable} ${plexMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
