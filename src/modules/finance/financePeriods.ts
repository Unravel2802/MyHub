import { endOfMonth, format, startOfMonth } from "date-fns";

// The yyyy-MM key of the month a date belongs to. Via date-fns format(), NOT
// date.toISOString().slice(0, 7) — the latter reads the UTC month, so a date at
// 11pm on the 31st in UTC+7 would be filed under the wrong month. This bug class
// has bitten the streak and roadmap code before; don't reintroduce it.
export function monthKeyOf(date: Date): string {
  return format(date, "yyyy-MM");
}

// yyyy-MM-dd bounds (inclusive) of the month containing `date`.
export function monthBounds(date: Date): { firstDay: string; lastDay: string } {
  return {
    firstDay: format(startOfMonth(date), "yyyy-MM-dd"),
    lastDay: format(endOfMonth(date), "yyyy-MM-dd"),
  };
}

// Whether an occurred_on (yyyy-MM-dd) falls in the same month as `date`. String
// comparison is safe because both sides are zero-padded ISO dates.
export function isInMonth(occurredOn: string, date: Date): boolean {
  const { firstDay, lastDay } = monthBounds(date);
  return occurredOn >= firstDay && occurredOn <= lastDay;
}
