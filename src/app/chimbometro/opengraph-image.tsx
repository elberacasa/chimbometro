import { meterImage, OG_SIZE } from "@/lib/og";

export const runtime = "nodejs";
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Chimbómetro: ¿qué tan chimba es esa oferta?";

export default function Image() {
  return meterImage("Gratis, sin registro, y el texto de tu oferta no se guarda");
}
