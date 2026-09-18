/**
 * Draws the README images from real data: the Jev banner from the last radar run, and the build
 * cost chart from ledger/jev-usage.jsonl. Renders HTML with headless Chrome, in Spanish and
 * English. Usage: npm run readme:art [-- --run <last-run URL>]
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const CHROME =
  process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const OUT = resolve("docs/images");
const FONTS = resolve("src/assets/fonts");
const runFlag = process.argv.indexOf("--run");
const runUrl =
  runFlag > -1 ? process.argv[runFlag + 1]! : "https://chimbometro.vercel.app/api/radar/last-run";

type LedgerEntry = {
  script?: string;
  purpose: string;
  calls: number;
  input_tokens: number;
  cost_usd: number;
};
type Judged = { type: "judged"; ms?: number };
type Done = {
  type: "done";
  run: {
    startedAt: string;
    ms: number;
    judged: number;
    inputTokens: number;
    costUsd: number;
    model: string;
  };
};

const ledger: LedgerEntry[] = readFileSync("ledger/jev-usage.jsonl", "utf8")
  .split("\n")
  .filter(Boolean)
  .map((l) => JSON.parse(l));

const events = (await (await fetch(runUrl)).json()) as (Judged | Done | { type: string })[];
const done = events.find((e): e is Done => e.type === "done");
if (!done) throw new Error(`No finished run at ${runUrl}`);
const latencies = events
  .filter((e): e is Judged => e.type === "judged" && typeof (e as Judged).ms === "number")
  .map((e) => e.ms!)
  .sort((a, b) => a - b);
const medianMs = latencies[Math.floor(latencies.length / 2)]!;
const run = done.run;

type Stage = { key: string; es: string; en: string; test: (e: LedgerEntry) => boolean };
const STAGES: Stage[] = [
  {
    key: "posts",
    es: "Leer 206 posts de r/dev_venezuela",
    en: "Reading 206 r/dev_venezuela posts",
    test: (e) => /classify_posts/.test(e.script ?? ""),
  },
  {
    key: "market",
    es: "Estudiar 732 empleos remotos",
    en: "Studying 732 remote job listings",
    test: (e) => /probe_job_listings|classify_jobs/.test(e.script ?? ""),
  },
  {
    key: "chimba",
    es: "Chimbómetro: pruebas y evals",
    en: "Chimbómetro: tests and evals",
    test: (e) => /chimba|eval-offers|curl/.test(e.script ?? ""),
  },
  {
    key: "radar",
    es: "Radar: 2 corridas de 500 ofertas y evals",
    en: "Radar: two 500-listing runs and evals",
    test: (e) => /radar/.test(e.script ?? ""),
  },
];

const total = ledger.reduce((n, e) => n + e.cost_usd, 0);
const calls = ledger.reduce((n, e) => n + e.calls, 0);
const tokens = ledger.reduce((n, e) => n + e.input_tokens, 0);
const stages = STAGES.map((s) => {
  const rows = ledger.filter(s.test);
  return {
    ...s,
    cost: rows.reduce((n, e) => n + e.cost_usd, 0),
    calls: rows.reduce((n, e) => n + e.calls, 0),
  };
});
const other = total - stages.reduce((n, s) => n + s.cost, 0);
if (other > 0.0005) throw new Error(`Ledger entries without a stage: $${other.toFixed(5)}`);

type Lang = "es" | "en";
const num = (n: number, lang: Lang, digits = 0) =>
  n.toLocaleString(lang === "es" ? "es-VE" : "en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
const usd = (n: number, lang: Lang, digits = 2) =>
  lang === "es" ? `${num(n, lang, digits)} $` : `$${num(n, lang, digits)}`;

const perListing = run.costUsd / run.judged;
const perDollar = Math.floor(1 / perListing);
const seconds = run.ms / 1000;

const css = `
@font-face { font-family: Display; src: url("file://${FONTS}/BigShoulders-ExtraBold.ttf"); font-weight: 800; }
@font-face { font-family: Display; src: url("file://${FONTS}/BigShoulders-SemiBold.ttf"); font-weight: 600; }
@font-face { font-family: Body; src: url("file://${FONTS}/HankenGrotesk-Medium.ttf"); font-weight: 500; }
@font-face { font-family: Body; src: url("file://${FONTS}/HankenGrotesk-Bold.ttf"); font-weight: 700; }
* { box-sizing: border-box; margin: 0; }
html, body { width: 1280px; background: #0d1726; }
body { font-family: Body, sans-serif; color: #e8ecf2; -webkit-font-smoothing: antialiased; }
.mono { font-family: Menlo, ui-monospace, monospace; }
`;

function banner(lang: Lang) {
  const t =
    lang === "es"
      ? {
          kicker: "Jev, de TypeSafe, en Chamba",
          head: [
            `${run.judged} ofertas leídas`,
            `en ${num(seconds, lang)} segundos`,
            `por ${num(run.costUsd * 100, lang)} centavos.`,
          ],
          sub: `Cada oferta recibe 8 preguntas en una sola llamada. Jev no escribe texto: responde con probabilidades que el código usa directamente.`,
          stats: [
            [`${num(medianMs, lang)} ms`, "mediana por llamada, 8 preguntas"],
            [num(perDollar, lang), "ofertas evaluadas por cada dólar"],
            [usd(0.042, lang, 3), "por millón de tokens de entrada; la salida es gratis"],
            [usd(total, lang), `costó construir todo el proyecto (${num(calls, lang)} llamadas)`],
          ],
          foot: `Medido en la corrida del radar del ${run.startedAt.slice(0, 10)}, modelo ${run.model}.`,
        }
      : {
          kicker: "Jev, by TypeSafe, inside Chamba",
          head: [
            `${run.judged} job listings read`,
            `in ${num(seconds, lang)} seconds`,
            `for ${num(run.costUsd * 100, lang)} cents.`,
          ],
          sub: `Each listing gets 8 questions in a single call. Jev does not write text: it answers with probabilities that code uses directly.`,
          stats: [
            [`${num(medianMs, lang)} ms`, "median per call, 8 questions"],
            [num(perDollar, lang), "listings judged per dollar"],
            [usd(0.042, lang, 3), "per million input tokens; output is free"],
            [usd(total, lang), `to build the whole project (${num(calls, lang)} calls)`],
          ],
          foot: `Measured on the radar run of ${run.startedAt.slice(0, 10)}, model ${run.model}.`,
        };
  const bars = latencies
    .filter((_, i) => i % 2 === 0)
    .map(
      (ms) => `<i style="height:${Math.max(4, Math.round((ms / latencies.at(-1)!) * 100))}%"></i>`,
    )
    .join("");
  return `<style>${css}
.wrap { padding: 72px 80px 56px; position: relative; overflow: hidden; }
.kicker { font-size: 22px; color: #7fd6a2; font-weight: 700; }
h1 { font-family: Display; font-weight: 800; font-size: 104px; line-height: 0.92; margin-top: 18px; letter-spacing: -0.5px; }
h1 span { display: block; }
h1 span:last-child { color: #7fd6a2; }
.sub { margin-top: 28px; max-width: 700px; font-size: 24px; line-height: 1.45; color: #a7b2c4; }
.stats { margin-top: 48px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 0; border-top: 1px solid #223047; }
.stat { padding: 24px 24px 0 0; }
.stat + .stat { padding-left: 24px; border-left: 1px solid #223047; }
.stat b { display: block; font-family: Display; font-weight: 600; font-size: 52px; line-height: 1; }
.stat span { display: block; margin-top: 10px; font-size: 18px; line-height: 1.35; color: #a7b2c4; }
.spark { position: absolute; right: 80px; top: 88px; width: 380px; height: 250px; display: flex; align-items: flex-end; gap: 1px; }
.spark i { flex: 1; background: #2c6b4a; border-radius: 1px 1px 0 0; }
.cap { position: absolute; right: 80px; top: 350px; width: 380px; font-size: 15px; color: #7e8aa0; }
.foot { margin-top: 40px; font-size: 15px; color: #7e8aa0; }
</style>
<div class="wrap">
  <div class="kicker">${t.kicker}</div>
  <h1>${t.head.map((l) => `<span>${l}</span>`).join("")}</h1>
  <p class="sub">${t.sub}</p>
  <div class="spark">${bars}</div>
  <p class="cap mono">${lang === "es" ? `${latencies.length} llamadas, de ${latencies[0]} a ${latencies.at(-1)} ms` : `${latencies.length} calls, ${latencies[0]} to ${latencies.at(-1)} ms`}</p>
  <div class="stats">${t.stats.map(([b, s]) => `<div class="stat"><b>${b}</b><span>${s}</span></div>`).join("")}</div>
  <p class="foot">${t.foot}</p>
</div>`;
}

function costChart(lang: Lang) {
  const max = Math.max(...stages.map((s) => s.cost));
  const rows = stages
    .map(
      (s) => `<div class="row">
  <div class="label">${s[lang]}<small>${num(s.calls, lang)} ${lang === "es" ? "llamadas" : "calls"}</small></div>
  <div class="track"><div class="bar" style="width:${(s.cost / max) * 100}%"></div></div>
  <div class="val mono">${usd(s.cost, lang, 4)}</div>
</div>`,
    )
    .join("");
  const t =
    lang === "es"
      ? {
          head: `Todo el proyecto costó ${usd(total, lang)} en Jev`,
          sub: `${num(calls, lang)} llamadas y ${num(tokens / 1e6, lang, 1)} millones de tokens, registrados uno por uno en ledger/jev-usage.jsonl.`,
        }
      : {
          head: `The whole project cost ${usd(total, lang)} in Jev`,
          sub: `${num(calls, lang)} calls and ${num(tokens / 1e6, lang, 1)} million tokens, each one logged in ledger/jev-usage.jsonl.`,
        };
  return `<style>${css}
html, body { background: #f2f3ef; color: #0f1b2d; }
.wrap { padding: 64px 80px 60px; }
h1 { font-family: Display; font-weight: 800; font-size: 72px; line-height: 1; }
.sub { margin-top: 16px; font-size: 22px; color: #45526a; }
.rows { margin-top: 48px; display: grid; gap: 22px; }
.row { display: grid; grid-template-columns: 420px 1fr 130px; align-items: center; gap: 24px; }
.label { font-size: 22px; font-weight: 700; line-height: 1.2; }
.label small { display: block; font-weight: 500; font-size: 16px; color: #6f7a8c; margin-top: 4px; }
.track { height: 36px; border-bottom: 1px solid #b9bfb4; display: flex; align-items: flex-end; }
.bar { height: 28px; background: #1e9e5a; border-radius: 0 4px 4px 0; min-width: 4px; }
.val { font-size: 20px; text-align: right; color: #0f1b2d; }
.foot { margin-top: 40px; padding-top: 20px; border-top: 1px solid #d6dad1; font-size: 17px; color: #6f7a8c; }
</style>
<div class="wrap">
  <h1>${t.head}</h1>
  <p class="sub">${t.sub}</p>
  <div class="rows">${rows}</div>
  <p class="foot">${lang === "es" ? "Jev cobra 0,042 $ por millón de tokens de entrada. Los tokens de salida son gratis." : "Jev charges $0.042 per million input tokens. Output tokens are free."}</p>
</div>`;
}

const dir = mkdtempSync(join(tmpdir(), "readme-art-"));
function shoot(name: string, html: string, height: number) {
  const file = join(dir, `${name}.html`);
  writeFileSync(file, `<!doctype html><meta charset="utf-8">${html}`);
  execFileSync(
    CHROME,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--force-device-scale-factor=2",
      `--window-size=1280,${height}`,
      `--screenshot=${join(OUT, `${name}.png`)}`,
      `file://${file}`,
    ],
    { stdio: "ignore" },
  );
  console.log(`docs/images/${name}.png`);
}

for (const lang of ["es", "en"] as const) {
  shoot(`jev-${lang}`, banner(lang), 800);
  shoot(`cost-${lang}`, costChart(lang), 620);
}
console.log(
  `run: ${run.judged} listings, ${seconds.toFixed(1)} s, $${run.costUsd.toFixed(4)}, median ${medianMs} ms · ledger: $${total.toFixed(4)}, ${calls} calls`,
);
