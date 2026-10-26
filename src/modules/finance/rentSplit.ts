import { formatCents } from "@/src/lib/money";

// The monthly rent split: each person pays their own room's rent plus an even
// share of every utility (electricity, gas, wifi, ...). Everyone — you
// included — shares the utilities; only the OTHER people's totals become
// "Owed to me" receivables, one per person. Pure — the store persists it.
//
// Rounding: a utility that doesn't divide evenly leaves a few cents over. As in
// splitBill.ts those go to the other people, never to you (you fronted the
// bill). Across several utilities the extra cents ROTATE through the others
// instead of always landing on whoever is listed first.

export interface RentSplitMember {
  name: string;
  rentCents: number;
  isMe: boolean;
}

export interface UtilityItem {
  label: string; // "Electricity"
  totalCents: number;
}

export interface RentShare {
  name: string;
  isMe: boolean;
  rentCents: number;
  // This person's share of each utility, in the same order as the input items.
  utilityCents: number[];
  totalCents: number;
}

export type RentSplitError =
  | "no_one_else" // nobody besides you to owe you money
  | "multiple_me"
  | "blank_name"
  | "duplicate_name"
  | "invalid_rent" // a rent isn't a non-negative integer number of cents
  | "invalid_utility" // a utility total isn't a non-negative integer, or unlabeled
  | "nothing_owed"; // every other person's total is 0

export type RentSplitResult =
  | { ok: true; shares: RentShare[] } // every member, in input order
  | { ok: false; error: RentSplitError };

const isCents = (n: number) => Number.isInteger(n) && n >= 0;

export function planRentSplit(
  members: RentSplitMember[],
  utilities: UtilityItem[],
): RentSplitResult {
  const named = members.map((m) => ({ ...m, name: m.name.trim() }));
  if (named.some((m) => m.name.length === 0)) {
    return { ok: false, error: "blank_name" };
  }
  const seen = new Set<string>();
  for (const m of named) {
    const key = m.name.toLowerCase();
    if (seen.has(key)) return { ok: false, error: "duplicate_name" };
    seen.add(key);
  }
  if (named.filter((m) => m.isMe).length > 1) {
    return { ok: false, error: "multiple_me" };
  }
  const otherIndexes = named.flatMap((m, i) => (m.isMe ? [] : [i]));
  if (otherIndexes.length === 0) return { ok: false, error: "no_one_else" };
  if (named.some((m) => !isCents(m.rentCents))) {
    return { ok: false, error: "invalid_rent" };
  }
  if (utilities.some((u) => !isCents(u.totalCents) || u.label.trim() === "")) {
    return { ok: false, error: "invalid_utility" };
  }

  const n = named.length;
  const utilityCents = named.map(() => [] as number[]);
  let cursor = 0; // rotates the leftover cents through the other people
  for (const utility of utilities) {
    const base = Math.floor(utility.totalCents / n);
    // leftover < n and <= number of others, so the others always absorb it.
    let leftover = utility.totalCents - base * n;
    const extra = new Set<number>();
    while (leftover > 0) {
      extra.add(otherIndexes[cursor % otherIndexes.length]);
      cursor += 1;
      leftover -= 1;
    }
    named.forEach((_, i) => {
      utilityCents[i].push(base + (extra.has(i) ? 1 : 0));
    });
  }

  const shares = named.map((m, i) => ({
    name: m.name,
    isMe: m.isMe,
    rentCents: m.rentCents,
    utilityCents: utilityCents[i],
    totalCents:
      m.rentCents + utilityCents[i].reduce((sum, cents) => sum + cents, 0),
  }));
  if (shares.every((s) => s.isMe || s.totalCents === 0)) {
    return { ok: false, error: "nothing_owed" };
  }
  return { ok: true, shares };
}

// The receivable's reason: "Rent Oct 2026: room $600.00, Electricity $30.00,
// Wifi $20.00". Zero lines are left out.
export function rentShareReason(
  title: string,
  share: RentShare,
  utilities: UtilityItem[],
): string {
  const parts: string[] = [];
  if (share.rentCents > 0) parts.push(`room ${formatCents(share.rentCents)}`);
  utilities.forEach((utility, i) => {
    const cents = share.utilityCents[i];
    if (cents > 0) parts.push(`${utility.label.trim()} ${formatCents(cents)}`);
  });
  return parts.length > 0 ? `${title}: ${parts.join(", ")}` : title;
}
