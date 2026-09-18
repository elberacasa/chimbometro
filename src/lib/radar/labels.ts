import type { RadarJob, Role, Seniority, SourceId, Where } from "./types";

export const WHERE_LABEL: Record<Where, string> = {
  anywhere: "Desde cualquier país",
  americas_or_latam: "Desde las Américas",
  specific_countries: "Solo ciertos países",
  us_or_canada: "Solo EE. UU. o Canadá",
  europe: "Solo Europa",
  onsite_or_hybrid: "Presencial o híbrido",
  unclear: "No dice desde dónde",
};

export const SENIORITY_LABEL: Record<Seniority, string> = {
  junior: "Junior",
  mid: "Semi senior",
  senior: "Senior",
  lead_or_staff: "Lead o staff",
  unclear: "Sin nivel",
};

export const ROLE_LABEL: Record<Role, string> = {
  frontend: "Frontend",
  backend: "Backend",
  fullstack: "Full stack",
  mobile: "Móvil",
  data_ml: "Datos e IA",
  devops: "DevOps e infra",
  qa: "QA",
  design: "Diseño",
  product: "Producto",
  other: "Otros",
};

export const SOURCE_LABEL: Record<SourceId, string> = {
  hn: "Hacker News",
  getonbrd: "Get on Board",
  himalayas: "Himalayas",
  jobicy: "Jobicy",
  wwr: "We Work Remotely",
  workingnomads: "Working Nomads",
  remoteok: "Remote OK",
  remotive: "Remotive",
};

/**
 * What a source's own field says about where the job can be done, for jobs it decided. Uses the
 * field itself so "LATAM" is not presented as "any country".
 */
export function sourceWhere(job: Pick<RadarJob, "source" | "eligible" | "location">): {
  tag: string;
  claim: string;
} {
  if (!job.eligible) {
    return {
      tag: "Solo residentes de otros países o presencial",
      claim: "solo residentes de otros países, o presencial",
    };
  }
  const places = job.location
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (
    job.source === "getonbrd" ||
    places.length === 0 ||
    /^(worldwide|anywhere.*|remote)$/i.test(job.location.trim())
  ) {
    return { tag: WHERE_LABEL.anywhere, claim: "remoto desde cualquier país" };
  }
  if (places.length > 3) {
    return {
      tag: "Ciertos países, incluida Venezuela",
      claim: `${places.length} países, incluida Venezuela`,
    };
  }
  return { tag: WHERE_LABEL.americas_or_latam, claim: job.location.trim() };
}

/** English required, from Jev's 0–3 score, in the words a candidate would use. */
export function englishLabel(score: number) {
  if (score < 0.75) return "Sin inglés";
  if (score < 1.5) return "Inglés básico";
  if (score < 2.5) return "Inglés profesional";
  return "Inglés nativo";
}

/** Below this, Jev's reading of where the job can be done is shown as "por confirmar". */
export const CONFIRM_BELOW = 0.6;

export function needsConfirmation(job: Pick<RadarJob, "decidedBy" | "whereConfidence">) {
  return job.decidedBy === "jev" && job.whereConfidence < CONFIRM_BELOW;
}

const relative = new Intl.RelativeTimeFormat("es-VE", { numeric: "auto" });

/** "hace 12 minutos", "ayer", "hace 3 días". */
export function timeAgo(iso: string, now = Date.now()) {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return relative.format(seconds, "second");
  if (abs < 3600) return relative.format(Math.round(seconds / 60), "minute");
  if (abs < 86_400) return relative.format(Math.round(seconds / 3600), "hour");
  return relative.format(Math.round(seconds / 86_400), "day");
}
