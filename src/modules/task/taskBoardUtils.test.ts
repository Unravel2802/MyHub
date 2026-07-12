import { describe, expect, it } from "vitest";
import {
  filterVisibleTasks,
  formatDueDate,
  formatStatus,
  getDropPosition,
  getTaskStats,
  getVisibleColumns,
  groupTasksByStatus,
  isTaskStatus,
  toggleColumnFilter,
} from "@/src/modules/task/taskBoardUtils";
import type { Task } from "@/src/modules/task/types";

function task(overrides: Partial<Task> & Pick<Task, "id" | "title">): Task {
  return {
    id: overrides.id,
    title: overrides.title,
    description: overrides.description ?? null,
    status: overrides.status ?? "inbox",
    position: overrides.position ?? 0,
    dueDate: overrides.dueDate ?? null,
    parentTaskId: overrides.parentTaskId ?? null,
    recursWeekly: overrides.recursWeekly ?? false,
    weekday: overrides.weekday ?? null,
    recurrenceTemplateId: overrides.recurrenceTemplateId ?? null,
    occurrenceDate: overrides.occurrenceDate ?? null,
    deletedAt: overrides.deletedAt ?? null,
    createdAt: overrides.createdAt ?? "2026-01-01T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-01-01T00:00:00.000Z",
  };
}

describe("task board helpers", () => {
  it("formats status and due date labels", () => {
    expect(formatStatus("in_progress")).toBe("In Progress");
    expect(formatDueDate(null)).toBe("No due date");
    expect(formatDueDate("2026-07-10")).toBe("Jul 10");
  });

  it("filters active tasks by title search", () => {
    const tasks = [
      task({ id: "a", title: "Plan sprint" }),
      task({ id: "b", title: "Review notes" }),
      task({
        id: "c",
        title: "Deleted planning note",
        deletedAt: "2026-07-10T00:00:00.000Z",
      }),
    ];

    expect(filterVisibleTasks(tasks, "PLAN").map((t) => t.id)).toEqual(["a"]);
  });

  it("groups tasks by status in position order", () => {
    const grouped = groupTasksByStatus([
      task({ id: "later", title: "Later", status: "todo", position: 20 }),
      task({ id: "first", title: "First", status: "todo", position: 10 }),
      task({ id: "done", title: "Done", status: "done", position: 0 }),
    ]);

    expect(grouped.todo.map((t) => t.id)).toEqual(["first", "later"]);
    expect(grouped.done.map((t) => t.id)).toEqual(["done"]);
  });

  it("computes active task stats", () => {
    const stats = getTaskStats(
      [
        task({ id: "a", title: "Open", status: "todo", dueDate: "2026-07-10" }),
        task({ id: "b", title: "Done", status: "done", dueDate: "2026-07-10" }),
        task({
          id: "c",
          title: "Deleted",
          dueDate: "2026-07-10",
          deletedAt: "2026-07-10T00:00:00.000Z",
        }),
      ],
      "2026-07-10",
    );

    expect(stats).toEqual([
      { label: "Open tasks", value: 1 },
      { label: "Due today", value: 2 },
      { label: "Completed", value: 1 },
    ]);
  });

  it("identifies valid task statuses", () => {
    expect(isTaskStatus("todo")).toBe(true);
    expect(isTaskStatus("blocked")).toBe(false);
  });

  it("shows every column when no filter is selected", () => {
    expect(getVisibleColumns([]).map((c) => c.status)).toEqual([
      "inbox",
      "todo",
      "in_progress",
      "done",
    ]);
  });

  it("shows only filtered columns, in board order", () => {
    expect(getVisibleColumns(["done", "inbox"]).map((c) => c.status)).toEqual([
      "inbox",
      "done",
    ]);
  });

  it("toggles a status in and out of the filter list", () => {
    expect(toggleColumnFilter([], "todo")).toEqual(["todo"]);
    expect(toggleColumnFilter(["todo", "done"], "todo")).toEqual(["done"]);
  });

  it("calculates sparse positions for drag/drop ordering", () => {
    const tasks = [
      task({ id: "a", title: "A", status: "todo", position: 1000 }),
      task({ id: "b", title: "B", status: "todo", position: 2000 }),
      task({ id: "c", title: "C", status: "todo", position: 3000 }),
    ];

    expect(getDropPosition(tasks, "c", "a")).toBe(999);
    expect(getDropPosition(tasks, "a", "c")).toBe(2500);
    expect(getDropPosition(tasks, "a", null)).toBe(4000);
    expect(getDropPosition([], "a", null)).toBe(0);
  });
});
