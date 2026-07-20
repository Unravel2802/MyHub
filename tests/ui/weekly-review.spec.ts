import { expect, test } from "./fixtures";
import { format, startOfWeek } from "date-fns";
import { FakeReviewDb, mockSupabaseReview } from "./supabaseReviewMock";

async function load(
  page: Parameters<typeof mockSupabaseReview>[0],
  db = new FakeReviewDb(),
) {
  await mockSupabaseReview(page, db);
  await page.goto("/review");
  await expect(
    page.getByRole("heading", { name: "Weekly Review", exact: true }).last(),
  ).toBeVisible();
  return db;
}

test("saves a review and upserts the same week", async ({ page }) => {
  const db = await load(page);
  const weekStart = format(
    startOfWeek(new Date(), { weekStartsOn: 1 }),
    "yyyy-MM-dd",
  );
  await page.getByLabel("What went well?").fill("Shipped the review ritual");
  await page.getByLabel("One fix for next week").fill("Protect deep work");
  await page.getByRole("button", { name: "Save review" }).click();
  await expect(
    page.getByRole("heading", { name: `Week of ${weekStart}` }),
  ).toBeVisible();
  await page.getByLabel("What went well?").fill("Shipped it and documented it");
  await page.getByRole("button", { name: "Save review" }).click();
  await expect.poll(() => db.reviews).toHaveLength(1);
  await expect(
    page.getByRole("heading", { name: `Week of ${weekStart}` }),
  ).toHaveCount(1);
  // Scope to the saved-review article. An unscoped getByText also matches the
  // form's <textarea>, whose re-hydrated value holds the same string — and
  // whether both are in the DOM when this runs is a timing race, so unscoped
  // this passes alone and fails intermittently under full-suite load. What we
  // actually mean to assert is that the PERSISTED review shows the new text.
  await expect(
    page.getByRole("article").filter({ hasText: `Week of ${weekStart}` }),
  ).toContainText("Shipped it and documented it");
});

// Assert on a question's own text, not on the "Quarterly questions" caption.
// The caption is a <legend>, which carries no `heading` role — it names the
// fieldset's `group` role — so getByRole("heading", ...) never matches it. A
// toHaveCount(0) against that selector would therefore pass whether the
// questions were rendered or not, testing nothing. The question text is what
// we actually care about, so assert on that in both directions.
const FIRST_QUARTERLY_QUESTION = "Am I becoming more technically rare?";

test("hides quarterly questions off a boundary week", async ({ page }) => {
  // This is an explicit off-boundary scenario, not a fixture pretending to be
  // "today". The normal save flow above follows the browser's real clock.
  await page.clock.install({ time: new Date("2026-02-02T12:00:00") });
  await load(page);
  await expect(
    page.getByRole("group", { name: "Quarterly questions" }),
  ).toHaveCount(0);
  await expect(
    page.getByText(FIRST_QUARTERLY_QUESTION, { exact: true }),
  ).toHaveCount(0);
});

test("shows quarterly questions on a boundary week", async ({ page }) => {
  // Mon 2026-03-30 starts the week containing 2026-03-31, the last day of Q1.
  await mockSupabaseReview(page, new FakeReviewDb());
  await page.clock.install({ time: new Date("2026-03-30T12:00:00") });
  await page.goto("/review");
  await expect(
    page.getByRole("group", { name: "Quarterly questions" }),
  ).toBeVisible();
  await expect(
    page.getByText(FIRST_QUARTERLY_QUESTION, { exact: true }),
  ).toBeVisible();
});
