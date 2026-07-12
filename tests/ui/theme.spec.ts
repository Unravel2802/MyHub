import { expect, test, type Page } from "@playwright/test";
import { FakeTaskDb, mockSupabaseTasks, row } from "./supabaseTasksMock";

async function loadBoard(page: Page) {
  await mockSupabaseTasks(page, new FakeTaskDb([]));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Kanban board" }),
  ).toBeVisible();
}

function themeControl(page: Page) {
  return page.getByRole("group", { name: "Theme" });
}

function isDark(page: Page) {
  return page
    .locator("html")
    .evaluate((html) => html.classList.contains("dark"));
}

test("switching to dark applies the dark palette", async ({ page }) => {
  await loadBoard(page);
  expect(await isDark(page)).toBe(false);

  await themeControl(page).getByRole("button", { name: "Dark" }).click();

  expect(await isDark(page)).toBe(true);
  await expect(
    themeControl(page).getByRole("button", { name: "Dark" }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("the chosen theme survives a reload", async ({ page }) => {
  await loadBoard(page);
  await themeControl(page).getByRole("button", { name: "Dark" }).click();

  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Kanban board" }),
  ).toBeVisible();

  expect(await isDark(page)).toBe(true);
  await expect(
    themeControl(page).getByRole("button", { name: "Dark" }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("the dark palette is applied before first paint", async ({ page }) => {
  await mockSupabaseTasks(page, new FakeTaskDb([]));
  await page.goto("/");
  await themeControl(page).getByRole("button", { name: "Dark" }).click();

  // Sample as soon as the HTML is parsed but before React hydrates. The inline
  // <head> script runs in that window; if the theme were applied by a component
  // instead, the page would paint light first and flash.
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const darkBeforeHydration = await page.evaluate(() =>
    document.documentElement.classList.contains("dark"),
  );

  expect(darkBeforeHydration).toBe(true);
});

test("the theme control stays on screen when a column is long", async ({
  page,
}) => {
  const tasks = Array.from({ length: 14 }, (_, index) =>
    row({
      id: `task-${index}`,
      title: `Inbox task ${index + 1}`,
      position: (index + 1) * 1000,
    }),
  );
  await mockSupabaseTasks(page, new FakeTaskDb(tasks));
  await page.goto("/");
  await expect(themeControl(page)).toBeInViewport();

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

  // The sidebar is a sticky viewport-height rail, so the control must not
  // scroll away with the board content.
  await expect(themeControl(page)).toBeInViewport();
});

test.describe("with a dark OS preference", () => {
  test.use({ colorScheme: "dark" });

  test("system follows the OS setting by default", async ({ page }) => {
    await loadBoard(page);

    expect(await isDark(page)).toBe(true);
    await expect(
      themeControl(page).getByRole("button", { name: "System" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  test("an explicit light choice overrides the OS setting", async ({
    page,
  }) => {
    await loadBoard(page);
    await themeControl(page).getByRole("button", { name: "Light" }).click();

    expect(await isDark(page)).toBe(false);
  });
});
