import radar from "@/content/radar-lab.json";
import subreddit from "@/content/subreddit.json";
import { costUsd } from "@/lib/jev/pricing";
import { formatInt, formatPercent, formatUsd } from "@/lib/format";
import styles from "./Docs.module.css";

/**
 * What we have tried with Jev beyond the Chimbómetro, with real numbers and links to every
 * source, plus the lessons that changed how we write questions.
 */
export function Lab({
  chimbaEval,
}: {
  chimbaEval: { passed: number; total: number; median: number };
}) {
  const share = radar.eligible / radar.jobPosts;
  const hn = radar.sources.find((s) => s.id === "hn")!;
  const subCost = costUsd({ input_tokens: subreddit.inputTokens, output_tokens: 0 });

  return (
    <>
      <p>
        Jev es barato y rápido, así que lo usamos para leer volúmenes de texto que nadie leería a
        mano. Cada experimento está en <code>research/</code> y quedó en el registro de costos.
      </p>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Experimento</th>
              <th scope="col">Textos</th>
              <th scope="col">Preguntas c/u</th>
              <th scope="col">Costo</th>
              <th scope="col">Resultado</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Leer r/dev_venezuela</td>
              <td className="num">{formatInt(subreddit.posts)} posts</td>
              <td className="num">7</td>
              <td className="num">{formatUsd(subCost)}</td>
              <td>Buscar trabajo es el tema que más duele; de ahí salió el Chimbómetro.</td>
            </tr>
            <tr>
              <td>Chimbómetro</td>
              <td className="num">{chimbaEval.total} ofertas</td>
              <td className="num">20</td>
              <td className="num">≈ $0,00015 c/u</td>
              <td>
                {chimbaEval.passed}/{chimbaEval.total} veredictos correctos, mediana{" "}
                {chimbaEval.median} ms, evidencia citada del texto.
              </td>
            </tr>
            <tr>
              <td>Chamba Radar</td>
              <td className="num">{formatInt(radar.listings)} empleos</td>
              <td className="num">{radar.questions}</td>
              <td className="num">{formatUsd(radar.costUsd)}</td>
              <td>Qué empleos remotos aceptan a alguien que vive en Venezuela.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3 className={styles.h3}>Chamba Radar: el experimento</h3>
      <p>
        Bajamos {formatInt(radar.listings)} empleos de cuatro fuentes públicas y le preguntamos a
        Jev, por cada uno, si es un empleo real, desde dónde se puede trabajar, si excluye a
        Venezuela, si paga en dólares, la seniority y cuánto inglés pide. Jev no navega: nuestro
        código descarga cada fuente y Jev lee el texto.
      </p>
      <p className={styles.bigStat}>
        De {formatInt(radar.jobPosts)} empleos, {formatInt(radar.eligible)} ({formatPercent(share)})
        aceptan a alguien en Venezuela. En Hacker News, {hn.eligible} de {hn.jobPosts}. Solo{" "}
        {radar.eligibleJunior} son para juniors.
      </p>

      <figure className={styles.figure}>
        <figcaption className={styles.chartTitle}>
          Empleos que aceptan a alguien en Venezuela, por fuente
        </figcaption>
        <ul className={styles.hbars}>
          {radar.sources.map((s) => (
            <li key={s.id}>
              <span className={styles.hbarLabel}>
                <a href={s.url}>{s.name}</a>
              </span>
              <span className={styles.hbarTrack} aria-hidden="true">
                <span style={{ width: `${(s.eligible / s.jobPosts) * 100}%` }} />
              </span>
              <span className={`${styles.hbarValue} num`}>
                {formatPercent(s.eligible / s.jobPosts)}
              </span>
              <span className={`${styles.hbarMeta} num`}>
                {s.eligible} de {s.jobPosts} empleos
              </span>
            </li>
          ))}
        </ul>
        <p className={styles.caption}>
          Datos del {new Date(radar.at).toLocaleDateString("es-VE", { dateStyle: "long" })}.{" "}
          {formatInt(radar.lowConfidence)} empleos tienen poca confianza en la ubicación (menos de
          0,6) y deberían marcarse para confirmar. Todos los empleos de We Work Remotely en su
          categoría de programación estaban marcados «Anywhere in the World».
        </p>
      </figure>

      <p className={`${styles.label} ${styles.spaced}`}>
        Algunos empleos de Hacker News que sí aceptan a Venezuela
      </p>
      <ul className={styles.sourceList}>
        {radar.examples.map((e) => (
          <li key={e.url}>
            <a href={e.url}>{e.title}</a>
            <span className="num">
              {e.where === "anywhere" ? "desde cualquier país" : "desde las Américas"}, confianza{" "}
              {formatPercent(e.confidence)}
            </span>
          </li>
        ))}
      </ul>

      <h3 className={styles.h3}>Lo que aprendimos usando Jev</h3>
      <ul className={styles.lessons}>
        <li>
          <strong>Lo que ya está en un campo, lo decide el código.</strong> Get on Board trae la
          modalidad remota como dato. Jev acertó casi siempre, pero en 14 casos no coincidió con el
          campo, que es la fuente exacta. Jev es para el texto libre.
        </li>
        <li>
          <strong>Nada de jerga de plataforma.</strong> Mandamos el código «remote_local» tal cual y
          Jev lo leyó como «remoto desde cualquier lado». Explicado en una frase, lo entendió.
        </li>
        <li>
          <strong>Una probabilidad a mitad de camino significa «no se sabe».</strong> ¿Acepta
          contratistas? Casi todas las respuestas cayeron entre 0,5 y 0,8 porque casi ningún empleo
          lo dice. No se usa como filtro.
        </li>
        <li>
          <strong>La confianza baja marca los casos dudosos.</strong> «Todo remoto, pero algunos
          solo en EE. UU.» recibió 0,46. Eso se muestra como «confirmar», no se esconde.
        </li>
        <li>
          <strong>Seleccionar en vez de generar.</strong> Para citar evidencia, Jev elige entre
          fragmentos que ya existen en la oferta. No puede inventar una cita.
        </li>
        <li>
          <strong>Si una elección se reparte, las opciones están mal definidas.</strong> «Prueba
          técnica gratis» quedaba entre «gratis» y «explotación» con 0,21 de confianza. Con las
          opciones mejor escritas, subió a 0,96.
        </li>
        <li>
          <strong>Preguntar de más en el mismo request sale casi gratis.</strong> Pedimos evidencia
          para las nueve banderas aunque solo usemos las activadas: van en paralelo y la latencia
          casi no cambia.
        </li>
      </ul>
    </>
  );
}
