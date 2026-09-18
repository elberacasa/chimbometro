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
  title: "Chamba: empleos remotos que sí aceptan a Venezuela",
  description:
    "Un radar de empleos remotos para devs en Venezuela: Jev lee cada oferta de cuatro bolsas públicas y cita la frase que dice si puedes aplicar. Incluye el Chimbómetro para medir ofertas.",
  authors: [{ name: "elberacasa", url: "https://github.com/elberacasa" }],
  openGraph: {
    title: "Chamba",
    description: "Empleos remotos que sí aceptan a Venezuela, leídos uno por uno por Jev.",
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
