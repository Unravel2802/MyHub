import type { Page } from "@playwright/test";

export type RoadmapRow = {
  id: string;
  kind: "criterion" | "readiness";
  item_key: string;
  completed_at: string | null;
  level: "not_started" | "minimum" | "strong" | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

const TIMESTAMP = "2026-09-01T00:00:00.000Z";

export class FakeRoadmapDb {
  rows: RoadmapRow[];
  constructor(rows: RoadmapRow[] = []) {
    this.rows = rows;
  }
}

export function tickRow(itemKey: string): RoadmapRow {
  return {
    id: crypto.randomUUID(),
    kind: "criterion",
    item_key: itemKey,
    completed_at: TIMESTAMP,
    level: null,
    deleted_at: null,
    created_at: TIMESTAMP,
    updated_at: TIMESTAMP,
  };
}

export async function mockSupabaseRoadmap(page: Page, db: FakeRoadmapDb) {
  await page.route("**/rest/v1/roadmap_progress*", async (route) => {
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

    // Supabase upsert -> POST with Prefer: resolution=merge-duplicates
    if (method === "POST") {
      const payload = request.postDataJSON() as Partial<RoadmapRow>;
      const existing = db.rows.find(
        (r) => r.item_key === payload.item_key && r.deleted_at === null,
      );
      if (existing) Object.assign(existing, payload);
      else
        db.rows.push({
          id: crypto.randomUUID(),
          kind: payload.kind ?? "criterion",
          item_key: payload.item_key ?? "",
          completed_at: payload.completed_at ?? null,
          level: payload.level ?? null,
          deleted_at: null,
          created_at: TIMESTAMP,
          updated_at: TIMESTAMP,
        });
      await route.fulfill({ status: 201, contentType: "application/json", body: "[]" });
      return;
    }

    // Un-tick is a soft delete (PATCH deleted_at).
    if (method === "PATCH") {
      const updates = request.postDataJSON() as Partial<RoadmapRow>;
      const url = new URL(request.url());
      const key = (url.searchParams.get("item_key") ?? "").replace(/^eq\./, "");
      for (const row of db.rows) {
        if (row.item_key === key && row.deleted_at === null) {
          Object.assign(row, updates);
        }
      }
      await route.fulfill({ status: 204, body: "" });
      return;
    }

    await route.fulfill({ status: 405, body: "" });
  });
}
