/**
 * Invented offers modeled on what r/dev_venezuela keeps posting. Used as one-click demos in the
 * UI and as the eval set for `npm run jev:eval`.
 */
import type { VerdictId } from "./questions";

/** `accepted` lists every verdict a reasonable reviewer could give the offer. */
export type Example = { id: string; label: string; accepted: VerdictId[]; text: string };

export const EXAMPLES: Example[] = [
  {
    id: "unicornio",
    label: "El junior que sabe todo",
    accepted: ["departamento_it"],
    text:
      "Se busca Desarrollador Junior (1 año de experiencia). Requisitos: dominio de React, Angular y Vue, " +
      "Node.js, Python y PHP (Laravel). Bases de datos: PostgreSQL, MySQL, SQL Server, Oracle y MongoDB. " +
      "Experiencia en AWS, Docker, Kubernetes, CI/CD. Conocimientos de IA y machine learning. Inglés " +
      "avanzado. Sueldo: 250$ mensuales. Presencial en Caracas, lunes a sábado.",
  },
  {
    id: "pyme",
    label: "Programador y community manager",
    accepted: ["explotacion", "departamento_it"],
    text:
      "Empresa en crecimiento busca programador web que también se encargue de las redes sociales, " +
      "diseño de flyers en Canva, soporte técnico a las computadoras de la oficina y atención al cliente " +
      "por WhatsApp. Somos una familia y buscamos a alguien que se ponga la camiseta. Pago en bolívares a " +
      "tasa BCV, equivalente a 150$. Disponibilidad inmediata y fines de semana cuando haga falta.",
  },
  {
    id: "gratis",
    label: "La prueba técnica que es el producto",
    accepted: ["gratis"],
    text:
      "Startup busca fullstack developer. Como parte del proceso debes desarrollar un MVP completo de " +
      "nuestra app de delivery (frontend, backend y panel admin) en 2 semanas. Si nos gusta, te " +
      "incorporamos. El pago inicial es en equity y cuando levantemos ronda hablamos de sueldo.",
  },
  {
    id: "estafa",
    label: "Gana 3000$ semanales",
    accepted: ["estafa"],
    text:
      "¡Gana 3000$ semanales desde tu casa! Buscamos programadores para proyecto cripto internacional. " +
      "Solo necesitas depositar 50 USDT de registro para acceder a la plataforma y enviarnos foto de tu " +
      "cédula y datos de tu cuenta de Binance. Cupos limitados.",
  },
  {
    id: "decente",
    label: "Una oferta decente",
    accepted: ["decente"],
    text:
      "Backend Developer Mid (Node.js + PostgreSQL). 100% remoto desde LATAM, contrato como contractor. " +
      "Salario: 2.200 a 2.800 USD mensuales pagados por Deel. 3+ años de experiencia. Horario flexible con " +
      "4 horas de solapamiento con EST. 20 días de vacaciones pagadas, presupuesto para equipo. Proceso: " +
      "una entrevista técnica de 1 hora y una conversación con el equipo.",
  },
];
