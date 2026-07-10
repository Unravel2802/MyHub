import { describe, it, expect } from "vitest";
import {
  taskDepth,
  canAddSubtask,
  MAX_TASK_DEPTH,
} from "@/src/modules/task/taskTree";
import type { Task } from "@/src/modules/task/types";

function task(id: string, parentTaskId: string | null = null): Task {
  return {
    id,
    title: id,
    status: "inbox",
    position: 0,
    dueDate: null,
    parentTaskId,
    deletedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

const tree: Task[] = [
  task("root"),
  task("child", "root"),
  task("grandchild", "child"),
];

describe("taskDepth", () => {
  it("counts the task itself and its ancestors (root = 1)", () => {
    expect(taskDepth(tree, "root")).toBe(1);
    expect(taskDepth(tree, "child")).toBe(2);
    expect(taskDepth(tree, "grandchild")).toBe(3);
  });

  it("returns 0 for an unknown id", () => {
    expect(taskDepth(tree, "missing")).toBe(0);
  });
});

describe("canAddSubtask", () => {
  it("permits subtasks until the max depth is reached", () => {
    expect(canAddSubtask(tree, "root")).toBe(true); // child would be level 2
    expect(canAddSubtask(tree, "child")).toBe(true); // grandchild would be level 3
    expect(canAddSubtask(tree, "grandchild")).toBe(false); // would be level 4
  });

  it("uses MAX_TASK_DEPTH as the boundary", () => {
    expect(MAX_TASK_DEPTH).toBe(3);
  });
});
