import type { Page } from "@playwright/test";

// A small in-memory stand-in for the Supabase `tasks` REST endpoint, so board
// flows can be driven end-to-end without writing to the real database. It only
// emulates the PostgREST features TaskRepository actually uses: eq / is.null /
// in filters, `select`, `order`, and the single-object Accept header.

export type TaskRow = {
  id: string;
  title: string;
  status: "inbox" | "todo" | "in_progress" | "done";
  position: number;
  due_date: string | null;
  parent_task_id: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

const TIMESTAMP = "2026-07-12T00:00:00.000Z";

export function row(
  overrides: Partial<TaskRow> & Pick<TaskRow, "id" | "title">,
): TaskRow {
  return {
    status: "inbox",
    position: 0,
    due_date: null,
    parent_task_id: null,
    deleted_at: null,
    created_at: TIMESTAMP,
    updated_at: TIMESTAMP,
    ...overrides,
  };
}

export class FakeTaskDb {
  rows: TaskRow[];
  // Queue of HTTP methods that should fail once, to exercise rollback paths.
  private failures: string[] = [];

  constructor(rows: TaskRow[] = []) {
    this.rows = rows;
  }

  failNext(method: "POST" | "PATCH") {
    this.failures.push(method);
  }

  takeFailure(method: string): boolean {
    const index = this.failures.indexOf(method);
    if (index === -1) return false;
    this.failures.splice(index, 1);
    return true;
  }
}

const RESERVED_PARAMS = new Set(["select", "order", "limit", "offset"]);

function matchesFilter(value: unknown, expression: string): boolean {
  if (expression === "is.null") return value === null;
  if (expression.startsWith("eq."))
    return String(value) === expression.slice(3);
  if (expression.startsWith("in.(")) {
    const list = expression
      .slice(4, -1)
      .split(",")
      .map((entry) => entry.replace(/^"|"$/g, ""));
    return list.includes(String(value));
  }
  return true;
}

function selectRows(db: FakeTaskDb, url: URL): TaskRow[] {
  const filters = [...url.searchParams.entries()].filter(
    ([key]) => !RESERVED_PARAMS.has(key),
  );

  const matched = db.rows.filter((candidate) =>
    filters.every(([column, expression]) =>
      matchesFilter(candidate[column as keyof TaskRow], expression),
    ),
  );

  const order = url.searchParams.get("order");
  if (order?.startsWith("position")) {
    matched.sort((a, b) => a.position - b.position);
  }

  return matched;
}

export async function mockSupabaseTasks(page: Page, db: FakeTaskDb) {
  await page.route("**/rest/v1/tasks*", async (route) => {
    const request = route.request();
    const method = request.method();

    if (db.takeFailure(method)) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "Simulated database failure" }),
      });
      return;
    }

    const url = new URL(request.url());
    // `.single()` asks PostgREST for a bare object rather than an array.
    const wantsObject = (request.headers()["accept"] ?? "").includes(
      "vnd.pgrst.object+json",
    );

    const respond = async (rows: TaskRow[]) => {
      await route.fulfill({
        status: method === "POST" ? 201 : 200,
        contentType: "application/json",
        body: JSON.stringify(wantsObject ? (rows[0] ?? null) : rows),
      });
    };

    if (method === "GET") {
      await respond(selectRows(db, url));
      return;
    }

    if (method === "POST") {
      const payload = request.postDataJSON() as Partial<TaskRow>;
      const created = row({
        id: crypto.randomUUID(),
        title: payload.title ?? "",
        status: payload.status ?? "inbox",
        position: payload.position ?? 0,
        due_date: payload.due_date ?? null,
        parent_task_id: payload.parent_task_id ?? null,
      });
      db.rows.push(created);
      await respond([created]);
      return;
    }

    if (method === "PATCH") {
      const updates = request.postDataJSON() as Partial<TaskRow>;
      const targets = selectRows(db, url);
      for (const target of targets) {
        Object.assign(target, updates, { updated_at: TIMESTAMP });
      }
      // Without an explicit `select`, postgrest-js expects no representation back.
      if (!url.searchParams.has("select")) {
        await route.fulfill({ status: 204, body: "" });
        return;
      }
      await respond(targets);
      return;
    }

    await route.fulfill({ status: 405, body: "" });
  });
}
