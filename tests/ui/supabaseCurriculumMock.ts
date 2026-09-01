import type { Page } from "@playwright/test";

export type CurriculumRow = {
  id: string;
  item_key: string;
  completed_at: string | null;
  starred: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

const TIMESTAMP = "2026-09-01T00:00:00.000Z";

export class FakeCurriculumDb {
  rows: CurriculumRow[];
  constructor(rows: CurriculumRow[] = []) {
    this.rows = rows;
  }
  keys() {
    return this.rows
      .filter((row) => row.deleted_at === null && row.completed_at !== null)
      .map((row) => row.item_key);
  }
}

export function readRow(itemKey: string): CurriculumRow {
  return {
    id: crypto.randomUUID(),
    item_key: itemKey,
    completed_at: TIMESTAMP,
    starred: false,
    deleted_at: null,
    created_at: TIMESTAMP,
    updated_at: TIMESTAMP,
  };
}

export async function mockSupabaseCurriculum(page: Page, db: FakeCurriculumDb) {
  await page.route("**/rest/v1/curriculum_progress*", async (route) => {
    const request = route.request();
    const method = request.method();

    if (method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(db.rows.filter((r) => r.deleted_at === null)),
      });
      return;
    }

    if (method === "POST") {
      const url = new URL(request.url());
      const prefer = request.headers()["prefer"] ?? "";
      // The 42P10 guard, copied from supabaseRoadmapMock deliberately.
      //
      // Migration 0014 gave roadmap_progress a PARTIAL unique index, which
      // Postgres will not accept as an ON CONFLICT target for the bare
      // `ON CONFLICT (item_key)` PostgREST emits. Every tick failed against the
      // real database and rolled back, and the suite stayed green throughout
      // because the mock accepted any POST. Migration 0043 uses a plain unique
      // constraint for exactly this reason; this is what keeps that honest.
      if (prefer.includes("merge-duplicates")) {
        if (url.searchParams.get("on_conflict") !== "item_key") {
          await route.fulfill({
            status: 400,
            contentType: "application/json",
            body: JSON.stringify({
              code: "42P10",
              message:
                "there is no unique or exclusion constraint matching the ON CONFLICT specification",
            }),
          });
          return;
        }
      }

      const payload = request.postDataJSON() as Partial<CurriculumRow>;
      const existing = db.rows.find(
        (r) => r.item_key === payload.item_key && r.deleted_at === null,
      );
      // Assign only the columns the payload carries — an upsert of
      // `completed_at` must not blank `starred`, which is exactly what
      // PostgREST's ON CONFLICT DO UPDATE does and what the repository relies
      // on to keep the two flags independent.
      if (existing) Object.assign(existing, payload);
      else
        db.rows.push({
          id: crypto.randomUUID(),
          item_key: payload.item_key ?? "",
          completed_at: payload.completed_at ?? null,
          starred: payload.starred ?? false,
          deleted_at: null,
          created_at: TIMESTAMP,
          updated_at: TIMESTAMP,
        });

      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: "[]",
      });
      return;
    }

    await route.fulfill({ status: 405, body: "" });
  });
}

// A curriculum_progress route that fails every write, for the rollback test.
export async function mockSupabaseCurriculumWriteFailure(
  page: Page,
  db: FakeCurriculumDb,
) {
  await page.route("**/rest/v1/curriculum_progress*", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(db.rows),
      });
      return;
    }
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ message: 'relation "curriculum_progress" x' }),
    });
  });
}
