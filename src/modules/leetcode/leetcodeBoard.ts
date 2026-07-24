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

// The table view's "Attempts" and "Last attempt" columns, computed rather
// than stored — a problem's attempt count/recency is always derived from its
// attempt rows, never duplicated onto leetcode_problems.
export function attemptStats(
  attempts: LeetCodeAttempt[],
  problemId: string,
): { count: number; lastAttempt: LeetCodeAttempt | null } {
  const forProblem = attemptsForProblem(attempts, problemId);
  return { count: forProblem.length, lastAttempt: forProblem[0] ?? null };
}

// Attempts logged within a given yyyy-MM month. Mirrors prepScorecard.ts's
// monthOf/entriesInMonth — used by Prep Tracker's monthly "Algorithms" count,
// which counts a LeetCode attempt as an algorithm rep same as a logged
// prep_entries row.
export function attemptCountInMonth(
  attempts: LeetCodeAttempt[],
  month: string,
): number {
  return attempts.filter((attempt) => attempt.date.slice(0, 7) === month)
    .length;
}

// Attempts on or before a given yyyy-MM-dd date. Mirrors prepScorecard.ts's
// cumulativeCountsByType — used by Prep Tracker's cumulative checkpoint
// progress (prepTargets.ts).
export function attemptCountThrough(
  attempts: LeetCodeAttempt[],
  throughDate: string,
): number {
  return attempts.filter((attempt) => attempt.date <= throughDate).length;
}
