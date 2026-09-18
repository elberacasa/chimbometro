import type { Receipt as ReceiptData } from "@/lib/chimba/analyze";
import { requestsPerDollar, USD_PER_MILLION_INPUT_TOKENS } from "@/lib/jev/pricing";
import type { ChoiceAnswer, NoulAnswer, ScoreAnswer } from "@/lib/jev/types";
import {
  formatDateTime,
  formatDecimal,
  formatInt,
  formatMs,
  formatPercent,
  formatUsd,
} from "@/lib/format";
import styles from "./Receipt.module.css";

type Answer = NoulAnswer | ChoiceAnswer | ScoreAnswer;

const KIND: Record<Answer["type"], string> = { noul: "sí/no", score: "escala", choice: "elección" };

function formatAnswer(a: Answer): string {
  if (a.type === "noul") return formatDecimal(a.noul);
  if (a.type === "score") return `${formatDecimal(a.score)} / 3`;
  return `${a.choice} ${formatPercent(a.probabilities[a.choice] ?? a.confidence)}`;
}

export function Receipt({ data, at }: { data: ReceiptData | null; at: string | null }) {
  return (
    <div className={styles.printer}>
      <div className={styles.slot} aria-hidden="true" />
      {data && at ? <Paper key={at} data={data} at={at} /> : <EmptyPaper />}
    </div>
  );
}

function EmptyPaper() {
  return (
    <div className={`${styles.paper} ${styles.empty}`}>
      <p>
        Aquí se imprime el recibo de cada consulta: cada pregunta que le hicimos a Jev, lo que
        respondió, los tokens, lo que costó y cuánto tardó.
      </p>
    </div>
  );
}

function Paper({ data, at }: { data: ReceiptData; at: string }) {
  const answers = Object.entries(data.response.answers) as Array<[string, Answer]>;
  return (
    <article className={styles.paper} aria-label="Recibo de la consulta a Jev">
      <header className={styles.head}>
        <p className={styles.brand}>Jev System One</p>
        <p>{data.model}</p>
        <p>{formatDateTime(at)}</p>
      </header>

      <hr className={styles.cut} />

      <table className={styles.lines}>
        <caption className="visually-hidden">Respuestas de Jev a cada pregunta</caption>
        <thead>
          <tr>
            <th scope="col">Pregunta</th>
            <th scope="col">Tipo</th>
            <th scope="col">Respuesta</th>
          </tr>
        </thead>
        <tbody>
          {answers.map(([id, a]) => (
            <tr key={id}>
              <th scope="row">{id}</th>
              <td>{KIND[a.type]}</td>
              <td className="num">{formatAnswer(a)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <hr className={styles.cut} />

      <dl className={styles.totals}>
        <div>
          <dt>Preguntas en paralelo</dt>
          <dd className="num">{data.questionCount}</dd>
        </div>
        <div>
          <dt>Tokens de entrada</dt>
          <dd className="num">{formatInt(data.usage.input_tokens)}</dd>
        </div>
        <div>
          <dt>Tokens de salida (gratis)</dt>
          <dd className="num">{formatInt(data.usage.output_tokens)}</dd>
        </div>
        <div>
          <dt>Precio por millón de entrada</dt>
          <dd className="num">{formatUsd(USD_PER_MILLION_INPUT_TOKENS)}</dd>
        </div>
        <div className={styles.total}>
          <dt>Total</dt>
          <dd className="num">{formatUsd(data.costUsd)}</dd>
        </div>
      </dl>

      <hr className={styles.cut} />

      <dl className={styles.totals}>
        <div>
          <dt>Jev respondió en</dt>
          <dd className="num">{formatMs(data.jevMs)}</dd>
        </div>
        <div>
          <dt>Total en el servidor</dt>
          <dd className="num">{formatMs(data.totalMs)}</dd>
        </div>
        {data.attempts > 1 && (
          <div>
            <dt>Intentos</dt>
            <dd className="num">{data.attempts}</dd>
          </div>
        )}
      </dl>

      <p className={styles.footnote}>
        Con $1 alcanza para {formatInt(requestsPerDollar(data.usage))} ofertas como esta.
      </p>

      <details className={styles.json}>
        <summary>JSON enviado a Jev</summary>
        <pre tabIndex={0}>{JSON.stringify(data.request, null, 2)}</pre>
      </details>
      <details className={styles.json}>
        <summary>JSON que devolvió Jev</summary>
        <pre tabIndex={0}>{JSON.stringify(data.response, null, 2)}</pre>
      </details>
    </article>
  );
}
