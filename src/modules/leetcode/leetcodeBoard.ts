import { differenceInCalendarDays, format, parseISO } from "date-fns";
import type {
  LeetCodeAttempt,
  LeetCodeDifficulty,
  LeetCodeProblem,
  LeetCodeStatus,
} from "@/src/modules/leetcode/types";

// Fixed column order for the Notion-style status board — not derived from
// data, so an empty column still renders in the right place.
export const LEETCODE_STATUSES: LeetCodeStatus[] = [
  "to_review",
  "in_progress",
  "solved",
  "needs_revisit",
];

// Groups problems into board columns by their manual `status`. Every column
// in LEETCODE_STATUSES is present in the result, even if empty, so the board
// doesn't need to special-case a missing key.
export function groupByStatus(
  problems: LeetCodeProblem[],
): Record<LeetCodeStatus, LeetCodeProblem[]> {
  const groups = Object.fromEntries(
    LEETCODE_STATUSES.map((status) => [status, [] as LeetCodeProblem[]]),
  ) as Record<LeetCodeStatus, LeetCodeProblem[]>;

  for (const problem of problems) {
    groups[problem.status].push(problem);
  }
  return groups;
}

// All attempts for one problem, most recent first. `attempts` is assumed
// already sorted most-recent-first (LeetCodeRepository.getAttempts's order),
// so this just filters rather than re-sorting.
export function attemptsForProblem(
  attempts: LeetCodeAttempt[],
  problemId: string,
): LeetCodeAttempt[] {
  return attempts.filter((attempt) => attempt.problemId === problemId);
}

// Attempt count/recency is computed rather than stored, so it is always
// derived from attempt rows and never duplicated onto leetcode_problems.
export function attemptStats(
  attempts: LeetCodeAttempt[],
  problemId: string,
): { count: number; lastAttempt: LeetCodeAttempt | null } {
  const forProblem = attemptsForProblem(attempts, problemId);
  return { count: forProblem.length, lastAttempt: forProblem[0] ?? null };
}

// Total minutes logged across attempts, optionally scoped to attempts on or
// after fromDate (yyyy-MM-dd, inclusive) — feeds Prep Tracker's time
// allocation (prepAllocation.ts's additionalAlgorithmMinutes). Attempts with
// a null timeToSolveMin contribute 0 but still count as logged.
export function totalAttemptTimeMin(
  attempts: LeetCodeAttempt[],
  fromDate?: string,
): number {
  return attempts
    .filter((attempt) => fromDate === undefined || attempt.date >= fromDate)
    .reduce((total, attempt) => total + (attempt.timeToSolveMin ?? 0), 0);
}

// Problems added within a given yyyy-MM month, bucketed by createdAt (a
// problem has no separate "date done" — adding it to the tracker IS the rep,
// mirroring how Prep Tracker's algorithm reps used to work). Mirrors
// prepScorecard.ts's monthOf/entriesInMonth.
export function problemCountInMonth(
  problems: LeetCodeProblem[],
  month: string,
): number {
  return problems.filter((problem) => problem.createdAt.slice(0, 7) === month)
    .length;
}

// Problems added on or before a given yyyy-MM-dd date. Mirrors
// prepScorecard.ts's cumulativeCountsByType.
export function problemCountThrough(
  problems: LeetCodeProblem[],
  throughDate: string,
): number {
  return problems.filter(
    (problem) => problem.createdAt.slice(0, 10) <= throughDate,
  ).length;
}

// One section of the table's day-grouped view: the problems whose LAST
// attempt fell on `date`, plus a summary strip computed from exactly those
// rows. A problem attempted on Oct 6 and again on Oct 7 lives under Oct 7
// only, and Oct 6's header doesn't count it — the header always agrees with
// the rows under it, never with a fuller "everything logged that day" tally.
export interface LeetCodeDayGroup {
  // yyyy-MM-dd, or null for the trailing group of never-attempted problems.
  date: string | null;
  // "Today", "Yesterday", "Mon, Oct 6", "Mon, Oct 6, 2025" (other years), or
  // "Not attempted" for the null group.
  label: string;
  // Rows in the order they arrived — grouping never re-sorts.
  problems: LeetCodeProblem[];
  byDifficulty: Record<LeetCodeDifficulty, number>;
  byStatus: Record<LeetCodeStatus, number>;
  // Minutes across every attempt these problems logged ON `date` (a problem
  // done twice that day counts both sittings). Null-time attempts add 0.
  // Always 0 for the "Not attempted" group.
  timeMin: number;
}

// Header label for a yyyy-MM-dd day relative to `today` (also yyyy-MM-dd,
// the viewer's local date — passed in rather than read from the clock so
// this stays pure). Both strings are parsed as local midnights, so the
// day difference is a calendar-day count with no timezone drift.
export function dayLabel(date: string, today: string): string {
  const day = parseISO(date);
  const now = parseISO(today);
  const diff = differenceInCalendarDays(now, day);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return format(
    day,
    day.getFullYear() === now.getFullYear() ? "EEE, MMM d" : "EEE, MMM d, yyyy",
  );
}

// Splits an ALREADY SORTED, already filtered problem list into per-day
// sections keyed by each problem's last attempt date. Only meaningful when
// the table is sorted by last-attempted (either direction); the caller
// decides that and falls back to the flat table otherwise. Groups appear in
// first-seen order, so the sort direction carries through; the
// never-attempted group is always last regardless of where its rows sat,
// matching sortLeetCodeProblems's nulls-last rule.
export function groupByLastAttemptDay(
  problems: LeetCodeProblem[],
  attempts: LeetCodeAttempt[],
  today: string,
): LeetCodeDayGroup[] {
  const lastDate = new Map<string, string>();
  for (const attempt of attempts) {
    const current = lastDate.get(attempt.problemId);
    if (current === undefined || attempt.date > current) {
      lastDate.set(attempt.problemId, attempt.date);
    }
  }

  const groups = new Map<string | null, LeetCodeDayGroup>();
  for (const problem of problems) {
    const date = lastDate.get(problem.id) ?? null;
    let group = groups.get(date);
    if (!group) {
      group = {
        date,
        label: date === null ? "Not attempted" : dayLabel(date, today),
        problems: [],
        byDifficulty: { easy: 0, medium: 0, hard: 0 },
        byStatus: Object.fromEntries(
          LEETCODE_STATUSES.map((status) => [status, 0]),
        ) as Record<LeetCodeStatus, number>,
        timeMin: 0,
      };
      groups.set(date, group);
    }
    group.problems.push(problem);
    group.byDifficulty[problem.difficulty] += 1;
    group.byStatus[problem.status] += 1;
  }

  // Only rows actually shown contribute time — a problem hidden by the
  // table's filters must not leak minutes into its day's header.
  const shown = new Set(problems.map((problem) => problem.id));
  for (const attempt of attempts) {
    const date = lastDate.get(attempt.problemId);
    if (!shown.has(attempt.problemId) || attempt.date !== date) continue;
    groups.get(date)!.timeMin += attempt.timeToSolveMin ?? 0;
  }

  const ordered = [...groups.values()];
  const unattempted = ordered.findIndex((group) => group.date === null);
  if (unattempted !== -1) ordered.push(...ordered.splice(unattempted, 1));
  return ordered;
}
