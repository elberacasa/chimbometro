import { LIVE_SOURCES } from "./live";
import type { Listing, Seniority, SourceId, SourceReport } from "./types";

/**
 * Public job sources. Each fetcher uses the source's public API or feed, makes a bounded number
 * of requests, and returns normalized listings. Nothing here calls Jev: whatever a source states
 * in a field (where the job can be done, the seniority, the category) is decided in code.
 */

const UA = "Chamba/1.0 (+https://github.com/elberacasa/chimbometro)";
const TIMEOUT_MS = 15_000;

type Fetched = { listings: Listing[]; requested: string[] };

export type Source = {
  id: SourceId;
  name: string;
  homepage: string;
  /** Never fetched more often than this, whatever triggers the refresh. Respects each API's terms. */
  minIntervalHours: number;
  fetch: () => Promise<Fetched>;
};

/** Every source we evaluated. `npm run jev:sources` measures each one with Jev. */
export const CANDIDATE_SOURCES: Source[] = [
  {
    id: "hn",
    name: "Hacker News: Who is hiring?",
    homepage: "https://news.ycombinator.com/submitted?id=whoishiring",
    minIntervalHours: 1,
    fetch: hackerNews,
  },
  {
    id: "getonbrd",
    name: "Get on Board",
    homepage: "https://www.getonbrd.com",
    minIntervalHours: 1,
    fetch: getOnBoard,
  },
  {
    id: "himalayas",
    name: "Himalayas",
    homepage: "https://himalayas.app",
    minIntervalHours: 1,
    fetch: himalayas,
  },
  {
    id: "jobicy",
    name: "Jobicy",
    homepage: "https://jobicy.com",
    // "Polling must not exceed once per hour."
    minIntervalHours: 2,
    fetch: jobicy,
  },
  {
    id: "wwr",
    name: "We Work Remotely",
    homepage: "https://weworkremotely.com",
    minIntervalHours: 1,
    fetch: weWorkRemotely,
  },
  {
    id: "workingnomads",
    name: "Working Nomads",
    homepage: "https://www.workingnomads.com",
    minIntervalHours: 2,
    fetch: workingNomads,
  },
  {
    id: "remoteok",
    name: "Remote OK",
    homepage: "https://remoteok.com",
    minIntervalHours: 2,
    fetch: remoteOk,
  },
  {
    id: "remotive",
    name: "Remotive",
    homepage: "https://remotive.com",
    // "We advise max. 4 times a day."
    minIntervalHours: 6,
    fetch: remotive,
  },
];

export const SOURCES = CANDIDATE_SOURCES.filter((s) => LIVE_SOURCES.includes(s.id));

type FetchOptions = {
  sources?: Source[];
  /** Whether a source may be fetched now; a source that is not due is reported as "recent". */
  isDue?: (source: Source) => Promise<boolean>;
  onSource?: (report: SourceReport) => void;
};

/** Fetches every due source in parallel. A failing source is reported, never fatal. */
export async function fetchAll({ sources = SOURCES, isDue, onSource }: FetchOptions = {}) {
  const results = await Promise.all(
    sources.map(async (s) => {
      const started = performance.now();
      const base = { id: s.id, name: s.name, homepage: s.homepage };
      let report: SourceReport;
      let listings: Listing[] = [];
      if (isDue && !(await isDue(s))) {
        report = { ...base, requested: [], status: "recent", listings: 0, ms: 0 };
      } else {
        try {
          const got = await s.fetch();
          listings = got.listings;
          report = {
            ...base,
            requested: got.requested,
            status: "ok",
            listings: listings.length,
            ms: ms(started),
          };
        } catch (e) {
          report = {
            ...base,
            requested: [],
            status: "failed",
            listings: 0,
            ms: ms(started),
            error: (e as Error).message,
          };
        }
      }
      onSource?.(report);
      return { report, listings };
    }),
  );
  return { reports: results.map((r) => r.report), listings: results.flatMap((r) => r.listings) };
}

