import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";
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

test("a first visit defaults to dark", async ({ page }) => {
  await loadBoard(page);

  expect(await isDark(page)).toBe(true);
  await expect(
    themeControl(page).getByRole("button", { name: "Dark" }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("switching to light applies the light palette", async ({ page }) => {
  await loadBoard(page);

  await themeControl(page).getByRole("button", { name: "Light" }).click();

  expect(await isDark(page)).toBe(false);
  await expect(
    themeControl(page).getByRole("button", { name: "Light" }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("the chosen theme survives a reload", async ({ page }) => {
  await loadBoard(page);
  await themeControl(page).getByRole("button", { name: "Light" }).click();

  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Kanban board" }),
  ).toBeVisible();

  expect(await isDark(page)).toBe(false);
  await expect(
    themeControl(page).getByRole("button", { name: "Light" }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("the chosen theme survives closing and reopening the app", async ({
  context,
}) => {
  const first = await context.newPage();
  await mockSupabaseTasks(first, new FakeTaskDb([]));
  await first.goto("/");
  await themeControl(first).getByRole("button", { name: "Light" }).click();
  await first.close();

  // A fresh tab, as if returning to the app later.
  const second = await context.newPage();
  await mockSupabaseTasks(second, new FakeTaskDb([]));
  await second.goto("/");
  await expect(
    second.getByRole("heading", { name: "Kanban board" }),
  ).toBeVisible();

  expect(await isDark(second)).toBe(false);
});

test("the theme is applied before first paint", async ({ page }) => {
  await loadBoard(page);
  await themeControl(page).getByRole("button", { name: "Light" }).click();

  // Sample as soon as the HTML is parsed but before React hydrates. The inline
  // <head> script runs in that window; if the theme were applied by a component
  // instead, the page would paint the default first and flash.
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const darkBeforeHydration = await page.evaluate(() =>
    document.documentElement.classList.contains("dark"),
  );

  expect(darkBeforeHydration).toBe(false);
});

test("the OS colour scheme does not override the saved choice", async ({
  browser,
}) => {
  // A light OS must not drag the app out of its (default) dark theme.
  const context = await browser.newContext({ colorScheme: "light" });
  const page = await context.newPage();
  await mockSupabaseTasks(page, new FakeTaskDb([]));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Kanban board" }),
  ).toBeVisible();

  expect(await isDark(page)).toBe(true);
  await context.close();
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
