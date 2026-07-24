import { describe, expect, it } from "vitest";
import {
  LEETCODE_STATUSES,
  attemptCountInMonth,
  attemptCountThrough,
  attemptStats,
  attemptsForProblem,
  groupByStatus,
} from "@/src/modules/leetcode/leetcodeBoard";
import type {
  LeetCodeAttempt,
  LeetCodeProblem,
} from "@/src/modules/leetcode/types";

const timestamp = "2026-07-24T00:00:00.000Z";

function problem(overrides: Partial<LeetCodeProblem> = {}): LeetCodeProblem {
  return {
    id: "p1",
    title: "Two Sum",
    questionNumber: null,
    difficulty: "easy",
    tags: [],
    status: "to_review",
    deletedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

function attempt(overrides: Partial<LeetCodeAttempt> = {}): LeetCodeAttempt {
  return {
    id: "a1",
    problemId: "p1",
    date: "2026-07-24",
    timeToSolveMin: 20,
    outcome: "solved",
    notes: null,
    solutionCode: null,
    solutionLanguage: null,
    deletedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

describe("groupByStatus", () => {
  it("includes every status column, even when empty", () => {
    const groups = groupByStatus([]);
    expect(Object.keys(groups).sort()).toEqual([...LEETCODE_STATUSES].sort());
    expect(groups.solved).toEqual([]);
  });

  it("buckets problems by their status", () => {
    const p1 = problem({ id: "p1", status: "to_review" });
    const p2 = problem({ id: "p2", status: "solved" });
    const p3 = problem({ id: "p3", status: "solved" });

    const groups = groupByStatus([p1, p2, p3]);

    expect(groups.to_review).toEqual([p1]);
    expect(groups.solved).toEqual([p2, p3]);
    expect(groups.in_progress).toEqual([]);
    expect(groups.needs_revisit).toEqual([]);
  });
});

describe("attemptsForProblem", () => {
  it("filters attempts to the given problem", () => {
    const a1 = attempt({ id: "a1", problemId: "p1" });
    const a2 = attempt({ id: "a2", problemId: "p2" });
    const a3 = attempt({ id: "a3", problemId: "p1" });

    expect(attemptsForProblem([a1, a2, a3], "p1")).toEqual([a1, a3]);
  });
});

describe("attemptStats", () => {
  it("counts attempts and reports the most recent as first-in-order", () => {
    const latest = attempt({ id: "latest", date: "2026-07-24" });
    const older = attempt({ id: "older", date: "2026-07-01" });

    // Assumes caller passes attempts already sorted most-recent-first, as
    // LeetCodeRepository.getAttempts returns them.
    const stats = attemptStats([latest, older], "p1");

    expect(stats.count).toBe(2);
    expect(stats.lastAttempt).toEqual(latest);
  });

  it("reports zero/null for a problem with no attempts", () => {
    const stats = attemptStats([attempt({ problemId: "other" })], "p1");
    expect(stats).toEqual({ count: 0, lastAttempt: null });
  });
});

describe("attemptCountInMonth", () => {
  it("counts only attempts within the given month", () => {
    const attempts = [
      attempt({ id: "a1", date: "2026-07-01" }),
      attempt({ id: "a2", date: "2026-07-24" }),
      attempt({ id: "a3", date: "2026-08-01" }),
    ];

    expect(attemptCountInMonth(attempts, "2026-07")).toBe(2);
    expect(attemptCountInMonth(attempts, "2026-08")).toBe(1);
    expect(attemptCountInMonth(attempts, "2026-09")).toBe(0);
  });
});

describe("attemptCountThrough", () => {
  it("counts only attempts on or before the given date", () => {
    const attempts = [
      attempt({ id: "a1", date: "2026-07-01" }),
      attempt({ id: "a2", date: "2026-07-24" }),
      attempt({ id: "a3", date: "2026-08-01" }),
    ];

    expect(attemptCountThrough(attempts, "2026-07-24")).toBe(2);
    expect(attemptCountThrough(attempts, "2026-06-30")).toBe(0);
  });
});
