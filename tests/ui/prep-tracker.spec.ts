import { expect, test } from "@playwright/test";
import { FakePrepDb, mockSupabasePrep, prepEntryRow } from "./supabasePrepMock";

async function loadPrep(
  page: Parameters<typeof mockSupabasePrep>[0],
  db = new FakePrepDb(),
) {
  await mockSupabasePrep(page, db);
  await page.goto("/prep");
  await expect(
    page.getByRole("heading", { name: "Build measurable reps" }),
  ).toBeVisible();
  return db;
}

test("entry form only offers fields and outcomes valid for its type", async ({
  page,
}) => {
  await loadPrep(page);

  await expect(page.getByLabel("Time to solve (minutes)")).toBeVisible();
  await expect(page.getByLabel("Outcome")).toContainText("Solved");

  await page.getByLabel("Practice type").selectOption("system_design");

  await expect(page.getByLabel("Time to solve (minutes)")).toHaveCount(0);
  await expect(page.getByLabel("Outcome")).toContainText("Needs work");
  await expect(page.getByLabel("Outcome")).not.toContainText("Solved");
});

test("logs an algorithm rep and updates the monthly scorecard", async ({
  page,
}) => {
  const db = await loadPrep(page);

  await page.getByLabel("Topic").fill("graphs");
  await page.getByLabel("Duration (minutes)").fill("45");
  await page.getByLabel("Time to solve (minutes)").fill("30");
  await page.getByLabel("Outcome").selectOption("solved");
  await page.getByLabel("Notes / post-mortem").fill("BFS was the key");
  await page.getByRole("button", { name: "Log session" }).click();

  await expect(
    page.getByRole("region", { name: "Recent sessions" }),
  ).toContainText("graphs");
  await expect(
    page.getByRole("region", { name: "Monthly scorecard" }),
  ).toContainText("1 / 1");
  await expect
    .poll(() => db.entries[0])
    .toMatchObject({
      topic: "graphs",
      time_to_solve_min: 30,
      outcome: "solved",
    });
});

test("creates and edits a behavioral story grouped by theme", async ({
  page,
}) => {
  await loadPrep(page);

  await page.getByLabel("Title").fill("Led a migration");
  await page
    .getByRole("textbox", { name: "Theme" })
    .fill("Technical leadership");
  await page
    .getByLabel("Concise version")
    .fill("Moved safely with feature flags");
  await page.getByRole("button", { name: "Add story" }).click();

  await expect(
    page.getByRole("heading", { name: "Technical leadership" }),
  ).toBeVisible();
  await expect(page.getByText("Moved safely with feature flags")).toBeVisible();

  await page.getByRole("button", { name: "Edit" }).click();
  await page
    .getByLabel("Concise version")
    .fill("Migrated safely with staged flags");
  await page.getByRole("button", { name: "Save story" }).click();

  await expect(
    page.getByRole("listitem").getByText("Migrated safely with staged flags"),
  ).toBeVisible();
});

test("shows no-data and measured weak-topic states distinctly", async ({
  page,
}) => {
  await loadPrep(
    page,
    new FakePrepDb([
      prepEntryRow({ id: "failed", topic: "graphs", outcome: "failed" }),
    ]),
  );

  const scorecard = page.getByRole("region", { name: "Monthly scorecard" });
  await expect(scorecard).toContainText("0%");
  await expect(scorecard).toContainText("graphs");
  await expect(scorecard).not.toContainText("No judged attempts");
});

test("rolls back a failed prep entry create", async ({ page }) => {
  const db = new FakePrepDb();
  db.failNext("prep_entries", "POST");
  await loadPrep(page, db);

  await page.getByLabel("Topic").fill("doomed rep");
  await page.getByRole("button", { name: "Log session" }).click();

  await expect(page.getByText("Simulated database failure")).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Recent sessions" }),
  ).not.toContainText("doomed rep");
});
