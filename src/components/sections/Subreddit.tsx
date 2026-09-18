import data from "@/content/subreddit.json";
import { costUsd } from "@/lib/jev/pricing";
import { formatDecimal, formatInt, formatUsd } from "@/lib/format";
import styles from "./Sections.module.css";

const MAX_PAIN = 3;
/** The topic the Chimbómetro exists for is drawn in red; everything else in ink. */
const FOCUS_TOPIC = "job_search";

export function Subreddit() {
  const cost = costUsd({ input_tokens: data.inputTokens, output_tokens: 0 });
  return (
    <section id="el-sub" className={styles.section} aria-labelledby="el-sub-titulo">
      <h2 id="el-sub-titulo" className={`${styles.h2} ${styles.claim}`}>
        {data.absurdOffersInTop6} de los 6 posts más votados en la historia de r/dev_venezuela son
        capturas de ofertas absurdas.
      </h2>
      <p className={styles.intro}>
        Antes de escribir código le pasamos a Jev {formatInt(data.posts)} posts del sub, de{" "}
        {formatMonth(data.from)} a {formatMonth(data.to)}, con {data.questionsPerPost} preguntas
        cada uno: de qué trata, qué busca quien lo escribe y cuánto le cuesta el problema. Todo el
        análisis costó {formatUsd(cost)}. Buscar trabajo es lo que más duele.
      </p>

      <figure className={styles.figure}>
        <figcaption>
          Dolor promedio por tema, de 0 (ningún problema) a 3 (bloquea ingresos, un trabajo o una
          decisión grande)
        </figcaption>
        <ul className={styles.bars} aria-hidden="true">
          {data.painByTopic.map((t) => (
            <li key={t.id} className={t.id === FOCUS_TOPIC ? styles.focus : undefined}>
              <span className={styles.barLabel}>{t.label}</span>
              <span className={styles.barTrack}>
                <span style={{ width: `${(t.pain / MAX_PAIN) * 100}%` }} />
              </span>
              <span className={`${styles.barValue} num`}>{formatDecimal(t.pain)}</span>
            </li>
          ))}
        </ul>
        <details className={styles.tableToggle}>
          <summary>Ver como tabla</summary>
          <table>
            <thead>
              <tr>
                <th scope="col">Tema</th>
                <th scope="col">Posts</th>
                <th scope="col">Dolor promedio</th>
              </tr>
            </thead>
            <tbody>
              {data.painByTopic.map((t) => (
                <tr key={t.id}>
                  <th scope="row">{t.label}</th>
                  <td className="num">{t.posts}</td>
                  <td className="num">{formatDecimal(t.pain)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </figure>
    </section>
  );
}

function formatMonth(isoDate: string) {
  return new Intl.DateTimeFormat("es-VE", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(isoDate));
}
