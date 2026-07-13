import { expect, test, type Page } from "@playwright/test";
import {
  FakeTaskDb,
  mockSupabaseTasks,
  row,
  type TaskRow,
} from "./supabaseTasksMock";

// Browser-level coverage for the subtask cascades in myhub_plan.md Part A §A.2
// (Task Engine): completing a task completes its whole subtree, and completing
// the last outstanding subtask auto-completes the ancestors above it.

function card(page: Page, title: string) {
  return page.getByRole("article", { name: `Task: ${title}` });
}

function statusOf(page: Page, title: string) {
  return card(page, title).getByLabel("Status");
}

async function loadBoard(page: Page, rows: TaskRow[]) {
  const db = new FakeTaskDb(rows);
  await mockSupabaseTasks(page, db);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Kanban board" }),
  ).toBeVisible();
  return db;
}

function statusIn(db: FakeTaskDb, id: string) {
  return db.rows.find((task) => task.id === id)?.status;
}

// parent → child → grandchild, the deepest tree the spec allows.
function nestedTree(): TaskRow[] {
  return [
    row({
      id: "parent",
      title: "Ship the module",
      status: "todo",
      position: 1000,
    }),
    row({
      id: "child",
      title: "Write the store",
      status: "todo",
      position: 2000,
      parent_task_id: "parent",
    }),
    row({
      id: "grandchild",
      title: "Cover the cascade",
      status: "todo",
      position: 3000,
      parent_task_id: "child",
    }),
  ];
}

test("completing a task completes its entire subtree", async ({ page }) => {
  const db = await loadBoard(page, nestedTree());

  await statusOf(page, "Ship the module").selectOption("done");

  await expect(statusOf(page, "Write the store")).toHaveValue("done");
  await expect(statusOf(page, "Cover the cascade")).toHaveValue("done");

  await expect.poll(() => statusIn(db, "child")).toBe("done");
  await expect.poll(() => statusIn(db, "grandchild")).toBe("done");
});

test("completing the last subtask auto-completes its ancestors", async ({
  page,
}) => {
  const db = await loadBoard(page, nestedTree());

  // The grandchild is the only leaf, so finishing it should complete the child
  // and then the parent, all the way up the chain.
  await statusOf(page, "Cover the cascade").selectOption("done");

  await expect(statusOf(page, "Write the store")).toHaveValue("done");
  await expect(statusOf(page, "Ship the module")).toHaveValue("done");

  await expect.poll(() => statusIn(db, "child")).toBe("done");
  await expect.poll(() => statusIn(db, "parent")).toBe("done");
});

test("a parent stays open while any sibling subtask is outstanding", async ({
  page,
}) => {
  const db = await loadBoard(page, [
    row({
      id: "parent",
      title: "Ship the module",
      status: "todo",
      position: 1000,
    }),
    row({
      id: "child-a",
      title: "Write the store",
      status: "todo",
      position: 2000,
      parent_task_id: "parent",
    }),
    row({
      id: "child-b",
      title: "Write the tests",
      status: "todo",
      position: 3000,
      parent_task_id: "parent",
    }),
  ]);

  await statusOf(page, "Write the store").selectOption("done");

  await expect(statusOf(page, "Ship the module")).toHaveValue("todo");
  await expect.poll(() => statusIn(db, "parent")).toBe("todo");
});

test("completion status changes carry completed_at in the PATCH body", async ({
  page,
}) => {
  await loadBoard(page, [
    row({
      id: "task",
      title: "Timestamp this task",
      status: "todo",
      position: 1000,
    }),
  ]);

  const completionRequest = page.waitForRequest(
    (request) =>
      request.method() === "PATCH" && request.url().includes("/rest/v1/tasks"),
  );
  await statusOf(page, "Timestamp this task").selectOption("done");
  const completionBody = completionRequest.then(
    (request) => request.postDataJSON() as Partial<TaskRow>,
  );
  const completed = await completionBody;

  expect(completed.status).toBe("done");
  expect(typeof completed.completed_at).toBe("string");
  expect(Number.isNaN(Date.parse(completed.completed_at ?? ""))).toBe(false);

  const revertRequest = page.waitForRequest(
    (request) =>
      request.method() === "PATCH" && request.url().includes("/rest/v1/tasks"),
  );
  await statusOf(page, "Timestamp this task").selectOption("todo");
  const reverted = (await revertRequest).postDataJSON() as Partial<TaskRow>;

  expect(reverted.status).toBe("todo");
  expect(reverted.completed_at).toBeNull();
});

test("adding a subtask reopens a completed parent", async ({ page }) => {
  const db = await loadBoard(page, [
    row({
      id: "parent",
      title: "Ship the module",
      status: "done",
      position: 1000,
    }),
  ]);

  await card(page, "Ship the module")
    .getByPlaceholder("New subtask")
    .fill("One more thing");
  await card(page, "Ship the module")
    .getByRole("button", { name: "Add" })
    .click();

  // The board must reflect the revert without waiting for a refetch.
  await expect(statusOf(page, "Ship the module")).toHaveValue("todo");
  await expect.poll(() => statusIn(db, "parent")).toBe("todo");
});
