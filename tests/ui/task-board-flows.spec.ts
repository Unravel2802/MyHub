import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";
import {
  FakeTaskDb,
  mockSupabaseTasks,
  row,
  type TaskRow,
} from "./supabaseTasksMock";

function card(page: Page, title: string) {
  return page.getByRole("article", { name: `Task: ${title}` });
}

async function loadBoard(page: Page, rows: TaskRow[] = []) {
  const db = new FakeTaskDb(rows);
  await mockSupabaseTasks(page, db);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Kanban board" }),
  ).toBeVisible();
  return db;
}

test("creates a task into the inbox column", async ({ page }) => {
  await loadBoard(page);

  await page.getByPlaceholder("New inbox task").fill("Draft the notes spec");
  await page.getByRole("button", { name: "Add", exact: true }).click();

  await expect(card(page, "Draft the notes spec")).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Inbox" }).getByRole("article"),
  ).toHaveCount(1);
});

test("creates and displays a weekly task rule", async ({ page }) => {
  const db = await loadBoard(page);

  await page.getByPlaceholder("New inbox task").fill("Practice system design");
  await page.getByRole("checkbox", { name: "Repeats weekly" }).check();
  await page.getByLabel("Weekday").selectOption("2");
  await page.getByRole("button", { name: "Add", exact: true }).click();

  const weeklyTasks = page.getByLabel("Weekly tasks");
  await expect(weeklyTasks).toContainText("Practice system design");
  await expect(weeklyTasks).toContainText("Tuesday");
  await expect(card(page, "Practice system design")).toHaveCount(0);
  await expect
    .poll(() => db.rows.find((task) => task.title === "Practice system design"))
    .toMatchObject({ recurs_weekly: true, weekday: 2 });
});

test("generates a weekly instance and keeps it after stopping the rule", async ({
  page,
}) => {
  const db = await loadBoard(page, [
    row({
      id: "weekly-template",
      title: "Solve graph problems",
      recurs_weekly: true,
      weekday: 0,
    }),
  ]);

  const instance = card(page, "Solve graph problems");
  await expect(instance).toBeVisible();
  await expect(instance).toContainText("Weekly instance");
  await expect(
    page.getByRole("region", { name: "Todo" }).getByRole("article"),
  ).toHaveCount(1);

  page.on("dialog", (dialog) => void dialog.accept());
  await page
    .getByLabel("Weekly tasks")
    .getByRole("button", { name: "Stop" })
    .click();

  await expect(page.getByLabel("Weekly tasks")).toContainText(
    "No weekly tasks yet.",
  );
  await expect(instance).toBeVisible();
  await expect
    .poll(
      () => db.rows.find((task) => task.id === "weekly-template")?.deleted_at,
    )
    .not.toBeNull();
});

test("creates a subtask nested one level below its parent", async ({
  page,
}) => {
  await loadBoard(page, [row({ id: "parent-1", title: "Ship the board" })]);

  const parent = card(page, "Ship the board");
  await parent.getByPlaceholder("New subtask").fill("Write the tests");
  await parent.getByRole("button", { name: "Add" }).click();

  await expect(card(page, "Write the tests")).toContainText("Level 2");
  await expect(parent).toContainText("1 subtasks");
});

test("deleting a parent cascades to its subtasks", async ({ page }) => {
  await loadBoard(page, [
    row({ id: "parent-1", title: "Ship the board" }),
    row({
      id: "child-1",
      title: "Write the tests",
      parent_task_id: "parent-1",
    }),
  ]);

  page.on("dialog", (dialog) => void dialog.accept());
  await card(page, "Ship the board")
    .getByRole("button", { name: "Delete" })
    .click();

  await expect(card(page, "Ship the board")).toHaveCount(0);
  await expect(card(page, "Write the tests")).toHaveCount(0);
});

test("column filters narrow the board and restore it when cleared", async ({
  page,
}) => {
  await loadBoard(page);
  const filters = page.getByRole("group", { name: "Filter columns" });
  // Scoped to the board itself. A bare page.getByRole("region") counted EVERY
  // landmark on the page, which only worked while the columns happened to be
  // the only ones — the Archive section is a legitimate region too, and the
  // count silently became a lie about what it was testing.
  const columns = page
    .getByRole("group", { name: "Board columns" })
    .getByRole("region");

  await expect(columns).toHaveCount(4);

  await filters.getByRole("button", { name: "Todo" }).click();
  await expect(columns).toHaveCount(1);
  await expect(page.getByRole("region", { name: "Todo" })).toBeVisible();

  await filters.getByRole("button", { name: "Done" }).click();
  await expect(columns).toHaveCount(2);

  await filters.getByRole("button", { name: "Todo" }).click();
  await filters.getByRole("button", { name: "Done" }).click();
  await expect(columns).toHaveCount(4);
});

test("dragging a card from Inbox to Todo persists the new status", async ({
  page,
}) => {
  const db = await loadBoard(page, [
    row({ id: "task-1", title: "Triage me", position: 1000 }),
  ]);

  // Grab the title itself: the drag listeners live on the card's header row, not
  // on the article's padding.
  const handle = card(page, "Triage me").getByText("Triage me");
  const target = page.getByRole("region", { name: "Todo" });
  const from = await handle.boundingBox();
  const to = await target.boundingBox();
  if (!from || !to) throw new Error("Expected card and column to be visible");

  // dnd-kit's PointerSensor needs >6px of movement, and intermediate moves, to
  // start and track the drag.
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    from.x + from.width / 2,
    from.y + from.height / 2 + 20,
    {
      steps: 5,
    },
  );
  await page.mouse.move(to.x + to.width / 2, to.y + 120, { steps: 12 });
  await page.mouse.up();

  await expect(
    target.getByRole("article", { name: "Task: Triage me" }),
  ).toBeVisible();
  await expect
    .poll(() => db.rows.find((task) => task.id === "task-1")?.status)
    .toBe("todo");
});

test("a failed create rolls back the card and surfaces an error", async ({
  page,
}) => {
  const db = await loadBoard(page);
  db.failNext("POST");

  await page.getByPlaceholder("New inbox task").fill("Doomed task");
  await page.getByRole("button", { name: "Add", exact: true }).click();

  await expect(
    page.getByText("Something went wrong, please try again later."),
  ).toBeVisible();
  await expect(card(page, "Doomed task")).toHaveCount(0);
});
