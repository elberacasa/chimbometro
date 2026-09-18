/** A job listing as fetched and normalized from one public source, before any judgment. */
export type Listing = {
  id: string;
  source: SourceId;
  title: string;
  company: string;
  /** Location as the source states it, if it has a field for it. */
  location: string;
  text: string;
  url: string;
  postedAt: string | null;
  /** Monthly USD range when the source has structured salary fields. */
  salary: { min: number; max: number } | null;
  /**
   * Where the person can work from, when the source says so in a structured field. Decided in
   * code; Jev only judges listings without it.
   */
  structuredWhere: "anywhere" | "country_only" | "onsite" | null;
};

export type SourceId = "hn" | "getonbrd" | "wwr" | "remotive";

export type SourceReport = {
  id: SourceId;
  name: string;
  homepage: string;
  /** The exact URL(s) our server requested. */
  requested: string[];
  status: "ok" | "failed";
  listings: number;
  ms: number;
  error?: string;
};

export type Where =
  | "anywhere"
  | "americas_or_latam"
  | "specific_countries"
  | "us_or_canada"
  | "europe"
  | "onsite_or_hybrid"
  | "unclear";

export type Seniority = "junior" | "mid" | "senior" | "lead_or_staff" | "unclear";
export type Role =
  | "frontend"
  | "backend"
  | "fullstack"
  | "mobile"
  | "data_ml"
  | "devops"
  | "qa"
  | "design"
  | "product"
  | "other";

/** A listing after judgment: what the radar stores and shows. Full text is not kept. */
export type RadarJob = {
  id: string;
  source: SourceId;
  title: string;
  company: string;
  location: string;
  url: string;
  postedAt: string | null;
  excerpt: string;
  salary: { min: number; max: number } | null;
  isJob: boolean;
  /** Software, data, infra, QA, security, design or technical product. The radar only shows these. */
  techRole: boolean;
  eligible: boolean;
  /** How the eligibility was decided: a structured source field, or Jev reading the text. */
  decidedBy: "source" | "jev";
  where: Where;
  whereConfidence: number;
  excludesVenezuela: number;
  usd: number;
  seniority: Seniority;
  role: Role;
  /** 0 (none) to 3 (native). */
  english: number;
  /** The sentence Jev chose as proof of where the person can work from. */
  quote: string | null;
  judgedAt: string;
  inputTokens: number;
  /** RADAR_QUESTIONS_VERSION the listing was judged with. */
  version: number;
};

export type RadarSnapshot = {
  updatedAt: string;
  sources: SourceReport[];
  jobs: RadarJob[];
  run: RunSummary;
};

export type RunSummary = {
  startedAt: string;
  ms: number;
  fetched: number;
  reused: number;
  judged: number;
  inputTokens: number;
  costUsd: number;
  /** The model version that answered, or null when nothing new needed judging. */
  model: string | null;
  trigger: "cron" | "visitor" | "script";
};
