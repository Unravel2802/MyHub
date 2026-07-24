import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  LeetCodeAttempt,
  LeetCodeProblem,
} from "@/src/modules/leetcode/types";

vi.mock("@/src/modules/leetcode/LeetCodeRepository", () => ({
  getProblems: vi.fn(),
  createProblem: vi.fn(),
  updateProblem: vi.fn(),
  deleteProblem: vi.fn(),
  getAttempts: vi.fn(),
  createAttempt: vi.fn(),
  updateAttempt: vi.fn(),
  deleteAttempt: vi.fn(),
}));

vi.mock("@/src/lib/events", () => ({ emit: vi.fn() }));

import * as LeetCodeRepository from "@/src/modules/leetcode/LeetCodeRepository";
import { emit } from "@/src/lib/events";
import { useLeetCodeStore } from "@/src/modules/leetcode/useLeetCodeStore";

const repository = vi.mocked(LeetCodeRepository);
const emitMock = vi.mocked(emit);

function problem(
  overrides: Partial<LeetCodeProblem> & { id: string },
): LeetCodeProblem {
  return {
    title: "Two Sum",
    url: "https://leetcode.com/problems/two-sum/",
    difficulty: "easy",
    tags: ["Array"],
    status: "to_review",
    deletedAt: null,
    createdAt: "2026-07-24T00:00:00.000Z",
    updatedAt: "2026-07-24T00:00:00.000Z",
    ...overrides,
  };
}

function attempt(
  overrides: Partial<LeetCodeAttempt> & { id: string },
): LeetCodeAttempt {
  return {
    problemId: "problem",
    date: "2026-07-24",
    timeToSolveMin: 20,
    outcome: "solved",
    notes: null,
    solutionCode: null,
    solutionLanguage: null,
    deletedAt: null,
    createdAt: "2026-07-24T00:00:00.000Z",
    updatedAt: "2026-07-24T00:00:00.000Z",
    ...overrides,
  };
}

function reset(
  problems: LeetCodeProblem[] = [],
  attempts: LeetCodeAttempt[] = [],
) {
  useLeetCodeStore.setState({
    problems,
    attempts,
    isLoading: false,
    error: null,
    isCreating: false,
    pendingIds: [],
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  reset();
});

describe("useLeetCodeStore problems", () => {
  it("loads problems", async () => {
    const problems = [problem({ id: "problem" })];
    repository.getProblems.mockResolvedValue(problems);

    await useLeetCodeStore.getState().fetchProblems();

    expect(useLeetCodeStore.getState()).toMatchObject({
      problems,
      isLoading: false,
      error: null,
    });
  });

  it("replaces an optimistic problem after create", async () => {
    const created = problem({ id: "created" });
    repository.createProblem.mockResolvedValue(created);

    await useLeetCodeStore.getState().createProblem({
      title: "Two Sum",
      difficulty: "easy",
      tags: ["Array"],
    });

    expect(useLeetCodeStore.getState().problems).toEqual([created]);
    expect(useLeetCodeStore.getState().isCreating).toBe(false);
  });

  it("optimistically updates a problem and tracks its pending id", async () => {
    const existing = problem({ id: "problem" });
    const updated = { ...existing, status: "solved" as const };
    reset([existing]);
    let resolveUpdate: ((value: LeetCodeProblem) => void) | undefined;
    repository.updateProblem.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveUpdate = resolve;
        }),
    );

    const request = useLeetCodeStore
      .getState()
      .updateProblem("problem", { status: "solved" });

    expect(useLeetCodeStore.getState().problems[0].status).toBe("solved");
    expect(useLeetCodeStore.getState().pendingIds).toEqual(["problem"]);

    resolveUpdate?.(updated);
    await request;

    expect(useLeetCodeStore.getState().problems).toEqual([updated]);
    expect(useLeetCodeStore.getState().pendingIds).toEqual([]);
  });

  it("rolls back a failed problem update", async () => {
    const existing = problem({ id: "problem" });
    reset([existing]);
    repository.updateProblem.mockRejectedValue(new Error("offline"));

    await useLeetCodeStore
      .getState()
      .updateProblem("problem", { status: "solved" });

    expect(useLeetCodeStore.getState().problems).toEqual([existing]);
    expect(useLeetCodeStore.getState().error).toBe(
      "Something went wrong, please try again later.",
    );
    expect(useLeetCodeStore.getState().pendingIds).toEqual([]);
  });

  it("rolls back a failed problem delete", async () => {
    const existing = problem({ id: "problem" });
    reset([existing]);
    repository.deleteProblem.mockRejectedValue(new Error("offline"));

    await useLeetCodeStore.getState().deleteProblem("problem");

    expect(useLeetCodeStore.getState().problems).toEqual([existing]);
    expect(useLeetCodeStore.getState().pendingIds).toEqual([]);
  });
});

