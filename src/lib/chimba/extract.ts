/**
 * Facts we can read from the offer with plain code, no model needed: salary amounts and the
 * technologies it asks for. Shown next to Jev's judgments so each does the job it is good at.
 */

const TECHS: Array<[name: string, pattern: RegExp]> = [
  // Bare "js"/"ts" only when not a suffix like "Node.js".
  ["JavaScript", /\bjavascript\b|(?<![.\w])js\b/i],
  ["TypeScript", /\btypescript\b|(?<![.\w])ts\b/i],
  ["React", /\breact(?:\.?js)?\b(?!\s*native)/i],
  ["React Native", /\breact\s*native\b/i],
  ["Angular", /\bangular\b/i],
  ["Vue", /\bvue(?:\.?js)?\b/i],
  ["Svelte", /\bsvelte\b/i],
  ["Next.js", /\bnext\.?js\b/i],
  ["Node.js", /\bnode(?:\.?js)?\b/i],
  ["Express", /\bexpress(?:\.?js)?\b/i],
  ["NestJS", /\bnest\.?js\b/i],
  ["Python", /\bpython\b/i],
  ["Django", /\bdjango\b/i],
  ["FastAPI", /\bfastapi\b/i],
  ["Flask", /\bflask\b/i],
  ["PHP", /\bphp\b/i],
  ["Laravel", /\blaravel\b/i],
  ["WordPress", /\bwordpress\b/i],
  ["Java", /\bjava\b(?!\s*script)/i],
  ["Spring", /\bspring(?:\s*boot)?\b/i],
  ["Kotlin", /\bkotlin\b/i],
  ["Swift", /\bswift\b/i],
  ["Flutter", /\bflutter\b/i],
  ["Dart", /\bdart\b/i],
  ["C#", /\bc#|\bc\s*sharp\b/i],
  [".NET", /\.net\b/i],
  ["C++", /\bc\+\+/i],
  ["Go", /\bgolang\b|\bgo\b(?=\s*(?:,|\/|y\b|lang|\)|$))/i],
  ["Rust", /\brust\b/i],
  ["Ruby", /\bruby\b|\brails\b/i],
  ["SQL", /\bsql\b(?!\s*server)/i],
  ["PostgreSQL", /\bpostgres(?:ql)?\b/i],
  ["MySQL", /\bmysql\b/i],
  ["SQL Server", /\bsql\s*server\b/i],
  ["Oracle", /\boracle\b/i],
  ["MongoDB", /\bmongo(?:db)?\b/i],
  ["Redis", /\bredis\b/i],
  ["Firebase", /\bfirebase\b/i],
  ["GraphQL", /\bgraphql\b/i],
  ["AWS", /\baws\b|\bamazon web services\b/i],
  ["Azure", /\bazure\b/i],
  ["GCP", /\bgcp\b|\bgoogle cloud\b/i],
  ["Docker", /\bdocker\b/i],
  ["Kubernetes", /\bkubernetes\b|\bk8s\b/i],
  ["CI/CD", /\bci\s*\/\s*cd\b/i],
  ["Terraform", /\bterraform\b/i],
  ["Linux", /\blinux\b/i],
  ["Git", /\bgit\b(?!hub|lab)/i],
  ["Machine learning", /\bmachine\s*learning\b|\bml\b/i],
  ["IA", /\bia\b|\bai\b|\binteligencia artificial\b|\bllms?\b/i],
  ["Data science", /\bdata\s*scien(?:ce|tist)\b|\bciencia de datos\b/i],
  ["Figma", /\bfigma\b/i],
  ["Photoshop", /\bphotoshop\b/i],
  ["Canva", /\bcanva\b/i],
  ["Excel", /\bexcel\b/i],
  ["SAP", /\bsap\b/i],
];

export function findTechnologies(text: string): string[] {
  return TECHS.filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
}

export type Salary = { currency: "USD" | "VES"; amounts: number[] };

const USD = String.raw`(?:\$|usd|us\$|dólares|dolares)`;
const VES = String.raw`(?:bs\.?|bs\.?s|bolívares|bolivares|ves)`;
const NUMBER = String.raw`(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d{1,2})?)(\s*k)?`;

/** Finds money amounts written before or after a currency marker, e.g. "$250", "2.200 USD". */
export function findSalary(text: string): Salary | null {
  const usd = amounts(text, USD);
  if (usd.length) return { currency: "USD", amounts: usd };
  const ves = amounts(text, VES);
  if (ves.length) return { currency: "VES", amounts: ves };
  return null;
}

function amounts(text: string, currency: string): number[] {
  const before = new RegExp(String.raw`${currency}\s*${NUMBER}`, "gi");
  const after = new RegExp(String.raw`${NUMBER}\s*${currency}(?![a-z])`, "gi");
  const found = new Set<number>();
  for (const re of [before, after]) {
    for (const m of text.matchAll(re)) {
      const value = parseAmount(m[1]!, Boolean(m[2]));
      if (value > 0) found.add(value);
    }
  }
  // "2.200 a 2.800 USD" puts the currency only after the second number.
  const range = new RegExp(String.raw`${NUMBER}\s*(?:a|-|–|hasta)\s*${NUMBER}\s*${currency}`, "gi");
  for (const m of text.matchAll(range)) found.add(parseAmount(m[1]!, Boolean(m[2])));
  return [...found].sort((a, b) => a - b);
}

function parseAmount(raw: string, thousands: boolean): number {
  // Separators followed by exactly three digits group thousands ("2.200", "2,200");
  // otherwise they mark decimals ("2,5").
  const normalized = /[.,]\d{3}(?:\D|$)/.test(raw)
    ? raw.replace(/[.,]/g, "")
    : raw.replace(",", ".");
  const value = Number.parseFloat(normalized);
  return thousands ? value * 1000 : value;
}
