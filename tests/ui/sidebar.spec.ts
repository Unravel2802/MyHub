import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";
import { FakeTaskDb, mockSupabaseTasks } from "./supabaseTasksMock";

async function loadBoard(page: Page) {
  await mockSupabaseTasks(page, new FakeTaskDb([]));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Kanban board" }),
  ).toBeVisible();
}

const nav = (page: Page) =>
  page.getByRole("navigation", { name: "MyHub modules" });
const collapseButton = (page: Page) =>
  page.getByRole("button", { name: "Collapse sidebar" });
const openButton = (page: Page) =>
  page.getByRole("button", { name: "Open sidebar" });

test("collapses and reopens the sidebar on desktop", async ({ page }) => {
  await loadBoard(page);

  await expect(nav(page)).toBeVisible();
  await expect(collapseButton(page)).toBeVisible();
  await expect(openButton(page)).toHaveCount(0);

  await collapseButton(page).click();
  await expect(nav(page)).toBeHidden();
  await expect(openButton(page)).toBeVisible();

  await openButton(page).click();
  await expect(nav(page)).toBeVisible();
  await expect(collapseButton(page)).toBeVisible();
});

test("the collapsed choice survives a reload", async ({ page }) => {
  await loadBoard(page);

  await collapseButton(page).click();
  await expect(nav(page)).toBeHidden();

  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Kanban board" }),
  ).toBeVisible();
  await expect(nav(page)).toBeHidden();
  await expect(openButton(page)).toBeVisible();
});

test("Cmd/Ctrl+B toggles the sidebar", async ({ page }) => {
  await loadBoard(page);
  await expect(nav(page)).toBeVisible();

  await page.keyboard.press("ControlOrMeta+b");
  await expect(nav(page)).toBeHidden();

  await page.keyboard.press("ControlOrMeta+b");
  await expect(nav(page)).toBeVisible();
});
