import type { Page } from "@playwright/test";

export type LeetCodeProblemRow = {
  id: string;
  title: string;
  url: string | null;
  difficulty: "easy" | "medium" | "hard";
  tags: string[];
  status: "to_review" | "in_progress" | "solved" | "needs_revisit";
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type LeetCodeAttemptRow = {
  id: string;
  problem_id: string;
  date: string;
  time_to_solve_min: number | null;
  outcome: "solved" | "partial" | "failed";
  notes: string | null;
  solution_code: string | null;
  solution_language: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

type TableName = "leetcode_problems" | "leetcode_attempts";

const STAMP = "2026-07-24T00:00:00.000Z";

export function leetCodeProblemRow(
  overrides: Partial<LeetCodeProblemRow> &
    Pick<LeetCodeProblemRow, "id" | "title">,
): LeetCodeProblemRow {
  return {
    url: null,
    difficulty: "medium",
    tags: [],
    status: "to_review",
    deleted_at: null,
    created_at: STAMP,
    updated_at: STAMP,
    ...overrides,
  };
}

export function leetCodeAttemptRow(
  overrides: Partial<LeetCodeAttemptRow> &
    Pick<LeetCodeAttemptRow, "id" | "problem_id">,
): LeetCodeAttemptRow {
  return {
    date: "2026-07-24",
    time_to_solve_min: null,
    outcome: "solved",
    notes: null,
    solution_code: null,
    solution_language: null,
    deleted_at: null,
    created_at: STAMP,
    updated_at: STAMP,
    ...overrides,
  };
}

export class FakeLeetCodeDb {
  problems: LeetCodeProblemRow[];
  attempts: LeetCodeAttemptRow[];
  private failures: { table: TableName; method: string }[] = [];

  constructor(
    problems: LeetCodeProblemRow[] = [],
    attempts: LeetCodeAttemptRow[] = [],
  ) {
    this.problems = problems;
    this.attempts = attempts;
  }

  failNext(table: TableName, method: "POST" | "PATCH") {
    this.failures.push({ table, method });
  }

  takeFailure(table: TableName, method: string) {
    const index = this.failures.findIndex(
      (failure) => failure.table === table && failure.method === method,
    );
    if (index === -1) return false;
    this.failures.splice(index, 1);
    return true;
  }
}

const RESERVED_PARAMS = new Set(["select", "order", "limit", "offset"]);

function matches(value: unknown, expression: string) {
  if (expression === "is.null") return value === null;
  if (expression.startsWith("eq.")) {
    return String(value) === expression.slice(3);
  }
  return true;
}

function filteredRows<T extends Record<string, unknown>>(rows: T[], url: URL) {
  const filters = [...url.searchParams.entries()].filter(
    ([key]) => !RESERVED_PARAMS.has(key),
  );
  return rows.filter((row) =>
    filters.every(([column, expression]) => matches(row[column], expression)),
  );
}

export async function mockSupabaseLeetCode(page: Page, db: FakeLeetCodeDb) {
  await page.route(
    "**/rest/v1/{leetcode_problems,leetcode_attempts}*",
    async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const table: TableName = url.pathname.includes("leetcode_attempts")
        ? "leetcode_attempts"
        : "leetcode_problems";
      const method = request.method();

      if (db.takeFailure(table, method)) {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ message: "Simulated database failure" }),
        });
        return;
      }

      const wantsObject = (request.headers()["accept"] ?? "").includes(
        "vnd.pgrst.object+json",
      );
      const respond = async (rows: Record<string, unknown>[]) => {
        await route.fulfill({
          status: method === "POST" ? 201 : 200,
          contentType: "application/json",
          body: JSON.stringify(wantsObject ? (rows[0] ?? null) : rows),
        });
      };
      const rows = (
        table === "leetcode_problems" ? db.problems : db.attempts
      ) as Record<string, unknown>[];

      if (method === "GET") {
        const matched = filteredRows(rows, url);
        if (table === "leetcode_attempts") {
          matched.sort((left, right) =>
            String(right.date).localeCompare(String(left.date)),
          );
        } else {
          matched.sort((left, right) =>
            String(right.created_at).localeCompare(String(left.created_at)),
          );
        }
        await respond(matched);
        return;
      }

      if (method === "POST") {
        const payload = request.postDataJSON() as Record<string, unknown>;
        const created = {
          id: crypto.randomUUID(),
          deleted_at: null,
          created_at: STAMP,
          updated_at: STAMP,
          ...payload,
        };
        rows.push(created);
        await respond([created]);
        return;
      }

      if (method === "PATCH") {
        const payload = request.postDataJSON() as Record<string, unknown>;
        const targets = filteredRows(rows, url);
        for (const target of targets) {
          Object.assign(target, payload, { updated_at: STAMP });
        }
        if (!url.searchParams.has("select")) {
          await route.fulfill({ status: 204, body: "" });
          return;
        }
        await respond(targets);
        return;
      }

      await route.fulfill({ status: 405, body: "" });
    },
  );
}
