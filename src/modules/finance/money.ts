// All money in the finance module is integer CENTS. Floats never touch a
// balance — 0.1 + 0.2 !== 0.3 is not a bug you want in a ledger. Parse at the
// input edge, format at the output edge, keep everything in between integer
// cents.

// Parse a user-entered amount ("12.50", "$1,234.5", "12", ".5") into integer
// cents. Returns null on anything it can't read as a non-negative money value,
// so a form can validate rather than storing garbage. Rounds to the nearest cent.
export function parseAmount(input: string): number | null {
  const cleaned = input.trim().replace(/[$,\s]/g, "");
  if (cleaned === "") return null;
  // digits, optional single decimal point with any number of fractional digits
  if (!/^\d*(\.\d*)?$/.test(cleaned)) return null;
  const dollars = Number(cleaned);
  if (!Number.isFinite(dollars) || dollars < 0) return null;
  return Math.round(dollars * 100);
}

// Format integer cents as a display string: 1250 -> "$12.50", -1250 ->
// "-$12.50", 9 -> "$0.09". Handles negatives so a net-cash-flow figure reads
// correctly.
export function formatCents(cents: number): string {
  const rounded = Math.round(cents);
  const sign = rounded < 0 ? "-" : "";
  const abs = Math.abs(rounded);
  const dollars = Math.floor(abs / 100);
  const remainder = abs % 100;
  return `${sign}$${dollars.toLocaleString("en-US")}.${remainder
    .toString()
    .padStart(2, "0")}`;
}

// Sum integer cents. Centralizes the "stay in cents" contract so callers never
// reach for reduce with a float accumulator.
export function sumCents(values: number[]): number {
  return values.reduce((total, cents) => total + cents, 0);
}
