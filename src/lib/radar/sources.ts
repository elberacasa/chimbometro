import type { Listing, SourceId, SourceReport } from "./types";

/**
 * Public job sources. Each fetcher uses the source's public API or feed, makes a bounded number
 * of requests, and returns normalized listings. Nothing here calls Jev.
 */

const UA = "Chamba/1.0 (+https://github.com/elberacasa)";
const TIMEOUT_MS = 15_000;

type Fetched = { listings: Listing[]; requested: string[] };

type Source = {
  id: SourceId;
  name: string;
  homepage: string;
  fetch: () => Promise<Fetched>;
};

export const SOURCES: Source[] = [
  {
    id: "hn",
    name: "Hacker News: Who is hiring?",
    homepage: "https://news.ycombinator.com/submitted?id=whoishiring",
    fetch: hackerNews,
  },
  { id: "getonbrd", name: "Get on Board", homepage: "https://www.getonbrd.com", fetch: getOnBoard },
  {
    id: "wwr",
    name: "We Work Remotely",
    homepage: "https://weworkremotely.com",
    fetch: weWorkRemotely,
  },
  { id: "remotive", name: "Remotive", homepage: "https://remotive.com", fetch: remotive },
];

/** Fetches every source in parallel. A failing source is reported, never fatal. */
export async function fetchAll(onSource?: (report: SourceReport) => void) {
  const results = await Promise.all(
    SOURCES.map(async (s) => {
      const started = performance.now();
      let report: SourceReport;
      let listings: Listing[] = [];
      try {
        const got = await s.fetch();
        listings = got.listings;
        report = {
          id: s.id,
          name: s.name,
          homepage: s.homepage,
          requested: got.requested,
          status: "ok",
          listings: listings.length,
          ms: ms(started),
        };
      } catch (e) {
        report = {
          id: s.id,
          name: s.name,
          homepage: s.homepage,
          requested: [],
          status: "failed",
          listings: 0,
          ms: ms(started),
          error: (e as Error).message,
        };
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
  };
  links?: { public_url?: string };
};

// Get on Board's modality codes, decided in code. "remote_local" is remote only for residents of
// the job's country (see the Laboratorio in /docs for why this is not left to the model).
const GOB_WHERE: Record<string, Listing["structuredWhere"]> = {
  fully_remote: "anywhere",
  remote_local: "country_only",
  temporarily_remote: "onsite",
  hybrid: "onsite",
  no_remote: "onsite",
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
      });
    }
    if (data.length < 50) break;
  }
  return { listings, requested };
}

async function weWorkRemotely(): Promise<Fetched> {
  const url = "https://weworkremotely.com/categories/remote-programming-jobs.rss";
  const xml = await getText(url);
  const listings = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m): Listing => {
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
    };
  });
  return { listings, requested: [url] };
}

async function remotive(): Promise<Fetched> {
  const url = "https://remotive.com/api/remote-jobs?category=software-dev";
  const data = await getJson<{
    jobs: Array<{
      id: number;
      title: string;
      company_name: string;
      candidate_required_location: string;
      description: string;
      url: string;
      publication_date: string;
    }>;
  }>(url);
  const listings = data.jobs.map((j): Listing => ({
    id: `remotive-${j.id}`,
    source: "remotive",
    title: j.title,
    company: j.company_name,
    location: j.candidate_required_location,
    text: htmlToText(j.description),
    url: j.url,
    postedAt: toIso(j.publication_date),
    salary: null,
    structuredWhere: /^worldwide$/i.test(j.candidate_required_location.trim()) ? "anywhere" : null,
  }));
  return { listings, requested: [url] };
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
    .replace(/[ \t ]+/g, " ")
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
