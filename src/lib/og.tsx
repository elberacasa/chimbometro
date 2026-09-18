import { readFile } from "node:fs/promises";
import { ImageResponse } from "next/og";
import { arcPath, polar, valueToAngle } from "@/lib/dial";

/**
 * Link-preview cards (Open Graph, 1200×630) for Reddit, WhatsApp and X. Drawn with the site's own
 * fonts and palette; always light, so they read the same in every app.
 */

export const OG_SIZE = { width: 1200, height: 630 };

const C = {
  paper: "#f2f3ef",
  ink: "#0f1b2d",
  ink2: "#45526a",
  ink3: "#6f7a8c",
  rule: "#d6dad1",
  good: "#1e9e5a",
  warn: "#e0a100",
  bad: "#e3342f",
  night: "#0d1726",
};

async function fonts() {
  const load = (file: string) => readFile(new URL(`../assets/fonts/${file}`, import.meta.url));
  const [display, displaySemi, body, bodyBold] = await Promise.all([
    load("BigShoulders-ExtraBold.ttf"),
    load("BigShoulders-SemiBold.ttf"),
    load("HankenGrotesk-Medium.ttf"),
    load("HankenGrotesk-Bold.ttf"),
  ]);
  return [
    { name: "Display", data: display, weight: 800 as const },
    { name: "Display", data: displaySemi, weight: 600 as const },
    { name: "Body", data: body, weight: 500 as const },
    { name: "Body", data: bodyBold, weight: 700 as const },
  ];
}

export function siteHost() {
  return (
    process.env.NEXT_PUBLIC_SITE_HOST ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    "localhost:3000"
  );
}

async function render(node: React.ReactElement) {
  return new ImageResponse(node, { ...OG_SIZE, fonts: await fonts() });
}

const BAND_COLOR: Record<string, string> = {
  decente: C.good,
  sospechosa: C.warn,
  chimba: C.bad,
  chimbisima: C.bad,
};

function Dial({ value, size }: { value: number; size: number }) {
  const cx = 220;
  const cy = 232;
  const r = 196;
  const bands = [
    { from: 0, to: 25, color: C.good, w: 18 },
    { from: 25, to: 50, color: C.warn, w: 18 },
    { from: 50, to: 75, color: C.bad, w: 18 },
    { from: 75, to: 100, color: C.bad, w: 32 },
  ];
  const tip = polar(cx, cy, r - 30, valueToAngle(value));
  const base1 = polar(cx, cy, 9, valueToAngle(value) + 90);
  const base2 = polar(cx, cy, 9, valueToAngle(value) - 90);
  return (
    <svg width={size} height={(size * 262) / 440} viewBox="0 0 440 262">
      {bands.map((b) => (
        <path
          key={b.from}
          d={arcPath(
            cx,
            cy,
            r - b.w / 2,
            valueToAngle(b.from) - (b.from ? 1 : 0),
            valueToAngle(b.to) + (b.to < 100 ? 1 : 0),
          )}
          stroke={b.color}
          strokeWidth={b.w}
          fill="none"
        />
      ))}
      <path
        d={`M ${base1[0]} ${base1[1]} L ${tip[0]} ${tip[1]} L ${base2[0]} ${base2[1]} Z`}
        fill={C.ink}
      />
      <circle cx={cx} cy={cy} r={20} fill={C.ink} />
    </svg>
  );
}

/** Bottom row shared by every card: what happened on the left, where to find it on the right. */
function Footer({ note, color }: { note: string; color: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        fontSize: 22,
        color,
        marginTop: 18,
      }}
    >
      <div>{note}</div>
      <div>{siteHost()}</div>
    </div>
  );
}

export type ResultCard = {
  score: number;
  band: { id: string; label: string };
  verdict: string;
  flags: string[];
  footer: string;
};

