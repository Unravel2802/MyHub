import { expect, test } from "./fixtures";

test("task board loads with core controls", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Kanban board" }),
  ).toBeVisible();
  await expect(page.getByPlaceholder("Search tasks")).toBeVisible();
  await expect(page.getByPlaceholder("New inbox task")).toBeVisible();
  await expect(page.getByRole("button", { name: "Refresh" })).toBeVisible();

  for (const column of ["Inbox", "Todo", "In Progress", "Done"]) {
    await expect(page.getByRole("heading", { name: column })).toBeVisible();
  }

  await expect(
    page.getByText("Something went wrong, please try again later."),
  ).toHaveCount(0);
});