async function hackerNews(): Promise<Fetched> {
  const searchUrl =
    "https://hn.algolia.com/api/v1/search_by_date?tags=story,author_whoishiring&hitsPerPage=10";
  const search = await getJson<{ hits: Array<{ objectID: string; title: string }> }>(searchUrl);
  const thread = search.hits.find((h) => h.title.startsWith("Ask HN: Who is hiring?"));
  if (!thread) throw new Error("No encontramos el hilo de este mes");
  const itemUrl = `https://hn.algolia.com/api/v1/items/${thread.objectID}`;
  const item = await getJson<{
    children: Array<{ id: number; text: string | null; created_at: string }>;
  }>(itemUrl);

  const listings = item.children.flatMap((c): Listing[] => {
    const text = htmlToText(c.text ?? "");
    if (text.length < 80) return [];
    const firstLine = text.split("\n")[0]!;
    return [
      {
        id: `hn-${c.id}`,
        source: "hn",
        title: firstLine.slice(0, 180),
        company: firstLine.split("|")[0]!.trim().slice(0, 80),
        location: "",
        text,
        url: `https://news.ycombinator.com/item?id=${c.id}`,
        postedAt: c.created_at,
        salary: null,
        structuredWhere: null,
        levels: null,
      },
    ];
  });
  return { listings, requested: [searchUrl, itemUrl] };
}

type GobJob = {
  id: string;
  attributes: {
    title: string;
    description?: string;
    functions?: string;
    benefits?: string;
    remote_modality?: string;
    countries?: string[];
    min_salary?: number | null;
    max_salary?: number | null;
    published_at?: number;
    seniority?: { data?: { id?: number | string } };
  };
  links?: { public_url?: string };
};

// Get on Board's modality codes, decided in code. "remote_local" is remote only for residents of
// the job's countries; none of them was Venezuela when we checked (see the Laboratorio in /docs).
const GOB_WHERE: Record<string, Listing["structuredWhere"]> = {
  fully_remote: "anywhere",
  remote_local: "country_only",
  temporarily_remote: "onsite",
  hybrid: "onsite",
  no_remote: "onsite",
};

// Get on Board seniority ids: 1 no experience, 2 junior, 3 semi senior, 4 senior, 5 expert.
const GOB_LEVEL: Record<string, Seniority> = {
  "1": "junior",
  "2": "junior",
  "3": "mid",
  "4": "senior",
  "5": "lead_or_staff",
};

async function getOnBoard(): Promise<Fetched> {
  const listings: Listing[] = [];
  const requested: string[] = [];
  for (let page = 1; page <= 4; page++) {
    const url = `https://www.getonbrd.com/api/v0/search/jobs?query=developer&per_page=50&page=${page}`;
    requested.push(url);
    const { data } = await getJson<{ data: GobJob[] }>(url);
    for (const j of data) {
      const a = j.attributes;
      const level = GOB_LEVEL[String(a.seniority?.data?.id ?? "")];
      listings.push({
        id: `gob-${j.id}`,
        source: "getonbrd",
        title: a.title,
        company: "",
        location: (a.countries ?? []).join(", "),
        text: htmlToText([a.description, a.functions, a.benefits].filter(Boolean).join("\n")),
        url: j.links?.public_url ?? "https://www.getonbrd.com",
        postedAt: a.published_at ? new Date(a.published_at * 1000).toISOString() : null,
        salary: a.min_salary && a.max_salary ? { min: a.min_salary, max: a.max_salary } : null,
        structuredWhere: GOB_WHERE[a.remote_modality ?? ""] ?? null,
        levels: level ? [level] : null,
      });
    }
    if (data.length < 50) break;
  }
  return { listings, requested };
}

type HimalayasJob = {
  guid: string;
  title: string;
  companyName: string;
  description: string;
  applicationLink: string;
  pubDate: number;
  locationRestrictions: string[];
  seniority: string[];
  minSalary: number | null;
  maxSalary: number | null;
  currency: string | null;
  salaryPeriod?: string | null;
};

// Himalayas' search filters by country on their side: every result is worldwide or lists
// Venezuela. Two keyword searches, newest first, cover engineering and development roles. Pages
// hold up to 20 jobs and sometimes fewer, so the page count is fixed rather than inferred.
// Almost every tech job it returns accepts Venezuela, so it gets the most pages.
const HIMALAYAS_SEARCHES: Array<[query: string, pages: number]> = [
  ["engineer", 10],
  ["developer", 6],
];

