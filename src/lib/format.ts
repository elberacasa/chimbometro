/** Number formatting in Venezuelan Spanish: "1.440 tokens", "$0,0000605", "97 %". */

const LOCALE = "es-VE";

const integer = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
const decimal2 = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const COUNT_WORDS = ["cero", "una", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho"];

/** "cinco" for 5, digits past eight. Feminine, as in "cinco bolsas". */
export function countWord(n: number): string {
  return COUNT_WORDS[n] ?? formatInt(n);
}

export function formatInt(n: number): string {
  return integer.format(n);
}

export function formatDecimal(n: number): string {
  return decimal2.format(n);
}

/** Small dollar amounts keep three significant digits so fractions of a cent stay readable. */
export function formatUsd(n: number): string {
  if (n === 0) return "$0";
  const digits = n >= 0.01 ? { maximumFractionDigits: 4 } : { maximumSignificantDigits: 3 };
  return "$" + new Intl.NumberFormat(LOCALE, digits).format(n);
}

export function formatPercent(p: number): string {
  // Non-breaking space so "57 %" never splits across lines.
  return `${Math.round(p * 100)}\u00a0%`;
}

export function formatMs(ms: number): string {
  return ms < 1000 ? `${formatInt(ms)} ms` : `${decimal2.format(ms / 1000)} s`;
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat(LOCALE, { dateStyle: "short", timeStyle: "short" }).format(
    new Date(iso),
  );
}
