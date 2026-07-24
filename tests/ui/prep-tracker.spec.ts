import { expect, test } from "./fixtures";
import { FakePrepDb, mockSupabasePrep, prepEntryRow } from "./supabasePrepMock";
import {
  FakeLeetCodeDb,
  leetCodeAttemptRow,
  leetCodeProblemRow,
  mockSupabaseLeetCode,
} from "./supabaseLeetCodeMock";

async function loadPrep(
  page: Parameters<typeof mockSupabasePrep>[0],
  db = new FakePrepDb(),
  leetCodeDb = new FakeLeetCodeDb(),
) {
  await mockSupabasePrep(page, db);
  await mockSupabaseLeetCode(page, leetCodeDb);
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

  await expect(
    page.getByLabel("Time to solve this problem (minutes)"),
  ).toHaveCount(0);
  await expect(page.getByLabel("Practice type")).not.toContainText("Algorithm");
  await expect(page.getByLabel("Outcome")).toContainText("Pass");
  await expect(page.getByLabel("Outcome")).toContainText("Needs work");
  await expect(page.getByLabel("Outcome")).not.toContainText("Solved");

  await page.getByLabel("Practice type").selectOption("behavioral");

  await expect(
    page.getByLabel("Time to solve this problem (minutes)"),
  ).toHaveCount(0);
  await expect(page.getByLabel("Outcome")).toContainText("Pass");
  await expect(page.getByLabel("Outcome")).toContainText("Needs work");
  await expect(page.getByLabel("Outcome")).not.toContainText("Solved");
});

test("logs mock subtypes, resume deep-dives, and renders time allocation", async ({
  page,
}) => {
  const db = await loadPrep(page);

  await page.getByLabel("Practice type").selectOption("mock_interview");
  await expect(page.getByLabel("Mock subtype")).toBeVisible();
  await page.getByLabel("Mock subtype").selectOption("coding");
  await page.getByLabel("Topic").fill("coding mock");
  await page.getByLabel("Session length (minutes)").fill("60");
  await page.getByRole("button", { name: "Log session" }).click();

  await expect
    .poll(() => db.entries.find((entry) => entry.topic === "coding mock"))
    .toMatchObject({
      entry_type: "mock_interview",
      mock_subtype: "coding",
    });

  await page.getByLabel("Practice type").selectOption("resume_deep_dive");
  await expect(page.getByLabel("Mock subtype")).toHaveCount(0);
  await page.getByLabel("Topic").fill("resume walkthrough");
  await page.getByLabel("Session length (minutes)").fill("30");
  await page.getByRole("button", { name: "Log session" }).click();

  await expect
    .poll(() =>
      db.entries.find((entry) => entry.topic === "resume walkthrough"),
    )
    .toMatchObject({ entry_type: "resume_deep_dive" });

  const allocation = page.getByRole("region", {
    name: "Prep time allocation",
  });
  await expect(allocation).toContainText("Algorithms");
  await expect(allocation).toContainText("Resume deep-dive");
  await expect(allocation).toContainText("Mock-interview time excluded");
});

test("includes LeetCode attempt time in algorithm allocation", async ({
  page,
}) => {
  await loadPrep(
    page,
    new FakePrepDb(),
    new FakeLeetCodeDb(
      [leetCodeProblemRow({ id: "two-sum", title: "Two Sum" })],
      [
        leetCodeAttemptRow({
          id: "two-sum-attempt",
          problem_id: "two-sum",
          time_to_solve_min: 45,
        }),
      ],
    ),
  );

  const algorithmAllocation = page
    .getByRole("region", { name: "Prep time allocation" })
    .getByText("Algorithms", { exact: true })
    .locator("..");
  await expect(algorithmAllocation).toContainText("100%");
});

test("logs a system design rep and updates the monthly scorecard", async ({
  page,
}) => {
  const db = await loadPrep(page);

  await page.getByLabel("Topic").fill("rate limiter");
  await page.getByLabel("Session length (minutes)").fill("45");
  await page.getByLabel("Outcome").selectOption("pass");
  await page
    .getByLabel("Notes / post-mortem")
    .fill("Separated global and per-user limits");
  await page.getByRole("button", { name: "Log session" }).click();

  await expect(
    page.getByRole("region", { name: "Recent sessions" }),
  ).toContainText("rate limiter");
  const systemDesignTile = page
    .getByRole("region", { name: "Monthly scorecard" })
    .getByText("System design", { exact: true })
    .first()
    .locator("..");
  await expect(systemDesignTile).toContainText("1");
  await expect
    .poll(() => db.entries[0])
    .toMatchObject({
      entry_type: "system_design",
      topic: "rate limiter",
      time_to_solve_min: null,
      outcome: "pass",
    });
});

test("keeps recent sessions bounded with pinned deletes and preserved note lines", async ({
  page,
}) => {
  await loadPrep(
    page,
    new FakePrepDb([
      prepEntryRow({
        id: "multiline-notes",
        topic: "Graph traversal",
        notes:
          "First note line with enough detail to fill the session card.\nSecond note line stays distinct.",
      }),
    ]),
  );

  await expect(
    page.locator("details").filter({ hasText: "Log a prep session" }),
  ).toHaveCount(0);

  const recentSessions = page.getByRole("region", {
    name: "Recent sessions",
  });
  const list = recentSessions.getByRole("list");
  const listStyles = await list.evaluate((element) => {
    const styles = getComputedStyle(element);
    return {
      maxHeight: styles.maxHeight,
      overflowY: styles.overflowY,
    };
  });
  expect(listStyles.overflowY).toBe("auto");
  expect(listStyles.maxHeight).not.toBe("none");

  const item = recentSessions.getByRole("listitem");
  const notes = item.getByText(/First note line/);
  await expect(notes).toHaveCSS("white-space", "pre-wrap");

  const itemBox = await item.boundingBox();
  const deleteBox = await item
    .getByRole("button", { name: "Delete" })
    .boundingBox();
  expect(itemBox).not.toBeNull();
  expect(deleteBox).not.toBeNull();
  if (!itemBox || !deleteBox) return;

  expect(deleteBox.y - itemBox.y).toBeGreaterThanOrEqual(10);
  expect(deleteBox.y - itemBox.y).toBeLessThanOrEqual(15);
  expect(
    itemBox.x + itemBox.width - (deleteBox.x + deleteBox.width),
  ).toBeGreaterThanOrEqual(10);
  expect(
    itemBox.x + itemBox.width - (deleteBox.x + deleteBox.width),
  ).toBeLessThanOrEqual(15);
});

test("creates and edits a behavioral story grouped by theme", async ({
  page,
}) => {
  await loadPrep(page);

  await page.getByLabel("Title", { exact: true }).fill("Led a migration");
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

  await expect(
    page.getByText("Something went wrong, please try again later."),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Recent sessions" }),
  ).not.toContainText("doomed rep");
});
