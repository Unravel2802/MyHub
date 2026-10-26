// Split a shared bill evenly and turn everyone else's share into "Owed to me"
// receivables. Pure — the store persists the result via createReceivables.
//
// Money is integer cents, so an uneven total can't divide exactly: $10.00 / 3
// is 333 cents each with 1 cent left over. The leftover cents go one each to
// the OTHER participants first (in the order entered), never to you, because
// you fronted the money — rounding should make you whole, not short you. The
// leftover is always smaller than the participant count, so it never exceeds
// the number of other people and your share is always the plain base.

export interface SplitParticipant {
  name: string;
  // Exactly one participant may be you. Your share is computed (so the others'
  // shares are right) but never becomes a receivable — you don't owe yourself.
  isMe: boolean;
}

export interface SplitShare {
  name: string;
  amountCents: number;
}

export interface SplitPlan {
  // One per OTHER participant, in entered order — each becomes a receivable.
  shares: SplitShare[];
  // Your own share (0 when you're not part of the split). Shown, not stored.
  myShareCents: number;
}

export type SplitError =
  | "invalid_total" // not a positive integer number of cents
  | "no_one_else" // nobody besides you to owe you money
  | "multiple_me" // more than one participant marked as you
  | "blank_name" // a participant's name is empty after trimming
  | "duplicate_name" // two participants share a name (case-insensitive)
  | "total_too_small"; // fewer cents than participants — someone's share is 0

export type SplitResult =
  { ok: true; plan: SplitPlan } | { ok: false; error: SplitError };

// Names that mean "me" when typed into the participant list, so entering
// "me, Alex, Sam" works without ticking anything. Case-insensitive.
const SELF_ALIASES = new Set(["me", "myself", "i", "self"]);

export function isSelfAlias(name: string): boolean {
  return SELF_ALIASES.has(name.trim().toLowerCase());
}

// Turn free text ("me, Alex\nSam") into participants: split on commas and
// newlines, trim, drop empties. A self alias is pre-marked as you; the UI may
// still let the user mark a different name (e.g. their own first name) instead.
export function parseParticipants(text: string): SplitParticipant[] {
  return text
    .split(/[,\n]/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((name) => ({ name, isMe: isSelfAlias(name) }));
}

export function planSplit(
  totalCents: number,
  participants: SplitParticipant[],
): SplitResult {
  if (!Number.isInteger(totalCents) || totalCents <= 0) {
    return { ok: false, error: "invalid_total" };
  }

  const named = participants.map((p) => ({ ...p, name: p.name.trim() }));
  if (named.some((p) => p.name.length === 0)) {
    return { ok: false, error: "blank_name" };
  }
  const seen = new Set<string>();
  for (const p of named) {
    const key = p.name.toLowerCase();
    if (seen.has(key)) return { ok: false, error: "duplicate_name" };
    seen.add(key);
  }

  const meCount = named.filter((p) => p.isMe).length;
  if (meCount > 1) return { ok: false, error: "multiple_me" };
  const others = named.filter((p) => !p.isMe);
  if (others.length === 0) return { ok: false, error: "no_one_else" };
  if (totalCents < named.length) {
    return { ok: false, error: "total_too_small" };
  }

  const base = Math.floor(totalCents / named.length);
  let leftover = totalCents - base * named.length; // <= others.length

  const shares = others.map((p) => {
    const extra = leftover > 0 ? 1 : 0;
    leftover -= extra;
    return { name: p.name, amountCents: base + extra };
  });
  const myShareCents = meCount === 1 ? base : 0;

  return { ok: true, plan: { shares, myShareCents } };
}
