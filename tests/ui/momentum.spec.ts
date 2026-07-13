import { expect, test } from "./fixtures";
import { FakeMomentumDb, mockSupabaseMomentum } from "./supabaseMomentumMock";
import { prepEntryRow } from "./supabasePrepMock";

test("unlocks the first prep achievement and does not duplicate it on reload", async ({
  page,
}) => {
  const db = new FakeMomentumDb();
  await mockSupabaseMomentum(page, db);
  await page.route("**/rest/v1/prep_entries*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([prepEntryRow({ id: "prep-1" })]),
    });
  });
  await page.goto("/achievements");
  await expect(
    page.getByRole("heading", { name: "Achievements", exact: true }).last(),
  ).toBeVisible();
  await expect(page.getByText("Achievement unlocked")).toBeVisible();
  await expect(page.getByText("First Rep").first()).toBeVisible();
  await expect
    .poll(() => db.unlocks.map((row) => row.key))
    .toEqual(["first_prep_entry"]);
  await page.reload();
  await expect(page.getByText("Achievement unlocked")).toHaveCount(0);
  await expect(page.getByText("Unlocked").first()).toBeVisible();
  await expect.poll(() => db.unlocks).toHaveLength(1);
});
