import type { Listing, Seniority } from "./types";

/**
 * Invented listings modeled on the traps found in real data. `npm run jev:eval-radar` runs them
 * through the real judge and checks what the radar would show. Add a case every time a real
 * listing is misjudged.
 */
export type RadarCase = {
  id: string;
  why: string;
  listing: Omit<Listing, "id" | "url" | "postedAt" | "salary">;
  expect: { techRole: boolean; eligible: boolean; seniority?: Seniority };
};

const base = { company: "", location: "", structuredWhere: null } as const;

export const RADAR_CASES: RadarCase[] = [
  {
    id: "insurance-license",
    why: "A 'fully remote' Get on Board listing that requires a US insurance license (reported by a user).",
    listing: {
      ...base,
      source: "getonbrd",
      title: "US Licensed Insurance Agent. Living Outside US",
      structuredWhere: "anywhere",
      text:
        "DO NOT APPLY IF YOU DO NOT HOLD A US PROPERTY & CASUALTY LICENSE. We are a personal lines insurance " +
        "agency selling auto, home and life insurance in several US states, fully remote for six years. You will " +
        "quote policies, call leads and close sales. Commission plus base.",
    },
    expect: { techRole: false, eligible: false },
  },
  {
    id: "sdr-latam",
    why: "Remote from LATAM, but a sales role: not for a developer radar.",
    listing: {
      ...base,
      source: "getonbrd",
      title: "Sales Development Representative",
      structuredWhere: "anywhere",
      text:
        "Fully remote from anywhere in Latin America. Prospect B2B leads on LinkedIn, book meetings for our " +
        "account executives, hit monthly quotas. English and Spanish required. Base plus commission in USD.",
    },
    expect: { techRole: false, eligible: true },
  },
  {
    id: "hn-worldwide",
    why: "The clear positive: a software role remote from anywhere.",
    listing: {
      ...base,
      source: "hn",
      title: "Acme | Senior Backend Engineer (Go) | REMOTE (Worldwide) | Full-time | $120k-160k",
      text:
        "Acme | Senior Backend Engineer (Go) | REMOTE (Worldwide) | Full-time | $120k-160k\n" +
        "We build payment infrastructure. You will own services in Go and Postgres. We hire anywhere in the world.",
    },
    expect: { techRole: true, eligible: true, seniority: "senior" },
  },
  {
    id: "hn-us-only",
    why: "Remote, but only in the US.",
    listing: {
      ...base,
      source: "hn",
      title: "Beta | Staff Engineer | Remote (US only) | Full-time",
      text:
        "Beta | Staff Engineer | Remote (US only) | Full-time\nYou must be authorized to work in the United " +
        "States. TypeScript, React, Node.",
    },
    expect: { techRole: true, eligible: false },
  },
  {
    id: "hn-latam-timezones",
    why: "Remote from LATAM by time zone, which includes Venezuela (UTC-4).",
    listing: {
      ...base,
      source: "hn",
      title: "Gamma | Full Stack Engineer | Remote, LATAM (UTC-3 to UTC-5) | Contractor",
      text:
        "Gamma | Full Stack Engineer | Remote, LATAM (UTC-3 to UTC-5) | Contractor\nNext.js and Python. We pay " +
        "contractors in USD monthly.",
    },
    expect: { techRole: true, eligible: true },
  },
  {
    id: "hn-onsite",
    why: "On-site in a US city.",
    listing: {
      ...base,
      source: "hn",
      title: "Delta | ML Engineer | ONSITE San Francisco | Full-time",
      text: "Delta | ML Engineer | ONSITE San Francisco | Full-time\nTrain ranking models. 5 days a week in our SF office.",
    },
    expect: { techRole: true, eligible: false },
  },
  {
    id: "clearance",
    why: "Remote, but requires a US security clearance.",
    listing: {
      ...base,
      source: "remotive",
      location: "USA",
      title: "DevOps Engineer",
      text: "Remote anywhere in the US. Must hold an active Secret clearance. Terraform, AWS GovCloud, Kubernetes.",
    },
    expect: { techRole: true, eligible: false },
  },
  {
    id: "gob-remote-local",
    why: "Get on Board says remote only for residents of the job's country.",
    listing: {
      ...base,
      source: "getonbrd",
      location: "Chile",
      title: "Desarrollador Backend Semi Senior",
      structuredWhere: "country_only",
      text: "Trabajo remoto para Chile. Node.js y PostgreSQL. Contrato indefinido.",
    },
    expect: { techRole: true, eligible: false },
  },
  {
    id: "wwr-country-list",
    why: "Tagged 'Anywhere in the World', but the text lists allowed countries without Venezuela.",
    listing: {
      ...base,
      source: "wwr",
      location: "Anywhere in the World",
      title: "Frontend Engineer",
      structuredWhere: "anywhere",
      text:
        "Remote. Because of payroll, we can only hire people residing in Mexico, Colombia, Argentina or Brazil. " +
        "React and TypeScript.",
    },
    expect: { techRole: true, eligible: false },
  },
  {
    id: "hn-all-roles",
    why: "A company post with many roles; some are engineering, so it belongs on the radar.",
    listing: {
      ...base,
      source: "hn",
      title: "Tether | Many roles | Fully remote, worldwide",
      text:
        "At Tether we're hiring! All of our roles are fully remote, worldwide: Backend Engineer, Frontend " +
        "Engineer, Legal Counsel, Marketing Manager.",
    },
    expect: { techRole: true, eligible: true },
  },
  {
    id: "sanctioned-list",
    why: "Worldwide, but the excluded countries include Venezuela by name.",
    listing: {
      ...base,
      source: "hn",
      title: "Epsilon | Software Engineer | Remote (global)",
      text:
        "Epsilon | Software Engineer | Remote (global)\nWe cannot hire residents of Cuba, Iran, North Korea, " +
        "Syria, Russia or Venezuela due to payment restrictions.",
    },
    expect: { techRole: true, eligible: false },
  },
  {
    id: "junior-dev",
    why: "The listing a junior in Venezuela is looking for.",
    listing: {
      ...base,
      source: "getonbrd",
      title: "Junior Frontend Developer",
      structuredWhere: "anywhere",
      text:
        "Buscamos desarrollador frontend junior con React. 100% remoto desde cualquier país, equipo en español, " +
        "pago en USD.",
    },
    expect: { techRole: true, eligible: true, seniority: "junior" },
  },
];