export function resultImage(r: ResultCard) {
  return render(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        background: C.paper,
        padding: "52px 64px 40px",
        fontFamily: "Body",
      }}
    >
      <div style={{ display: "flex", flex: 1 }}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, paddingRight: 24 }}>
          <div style={{ fontFamily: "Display", fontWeight: 600, fontSize: 32, color: C.ink2 }}>
            chimbómetro
          </div>
          <div style={{ display: "flex", alignItems: "baseline" }}>
            <div
              style={{
                fontFamily: "Display",
                fontWeight: 800,
                fontSize: 180,
                lineHeight: 1,
                color: C.ink,
              }}
            >
              {String(r.score)}
            </div>
            <div
              style={{
                fontFamily: "Display",
                fontWeight: 600,
                fontSize: 56,
                color: C.ink3,
                marginLeft: 8,
              }}
            >
              /100
            </div>
          </div>
          <div
            style={{
              fontFamily: "Display",
              fontWeight: 800,
              fontSize: 60,
              lineHeight: 1,
              color: BAND_COLOR[r.band.id] ?? C.ink,
            }}
          >
            {r.band.label}
          </div>
          <div
            style={{
              fontSize: 30,
              fontWeight: 700,
              color: C.ink,
              marginTop: 14,
              lineHeight: 1.2,
              maxWidth: 600,
            }}
          >
            {r.verdict}
          </div>
        </div>
        <div
          style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", width: 470 }}
        >
          <Dial value={r.score} size={470} />
          <div
            style={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-end", marginTop: 22 }}
          >
            {r.flags.slice(0, 4).map((f) => (
              <div
                key={f}
                style={{
                  fontSize: 22,
                  color: C.ink,
                  background: "#f8d9d6",
                  borderRadius: 8,
                  padding: "6px 12px",
                  marginLeft: 8,
                  marginBottom: 8,
                }}
              >
                {f}
              </div>
            ))}
          </div>
        </div>
      </div>
      <Footer note={r.footer} color={C.ink2} />
    </div>,
  );
}

export type RadarCard = { eligible: number; total: number; juniors: number; footer: string };

export function radarImage(r: RadarCard) {
  const pct = Math.round((r.eligible / Math.max(1, r.total)) * 100);
  return render(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        background: C.night,
        color: "#e8ecf2",
        padding: "52px 64px 40px",
        fontFamily: "Body",
      }}
    >
      <div style={{ display: "flex", flex: 1 }}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div style={{ fontFamily: "Display", fontWeight: 800, fontSize: 40, color: "#4fd18b" }}>
            chamba
          </div>
          <div
            style={{
              fontFamily: "Display",
              fontWeight: 800,
              fontSize: 92,
              lineHeight: 0.95,
              marginTop: 18,
              maxWidth: 640,
            }}
          >
            Empleos remotos que sí aceptan a Venezuela
          </div>
          <div style={{ display: "flex", alignItems: "baseline", marginTop: 30 }}>
            <div style={{ fontFamily: "Display", fontWeight: 800, fontSize: 86, color: "#4fd18b" }}>
              {String(r.eligible)}
            </div>
            <div style={{ fontSize: 34, fontWeight: 700, marginLeft: 16 }}>
              {`de ${r.total} ofertas de tecnología (${pct} %). Solo ${r.juniors} para juniors.`}
            </div>
          </div>
        </div>
        <div
          style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 360 }}
        >
          <svg width={340} height={340} viewBox="0 0 320 320">
            <circle cx={160} cy={160} r={150} fill="none" stroke="#25385a" strokeWidth={3} />
            <circle cx={160} cy={160} r={96} fill="none" stroke="#25385a" strokeWidth={2} />
            <circle cx={160} cy={160} r={44} fill="none" stroke="#25385a" strokeWidth={2} />
            <path d="M160 160 L160 10 A150 150 0 0 1 290 85 Z" fill="#4fd18b" fillOpacity={0.22} />
            <line x1={160} y1={160} x2={160} y2={10} stroke="#4fd18b" strokeWidth={4} />
            {[
              [230, 70],
              [250, 150],
              [120, 90],
              [90, 220],
              [200, 240],
              [60, 150],
            ].map(([x, y]) => (
              <circle key={`${x}-${y}`} cx={x} cy={y} r={9} fill="#4fd18b" />
            ))}
            <circle cx={160} cy={160} r={8} fill="#4fd18b" />
          </svg>
        </div>
      </div>
      <Footer note={r.footer} color="#9aa8bf" />
    </div>,
  );
}

export function meterImage(footer: string) {
  return render(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        background: C.paper,
        padding: "52px 64px 40px",
        fontFamily: "Body",
      }}
    >
      <div style={{ display: "flex", flex: 1 }}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div style={{ fontFamily: "Display", fontWeight: 600, fontSize: 34, color: C.ink2 }}>
            chimbómetro
          </div>
          <div
            style={{
              fontFamily: "Display",
              fontWeight: 800,
              fontSize: 100,
              lineHeight: 0.92,
              color: C.ink,
              marginTop: 14,
              maxWidth: 560,
            }}
          >
            ¿Qué tan chimba es esa oferta?
          </div>
          <div style={{ fontSize: 28, color: C.ink2, marginTop: 20, maxWidth: 580 }}>
            Pégala y Jev la mide en menos de un segundo, con cada bandera roja citada del texto.
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", width: 460 }}>
          <Dial value={88} size={460} />
        </div>
      </div>
      <Footer note={footer} color={C.ink2} />
    </div>,
  );
}
