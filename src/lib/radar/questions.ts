import type { ChoiceQuestion, Question } from "@/lib/jev/types";
import type { Fragment } from "@/lib/chimba/evidence";

/**
 * Bump when the questions change: stored judgments from an older version are re-judged on the next
 * refresh instead of being reused. v2 added `tech_role` and broadened `excludes_venezuela` after a
 * US-licensed insurance sales job showed up as a junior role open to Venezuela. v3 added
 * `junior_friendly`, because posts hiring "junior and senior" engineers were labeled "unclear", and
 * taught `where` that region codes such as NAMER, EMEA and APJ leave Latin America out. v4 came out
 * of comparing sources: Jev read "LATAM, USA" and the standard "must be authorized to work where the
 * position is located" line as exclusions, and missed that CET-only time zones leave Venezuela out.
 */
export const RADAR_QUESTIONS_VERSION = 4;

/**
 * What Jev is asked about every job listing, in one request. Written after the Chamba Radar
 * experiment (research/classify_jobs.py): "contractor OK" was dropped because listings rarely
 * say, so its probabilities carried no signal.
 */
export const RADAR_QUESTIONS = {
  is_job: {
    type: "noul",
    instructions:
      "Is `job` an actual job opening someone could apply to (not a comment, a question, or an ad for a service)?",
  },
  where: {
    type: "choice",
    instructions: "Based on `job`, where can the hired person live and work from?",
    criteria: {
      anywhere: "Fully remote from anywhere in the world, or explicitly open to any country.",
      americas_or_latam:
        "Remote from Latin America or the Americas (time zone overlap), without excluding Venezuela.",
      specific_countries:
        "Remote, but only from a listed set of countries or regions that leaves Latin America out, " +
        "for example 'NAMER, EMEA, APJ' or 'US, UK, Germany'.",
      us_or_canada: "Remote only from the US and/or Canada.",
      europe: "Remote only from Europe or the EU/UK.",
      onsite_or_hybrid: "Requires working on-site or hybrid in a city.",
      unclear: "The listing does not say where the person can be.",
    },
  },
  tech_role: {
    type: "noul",
    instructions:
      "Is at least one of the roles in `job` a technology role: software engineering, data or machine " +
      "learning, DevOps or infrastructure, QA, security, UX/UI design, or technical product management? " +
      "Sales, business development, customer support, marketing, recruiting and administrative roles are not.",
  },
  excludes_venezuela: {
    type: "noul",
    instructions:
      "Does `job` require something a person living in Venezuela would normally not have? For example: " +
      "work authorization, citizenship or residency in a specific country; a professional license or " +
      "certification issued by a specific country (such as a US insurance, real estate, nursing or CPA " +
      "license); a security clearance; excluding sanctioned countries; a list of allowed countries or " +
      "regions that does not include Venezuela or Latin America (for example 'NAMER, EMEA, APAC'); or " +
      "working hours in a time zone Venezuela (UTC-4) cannot match, such as 'within one hour of CET'. " +
      "Latin America, LATAM, South America and the Americas include Venezuela. A generic line such as " +
      "'must be authorized to work in the location where you live' or 'where the position is located' " +
      "is not an exclusion by itself.",
  },
  junior_friendly: {
    type: "noul",
    instructions:
      "Does at least one technology role in `job` accept junior, entry-level or intern candidates? Yes " +
      "when it says junior, intern, trainee, entry level, recent graduates, up to two years of " +
      "experience, or a range that starts at junior (such as 'junior to senior'). No when every role " +
      "is mid-level, senior, staff, lead or asks for three or more years.",
  },
  usd: { type: "noul", instructions: "Does `job` state pay in US dollars?" },
  seniority: {
    type: "choice",
    instructions: "What seniority does `job` target?",
    criteria: { junior: null, mid: null, senior: null, lead_or_staff: null, unclear: null },
  },
  role: {
    type: "choice",
    instructions: "What is the main role in `job`?",
    criteria: {
      frontend: null,
      backend: null,
      fullstack: null,
      mobile: null,
      data_ml: "Data engineering, data science, machine learning or AI research.",
      devops: "DevOps, SRE, platform, infrastructure or security.",
      qa: null,
      design: null,
      product: "Product or project management.",
      other: "Anything else, including non-engineering roles.",
    },
  },
  english: {
    type: "score",
    instructions: "How much English does `job` require?",
    criteria: [
      "None: the role works in Spanish or Portuguese.",
      "Basic reading and writing.",
      "Professional: meetings and written communication in English.",
      "Native or near-native fluency.",
    ],
  },
} satisfies Record<string, Question>;

/** "Select instead of generate": Jev points at the sentence that says where the job can be done. */
export function whereEvidenceQuestion(fragments: Fragment[]): ChoiceQuestion {
  const criteria: Record<string, string> = Object.fromEntries(
    fragments.map((f) => [f.id, `The fragment \`fragmentos.${f.id}\`.`]),
  );
  criteria.ninguno = "No fragment says where the person can work from.";
  return {
    type: "choice",
    instructions:
      "`fragmentos` are consecutive pieces of the listing in `job`. Which fragment best states where the " +
      "hired person can live and work from?",
    criteria,
  };
}
