import { QUESTIONS, RED_FLAG_QUESTIONS, type RedFlagId } from "@/lib/chimba/questions";
import { ABSURDITY_SHARE, FLAG_FLOOR, RED_FLAGS } from "@/lib/chimba/score";
import { formatDecimal } from "@/lib/format";
import styles from "./Sections.module.css";

const TOTAL = Object.keys(QUESTIONS).length;
const FLAGS = Object.keys(RED_FLAG_QUESTIONS).length;
const example = JSON.stringify({ unicornio: RED_FLAG_QUESTIONS.unicornio }, null, 2);
const share = Math.round(ABSURDITY_SHARE * 100);

export function HowItWorks() {
  return (
    <section id="como-funciona" className={styles.section} aria-labelledby="como-funciona-titulo">
      <h2 id="como-funciona-titulo" className={styles.h2}>
        Así piensa Jev
      </h2>
      <p className={styles.intro}>
        Jev es un modelo de TypeSafe que no escribe texto: responde preguntas con probabilidades.
        Eso lo hace rápido, barato y fácil de revisar. Esto es exactamente lo que pasa cuando mides
        una oferta.
      </p>

      <ol className={styles.steps}>
        <li>
          <h3>Tu oferta llega a nuestro servidor</h3>
          <p>
            La API key de TypeSafe vive ahí; tu navegador nunca la ve. No guardamos el texto de la
            oferta, solo registramos tokens, costo y tiempo de cada consulta.
          </p>
        </li>
        <li>
          <h3>Un solo request con {TOTAL} preguntas</h3>
          <p>
            {FLAGS} de sí o no, una escala de 0 a 3 y una elección entre seis veredictos. Jev las
            responde en paralelo y ninguna ve la respuesta de las otras. Cada pregunta se escribe
            así:
          </p>
          <pre className={styles.code} tabIndex={0}>
            {example}
          </pre>
        </li>
        <li>
          <h3>Jev devuelve números, no párrafos</h3>
          <p>
            Cada respuesta llega con su tipo: una probabilidad, un punto en la escala o una opción
            con su distribución. No hay texto que interpretar, así que el código puede usarlas
            directo.
          </p>
        </li>
        <li>
          <h3>El código decide el puntaje</h3>
          <p>
            La fórmula no es IA: es código que puedes leer. La mitad viene de qué tan injusta ve Jev
            la oferta en general; la otra mitad, de las banderas rojas, cada una con su peso. Las
            probabilidades menores a {formatDecimal(FLAG_FLOOR)} casi no cuentan, para que el ruido
            de muchas banderas no sume un veredicto.
          </p>
          <div className={styles.formula}>
            puntaje = {share} × absurdo / 3 + {100 - share} × [1 − (1 − peso₁ × p₁) × (1 − peso₂ ×
            p₂) × …]
          </div>
          <table className={styles.weights}>
            <caption>Peso de cada bandera en la fórmula</caption>
            <tbody>
              {(Object.keys(RED_FLAGS) as RedFlagId[]).map((id) => (
                <tr key={id}>
                  <th scope="row">{RED_FLAGS[id].label}</th>
                  <td className="num">{formatDecimal(RED_FLAGS[id].weight)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </li>
      </ol>
    </section>
  );
}
