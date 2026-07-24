export type LeetCodeDifficulty = "easy" | "medium" | "hard";

// The board/table view's grouping column, set manually on the problem — not
// derived from attempts. A problem can read 'solved' while its latest attempt
// was 'partial' (e.g. solved on a prior sitting, now being revisited for
// speed); the two are tracked independently on purpose.
export type LeetCodeStatus =
  "to_review" | "in_progress" | "solved" | "needs_revisit";

// Per-attempt outcome. Distinct from LeetCodeStatus — see above.
export type LeetCodeOutcome = "solved" | "partial" | "failed";

export interface LeetCodeProblem {
  id: string;
  title: string;
  // LeetCode's own problem number (e.g. 1 for "Two Sum"), not a link — the
  // simplest thing to type in when logging a problem you just did.
  questionNumber: number | null;
  difficulty: LeetCodeDifficulty;
  // Free-form pattern/topic tags (e.g. "DP", "Two Pointers") — what the
  // table/board filters and groups by, alongside status and difficulty.
  tags: string[];
  notes: string | null;
  status: LeetCodeStatus;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeetCodeAttempt {
  id: string;
  problemId: string;
  // yyyy-MM-dd. The day the attempt happened, not the day it was logged.
  date: string;
  timeToSolveMin: number | null;
  outcome: LeetCodeOutcome;
  // The write-up / post-mortem for this sitting, so past attempts stay
  // reviewable, not just their outcome.
  notes: string | null;
  // User's own solution for this attempt. Render via the existing
  // highlight.js code-pad pattern (CLAUDE.md's "user's own scratchpad text"
  // dangerouslySetInnerHTML exception) — never through Markdown.tsx, and
  // solutionLanguage is always present together with solutionCode or not at
  // all (DB constraint: leetcode_attempts_solution_pair).
  solutionCode: string | null;
  solutionLanguage: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
