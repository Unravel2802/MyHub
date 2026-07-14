import { describe, expect, it } from "vitest";
import {
  archivedTasks,
  boardTasks,
  isArchived,
  weekStartKey,
} from "@/src/modules/task/taskArchive";
import type { Task } from "@/src/modules/task/types";

// Tue 2026-07-14. Its Monday-start week is 2026-07-13 .. 2026-07-19.
const TODAY = new Date("2026-07-14T09:00:00");

function task(overrides: Partial<Task> & { id: string }): Task {
  return {
    title: overrides.id,
    description: null,
    status: "done",
    position: 0,
    dueDate: null,
    parentTaskId: null,
    recursWeekly: false,
    weekday: null,
    recurrenceTemplateId: null,
    occurrenceDate: null,
    completedAt: null,
    archivedAt: null,
    deletedAt: null,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

// A local-wall-clock instant on a given day, so these tests mean the same thing
// in any timezone the suite runs in.
const at = (day: string, time = "12:00:00") =>
  new Date(`${day}T${time}`).toISOString();

describe("weekStartKey", () => {
  it("returns the Monday of the week containing today", () => {
    expect(weekStartKey(TODAY)).toBe("2026-07-13");
    expect(weekStartKey(new Date("2026-07-13T00:30:00"))).toBe("2026-07-13");
    // Sunday still belongs to the week that began on Monday.
    expect(weekStartKey(new Date("2026-07-19T23:30:00"))).toBe("2026-07-13");
  });
});

describe("isArchived — by age", () => {
  it("keeps a task completed earlier this week on the board", () => {
    const t = task({ id: "mon", completedAt: at("2026-07-13") });
    expect(isArchived(t, TODAY)).toBe(false);
  });

  it("keeps a task completed today on the board", () => {
    const t = task({ id: "today", completedAt: at("2026-07-14") });
    expect(isArchived(t, TODAY)).toBe(false);
  });

  it("archives a task completed last week", () => {
    const t = task({ id: "last-week", completedAt: at("2026-07-12") });
    expect(isArchived(t, TODAY)).toBe(true);
  });

  it("draws the boundary exactly at Monday 00:00 local", () => {
    // Sunday 23:59 of last week -> archived. Monday 00:00 -> on the board.
    // Off-by-one here would silently hide a task you finished this morning.
    expect(
      isArchived(task({ id: "sun", completedAt: at("2026-07-12", "23:59:59") }), TODAY),
    ).toBe(true);
    expect(
      isArchived(task({ id: "mon", completedAt: at("2026-07-13", "00:00:00") }), TODAY),
    ).toBe(false);
  });

  it("archives a done task with no completedAt — it can't be dated, so it's old", () => {
    const t = task({ id: "undated", status: "done", completedAt: null });
    expect(isArchived(t, TODAY)).toBe(true);
  });
});

describe("isArchived — open tasks never age out", () => {
  it("keeps an ancient open task on the board", () => {
    // A stale backlog item is not an archive candidate. Only DONE ages out.
    for (const status of ["inbox", "todo", "in_progress"] as const) {
      const t = task({
        id: status,
        status,
        completedAt: null,
        createdAt: "2020-01-01T00:00:00.000Z",
      });
      expect(isArchived(t, TODAY)).toBe(false);
    }
  });
});

describe("isArchived — manual", () => {
  it("archives immediately when archivedAt is set, even if completed today", () => {
    const t = task({
      id: "manual",
      completedAt: at("2026-07-14"),
      archivedAt: at("2026-07-14", "13:00:00"),
    });
    expect(isArchived(t, TODAY)).toBe(true);
  });

  it("archives a manually-archived task regardless of status", () => {
    const t = task({
      id: "manual-open",
      status: "todo",
      completedAt: null,
      archivedAt: at("2026-07-14"),
    });
    expect(isArchived(t, TODAY)).toBe(true);
  });
});

describe("boardTasks / archivedTasks", () => {
  const tasks = [
    task({ id: "open", status: "todo", completedAt: null }),
    task({ id: "this-week", completedAt: at("2026-07-13") }),
    task({ id: "last-week", completedAt: at("2026-07-10") }),
    task({ id: "older", completedAt: at("2026-06-01") }),
    task({
      id: "manual",
      completedAt: at("2026-07-14"),
      archivedAt: at("2026-07-14", "13:00:00"),
    }),
  ];

  it("splits the board from the archive", () => {
    expect(boardTasks(tasks, TODAY).map((t) => t.id)).toEqual([
      "open",
      "this-week",
    ]);
    expect(archivedTasks(tasks, TODAY).map((t) => t.id)).toEqual([
      "manual",
      "last-week",
      "older",
    ]);
  });

  it("orders the archive by most recent completion", () => {
    expect(archivedTasks(tasks, TODAY).map((t) => t.id)).toEqual([
      "manual", // 07-14
      "last-week", // 07-10
      "older", // 06-01
    ]);
  });

  it("excludes soft-deleted tasks from the archive — deleted is not archived", () => {
    const deleted = task({
      id: "deleted",
      completedAt: at("2026-06-01"),
      deletedAt: at("2026-06-02"),
    });
    expect(archivedTasks([...tasks, deleted], TODAY).map((t) => t.id)).not.toContain(
      "deleted",
    );
  });
});
