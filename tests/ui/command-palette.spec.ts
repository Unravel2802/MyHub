import { expect, test } from "./fixtures";

test("opens the command palette and runs a keyboard-selected command", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "Keep the week honest" }),
  ).toBeVisible();
  await page.keyboard.press("Control+KeyK");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByLabel("Search commands").fill("Refresh dashboard");
  await expect(
    page.getByRole("option", { name: "Refresh dashboard" }),
  ).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
