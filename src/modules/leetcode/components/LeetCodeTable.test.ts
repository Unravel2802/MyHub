import { describe, expect, it } from "vitest";
import { sortLeetCodeProblems } from "@/src/modules/leetcode/components/LeetCodeTable";
import type {
  LeetCodeAttempt,
  LeetCodeProblem,
} from "@/src/modules/leetcode/types";

const timestamp = "2026-08-15T00:00:00.000Z";

function problem(id: string, questionNumber: number | null): LeetCodeProblem {
  return {
    id,
    title: id,
    questionNumber,
    difficulty: "medium",
    tags: [],
    notes: null,
    status: "to_review",
    deletedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function attempt(problemId: string, date: string): LeetCodeAttempt {
  return {
    id: `attempt-${problemId}`,
    problemId,
    date,
    timeToSolveMin: null,
    outcome: "solved",
    notes: null,
    solutionCode: null,
    solutionLanguage: null,
    deletedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

const problems = [
  problem("null", null),
  problem("high", 20),
  problem("low", 1),
];
const attempts = new Map([
  ["high", attempt("high", "2026-08-10")],
  ["low", attempt("low", "2026-08-14")],
]);
const attemptStats = (problemId: string) => ({
  count: attempts.has(problemId) ? 1 : 0,
  lastAttempt: attempts.get(problemId) ?? null,
});

describe("sortLeetCodeProblems", () => {
  it("sorts question numbers in both directions with nulls last", () => {
    expect(
      sortLeetCodeProblems(problems, "questionNumber", true, attemptStats).map(
        ({ id }) => id,
      ),
    ).toEqual(["low", "high", "null"]);
    expect(
      sortLeetCodeProblems(problems, "questionNumber", false, attemptStats).map(
        ({ id }) => id,
      ),
    ).toEqual(["high", "low", "null"]);
  });

  it("sorts last-attempted dates in both directions with never-attempted last", () => {
    expect(
      sortLeetCodeProblems(problems, "lastAttempted", true, attemptStats).map(
        ({ id }) => id,
      ),
    ).toEqual(["high", "low", "null"]);
    expect(
      sortLeetCodeProblems(problems, "lastAttempted", false, attemptStats).map(
        ({ id }) => id,
      ),
    ).toEqual(["low", "high", "null"]);
  });
});
