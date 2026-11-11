import { expect, test } from "./fixtures";
import {
  FakeCurriculumDb,
  mockSupabaseCurriculum,
} from "./supabaseCurriculumMock";

const ROUTE = "/curriculum/systems-design.estimation/01-back-of-envelope";

test("estimation exercises render disclosures, enter the TOC, and fit mobile", async ({
  page,
}) => {
  await mockSupabaseCurriculum(page, new FakeCurriculumDb());
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(ROUTE);

  const cards = page.locator("[data-exercise-card]");
  await expect(cards).toHaveCount(3);
  await expect(cards.nth(0)).toContainText("Recall");
  await expect(cards.nth(1)).toContainText("Apply");
  await expect(cards.nth(2)).toContainText("Stretch");
  await expect(
    page.getByRole("link", { name: "Exercises", exact: true }),
  ).toBeVisible();

  const apply = cards.nth(1);
  const solution = apply.getByText(/Writes: 10M a day/);
  await expect(solution).toBeHidden();
  const hint = apply
    .locator("details")
    .filter({ has: page.getByText(/Use 86,400/) });
  await hint.locator("summary").click();
  await expect(hint.getByText(/Use 86,400/)).toBeVisible();
  await expect(solution).toBeHidden();

  const solutionDisclosure = apply
    .locator("details")
    .filter({ has: page.getByText(/Writes: 10M a day/) });
  await solutionDisclosure.locator("summary").click();
  await expect(solution).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(390);
});
