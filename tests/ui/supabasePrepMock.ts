import type { Page } from "@playwright/test";
import { format } from "date-fns";

export type PrepEntryRow = {
  id: string;
  entry_type:
    | "algorithm"
    | "system_design"
    | "ml_system_design"
    | "behavioral"
    | "mock_interview"
    | "resume_deep_dive";
  topic: string | null;
  date: string;
  duration_min: number | null;
  time_to_solve_min: number | null;
  outcome: "solved" | "partial" | "failed" | "pass" | "needs_work" | null;
  mock_subtype: "coding" | "system_design" | "ml_system_design" | null;
  notes: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type BehavioralStoryRow = {
  id: string;
  title: string;
  theme: string | null;
  concise_version: string | null;
  extended_version: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

const TODAY = format(new Date(), "yyyy-MM-dd");
const TIMESTAMP = new Date().toISOString();

export function prepEntryRow(
  overrides: Partial<PrepEntryRow> & Pick<PrepEntryRow, "id">,
): PrepEntryRow {
  return {
    entry_type: "algorithm",
    topic: null,
    date: TODAY,
    duration_min: null,
    time_to_solve_min: null,
    outcome: null,
    mock_subtype: null,
    notes: null,
    deleted_at: null,
    created_at: TIMESTAMP,
    updated_at: TIMESTAMP,
    ...overrides,
  };
}

export function storyRow(
  overrides: Partial<BehavioralStoryRow> &
    Pick<BehavioralStoryRow, "id" | "title">,
): BehavioralStoryRow {
  return {
    theme: null,
    concise_version: null,
    extended_version: null,
    deleted_at: null,
    created_at: TIMESTAMP,
    updated_at: TIMESTAMP,
    ...overrides,
  };
}

type TableName = "prep_entries" | "behavioral_stories";

export class FakePrepDb {
  entries: PrepEntryRow[];
  stories: BehavioralStoryRow[];
  private failures: { table: TableName; method: string }[] = [];

  constructor(
    entries: PrepEntryRow[] = [],
    stories: BehavioralStoryRow[] = [],
  ) {
    this.entries = entries;
    this.stories = stories;
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

export async function mockSupabasePrep(page: Page, db: FakePrepDb) {
  await page.route(
    "**/rest/v1/{prep_entries,behavioral_stories}*",
    async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const table: TableName = url.pathname.includes("behavioral_stories")
        ? "behavioral_stories"
        : "prep_entries";
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
        table === "prep_entries" ? db.entries : db.stories
      ) as Record<string, unknown>[];

      if (method === "GET") {
        await respond(filteredRows(rows, url));
        return;
      }

      if (method === "POST") {
        const payload = request.postDataJSON() as Record<string, unknown>;
        const created = {
          id: crypto.randomUUID(),
          deleted_at: null,
          created_at: TIMESTAMP,
          updated_at: TIMESTAMP,
          ...payload,
        };
        rows.push(created);
        await respond([created]);
        return;
      }

      if (method === "PATCH") {
        const payload = request.postDataJSON() as Record<string, unknown>;
        const targets = filteredRows(rows, url);
        for (const target of targets)
          Object.assign(target, payload, { updated_at: TIMESTAMP });
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
