import type { ChoiceQuestion, Question } from "@/lib/jev/types";
import type { Fragment } from "@/lib/chimba/evidence";

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
      specific_countries: "Remote, but only from a listed set of countries.",
      us_or_canada: "Remote only from the US and/or Canada.",
      europe: "Remote only from Europe or the EU/UK.",
      onsite_or_hybrid: "Requires working on-site or hybrid in a city.",
      unclear: "The listing does not say where the person can be.",
    },
  },
  excludes_venezuela: {
    type: "noul",
    instructions:
      "Does `job` rule out a candidate living in Venezuela, for example by requiring work authorization in a " +
      "specific country, excluding sanctioned countries, or listing allowed countries that do not include Venezuela?",
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
