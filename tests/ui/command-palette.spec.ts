import { expect, test } from "./fixtures";

test("fuzzy-selects a command and moves it into Recent", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "Keep the week honest" }),
  ).toBeVisible();
  await page.keyboard.press("Control+KeyK");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("combobox", { name: "Search commands" }).fill("rfshdsh");
  await expect(
    page.getByRole("option", { name: "Refresh dashboard" }),
  ).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.keyboard.press("Control+KeyK");
  await expect(page.getByText("Recent", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("option", { name: "Refresh dashboard" }),
  ).toBeVisible();
});

test("module shortcuts and quick add do not fire while typing", async ({
  page,
}) => {
  await page.goto("/");
  const search = page.getByLabel("Search tasks");
  const newTask = page.getByLabel("New task title");

  await search.focus();
  await page.keyboard.type("nt/");
  await expect(search).toHaveValue("nt/");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(search).toBeFocused();

  await search.blur();
  await page.keyboard.press("n");
  await page.keyboard.press("t");
  await expect(newTask).toBeFocused();

  await newTask.blur();
  await page.keyboard.press("/");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Search commands" }),
  ).toHaveValue("New");
});
