import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  type Row = Record<string, unknown>;
  const tables: Record<string, Row[]> = {
    leetcode_problems: [],
    leetcode_attempts: [],
  };

  class FakeQuery {
    private operation: "select" | "insert" | "update" = "select";
    private payload: Row | null = null;
    private filters: { column: string; value: unknown }[] = [];

    constructor(private table: string) {}

    select() {
      return this;
    }

    insert(payload: Row) {
      this.operation = "insert";
      this.payload = payload;
      return this;
    }

    update(payload: Row) {
      this.operation = "update";
      this.payload = payload;
      return this;
    }

    eq(column: string, value: unknown) {
      this.filters.push({ column, value });
      return this;
    }

    is(column: string, value: unknown) {
      this.filters.push({ column, value });
      return this;
    }

    order() {
      return this;
    }

    private run() {
      if (this.operation === "insert") {
        const now = "2026-07-24T00:00:00.000Z";
        const row = {
          id: crypto.randomUUID(),
          deleted_at: null,
          created_at: now,
          updated_at: now,
          ...this.payload,
        };
        tables[this.table].push(row);
        return [row];
      }

      const matches = tables[this.table].filter((row) =>
        this.filters.every((filter) => row[filter.column] === filter.value),
      );
      if (this.operation === "update") {
        for (const row of matches) Object.assign(row, this.payload);
      }
      return matches;
    }

    single() {
      return Promise.resolve({ data: this.run()[0] ?? null, error: null });
    }

    then(
      resolve: (result: { data: Row[]; error: null }) => unknown,
      reject?: (error: unknown) => unknown,
    ) {
      return Promise.resolve({ data: this.run(), error: null }).then(
        resolve,
        reject,
      );
    }
  }

  return {
    from: (table: string) => new FakeQuery(table),
    seed: (table: string, rows: Row[]) =>
      tables[table].push(...rows.map((row) => ({ ...row }))),
    rows: (table: string) => tables[table],
    reset: () => {
      tables.leetcode_problems = [];
      tables.leetcode_attempts = [];
    },
  };
});

vi.mock("@/src/lib/supabaseClient", () => ({ supabase: { from: h.from } }));

import * as LeetCodeRepository from "@/src/modules/leetcode/LeetCodeRepository";

const timestamp = "2026-07-24T00:00:00.000Z";

function problemRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "problem-1",
    title: "Two Sum",
    question_number: 1,
    difficulty: "easy",
    tags: ["array", "hash-table"],
    status: "to_review",
    deleted_at: null,
    created_at: timestamp,
    updated_at: timestamp,
    ...overrides,
  };
}

function attemptRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "attempt-1",
    problem_id: "problem-1",
    date: "2026-07-24",
    time_to_solve_min: 20,
    outcome: "solved",
    notes: "Used a hash map",
    solution_code: "def two_sum(...): ...",
    solution_language: "python",
    deleted_at: null,
    created_at: timestamp,
    updated_at: timestamp,
    ...overrides,
  };
}

beforeEach(() => h.reset());

describe("LeetCodeRepository problems", () => {
  it("loads and maps active problems", async () => {
    h.seed("leetcode_problems", [
      problemRow(),
      problemRow({ id: "deleted", deleted_at: timestamp }),
    ]);

    await expect(LeetCodeRepository.getProblems()).resolves.toEqual([
      expect.objectContaining({
        id: "problem-1",
        title: "Two Sum",
        difficulty: "easy",
        tags: ["array", "hash-table"],
        status: "to_review",
      }),
    ]);
  });

  it("creates and updates a problem using database column names", async () => {
    const created = await LeetCodeRepository.createProblem({
      title: "3Sum",
      difficulty: "medium",
      tags: ["array", "two-pointers"],
    });

    expect(created).toMatchObject({ title: "3Sum", difficulty: "medium" });

    const updated = await LeetCodeRepository.updateProblem(created.id, {
      status: "solved",
    });
    expect(updated).toMatchObject({ status: "solved" });
  });

  it("soft-deletes problems", async () => {
    h.seed("leetcode_problems", [problemRow()]);

    await LeetCodeRepository.deleteProblem("problem-1");

    expect(h.rows("leetcode_problems")[0].deleted_at).toEqual(
      expect.any(String),
    );
  });
});

describe("LeetCodeRepository attempts", () => {
  it("loads and maps active attempts", async () => {
    h.seed("leetcode_attempts", [
      attemptRow(),
      attemptRow({ id: "deleted", deleted_at: timestamp }),
    ]);

    await expect(LeetCodeRepository.getAttempts()).resolves.toEqual([
      expect.objectContaining({
        id: "attempt-1",
        problemId: "problem-1",
        outcome: "solved",
        solutionCode: "def two_sum(...): ...",
        solutionLanguage: "python",
      }),
    ]);
  });

  it("creates an attempt, defaulting date to today when omitted", async () => {
    const created = await LeetCodeRepository.createAttempt({
      problemId: "problem-1",
      outcome: "partial",
      timeToSolveMin: 35,
    });

    expect(created).toMatchObject({
      problemId: "problem-1",
      outcome: "partial",
      timeToSolveMin: 35,
    });
    expect(created.date).toEqual(expect.any(String));
  });

  it("updates and soft-deletes an attempt", async () => {
    h.seed("leetcode_attempts", [attemptRow()]);

    const updated = await LeetCodeRepository.updateAttempt("attempt-1", {
      outcome: "solved",
      notes: "Cleaner on the second pass",
    });
    expect(updated).toMatchObject({
      outcome: "solved",
      notes: "Cleaner on the second pass",
    });

    await LeetCodeRepository.deleteAttempt("attempt-1");
    expect(h.rows("leetcode_attempts")[0].deleted_at).toEqual(
      expect.any(String),
    );
  });
});