describe("useLeetCodeStore attempts", () => {
  it("loads attempts", async () => {
    const attempts = [attempt({ id: "attempt" })];
    repository.getAttempts.mockResolvedValue(attempts);

    await useLeetCodeStore.getState().fetchAttempts();

    expect(useLeetCodeStore.getState().attempts).toEqual(attempts);
  });

  it("replaces an optimistic attempt and emits attempt_logged", async () => {
    const created = attempt({ id: "created", outcome: "partial" });
    repository.createAttempt.mockResolvedValue(created);

    await useLeetCodeStore.getState().createAttempt({
      problemId: "problem",
      outcome: "partial",
    });

    expect(useLeetCodeStore.getState().attempts).toEqual([created]);
    expect(emitMock).toHaveBeenCalledWith({
      type: "leetcode.attempt_logged",
      payload: {
        attemptId: "created",
        problemId: "problem",
        outcome: "partial",
      },
      timestamp: expect.any(Number),
    });
  });

  it("rolls back a failed attempt create without emitting", async () => {
    const existing = attempt({ id: "existing" });
    reset([], [existing]);
    repository.createAttempt.mockRejectedValue(new Error("offline"));

    await useLeetCodeStore.getState().createAttempt({
      problemId: "problem",
      outcome: "failed",
    });

    expect(useLeetCodeStore.getState().attempts).toEqual([existing]);
    expect(useLeetCodeStore.getState().error).toBe(
      "Something went wrong, please try again later.",
    );
    expect(emitMock).not.toHaveBeenCalled();
  });

  it("rolls back failed attempt updates and deletes", async () => {
    const existing = attempt({ id: "attempt" });
    reset([], [existing]);
    repository.updateAttempt.mockRejectedValue(new Error("offline"));
    repository.deleteAttempt.mockRejectedValue(new Error("offline"));

    await useLeetCodeStore
      .getState()
      .updateAttempt("attempt", { outcome: "failed" });
    expect(useLeetCodeStore.getState().attempts).toEqual([existing]);

    await useLeetCodeStore.getState().deleteAttempt("attempt");
    expect(useLeetCodeStore.getState().attempts).toEqual([existing]);
    expect(useLeetCodeStore.getState().pendingIds).toEqual([]);
  });

  it("derives status groups, attempts, and stats", () => {
    const first = problem({ id: "first", status: "solved" });
    const second = problem({ id: "second", status: "to_review" });
    const newest = attempt({ id: "newest", problemId: "first" });
    const older = attempt({
      id: "older",
      problemId: "first",
      date: "2026-07-20",
    });
    reset([first, second], [newest, older]);

    expect(useLeetCodeStore.getState().groupByStatus().solved).toEqual([first]);
    expect(useLeetCodeStore.getState().attemptsForProblem("first")).toEqual([
      newest,
      older,
    ]);
    expect(useLeetCodeStore.getState().attemptStats("first")).toEqual({
      count: 2,
      lastAttempt: newest,
    });
  });
});
