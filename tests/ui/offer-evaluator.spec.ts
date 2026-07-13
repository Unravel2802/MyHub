import { expect, test } from "./fixtures";

test("updates offer scores and highlights a unique leader", async ({
  page,
}) => {
  await page.goto("/offers");
  const offers = page.getByRole("article");
  await expect(offers).toHaveCount(2);
  await expect(page.getByText("Don't choose on salary alone.")).toBeVisible();
  await expect(offers.nth(0).locator("p").first()).toContainText("5.0");
  await offers
    .nth(0)
    .getByRole("combobox", { name: "Learning rate" })
    .selectOption("10");
  await expect(offers.nth(0).locator("p").first()).toContainText("6.0");
  await expect(
    offers.nth(0).getByText("Leader", { exact: true }),
  ).toBeVisible();
  await expect(offers.nth(1).getByText("Leader", { exact: true })).toHaveCount(
    0,
  );
});

test("does not pick a leader on an exact tie", async ({ page }) => {
  await page.goto("/offers");
  await expect(page.getByText("Leader", { exact: true })).toHaveCount(0);
});
