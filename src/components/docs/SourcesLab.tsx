import iterations from "@/content/radar-iterations.json";
import lab from "@/content/sources-lab.json";
import { countWord, formatInt, formatPercent, formatUsd } from "@/lib/format";
import { LIVE_SOURCES } from "@/lib/radar/live";
import { RADAR_CASES } from "@/lib/radar/eval-cases";
import type { SourceId } from "@/lib/radar/types";
import styles from "./Docs.module.css";

/** What a case must come out as, in the words the radar uses. */
function expected(e: (typeof RADAR_CASES)[number]["expect"]) {
  if (!e.techRole) return "Debe quedar fuera: no es de tecnología";
  const parts = [e.eligible ? "acepta Venezuela" : "no acepta Venezuela"];
  if (e.juniorFriendly === true) parts.push("acepta juniors");
  if (e.juniorFriendly === false) parts.push("no es para juniors");
  return `Debe salir: ${parts.join(", ")}`;
}

/**
 * How the radar's sources were chosen (a Jev experiment over eight boards) and how its questions
 * improved: every version, the real listing that exposed the problem, and the eval case it became.
 */
export function SourcesLab() {
  const sources = [...lab.sources].sort(
    (a, b) => (a.costPerEligible ?? Infinity) - (b.costPerEligible ?? Infinity),
  );
  const disagreements = lab.sources.reduce((n, s) => n + s.disagreements.length, 0);
  const best = sources[0]!;

  return (
    <>
      <p>
        Al principio el radar leía cuatro bolsas porque eran las que conocíamos. Para elegir mejor,
        le pedimos a Jev que leyera las {formatInt(lab.sample)} ofertas más recientes de{" "}
        {countWord(lab.sources.length)} bolsas públicas con API y medimos lo único que importa a
        quien busca trabajo desde Venezuela: cuántos empleos de tecnología lo aceptan y cuánto
        cuesta encontrar cada uno. El experimento completo leyó {formatInt(lab.judged)} ofertas por{" "}
        {formatUsd(lab.costUsd)}.
      </p>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <caption className={styles.chartTitle}>
            Ofertas leídas por Jev en cada bolsa, ordenadas por costo por empleo útil
          </caption>
          <thead>
            <tr>
              <th scope="col">Bolsa</th>
              <th scope="col">Leídas</th>
              <th scope="col">De tecnología</th>
              <th scope="col">Aceptan Venezuela</th>
              <th scope="col">Costo por empleo útil</th>
              <th scope="col">Decisión</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((s) => {
              const live = LIVE_SOURCES.includes(s.id as SourceId);
              return (
                <tr key={s.id}>
                  <td>
                    <a href={s.homepage}>{s.name}</a>
                  </td>
                  <td className="num">{formatInt(s.sampled)}</td>
                  <td className="num">{formatInt(s.tech)}</td>
                  <td className="num">
                    {formatInt(s.eligible)} ({formatPercent(s.tech ? s.eligible / s.tech : 0)})
                  </td>
                  <td className="num">
                    {s.costPerEligible ? formatUsd(s.costPerEligible) : "sin empleos útiles"}
                  </td>
                  <td>{live ? "Se usa" : "Se descartó"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className={styles.caption}>
        Un empleo útil es de tecnología y acepta a alguien que vive en Venezuela. Datos del{" "}
        {new Date(lab.at).toLocaleDateString("es-VE", { dateStyle: "long" })}, preguntas versión{" "}
        {lab.questionsVersion}, modelo {lab.model}. Los resultados están en{" "}
        <code>src/content/sources-lab.json</code> y el experimento se repite con{" "}
        <code>npm run jev:sources</code>.
      </p>

      <ul className={styles.lessons}>
        <li>
          <strong>
            {best.name} fue la mejor: {formatInt(best.eligible)} de {formatInt(best.tech)} empleos
            de tecnología aceptan Venezuela.
          </strong>{" "}
          Su API filtra por país del lado de ellos, así que casi todo lo que devuelve sirve. Por eso
          es la bolsa de la que leemos más páginas.
        </li>
        <li>
          <strong>Descartamos tres bolsas con datos, no por intuición.</strong> Working Nomads,
          Remote OK y Remotive dieron 9 empleos útiles entre las tres. Encontrar cada uno costaba
          entre 5 y 13 veces más que en Himalayas, y la mitad de lo que traía Remotive ya estaba en
          otras bolsas.
        </li>
        <li>
          <strong>Respetamos las reglas de cada API.</strong> Ninguna bolsa se consulta más de una
          vez por hora aunque muchos visitantes actualicen el radar; Remotive pide como mucho cuatro
          veces al día. Si una bolsa se consultó hace poco, el radar reusa sus ofertas.
        </li>
      </ul>

      <h3 className={styles.h3}>Cuando la fuente y Jev no coinciden</h3>
      <p>
        Si una bolsa dice en un campo desde dónde se puede trabajar, decide el código. Pero en el
        experimento también le pedimos a Jev que leyera el texto por su cuenta y guardamos cada
        desacuerdo: {formatInt(disagreements)} en total. Los revisamos uno por uno. A veces se
        equivocaba la bolsa: «Anywhere in the World» en el campo y «any location in the United
        States» o «within one hour of CET» en el texto. Por eso la pregunta de exclusión de Jev
        siempre se aplica, aunque el campo diga que el empleo es para todo el mundo. Otras veces se
        equivocaba Jev, y eso cambió las preguntas.
      </p>

      <h3 className={styles.h3}>Cómo mejora Jev sobre la marcha</h3>
      <p>
        Cada error real sigue el mismo camino: lo encontramos (un usuario, una auditoría o una
        comparación), lo convertimos en un caso de prueba, cambiamos la pregunta y corremos todos
        los casos contra el modelo real con <code>npm run jev:eval-radar</code>. Cambiar la versión
        de las preguntas hace que el radar vuelva a leer todas las ofertas con la versión nueva.
      </p>
      <ol className={styles.story}>
        {iterations.versions.map((v) => (
          <li key={v.version}>
            <h3>
              Versión {v.version}. {v.title}
            </h3>
            <p>{v.found}</p>
            {v.problems.length > 0 && (
              <ul className={styles.sourceList}>
                {v.problems.map((p) => (
                  <li key={p.context}>
                    <span>
                      {p.context}
                      {p.quote && (
                        <>
                          : <q>{p.quote}</q>
                        </>
                      )}
                    </span>
                    <span>
                      Antes, {p.was}. Ahora, {p.now}.
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p>
              {v.change}
              {v.cases > 0 && ` Casos de prueba: ${v.cases}, todos correctos.`}
            </p>
          </li>
        ))}
      </ol>

      <details className={styles.tableToggle}>
        <summary>Los {RADAR_CASES.length} casos de prueba del radar</summary>
        <ul className={styles.sourceList}>
          {RADAR_CASES.map((c) => (
            <li key={c.id}>
              <span>{c.listing.title}</span>
              <span>{expected(c.expect)}</span>
            </li>
          ))}
        </ul>
      </details>
    </>
  );
}