async function himalayas(): Promise<Fetched> {
  const listings: Listing[] = [];
  const requested: string[] = [];
  for (const [query, pages] of HIMALAYAS_SEARCHES) {
    for (let page = 1; page <= pages; page++) {
      const url = `https://himalayas.app/jobs/api/search?q=${query}&country=Venezuela&sort=recent&page=${page}`;
      requested.push(url);
      const { jobs } = await getJson<{ jobs: HimalayasJob[] }>(url);
      for (const j of jobs) {
        const levels = j.seniority.flatMap((s) => HIMALAYAS_LEVEL[s] ?? []);
        listings.push({
          id: `himalayas-${j.guid.split("/").slice(-3).join("-")}`,
          source: "himalayas",
          title: j.title,
          company: j.companyName,
          location: j.locationRestrictions.join(", ") || "Worldwide",
          text: htmlToText(j.description),
          url: j.applicationLink,
          postedAt: new Date(j.pubDate * 1000).toISOString(),
          salary: monthlyUsd(j.minSalary, j.maxSalary, j.currency, j.salaryPeriod),
          structuredWhere: himalayasWhere(j.locationRestrictions),
          levels: levels.length ? [...new Set(levels)] : null,
        });
      }
      if (jobs.length === 0) break;
    }
  }
  return { listings, requested };
}

export function himalayasWhere(restrictions: string[]): Listing["structuredWhere"] {
  return restrictions.length === 0 || restrictions.includes("Venezuela")
    ? "anywhere"
    : "country_only";
}

const HIMALAYAS_LEVEL: Record<string, Seniority> = {
  "Entry-level": "junior",
  "Mid-level": "mid",
  Senior: "senior",
  Manager: "lead_or_staff",
  Director: "lead_or_staff",
  Executive: "lead_or_staff",
};

type JobicyJob = {
  id: number;
  url: string;
  jobTitle: string;
  companyName: string;
  jobGeo: string;
  jobLevel: string;
  jobDescription: string;
  pubDate: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  salaryPeriod?: string;
};

// Tech industries only, filtered by Jobicy. Its "latam" filter also returns "Anywhere" jobs.
const JOBICY_INDUSTRIES = ["dev", "data-science", "admin", "cybersecurity"];

async function jobicy(): Promise<Fetched> {
  const listings: Listing[] = [];
  const requested: string[] = [];
  for (const industry of JOBICY_INDUSTRIES) {
    const url = `https://jobicy.com/api/v2/remote-jobs?count=100&geo=latam&industry=${industry}`;
    requested.push(url);
    const { jobs = [] } = await getJson<{ jobs?: JobicyJob[] }>(url);
    for (const j of jobs) {
      listings.push({
        id: `jobicy-${j.id}`,
        source: "jobicy",
        title: decodeEntities(j.jobTitle),
        company: decodeEntities(j.companyName),
        location: j.jobGeo,
        text: htmlToText(j.jobDescription),
        url: j.url,
        postedAt: toIso(j.pubDate),
        salary: monthlyUsd(j.salaryMin, j.salaryMax, j.salaryCurrency, j.salaryPeriod),
        structuredWhere: jobicyWhere(j.jobGeo),
        levels: jobicyLevels(j.jobLevel),
      });
    }
  }
  return { listings, requested };
}

/** Jobicy's region field lists places; anything that covers Venezuela counts. */
export function jobicyWhere(geo: string): Listing["structuredWhere"] {
  return /anywhere|latam|latin america|south america|americas|venezuela/i.test(geo)
    ? "anywhere"
    : "country_only";
}

export function jobicyLevels(level: string): Seniority[] | null {
  // "Any" says nothing about juniors either way, so Jev decides.
  const levels = level.split(",").flatMap((l): Seniority[] => {
    const v = l.trim().toLowerCase();
    if (v === "junior" || v === "entry-level") return ["junior"];
    if (v === "midweight") return ["mid"];
    if (v === "senior") return ["senior"];
    if (v === "director" || v === "executive" || v === "lead") return ["lead_or_staff"];
    return [];
  });
  return levels.length ? [...new Set(levels)] : null;
}

// We Work Remotely's engineering feeds. "Anywhere in the World" is their structured region.
const WWR_FEEDS = [
  "remote-programming-jobs",
  "remote-full-stack-programming-jobs",
  "remote-back-end-programming-jobs",
  "remote-front-end-programming-jobs",
  "remote-devops-sysadmin-jobs",
];

async function weWorkRemotely(): Promise<Fetched> {
  const requested = WWR_FEEDS.map((f) => `https://weworkremotely.com/categories/${f}.rss`);
  const feeds = await Promise.all(requested.map(getText));
  const listings = feeds.flatMap((xml) =>
    [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m): Listing => {
      const item = m[1]!;
      const title = xmlField(item, "title");
      const [company, ...role] = title.split(":");
      const region = xmlField(item, "region");
      const link = xmlField(item, "link");
      return {
        id: `wwr-${link.split("/").pop() ?? title}`,
        source: "wwr",
        title: role.join(":").trim() || title,
        company: (company ?? "").trim(),
        location: region,
        text: htmlToText(xmlField(item, "description")),
        url: link,
        postedAt: toIso(xmlField(item, "pubDate")),
        salary: null,
        structuredWhere: /anywhere in the world/i.test(region) ? "anywhere" : null,
        levels: null,
      };
    }),
  );
  return { listings, requested };
}

