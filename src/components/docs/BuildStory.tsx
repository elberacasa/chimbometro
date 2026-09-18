import evalData from "@/content/eval.json";
import radar from "@/content/radar-lab.json";
import sourcesLab from "@/content/sources-lab.json";
import subreddit from "@/content/subreddit.json";
import { formatInt, formatPercent, formatUsd } from "@/lib/format";
import { costUsd } from "@/lib/jev/pricing";
import type { LedgerEntry } from "@/lib/ledger";
import styles from "./Docs.module.css";

/**
 * How Chamba was built, in order, with what each step cost in Jev. Numbers come from the research
 * exports and the ledger, so the story cannot drift from what actually happened.
 */
export function BuildStory({ ledger }: { ledger: LedgerEntry[] }) {
  const radarRuns = ledger.filter((e) => e.purpose.startsWith("Actualizar Chamba Radar"));
  const firstRun = radarRuns[0];
  const total = ledger.reduce((n, e) => n + e.cost_usd, 0);
  const subCost = costUsd({ input_tokens: subreddit.inputTokens, output_tokens: 0 });

  return (
    <>
      <p>
        Todo el proyecto le costó <strong>{formatUsd(total)}</strong> en Jev. Así lo usamos, paso a
        paso, para decidir qué construir y cómo:
      </p>
      <ol className={styles.story}>
        <li>
          <h3>Leímos el sub antes de escribir código</h3>
          <p>
            {formatInt(subreddit.posts)} posts de r/dev_venezuela, siete preguntas cada uno: de qué
            trata, qué busca quien lo escribe, cuánto le duele. {formatUsd(subCost)}. Salió que
            buscar trabajo es lo que más duele y que {subreddit.absurdOffersInTop6} de los 6 posts
            más votados de la historia son capturas de ofertas absurdas.
          </p>
        </li>
        <li>
          <h3>Convertimos el formato viral en una herramienta</h3>
          <p>
            El Chimbómetro le hace {evalData.runs[0]?.questions ?? 20} preguntas a Jev por oferta y
            la fórmula es código. Lo evaluamos con ofertas de ejemplo: {evalData.passed} de{" "}
            {evalData.total} veredictos correctos, después de reescribir las opciones de un
            veredicto que Jev confundía (su confianza subió de 0,21 a 0,96).
          </p>
        </li>
        <li>
          <h3>Hicimos visible cada paso</h3>
          <p>
            La respuesta se transmite en vivo, cada consulta imprime un recibo con tokens y costo, y
            cada bandera roja cita la frase de la oferta que la activó. Jev elige la frase entre
            fragmentos reales, así que no puede inventarla.
          </p>
        </li>
        <li>
          <h3>Probamos la idea más grande con datos</h3>
          <p>
            {formatInt(radar.listings)} empleos remotos de cuatro fuentes,{" "}
            {formatUsd(radar.costUsd)}. Solo {formatPercent(radar.eligible / radar.jobPosts)}{" "}
            aceptaba a alguien en Venezuela. Revisando a mano encontramos un error nuestro (le
            pasamos a Jev un código de plataforma sin explicar) y aprendimos a dejar los campos
            estructurados al código.
          </p>
        </li>
        <li>
          <h3>Lo convertimos en el producto</h3>
          <p>
            El radar de la portada se actualiza cada día y cuando alguien lo pide.
            {firstRun &&
              ` La primera corrida completa leyó ${formatInt(firstRun.calls)} ofertas por ${formatUsd(firstRun.cost_usd)};`}{" "}
            las siguientes solo leen las ofertas nuevas, así que cuestan centavos.
          </p>
        </li>
        <li>
          <h3>Elegimos las fuentes con Jev</h3>
          <p>
            Jev leyó {formatInt(sourcesLab.judged)} ofertas de {sourcesLab.sources.length} bolsas
            por {formatUsd(sourcesLab.costUsd)} y medimos cuánto cuesta encontrar un empleo útil en
            cada una. Nos quedamos con cinco. Revisar dónde la bolsa y Jev no coincidían nos mostró
            errores de los dos lados, y cada uno se volvió un caso de prueba.
          </p>
        </li>
      </ol>
    </>
  );
}
