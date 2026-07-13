import { addDays, endOfMonth, format, startOfWeek } from "date-fns";
import type { Application } from "@/src/modules/jobApplications/types";
import type { PrepEntry } from "@/src/modules/prep/types";
import type { OutreachEntry } from "@/src/modules/outreach/types";
import { weeklyCadence } from "@/src/modules/dashboard/dashboardSelectors";
import type { WeeklyCadence } from "@/src/modules/dashboard/dashboardSelectors";
import { monthOf, scorecardFor } from "@/src/modules/prep/prepScorecard";
import type { Scorecard } from "@/src/modules/prep/prepScorecard";
import {
  activeCheckpoint,
  progressTowardCheckpoint,
} from "@/src/modules/prep/prepTargets";
import type { CheckpointProgress } from "@/src/modules/prep/prepTargets";

// Pure logic for the Weekly Review ritual (myhub_plan.md Part B, Phase 6).
//
// Note the imports above: this composes selectors that already exist in
// dashboard and prep rather than reimplementing the same math a third time.
// These are PURE cross-module imports (no repository, no store), which is the
// same shape useDashboardStore already relies on for prepScorecard/prepTargets.
// Rule 1 forbids reaching into another module's INTERNALS — a tested pure
// function that's already the single source of truth for "how many applications
// this week" is exactly what should be reused, not copied.

// The Monday of the week containing `date`. Same convention as
// dashboardSelectors.weekBounds and taskRecurrence — Monday-start, everywhere.
export function weekStartOf(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 1 });
}

export function weekStartKeyOf(date: Date): string {
  return format(weekStartOf(date), "yyyy-MM-dd");
}

// §15's review questions are QUARTERLY, and the ritual is weekly — so exactly
// one week per quarter has to carry them. The rule: the week that CONTAINS the
// last day of March, June, September, or December.
//
// Anchoring on "contains the quarter's final day" rather than "the first week
// of the new quarter" matters at the boundary: 2026-12-31 falls in the week of
// Mon 2026-12-28, which also contains January 1st. That week is the one that
// closes out Q4, so it's the one that asks the questions — and it asks them
// once, not twice, even though it straddles two quarters and two years.
export function isQuarterBoundaryWeek(weekStart: Date): boolean {
  const monday = weekStartOf(weekStart);
  const sunday = addDays(monday, 6);

  // Compare CALENDAR DAYS as yyyy-MM-dd strings, not Date instants. Comparing
  // instants is subtly broken here: endOfMonth() returns 23:59:59.999 while the
  // week bounds inherit the caller's time-of-day, so a quarter-end falling on
  // the week's own Sunday would compare as AFTER that Sunday and be missed
  // entirely. Same discipline the rest of the codebase uses for date columns.
  const mondayKey = format(monday, "yyyy-MM-dd");
  const sundayKey = format(sunday, "yyyy-MM-dd");

  for (const month of [2, 5, 8, 11]) {
    // Check the quarter-ends of every year the week touches — a week spanning
    // New Year's touches two.
    for (const year of new Set([monday.getFullYear(), sunday.getFullYear()])) {
      const quarterEndKey = format(
        endOfMonth(new Date(year, month, 1)),
        "yyyy-MM-dd",
      );
      if (quarterEndKey >= mondayKey && quarterEndKey <= sundayKey) return true;
    }
  }

  return false;
}

// The five §15 questions, verbatim from engineering_first_roadmap_v2.md.
// Verbatim on purpose: paraphrasing them would quietly soften what they're
// asking, and their bite is the whole point.
export const QUARTERLY_QUESTIONS = [
  "Am I becoming more technically rare?",
  "Is my project actually deep, or just wide?",
  "Is my application funnel active enough given no VSF referral network?",
  "Am I investing consistently once income starts?",
  "Is the quant hobby staying a hobby, or quietly eating planned time?",
] as const;

// The week's numbers, frozen at save time (see migration 0011's comment on why
// this is stored rather than recomputed).
export interface WeeklyReviewSnapshot {
  cadence: WeeklyCadence;
  scorecard: Scorecard;
  checkpoint: CheckpointProgress;
}

export function buildSnapshot(
  applications: Application[],
  outreachEntries: OutreachEntry[],
  prepEntries: PrepEntry[],
  today: Date,
): WeeklyReviewSnapshot {
  const todayKey = format(today, "yyyy-MM-dd");

  return {
    cadence: weeklyCadence(applications, outreachEntries, prepEntries, today),
    scorecard: scorecardFor(prepEntries, monthOf(todayKey)),
    checkpoint: progressTowardCheckpoint(
      prepEntries,
      activeCheckpoint(todayKey),
    ),
  };
}
