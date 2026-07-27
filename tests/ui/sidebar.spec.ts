import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";
import { FakeTaskDb, mockSupabaseTasks } from "./supabaseTasksMock";

async function loadBoard(page: Page) {
  await mockSupabaseTasks(page, new FakeTaskDb([]));
  await page.goto("/tasks");
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

test("groups mini-app navigation below ungrouped core tools", async ({
  page,
}) => {
  await loadBoard(page);

  const modules = nav(page);
  const career = modules.getByRole("group", { name: "Career" });
  const money = modules.getByRole("group", { name: "Money" });
  const taskEngine = modules.getByRole("link", { name: "Task Engine" });
  const careerHeading = modules.getByText("Career", { exact: true });
  const moneyHeading = modules.getByText("Money", { exact: true });

  await expect(careerHeading).toBeVisible();
  await expect(moneyHeading).toBeVisible();
  await expect(
    career.getByRole("link", { name: "Prep Tracker" }),
  ).toBeVisible();
  await expect(money.getByRole("link", { name: "Finances" })).toBeVisible();
  await expect(taskEngine).toBeVisible();
  expect(
    await taskEngine.evaluate((element) =>
      element.parentElement?.getAttribute("role"),
    ),
  ).toBeNull();

  const navOrder = await modules
    .locator("a, [data-mini-app-heading]")
    .evaluateAll((elements) =>
      elements.map((element) => element.textContent?.trim()),
    );
  expect(navOrder.indexOf("Task Engine")).toBeLessThan(
    navOrder.indexOf("Career"),
  );
  expect(navOrder.indexOf("Career")).toBeLessThan(navOrder.indexOf("Money"));

  await collapseButton(page).click();
  await expect(careerHeading).toBeHidden();
  await expect(moneyHeading).toBeHidden();
});

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
