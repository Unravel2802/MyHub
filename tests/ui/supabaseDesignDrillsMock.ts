import type { Page } from "@playwright/test";

export type DesignDrillRow = {
  id: string;
  slug: string;
  category: "system_design" | "ml_system_design";
  difficulty: "warmup" | "core" | "advanced";
  title: string;
  prompt: string;
  rubric: string[];
  solution: string;
  estimated_minutes: number;
  tags: string[];
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DesignDrillAttemptRow = {
  id: string;
  drill_id: string;
  started_at: string;
  completed_at: string | null;
  duration_sec: number | null;
  notes: string | null;
  rubric_hits: number[];
  self_rating: "strong" | "solid" | "weak" | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

type TableName = "design_drills" | "design_drill_attempts";
type Method = "POST" | "PATCH";

const timestamp = () => new Date().toISOString();

export function designDrillRow(
  overrides: Partial<DesignDrillRow> & Pick<DesignDrillRow, "id" | "title">,
): DesignDrillRow {
  const now = timestamp();
  return {
    slug: overrides.id,
    category: "system_design",
    difficulty: "warmup",
    prompt: "Design a URL shortener for 100 million daily redirects.",
    rubric: ["Covers key generation", "Covers caching and hot keys"],
    solution:
      "Use a write service to allocate unique IDs and encode them in Base62.\nCache hot redirects at the edge and in Redis.",
    estimated_minutes: 30,
    tags: ["hashing", "caching"],
    deleted_at: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

export function designDrillAttemptRow(
  overrides: Partial<DesignDrillAttemptRow> &
    Pick<DesignDrillAttemptRow, "id" | "drill_id">,
): DesignDrillAttemptRow {
  const now = timestamp();
  return {
    started_at: now,
    completed_at: null,
    duration_sec: null,
    notes: null,
    rubric_hits: [],
    self_rating: null,
    deleted_at: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

export class FakeDesignDrillsDb {
  drills: DesignDrillRow[];
  attempts: DesignDrillAttemptRow[];
  private failures: { table: TableName; method: Method }[] = [];

  constructor(
    drills: DesignDrillRow[] = [],
    attempts: DesignDrillAttemptRow[] = [],
  ) {
    this.drills = drills;
    this.attempts = attempts;
  }

  failNext(table: TableName, method: Method) {
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

const reservedParams = new Set(["select", "order", "limit", "offset"]);

function matches(value: unknown, expression: string) {
  if (expression === "is.null") return value === null;
  if (expression.startsWith("eq.")) {
    return String(value) === expression.slice(3);
  }
  return true;
}

function filteredRows<T extends Record<string, unknown>>(rows: T[], url: URL) {
  const filters = [...url.searchParams.entries()].filter(
    ([key]) => !reservedParams.has(key),
  );
  return rows.filter((row) =>
    filters.every(([column, expression]) => matches(row[column], expression)),
  );
}

export async function mockSupabaseDesignDrills(
  page: Page,
  db: FakeDesignDrillsDb,
) {
  await page.route(
    "**/rest/v1/{design_drills,design_drill_attempts}*",
    async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const table: TableName = url.pathname.includes("design_drill_attempts")
        ? "design_drill_attempts"
        : "design_drills";
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
        table === "design_drills" ? db.drills : db.attempts
      ) as Record<string, unknown>[];

      if (method === "GET") {
        await respond(filteredRows(rows, url));
        return;
      }

      if (method === "POST" && table === "design_drill_attempts") {
        const now = timestamp();
        const payload = request.postDataJSON() as Record<string, unknown>;
        const created: DesignDrillAttemptRow = {
          id: crypto.randomUUID(),
          drill_id: String(payload.drill_id),
          started_at: now,
          completed_at: null,
          duration_sec: null,
          notes: null,
          rubric_hits: [],
          self_rating: null,
          deleted_at: null,
          created_at: now,
          updated_at: now,
        };
        db.attempts.unshift(created);
        await respond([created]);
        return;
      }

      if (method === "PATCH") {
        const payload = request.postDataJSON() as Record<string, unknown>;
        const targets = filteredRows(rows, url);
        for (const target of targets) {
          Object.assign(target, payload, { updated_at: timestamp() });
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
