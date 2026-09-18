import type { Metadata } from "next";
import evalData from "@/content/eval.json";
import subreddit from "@/content/subreddit.json";
import { ArchitectureDiagram } from "@/components/docs/ArchitectureDiagram";
import { CostBars, EvalRuns, LatencyHistogram } from "@/components/docs/Charts";
import { BuildStory } from "@/components/docs/BuildStory";
import { Lab } from "@/components/docs/Lab";
import { RadarDocs } from "@/components/docs/RadarDocs";
import { SourcesLab } from "@/components/docs/SourcesLab";
import { PolicyPlayground } from "@/components/docs/PolicyPlayground";
import styles from "@/components/docs/Docs.module.css";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { MAX_OFFER_CHARS } from "@/lib/chimba/analyze";
import { evidenceQuestions, MAX_FRAGMENTS, splitFragments } from "@/lib/chimba/evidence";
import { EXAMPLES } from "@/lib/chimba/examples";
import { QUESTIONS } from "@/lib/chimba/questions";
import type { ScoredAnswers } from "@/lib/chimba/score";
import { formatInt, formatUsd } from "@/lib/format";
import { USD_PER_MILLION_INPUT_TOKENS } from "@/lib/jev/pricing";
import { groupLedger, ledgerTotals, readLedger } from "@/lib/ledger";
import { DEFAULT_LIMITS, MAX_BODY_BYTES } from "@/lib/server/guard";
import pageStyles from "../page.module.css";

export const metadata: Metadata = {
  title: "Laboratorio de Chamba: cómo funciona por dentro",
  description:
    "Cómo el Chimbómetro usa Jev: arquitectura, cada pregunta tal como se envía, la fórmula, el protocolo de streaming, la seguridad y los costos reales.",
};

const TOC = [
  ["historia", "Cómo lo construimos"],
  ["radar", "El radar"],
  ["fuentes", "Fuentes y mejoras"],
  ["arquitectura", "Arquitectura del Chimbómetro"],
  ["preguntas", "Las preguntas"],
  ["evidencia", "Evidencia"],
  ["formula", "La fórmula"],
  ["streaming", "Streaming"],
  ["seguridad", "Seguridad"],
  ["datos", "Latencia y costo"],
  ["laboratorio", "Laboratorio"],
] as const;

const EXAMPLE = EXAMPLES[0]!;
const exampleFragments = splitFragments(EXAMPLE.text);
const exampleEvidence = evidenceQuestions(exampleFragments).evidencia_sueldo_bajo;
const judgments = Object.entries(QUESTIONS);
const totalQuestions = judgments.length + Object.keys(evidenceQuestions([])).length;
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
const evalMedian = median(evalData.runs.map((r) => r.jevMs));

const TYPE_LABEL = { noul: "sí/no", score: "escala", choice: "elección" } as const;