async function workingNomads(): Promise<Fetched> {
  const url = "https://www.workingnomads.com/api/exposed_jobs/";
  const jobs = await getJson<
    Array<{
      url: string;
      title: string;
      company_name: string;
      category_name: string;
      location: string;
      description: string;
      pub_date: string;
    }>
  >(url);
  // Their category is a structured field; only engineering is kept.
  const listings = jobs
    .filter((j) => j.category_name === "Development")
    .map((j): Listing => ({
      id: `workingnomads-${j.url.split("/").filter(Boolean).pop()}`,
      source: "workingnomads",
      title: j.title,
      company: j.company_name,
      location: j.location,
      text: htmlToText(j.description),
      url: j.url,
      postedAt: toIso(j.pub_date),
      salary: null,
      // Free-text locations such as "Global" or "CET (+/- 3 hours)" are left to Jev.
      structuredWhere: null,
      levels: null,
    }));
  return { listings, requested: [url] };
}

async function remoteOk(): Promise<Fetched> {
  const url = "https://remoteok.com/api";
  // The first element is Remote OK's legal notice, not a job.
  const [, ...jobs] = await getJson<
    Array<{
      id: string;
      position: string;
      company: string;
      location: string;
      description: string;
      url: string;
      date: string;
      tags?: string[];
      salary_min?: number;
      salary_max?: number;
    }>
  >(url);
  const listings = jobs.map((j): Listing => ({
    id: `remoteok-${j.id}`,
    source: "remoteok",
    title: j.position,
    company: j.company,
    location: j.location,
    text: htmlToText(j.description),
    url: j.url,
    postedAt: toIso(j.date),
    salary: monthlyUsd(j.salary_min, j.salary_max, "USD", "year"),
    structuredWhere: null,
    levels: null,
  }));
  return { listings, requested: [url] };
}

// Remotive's categories that are technology roles; the rest are skipped without asking Jev.
const REMOTIVE_TECH = new Set([
  "Software Development",
  "Data and Analytics",
  "Artificial Intelligence",
  "Devops",
  "DevOps / Sysadmin",
  "Quality Assurance",
  "Information Technology",
  "Design",
  "Product",
]);

async function remotive(): Promise<Fetched> {
  const url = "https://remotive.com/api/remote-jobs";
  const data = await getJson<{
    jobs: Array<{
      id: number;
      title: string;
      company_name: string;
      category: string;
      candidate_required_location: string;
      description: string;
      url: string;
      publication_date: string;
    }>;
  }>(url);
  const listings = data.jobs
    .filter((j) => REMOTIVE_TECH.has(j.category))
    .map((j): Listing => ({
      id: `remotive-${j.id}`,
      source: "remotive",
      title: j.title,
      company: j.company_name,
      location: j.candidate_required_location,
      text: htmlToText(j.description),
      url: j.url,
      postedAt: toIso(j.publication_date),
      salary: null,
      structuredWhere: /^worldwide$/i.test(j.candidate_required_location.trim())
        ? "anywhere"
        : null,
      levels: null,
    }));
  return { listings, requested: [url] };
}

/** Salary fields as a monthly USD range, only when the source says it is USD. */
export function monthlyUsd(
  min: number | null | undefined,
  max: number | null | undefined,
  currency: string | null | undefined,
  period: string | null | undefined,
): Listing["salary"] {
  if (!min || !max || (currency ?? "").toUpperCase() !== "USD") return null;
  const perYear = /year|annual/i.test(period ?? "");
  const perMonth = /month/i.test(period ?? "");
  if (!perYear && !perMonth) return null;
  const f = perYear ? 1 / 12 : 1;
  return { min: Math.round(min * f), max: Math.round(max * f) };
}

async function getText(url: string) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function getJson<T>(url: string): Promise<T> {
  return JSON.parse(await getText(url)) as T;
}

export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<!\[CDATA\[|\]\]>/g, "")
      .replace(/<(br|p|li|div|h\d)[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t ]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

function decodeEntities(s: string) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function xmlField(item: string, tag: string) {
  const m = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return m ? decodeEntities(m[1]!.replace(/<!\[CDATA\[|\]\]>/g, "")).trim() : "";
}

function toIso(date: string) {
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function ms(started: number) {
  return Math.round(performance.now() - started);
}
