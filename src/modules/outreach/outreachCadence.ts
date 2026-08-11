import { isInWeekOf } from "@/src/lib/week";
import type { OutreachEntry } from "@/src/modules/outreach/types";

// The roadmap's weekly outreach target (§11.2): 2-3 conversations a week.
// Owned here, by the module that logs the conversations, rather than read from
// Dashboard's WEEKLY_OUTREACH_TARGET — Dashboard aggregates ACROSS modules, so
// depending on it from inside one of them inverts the layering.
export const WEEKLY_OUTREACH_TARGET = { min: 2, max: 3 } as const;

// Conversations logged in the Monday-start week containing `today`.
//
// Counted by `date` (the day the conversation happened), not createdAt (the
// day it was typed in) — logging Friday's coffee chat on Sunday should still
// count toward Friday's week, which is the whole reason the column exists.
export function outreachCountThisWeek(
  entries: OutreachEntry[],
  today: Date,
): number {
  return entries.filter(
    (entry) => !entry.deletedAt && isInWeekOf(entry.date, today),
  ).length;
}
