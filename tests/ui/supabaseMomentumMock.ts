import type { Page } from "@playwright/test";

export type AchievementRow = {
  id: string;
  key: string;
  unlocked_at: string;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

const STAMP = "2026-07-12T00:00:00.000Z";

export class FakeMomentumDb {
  unlocks: AchievementRow[];
  constructor(unlocks: AchievementRow[] = []) {
    this.unlocks = unlocks;
  }
}

export async function mockSupabaseMomentum(page: Page, db: FakeMomentumDb) {
  await page.route("**/rest/v1/achievements*", async (route) => {
    const request = route.request();
    if (request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          db.unlocks.filter((row) => row.deleted_at === null),
        ),
      });
      return;
    }
    if (request.method() === "POST") {
      const payload = request.postDataJSON() as { key: string }[];
      const inserted = payload.flatMap(({ key }) => {
        if (
          db.unlocks.some((row) => row.key === key && row.deleted_at === null)
        )
          return [];
        const row: AchievementRow = {
          id: `unlock-${key}`,
          key,
          unlocked_at: STAMP,
          deleted_at: null,
          created_at: STAMP,
          updated_at: STAMP,
        };
        db.unlocks.push(row);
        return [row];
      });
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(inserted),
      });
      return;
    }
    await route.fulfill({ status: 204, body: "" });
  });
}
