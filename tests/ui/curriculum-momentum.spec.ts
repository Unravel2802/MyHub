import { expect, test } from "./fixtures";
import {
  FakeCurriculumDb,
  mockSupabaseCurriculum,
} from "./supabaseCurriculumMock";

test("reading and un-reading a chapter updates Momentum's active-today state", async ({
  page,
}) => {
  const db = new FakeCurriculumDb();
  await mockSupabaseCurriculum(page, db);
  await page.goto("/curriculum");
  await expect(
    page.getByRole("heading", { name: "Learn the whole stack, in order" }),
  ).toBeVisible();
  await expect(page.locator('[aria-label="0-day streak"]')).toBeVisible();
  await page.getByTitle(/^Data Structures \u2014 /).click();

  await page
    .getByRole("button", { name: "Mark Arrays and the memory model read" })
    .click();
  const streak = page.locator('[aria-label="1-day streak"]');
  await expect(streak.locator("span")).toHaveClass(/pulse-glow/);

  await page
    .getByRole("button", { name: "Mark Arrays and the memory model unread" })
    .click();
  await expect(page.locator('[aria-label="0-day streak"]')).toBeVisible();
});
