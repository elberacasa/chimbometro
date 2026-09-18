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
  expect: { techRole: boolean; eligible: boolean; seniority?: Seniority; juniorFriendly?: boolean };
};

const base = { company: "", location: "", structuredWhere: null, levels: null } as const;

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
    expect: { techRole: true, eligible: true, seniority: "senior", juniorFriendly: false },
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
    expect: { techRole: true, eligible: true, seniority: "junior", juniorFriendly: true },
  },
  {
    id: "junior-and-senior",
    why: "One post hiring juniors and seniors (a real HN post the radar labeled 'unclear' in v2).",
    listing: {
      ...base,
      source: "hn",
      title:
        "Zeta | Junior to Senior Fullstack Engineer, multiple positions | ONSITE or FULLY REMOTE | $150K-180K",
      text:
        "Zeta | Junior to Senior Fullstack Engineer, multiple positions | ONSITE or FULLY REMOTE | $150K-180K a " +
        "year for US or local average + 20% for outside the US\nWe are looking for more Junior and Senior " +
        "FullStack Engineers. Ruby on Rails, MongoDB and React.",
    },
    expect: { techRole: true, eligible: true, juniorFriendly: true },
  },
  {
    id: "interns-non-us",
    why: "Programming interns among animators and writers, remote outside the US (real HN post, v2 missed it).",
    listing: {
      ...base,
      source: "hn",
      title: "Hiring for several roles at Eta, an edutainment studio",
      text:
        "Hiring for several roles at Eta, an edutainment studio building learning videos for kids.\nOpen Roles " +
        "(REMOTE, non US): Animators (2D/3D), Writers, Programming interns. Fully remote, async-friendly.",
    },
    expect: { techRole: true, eligible: true, juniorFriendly: true },
  },
  {
    id: "region-codes",
    why: "NAMER, EMEA and APJ leave Latin America out (real HN post that v2 accepted with 0.49 confidence).",
    listing: {
      ...base,
      source: "hn",
      title: "Theta | VoiceAI infrastructure | Remote | Full Time",
      text:
        "Theta | VoiceAI infrastructure | Remote | Full Time\nHiring:\n>> Product Engineer | NAMER, EMEA, APJ " +
        "(Remote) or SF (Hybrid)\n>> Staff Security Engineer | NAMER, EMEA, APJ (Remote)\n>> Forward Deployed " +
        "Engineer | United States (Remote)",
    },
    expect: { techRole: true, eligible: false },
  },
  {
    id: "latam-field-boilerplate",
    why: "Jobicy says 'LATAM, USA'; the only restriction is standard work-authorization text (real, v3 rejected it).",
    listing: {
      ...base,
      source: "jobicy",
      location: "LATAM,  USA",
      structuredWhere: "anywhere",
      title: "Senior Software Engineer - Workflow",
      text:
        "We are a completely remote team powering hotels in 150 countries. You will build workflow features " +
        "in TypeScript and Go.\nWork Authorization: Please note that applicants must be currently authorized " +
        "to work in the location where the position is located without requiring visa sponsorship.",
    },
    expect: { techRole: true, eligible: true },
  },
  {
    id: "latam-field-plain",
    why: "Jobicy says 'LATAM, Canada, USA' and the text says nothing more (real, v3 rejected it with 0.52).",
    listing: {
      ...base,
      source: "jobicy",
      location: "LATAM,  Canada,  USA",
      structuredWhere: "anywhere",
      title: "Senior Data Analyst",
      text:
        "We are a fully remote, high-documentation, low-meeting company. You will own dashboards and " +
        "experiments in SQL, dbt and Python, and work with product and finance.",
    },
    expect: { techRole: true, eligible: true },
  },
  {
    id: "cet-timezone",
    why: "We Work Remotely says 'Anywhere in the World', the text asks for CET within one hour (real).",
    listing: {
      ...base,
      source: "wwr",
      location: "Anywhere in the World",
      structuredWhere: "anywhere",
      title: "Java Developer",
      text:
        "Belgian fintech. You develop the back end of our platform in Java.\nYou are based in a time zone " +
        "within one hour of CET, so your working day overlaps with the team's for the daily stand-ups.",
    },
    expect: { techRole: true, eligible: false },
  },
  {
    id: "anywhere-field-us-text",
    why: "'Anywhere in the World' in the field, 'anywhere within the United States' in the text (real).",
    listing: {
      ...base,
      source: "wwr",
      location: "Anywhere in the World",
      structuredWhere: "anywhere",
      title: "Senior Full-Stack Software Engineer",
      text:
        "This is a fully remote role: you can work from anywhere within the United States. React, Node.js " +
        "and PostgreSQL.",
    },
    expect: { techRole: true, eligible: false },
  },
  {
    id: "entry-level-field-expert-text",
    why: "Himalayas tags it Entry-level; the text wants expert senior engineers (real, v4 showed it as junior).",
    listing: {
      ...base,
      source: "himalayas",
      location: "Worldwide",
      structuredWhere: "anywhere",
      levels: ["junior"],
      title: "GitHub Contributor",
      text:
        "Role Type: Contractor (~15 hrs a week). Location: Remote. We are engaging expert Senior Software " +
        "Engineers to support a customer's project: you'll apply your expertise to help train next-generation " +
        "AI models by contributing to open-source repositories. 5+ years of professional experience required.",
    },
    expect: { techRole: true, eligible: true, juniorFriendly: false },
  },
  {
    id: "anywhere-field-us-headquarters",
    why: "'Anywhere in the World' on We Work Remotely; the text says Remote - United States (real, v5 accepted it).",
    listing: {
      ...base,
      source: "wwr",
      location: "Anywhere in the World",
      structuredWhere: "anywhere",
      company: "Reddit",
      title: "Backend Engineer, IAM",
      text:
        "Headquarters: Remote - United States. Reddit is a community of communities. You will build identity " +
        "and access management services in Go and Python.",
    },
    expect: { techRole: true, eligible: false },
  },
  {
    id: "anywhere-field-us-canada",
    why: "'Anywhere in the World' on We Work Remotely; the text says United States or Canada (real, v5 accepted it).",
    listing: {
      ...base,
      source: "wwr",
      location: "Anywhere in the World",
      structuredWhere: "anywhere",
      company: "Temporal Technologies",
      title: "Senior Application Security Engineer",
      text:
        "Headquarters: United States or Canada - Remote Opportunity. Temporal is an open source programming " +
        "model. The estimated pay range for this role is $180,000 - $225,000.",
    },
    expect: { techRole: true, eligible: false },
  },
  {
    id: "anywhere-field-ireland",
    why: "'Anywhere in the World' on We Work Remotely; the text says Location: Remote Ireland (real, v5 accepted it).",
    listing: {
      ...base,
      source: "wwr",
      location: "Anywhere in the World",
      structuredWhere: "anywhere",
      company: "Huntress",
      title: "Manager, Security Operations Center - EMEA",
      text:
        "Headquarters: Remote Ireland. Reports to: Director, Security Operations Center. Location: Remote " +
        "Ireland. Compensation Range: EUR 115,200 to 133,000 base plus bonus and equity.",
    },
    expect: { techRole: true, eligible: false },
  },
  {
    id: "anywhere-field-utc-window",
    why: "'Anywhere in the World' with a UTC-4 to UTC+4 window, which includes Venezuela (real, must stay open).",
    listing: {
      ...base,
      source: "wwr",
      location: "Anywhere in the World",
      structuredWhere: "anywhere",
      company: "Toggl",
      title: "Senior Full Stack",
      text:
        "Headquarters: Tallinn, Estonia. We are looking for a Senior Full Stack Engineer. You can work from " +
        "anywhere in the world as long as your main location is between UTC-4 and UTC+4.",
    },
    expect: { techRole: true, eligible: true },
  },
  {
    id: "anywhere-field-americas-europe",
    why: "'Anywhere in the World' with 'Remote | Americas, Europe' in the text (real, must stay open).",
    listing: {
      ...base,
      source: "wwr",
      location: "Anywhere in the World",
      structuredWhere: "anywhere",
      company: "A.Team",
      title: "Senior Independent AI Engineer / Architect",
      text:
        "Headquarters: NYC and TLV. Senior Independent AI Engineer / Architect. Remote | Americas, Europe. " +
        "A.Team is an invite-only network of senior AI engineers working on production AI systems.",
    },
    expect: { techRole: true, eligible: true },
  },
];
