import type {
  LeetCodeAttempt,
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

// Total minutes spent across problems, optionally scoped to problems added on
// or after fromDate (yyyy-MM-dd, inclusive) — mirrors prepAllocation.ts's
// timeAllocation's own fromDate scoping. Problems with a null timeMin
// contribute 0 but still count as logged, matching prepAllocation's treatment
// of a null durationMin.
export function totalTimeMin(
  problems: LeetCodeProblem[],
  fromDate?: string,
): number {
  return problems
    .filter(
      (problem) =>
        fromDate === undefined || problem.createdAt.slice(0, 10) >= fromDate,
    )
    .reduce((total, problem) => total + (problem.timeMin ?? 0), 0);
}
