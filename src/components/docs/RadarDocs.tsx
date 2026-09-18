import { RADAR_QUESTIONS } from "@/lib/radar/questions";
import { CONFIRM_BELOW } from "@/lib/radar/labels";
import { countWord, formatDecimal } from "@/lib/format";
import { LIVE_SOURCES } from "@/lib/radar/live";
import styles from "./Docs.module.css";

const TYPE_LABEL = { noul: "sí/no", score: "escala", choice: "elección" } as const;
const questions = Object.entries(RADAR_QUESTIONS);

/** How the job radar decides, from the same constants and questions the code uses. */
export function RadarDocs() {
  return (
    <>
      <p>
        Una vez al día, y cuando un visitante lo pide (como mucho cada 15 minutos), el servidor
        descarga las ofertas de {countWord(LIVE_SOURCES.length)} bolsas públicas. Las que ya fueron
        evaluadas se reusan; solo las nuevas van a Jev, una por request, ocho a la vez. Cada request
        lleva {questions.length} preguntas más una de evidencia: cuál fragmento de la oferta dice
        desde dónde se puede trabajar.
      </p>
      <ol className={styles.guards}>
        <li>
          <strong>Solo empleos de tecnología.</strong> Las bolsas mezclan ventas, soporte y
          administración con desarrollo. Jev decide si al menos uno de los roles es de software,
          datos, infraestructura, QA, seguridad, diseño o producto técnico; los demás no se
          muestran.
        </li>
        <li>
          <strong>Si la fuente lo dice en un campo, decide el código.</strong> Get on Board trae la
          modalidad remota como dato; We Work Remotely y Remotive marcan «Anywhere in the World» y
          «Worldwide». Ahí Jev no opina sobre la ubicación.
        </li>
        <li>
          <strong>Si no, decide Jev leyendo el texto.</strong> Acepta Venezuela si el empleo es
          remoto desde cualquier país o desde las Américas y Jev no ve una exclusión explícita (por
          ejemplo, «debes vivir en EE. UU.» o una lista de países sin Venezuela).
        </li>
        <li>
          <strong>La duda se muestra.</strong> Si la confianza de Jev sobre la ubicación es menor a{" "}
          {formatDecimal(CONFIRM_BELOW)}, el empleo sale marcado «Por confirmar».
        </li>
        <li>
          <strong>La cita no se inventa.</strong> Jev elige entre fragmentos que existen en la
          oferta. En casos límite puede elegir una frase que no es la más clara, aunque el juicio
          sea correcto: el título de la oferta siempre está a la vista para contrastar.
        </li>
      </ol>
      <div className={styles.catalog}>
        {questions.map(([id, q]) => (
          <details key={id} className={styles.question}>
            <summary>
              <code>{id}</code>
              <span className={styles.qtype}>{TYPE_LABEL[q.type]}</span>
            </summary>
            <pre tabIndex={0}>{JSON.stringify(q, null, 2)}</pre>
          </details>
        ))}
      </div>
    </>
  );
}