export default async function Docs() {
  const entries = await readLedger();
  const ledger = groupLedger(entries);
  const totals = ledgerTotals(ledger);
  const costRows = Object.values(
    ledger.reduce<Record<string, { purpose: string; calls: number; costUsd: number }>>((acc, e) => {
      const key = e.purpose.replace(/\s*\(.*\)$/, "");
      acc[key] ??= { purpose: key, calls: 0, costUsd: 0 };
      acc[key].calls += e.calls;
      acc[key].costUsd += e.cost_usd;
      return acc;
    }, {}),
  ).sort((a, b) => b.costUsd - a.costUsd);

  return (
    <div className={pageStyles.page}>
      <SiteHeader current="docs" />
      <div className={styles.layout}>
        <nav className={styles.toc} aria-label="En esta página">
          <p>En esta página</p>
          <ol>
            {TOC.map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`}>{label}</a>
              </li>
            ))}
          </ol>
        </nav>

        <main className={styles.content}>
          <header className={styles.intro}>
            <h1>Cómo funciona Chamba por dentro</h1>
            <p>
              Un radar que lee cientos de ofertas por centavos y un medidor que juzga una oferta en
              menos de un segundo, los dos con Jev. Cada número de esta página sale del código o de
              mediciones reales, así que no puede quedar desactualizado.
            </p>
            <dl className={styles.facts}>
              <div>
                <dt>Modelo</dt>
                <dd>{evalData.model}</dd>
              </div>
              <div>
                <dt>Preguntas por oferta</dt>
                <dd className="num">{totalQuestions}</dd>
              </div>
              <div>
                <dt>Mediana de Jev</dt>
                <dd className="num">{evalMedian} ms</dd>
              </div>
              <div>
                <dt>Precio</dt>
                <dd className="num">
                  {formatUsd(USD_PER_MILLION_INPUT_TOKENS)} por millón de tokens de entrada
                </dd>
              </div>
            </dl>
          </header>

          <section id="historia" className={styles.section}>
            <h2>Cómo lo construimos con Jev</h2>
            <BuildStory ledger={entries} />
          </section>

          <section id="radar" className={styles.section}>
            <h2>El radar de empleos</h2>
            <RadarDocs />
          </section>

          <section id="fuentes" className={styles.section}>
            <h2>Cómo elegimos las fuentes y cómo mejora Jev</h2>
            <SourcesLab />
          </section>

          <section id="arquitectura" className={styles.section}>
            <h2>Arquitectura del Chimbómetro</h2>
            <p>
              El navegador nunca habla con Jev. La oferta va a una función de Vercel que tiene la
              API key, verifica que la petición sea legítima, le hace las preguntas a Jev, calcula
              el puntaje y devuelve cada paso en cuanto ocurre.
            </p>
            <ArchitectureDiagram questions={totalQuestions} jevMs={evalMedian} />
          </section>

          <section id="preguntas" className={styles.section}>
            <h2>Las preguntas</h2>
            <p>
              Jev no escribe texto: responde preguntas tipadas. Un <em>noul</em> devuelve la
              probabilidad de que algo sea cierto, una <em>escala</em> ubica la oferta entre niveles
              descritos y una <em>elección</em> reparte la probabilidad entre opciones. Estas son
              las {judgments.length} preguntas de juicio, exactamente como se envían, en inglés. El
              texto de la oferta va aparte, en el estado.
            </p>
            <div className={styles.catalog}>
              {judgments.map(([id, q]) => (
                <details key={id} className={styles.question}>
                  <summary>
                    <code>{id}</code>
                    <span className={styles.qtype}>{TYPE_LABEL[q.type]}</span>
                  </summary>
                  <pre tabIndex={0}>{JSON.stringify(q, null, 2)}</pre>
                </details>
              ))}
            </div>
          </section>

          <section id="evidencia" className={styles.section}>
            <h2>Evidencia: seleccionar en vez de generar</h2>
            <p>
              Para señalar qué parte de la oferta activó cada bandera, el código la divide en
              fragmentos (hasta {MAX_FRAGMENTS}, cortando en puntos, dos puntos y saltos de línea) y
              le pregunta a Jev, por cada bandera, cuál fragmento es la mejor evidencia. Jev elige
              entre opciones que ya existen, así que no puede inventar citas. Estas{" "}
              {Object.keys(evidenceQuestions([])).length} preguntas viajan en el mismo request; el
              código solo usa las de banderas activadas.
            </p>
            <div className={styles.split}>
              <div>
                <p className={styles.label}>
                  «{EXAMPLE.label}» en {exampleFragments.length} fragmentos
                </p>
                <ol className={styles.fragments}>
                  {exampleFragments.map((f) => (
                    <li key={f.id}>
                      <code>{f.id}</code> {f.text}
                    </li>
                  ))}
                </ol>
              </div>
              <div>
                <p className={styles.label}>La pregunta de evidencia para «sueldo muy bajo»</p>
                <pre tabIndex={0} className={styles.codeBlock}>
                  {JSON.stringify({ evidencia_sueldo_bajo: exampleEvidence }, null, 2)}
                </pre>
              </div>
            </div>
          </section>

          <section id="formula" className={styles.section}>
            <h2>La fórmula</h2>
            <p>
              Jev da probabilidades; el código decide. El puntaje combina la opinión general de Jev
              sobre la oferta con las banderas rojas, cada una con su peso, usando un «O ruidoso»:
              cada bandera empeora la oferta por su cuenta y ninguna puede pasar de 100. Mueve las
              constantes y mira cómo cambian las cinco ofertas de ejemplo.
            </p>
            <pre className={styles.formula}>
              {`puntaje = 100 × [ s × absurdo/3 + (1 − s) × (1 − producto de (1 − pesoᵢ × p′ᵢ)) ]
p′ᵢ     = max(0, (pᵢ − umbral) / (1 − umbral))`}
            </pre>
            <PolicyPlayground
              runs={evalData.runs.map((r) => ({
                id: r.id,
                label: r.label,
                answers: r.answers as unknown as ScoredAnswers,
              }))}
            />
          </section>

          <section id="streaming" className={styles.section}>
            <h2>Streaming</h2>
            <p>
              <code>POST /api/chimba</code> responde con <code>application/x-ndjson</code>: una
              línea JSON por evento, escrita en el momento en que pasa. <code>t</code> son
              milisegundos desde que el servidor recibió la petición. Así la página muestra cada
              paso en vivo en vez de esperar al final.
            </p>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Evento</th>
                    <th scope="col">Cuándo</th>
                    <th scope="col">Trae</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <code>received</code>
                    </td>
                    <td>La petición pasó las verificaciones</td>
                    <td>caracteres, tiempo de verificación</td>
                  </tr>
                  <tr>
                    <td>
                      <code>sent</code>
                    </td>
                    <td>Justo antes de llamar a Jev</td>
                    <td>modelo, ids de las {totalQuestions} preguntas, fragmentos</td>
                  </tr>
                  <tr>
                    <td>
                      <code>answered</code>
                    </td>
                    <td>Llegó la respuesta de Jev</td>
                    <td>respuesta completa, tokens, latencia</td>
                  </tr>
                  <tr>
                    <td>
                      <code>scored</code>
                    </td>
                    <td>La fórmula terminó</td>
                    <td>puntaje, banderas, evidencia, recibo</td>
                  </tr>
                  <tr>
                    <td>
                      <code>error</code>
                    </td>
                    <td>Algo falló después de empezar</td>
                    <td>mensaje para mostrar</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section id="seguridad" className={styles.section}>
            <h2>Seguridad</h2>
            <p>
              La API key vive solo en el servidor, en un módulo que no se puede importar desde el
              navegador. Antes de gastar un centavo, cada petición pasa estas verificaciones, en
              orden:
            </p>
            <ol className={styles.guards}>
              <li>
                <strong>Mismo origen.</strong> Otros sitios no pueden usar la API desde el navegador
                de sus visitantes. Si no, <code>403</code>.
              </li>
              <li>
                <strong>Tamaño.</strong> Máximo {formatInt(MAX_BODY_BYTES / 1000)} KB por petición y{" "}
                {formatInt(MAX_OFFER_CHARS)} caracteres de oferta. Si no, <code>413</code> o{" "}
                <code>400</code>.
              </li>
              <li>
                <strong>Presupuesto diario.</strong> Si el gasto del día llega a{" "}
                {formatUsd(DEFAULT_LIMITS.dailyBudgetUsd)}, la API se pausa hasta la medianoche UTC.
                Acota el peor caso aunque alguien rote IPs. Si no, <code>503</code>.
              </li>
              <li>
                <strong>Por persona.</strong> {DEFAULT_LIMITS.perIpPerMinute} ofertas por minuto y{" "}
                {DEFAULT_LIMITS.perIpPerDay} por día por IP. La IP se guarda solo como hash. Si no,{" "}
                <code>429</code> con <code>Retry-After</code>.
              </li>
              <li>
                <strong>En total.</strong> {DEFAULT_LIMITS.globalPerMinute} ofertas por minuto entre
                todos, por debajo del límite de la API de TypeSafe. Si no, <code>503</code>.
              </li>
            </ol>
            <p>
              Los contadores viven en Upstash Redis para que valgan en todas las instancias. Si
              Redis no responde, la API no llama a Jev: falla cerrada.
            </p>
          </section>

          <section id="datos" className={styles.section}>
            <h2>Latencia y costo</h2>
            <p>
              Números medidos, no estimados. Construir todo esto costó{" "}
              <strong>{formatUsd(totals.costUsd)}</strong> en {formatInt(totals.calls)} consultas a
              Jev, cada una registrada.
            </p>
            <LatencyHistogram
              bins={subreddit.latencyHistogram}
              p50={subreddit.latencyP50Ms}
              p90={subreddit.latencyP90Ms}
              eval20Median={evalMedian}
            />
            <EvalRuns runs={evalData.runs} at={evalData.at} />
            <CostBars rows={costRows} />
          </section>

          <section id="laboratorio" className={styles.section}>
            <h2>Laboratorio: qué más puede hacer Jev</h2>
            <Lab
              chimbaEval={{ passed: evalData.passed, total: evalData.total, median: evalMedian }}
            />
          </section>
        </main>
      </div>
      <SiteFooter />
    </div>
  );
}
