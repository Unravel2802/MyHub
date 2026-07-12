import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Task } from "@/src/modules/task/types";

vi.mock("@/src/modules/task/TaskRepository", () => ({
  MaxDepthError: class MaxDepthError extends Error {
    readonly code = "max_depth" as const;
    constructor() {
      super("Subtasks can only nest 3 levels deep");
      this.name = "MaxDepthError";
    }
  },
  getTasks: vi.fn(),
  getTemplates: vi.fn(),
  regenerateWeeklyInstances: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  updateTaskStatus: vi.fn(),
  reorderTask: vi.fn(),
  moveTask: vi.fn(),
  deleteTask: vi.fn(),
}));

vi.mock("@/src/lib/events", () => ({
  emit: vi.fn(),
}));

import * as TaskRepository from "@/src/modules/task/TaskRepository";
import { emit } from "@/src/lib/events";
import { useTaskStore } from "@/src/modules/task/useTaskStore";

const repository = vi.mocked(TaskRepository);
const emitMock = vi.mocked(emit);

function task(overrides: Partial<Task> & { id: string }): Task {
  return {
    id: overrides.id,
    title: overrides.title ?? overrides.id,
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

function resetStore(tasks: Task[] = []) {
  useTaskStore.setState({
    tasks,
    templates: [],
    isLoading: false,
    error: null,
    columnFilters: [],
    isCreating: false,
    pendingIds: [],
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  resetStore();
  repository.regenerateWeeklyInstances.mockResolvedValue([]);
});

describe("useTaskStore fetchTasks", () => {
  it("regenerates weekly instances before loading the board", async () => {
    const tasks = [task({ id: "weekly-instance" })];
    repository.getTasks.mockResolvedValue(tasks);

    await useTaskStore.getState().fetchTasks();

    expect(repository.regenerateWeeklyInstances).toHaveBeenCalledOnce();
    expect(repository.getTasks).toHaveBeenCalledOnce();
    expect(
      repository.regenerateWeeklyInstances.mock.invocationCallOrder[0],
    ).toBeLessThan(repository.getTasks.mock.invocationCallOrder[0]);
    expect(useTaskStore.getState()).toMatchObject({
      tasks,
      isLoading: false,
      error: null,
    });
  });

  it("still loads tasks when weekly regeneration fails", async () => {
    const tasks = [task({ id: "existing" })];
    repository.regenerateWeeklyInstances.mockRejectedValue(
      new Error("regeneration failed"),
    );
    repository.getTasks.mockResolvedValue(tasks);

    await useTaskStore.getState().fetchTasks();

    expect(repository.getTasks).toHaveBeenCalledOnce();
    expect(useTaskStore.getState()).toMatchObject({
      tasks,
      isLoading: false,
      error: "regeneration failed",
    });
  });
});

describe("useTaskStore createTask", () => {
  it("replaces the optimistic task with the persisted task and emits task.created", async () => {
    const created = task({ id: "created", title: "Created", position: 4 });
    repository.createTask.mockResolvedValue(created);

    await useTaskStore.getState().createTask({ title: "Created" });

    expect(useTaskStore.getState().tasks).toEqual([created]);
    expect(useTaskStore.getState().isCreating).toBe(false);
    expect(emitMock).toHaveBeenCalledWith({
      type: "task.created",
      payload: { taskId: "created" },
      timestamp: expect.any(Number),
    });
  });

  it("reverts completed ancestors after creating a subtask", async () => {
    const root = task({ id: "root", status: "done" });
    const parent = task({
      id: "parent",
      parentTaskId: "root",
      status: "done",
    });
    const created = task({
      id: "created",
      title: "Created",
      parentTaskId: "parent",
    });
    resetStore([root, parent]);
    repository.createTask.mockResolvedValue(created);

    await useTaskStore
      .getState()
      .createTask({ title: "Created", parentTaskId: "parent" });

    expect(useTaskStore.getState().tasks).toEqual([
      { ...root, status: "todo" },
      { ...parent, status: "todo" },
      created,
    ]);
    expect(repository.getTasks).not.toHaveBeenCalled();
  });

  it("rolls back the optimistic task and exposes a user-facing error on failure", async () => {
    const existing = task({ id: "existing" });
    resetStore([existing]);
    repository.createTask.mockRejectedValue(new Error("database unavailable"));

    await useTaskStore.getState().createTask({ title: "New" });

    expect(useTaskStore.getState().tasks).toEqual([existing]);
    expect(useTaskStore.getState().error).toBe("database unavailable");
    expect(useTaskStore.getState().isCreating).toBe(false);
    expect(emitMock).not.toHaveBeenCalled();
  });

  it("stores a new recurrence template outside the board tasks", async () => {
    const template = task({
      id: "template",
      title: "Weekly practice",
      recursWeekly: true,
      weekday: 2,
    });
    repository.createTask.mockResolvedValue(template);

    await useTaskStore.getState().createTask({
      title: "Weekly practice",
      recursWeekly: true,
      weekday: 2,
    });

    expect(useTaskStore.getState().tasks).toEqual([]);
    expect(useTaskStore.getState().templates).toEqual([template]);
  });
});

describe("useTaskStore recurrence templates", () => {
  it("loads templates through the repository", async () => {
    const templates = [
      task({ id: "template", recursWeekly: true, weekday: 1 }),
    ];
    repository.getTemplates.mockResolvedValue(templates);

    await useTaskStore.getState().fetchTemplates();

    expect(useTaskStore.getState().templates).toEqual(templates);
  });

  it("removes a template without removing generated board instances", async () => {
    const template = task({
      id: "template",
      recursWeekly: true,
      weekday: 1,
    });
    const instance = task({
      id: "instance",
      recurrenceTemplateId: "template",
      occurrenceDate: "2026-07-13",
    });
    resetStore([instance]);
    useTaskStore.setState({ templates: [template] });
    repository.deleteTask.mockResolvedValue();

    await useTaskStore.getState().deleteTemplate("template");

    expect(useTaskStore.getState().templates).toEqual([]);
    expect(useTaskStore.getState().tasks).toEqual([instance]);
  });
});

describe("useTaskStore updateStatus", () => {
  it("applies completion cascades without refetching the board", async () => {
    const parent = task({ id: "parent", status: "todo" });
    const child = task({
      id: "child",
      parentTaskId: "parent",
      status: "todo",
    });
    const updated = { ...child, status: "done" as const };
    resetStore([parent, child]);
    repository.updateTaskStatus.mockResolvedValue(updated);

    await useTaskStore.getState().updateStatus("child", "done");

    expect(useTaskStore.getState().tasks).toEqual([
      { ...parent, status: "done" },
      updated,
    ]);
    expect(repository.getTasks).not.toHaveBeenCalled();
    expect(emitMock).toHaveBeenCalledWith({
      type: "task.completed",
      payload: { taskId: "child" },
      timestamp: expect.any(Number),
    });
  });

  it("recursively completes descendants of a level 2 task", async () => {
    const root = task({ id: "root", status: "todo" });
    const parent = task({
      id: "parent",
      parentTaskId: "root",
      status: "todo",
    });
    const child = task({
      id: "child",
      parentTaskId: "parent",
      status: "in_progress",
    });
    const updated = { ...parent, status: "done" as const };
    resetStore([root, parent, child]);
    repository.updateTaskStatus.mockResolvedValue(updated);

    await useTaskStore.getState().updateStatus("parent", "done");

    expect(useTaskStore.getState().tasks).toEqual([
      { ...root, status: "done" },
      updated,
      { ...child, status: "done" },
    ]);
  });
});

describe("useTaskStore moveTask", () => {
  it("keeps a successful within-column reorder without refetching", async () => {
    const original = task({ id: "a", status: "todo", position: 0 });
    const moved = { ...original, position: 2 };
    resetStore([original]);
    repository.moveTask.mockResolvedValue(moved);

    await useTaskStore.getState().moveTask("a", { position: 2 });

    expect(useTaskStore.getState().tasks).toEqual([moved]);
    expect(repository.getTasks).not.toHaveBeenCalled();
    expect(useTaskStore.getState().pendingIds).toEqual([]);
    expect(emitMock).toHaveBeenCalledWith({
      type: "task.updated",
      payload: { taskId: "a" },
      timestamp: expect.any(Number),
    });
  });

  it("reflects cross-column cascade side effects without refetching the board", async () => {
    const parent = task({ id: "parent", status: "todo" });
    const original = task({
      id: "child",
      parentTaskId: "parent",
      status: "todo",
      position: 0,
    });
    const moved = { ...original, status: "done" as const, position: 1 };
    resetStore([parent, original]);
    repository.moveTask.mockResolvedValue(moved);

    await useTaskStore
      .getState()
      .moveTask("child", { status: "done", position: 1 });

    expect(useTaskStore.getState().tasks).toEqual([
      { ...parent, status: "done" },
      moved,
    ]);
    expect(repository.getTasks).not.toHaveBeenCalled();
    expect(emitMock).toHaveBeenCalledWith({
      type: "task.completed",
      payload: { taskId: "child" },
      timestamp: expect.any(Number),
    });
  });

  it("recursively completes descendants when a level 2 task is moved to done", async () => {
    const root = task({ id: "root", status: "todo" });
    const parent = task({
      id: "parent",
      parentTaskId: "root",
      status: "todo",
      position: 0,
    });
    const child = task({
      id: "child",
      parentTaskId: "parent",
      status: "in_progress",
    });
    const moved = { ...parent, status: "done" as const, position: 1 };
    resetStore([root, parent, child]);
    repository.moveTask.mockResolvedValue(moved);

    await useTaskStore
      .getState()
      .moveTask("parent", { status: "done", position: 1 });

    expect(useTaskStore.getState().tasks).toEqual([
      { ...root, status: "done" },
      moved,
      { ...child, status: "done" },
    ]);
  });

  it("reverts done ancestors locally when a child is moved out of done", async () => {
    const grandparent = task({ id: "grandparent", status: "done" });
    const parent = task({
      id: "parent",
      parentTaskId: "grandparent",
      status: "done",
    });
    const original = task({
      id: "child",
      parentTaskId: "parent",
      status: "done",
    });
    const moved = { ...original, status: "todo" as const, position: 2 };
    resetStore([grandparent, parent, original]);
    repository.moveTask.mockResolvedValue(moved);

    await useTaskStore.getState().moveTask("child", {
      status: "todo",
      position: 2,
    });

    expect(useTaskStore.getState().tasks).toEqual([
      { ...grandparent, status: "todo" },
      { ...parent, status: "todo" },
      moved,
    ]);
    expect(repository.getTasks).not.toHaveBeenCalled();
  });

  it("rolls back a failed move and clears pending state", async () => {
    const original = task({ id: "a", status: "todo", position: 0 });
    resetStore([original]);
    repository.moveTask.mockRejectedValue(new Error("move failed"));

    await useTaskStore
      .getState()
      .moveTask("a", { status: "in_progress", position: 3 });

    expect(useTaskStore.getState().tasks).toEqual([original]);
    expect(useTaskStore.getState().pendingIds).toEqual([]);
    expect(useTaskStore.getState().error).toBe("move failed");
    expect(emitMock).not.toHaveBeenCalled();
  });
});

describe("useTaskStore deleteTask", () => {
  it("optimistically removes the full subtree before deleting", async () => {
    const root = task({ id: "root" });
    const child = task({ id: "child", parentTaskId: "root" });
    const grandchild = task({ id: "grandchild", parentTaskId: "child" });
    const unrelated = task({ id: "unrelated" });
    resetStore([root, child, grandchild, unrelated]);
    repository.deleteTask.mockResolvedValue();

    await useTaskStore.getState().deleteTask("root");

    expect(useTaskStore.getState().tasks).toEqual([unrelated]);
    expect(emitMock).toHaveBeenCalledWith({
      type: "task.deleted",
      payload: { taskId: "root" },
      timestamp: expect.any(Number),
    });
  });

  it("restores the subtree when deletion fails", async () => {
    const tasks = [
      task({ id: "root" }),
      task({ id: "child", parentTaskId: "root" }),
    ];
    resetStore(tasks);
    repository.deleteTask.mockRejectedValue(new Error("delete failed"));

    await useTaskStore.getState().deleteTask("root");

    expect(useTaskStore.getState().tasks).toEqual(tasks);
    expect(useTaskStore.getState().pendingIds).toEqual([]);
    expect(useTaskStore.getState().error).toBe("delete failed");
  });
});
