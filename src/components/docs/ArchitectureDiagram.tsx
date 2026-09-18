import styles from "./Docs.module.css";

/**
 * What happens to one offer, drawn as the real system: the browser, the Vercel function and its
 * five steps, and the two services it calls. Particles move along the request path; the return
 * path is the NDJSON stream.
 */

const FN = { x: 250, y: 24, w: 330, h: 312 };
const steps = (questions: number) => [
  "Origen y tamaño",
  "Límites y presupuesto",
  `${questions} preguntas a Jev`,
  "Fórmula (código)",
  "Stream de eventos",
];
const STEP_Y = (i: number) => FN.y + 62 + i * 52;

export function ArchitectureDiagram({ questions, jevMs }: { questions: number; jevMs: number }) {
  return (
    <figure className={styles.figure}>
      <div className={styles.scroll}>
        <svg viewBox="0 0 880 360" className={styles.diagram} role="img" aria-labelledby="arq-desc">
          <desc id="arq-desc">
            El navegador envía la oferta a una función de Vercel. La función verifica origen y
            tamaño, consulta los límites en Upstash Redis, envía {questions} preguntas a Jev en un
            solo request, calcula el puntaje con código y devuelve el resultado como un stream de
            eventos.
          </desc>

          {/* Browser */}
          <g>
            <rect x={20} y={130} width={150} height={100} rx={12} className={styles.box} />
            <text x={95} y={172} className={styles.boxTitle}>
              Tu navegador
            </text>
            <text x={95} y={194} className={styles.boxSub}>
              chimbometro.vercel.app
            </text>
          </g>

          {/* Function */}
          <rect x={FN.x} y={FN.y} width={FN.w} height={FN.h} rx={14} className={styles.fn} />
          <text x={FN.x + 20} y={FN.y + 30} className={styles.fnTitle}>
            POST /api/chimba
          </text>
          <text x={FN.x + FN.w - 20} y={FN.y + 30} className={styles.fnMeta}>
            función de Vercel, iad1
          </text>
          {steps(questions).map((label, i) => (
            <g key={label}>
              <rect
                x={FN.x + 20}
                y={STEP_Y(i) - 18}
                width={FN.w - 40}
                height={36}
                rx={8}
                className={styles.step}
              />
              <text x={FN.x + 38} y={STEP_Y(i) + 5} className={styles.stepNum}>
                {i + 1}
              </text>
              <text x={FN.x + 62} y={STEP_Y(i) + 5} className={styles.stepLabel}>
                {label}
              </text>
            </g>
          ))}

          {/* External services */}
          <g>
            <rect x={680} y={96} width={180} height={64} rx={12} className={styles.box} />
            <text x={770} y={124} className={styles.boxTitle}>
              Upstash Redis
            </text>
            <text x={770} y={144} className={styles.boxSub}>
              contadores con expiración
            </text>
          </g>
          <g>
            <rect
              x={680}
              y={170}
              width={180}
              height={64}
              rx={12}
              className={`${styles.box} ${styles.jevBox}`}
            />
            <text x={770} y={198} className={styles.boxTitle}>
              Jev
            </text>
            <text x={770} y={218} className={styles.boxSub}>
              api.typesafe.ai
            </text>
          </g>

          {/* Request path */}
          <path
            d={`M 170 162 C 210 162 210 ${STEP_Y(0)} ${FN.x + 20} ${STEP_Y(0)}`}
            className={styles.flowIn}
          />
          <path
            d={`M ${FN.x + FN.w - 20} ${STEP_Y(1)} C 630 ${STEP_Y(1)} 630 128 680 128`}
            className={styles.flowIn}
          />
          <path
            d={`M ${FN.x + FN.w - 20} ${STEP_Y(2)} C 630 ${STEP_Y(2)} 630 202 680 202`}
            className={`${styles.flowIn} ${styles.flowJev}`}
          />
          {/* Stream back */}
          <path
            d={`M ${FN.x + 20} ${STEP_Y(4)} C 210 ${STEP_Y(4)} 210 198 170 198`}
            className={styles.flowOut}
          />

          <text x={178} y={150} className={styles.edgeLabel}>
            oferta
          </text>
          <text x={630} y={116} className={`${styles.edgeLabel} ${styles.edgeMid}`}>
            INCRBY, GET
          </text>
          <text x={770} y={254} className={`${styles.edgeLabel} ${styles.edgeMid}`}>
            1 request, ~{jevMs} ms
          </text>
          <text x={95} y={252} className={`${styles.edgeLabel} ${styles.edgeMid}`}>
            5 eventos NDJSON
          </text>
        </svg>
      </div>
      <figcaption className={styles.caption}>
        Todo pasa en una sola función. Jev recibe un único request con las {questions} preguntas; la
        fórmula corre en la función y no llama a ningún modelo.
      </figcaption>
    </figure>
  );
}
