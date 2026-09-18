import { formatDateTime, formatInt, formatUsd } from "@/lib/format";
import { groupLedger, ledgerTotals, readLedger } from "@/lib/ledger";
import styles from "./Sections.module.css";

/** Every Jev call made while building the project, read from ledger/jev-usage.jsonl at build time. */
export async function BuildCost() {
  const entries = groupLedger(await readLedger());
  const totals = ledgerTotals(entries);
  const reconstructed = entries.some((e) => !e.exact);

  return (
    <section id="costos" className={styles.section} aria-labelledby="costos-titulo">
      <h2 id="costos-titulo" className={styles.h2}>
        Lo que costó construir esto
      </h2>
      <p className={styles.statement}>
        {formatUsd(totals.costUsd)} en Jev, en {formatInt(totals.calls)} consultas y{" "}
        {formatInt(totals.inputTokens)} tokens.
      </p>
      <p className={styles.intro}>
        Cada llamada a Jev durante el desarrollo quedó registrada: la investigación del sub, las
        pruebas de las preguntas y cada evaluación. El registro está en el repositorio y esta tabla
        se genera a partir de él.
      </p>

      <div className={styles.tableWrap}>
        <table className={styles.ledger}>
          <thead>
            <tr>
              <th scope="col">Fecha</th>
              <th scope="col">Para qué</th>
              <th scope="col">Consultas</th>
              <th scope="col">Tokens</th>
              <th scope="col">Costo</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.at + e.script}>
                <td className="num">{formatDateTime(e.at)}</td>
                <td>
                  {e.purpose}
                  {!e.exact && <span aria-label="reconstruido"> *</span>}
                </td>
                <td className="num">{formatInt(e.calls)}</td>
                <td className="num">{formatInt(e.input_tokens)}</td>
                <td className="num">{formatUsd(e.cost_usd)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" colSpan={2}>
                Total
              </th>
              <td className="num">{formatInt(totals.calls)}</td>
              <td className="num">{formatInt(totals.inputTokens)}</td>
              <td className="num">{formatUsd(totals.costUsd)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {reconstructed && (
        <p className={styles.footnote}>
          * Incluye consultas reconstruidas o estimadas porque no guardamos sus tokens exactos. Los
          tokens de salida no se cobran.
        </p>
      )}
    </section>
  );
}
