import { create } from "zustand";
import * as TaskRepository from "@/src/modules/task/TaskRepository";
import { MaxDepthError } from "@/src/modules/task/TaskRepository";
import type { Task, TaskStatus, Weekday } from "@/src/modules/task/types";
import { descendantIds } from "@/src/modules/task/taskTree";
import { emit } from "@/src/lib/events";

interface TaskStore {
  tasks: Task[];
  // Recurrence rules, kept separate from `tasks` on purpose: a template is not a
  // work item and must never reach the board. This backs the "manage recurring
  // rules" surface — components can't call the repository directly.
  templates: Task[];
  isLoading: boolean;
  error: string | null;
  columnFilters: TaskStatus[];
  // In-flight tracking so the UI can disable controls / show spinners per card.
  isCreating: boolean;
  pendingIds: string[];
  fetchTasks: () => Promise<void>;
  fetchTemplates: () => Promise<void>;
  // Stops future generation. Instances already generated are left alone — they're
  // real work you may still intend to do, and silently deleting last Tuesday's
  // completed block would rewrite history.
  deleteTemplate: (id: string) => Promise<void>;
  setColumnFilters: (statuses: TaskStatus[]) => void;
  // Passing recursWeekly + weekday creates a recurrence template rather than a
  // board task: it generates a fresh instance each week and never appears on the
  // board itself (myhub_plan.md §2.3).
  createTask: (input: {
    title: string;
    description?: string | null;
    parentTaskId?: string | null;
    dueDate?: string | null;
    recursWeekly?: boolean;
    weekday?: Weekday | null;
  }) => Promise<void>;
  updateTask: (
    id: string,
    updates: Partial<Pick<Task, "title" | "dueDate">>,
  ) => Promise<void>;
  updateStatus: (id: string, status: TaskStatus) => Promise<void>;
  reorderTask: (id: string, position: number) => Promise<void>;
  moveTask: (
    id: string,
    changes: { status?: TaskStatus; position: number },
  ) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
}

const FAILURE_MESSAGE = "Something went wrong, please try again later.";

// Log the real error for debugging, return a user-facing message. Known typed
// errors (e.g. the subtask depth limit) get a specific message; everything else
// falls back to the generic banner.
function toUserMessage(err: unknown): string {
  console.error(err);
  if (err instanceof MaxDepthError) return err.message;
  return FAILURE_MESSAGE;
}

function replaceTask(tasks: Task[], updated: Task): Task[] {
  return tasks.map((task) => (task.id === updated.id ? updated : task));
}

function completeDoneAncestors(tasks: Task[], parentId: string | null): Task[] {
  let nextTasks = tasks;
  let currentParentId = parentId;

  while (currentParentId) {
    const children = nextTasks.filter(
      (task) => task.parentTaskId === currentParentId && !task.deletedAt,
    );
    if (
      children.length === 0 ||
      !children.every((task) => task.status === "done")
    ) {
      break;
    }

    const parent = nextTasks.find((task) => task.id === currentParentId);
    if (!parent) break;

    nextTasks = nextTasks.map((task) =>
      task.id === currentParentId ? { ...task, status: "done" } : task,
    );
    currentParentId = parent.parentTaskId;
  }

  return nextTasks;
}

function revertDoneAncestors(tasks: Task[], parentId: string | null): Task[] {
  let nextTasks = tasks;
  let currentParentId = parentId;

  while (currentParentId) {
    const parent = nextTasks.find((task) => task.id === currentParentId);
    if (!parent || parent.status !== "done") break;

    nextTasks = nextTasks.map((task) =>
      task.id === currentParentId ? { ...task, status: "todo" } : task,
    );
    currentParentId = parent.parentTaskId;
  }

  return nextTasks;
}

function completeTaskDescendants(tasks: Task[], taskId: string): Task[] {
  const idsToComplete = new Set(descendantIds(tasks, taskId));
  return tasks.map((task) =>
    idsToComplete.has(task.id) ? { ...task, status: "done" } : task,
  );
}

function applyStatusCascade(tasks: Task[], updated: Task): Task[] {
  let nextTasks = replaceTask(tasks, updated);
  if (updated.status === "done") {
    nextTasks = completeTaskDescendants(nextTasks, updated.id);
    return completeDoneAncestors(nextTasks, updated.parentTaskId);
  }

  return revertDoneAncestors(nextTasks, updated.parentTaskId);
}

export const useTaskStore = create<TaskStore>((set, get) => {
  const addPending = (id: string) =>
    set({ pendingIds: [...get().pendingIds, id] });
  const removePending = (id: string) =>
    set({ pendingIds: get().pendingIds.filter((x) => x !== id) });

  return {
    tasks: [],
    templates: [],
    isLoading: false,
    error: null,
    columnFilters: [],
    isCreating: false,
    pendingIds: [],

    fetchTasks: async () => {
      set({ isLoading: true, error: null });
      let recurrenceError: string | null = null;

      try {
        await TaskRepository.regenerateWeeklyInstances();
      } catch (err) {
        recurrenceError = toUserMessage(err);
      }

      try {
        const tasks = await TaskRepository.getTasks();
        set({ tasks, isLoading: false, error: recurrenceError });
      } catch (err) {
        set({ isLoading: false, error: toUserMessage(err) });
      }
    },

    fetchTemplates: async () => {
      try {
        const templates = await TaskRepository.getTemplates();
        set({ templates });
      } catch (err) {
        set({ error: toUserMessage(err) });
      }
    },

    deleteTemplate: async (id) => {
      const previousTemplates = get().templates;
      set({
        templates: previousTemplates.filter((t) => t.id !== id),
        error: null,
      });
      addPending(id);

      try {
        await TaskRepository.deleteTask(id);
        emit({
          type: "task.deleted",
          payload: { taskId: id },
          timestamp: Date.now(),
        });
      } catch (err) {
        set({ templates: previousTemplates, error: toUserMessage(err) });
      } finally {
        removePending(id);
      }
    },

    setColumnFilters: (statuses) => set({ columnFilters: statuses }),

    createTask: async (input) => {
      const previousTasks = get().tasks;
      const optimisticTask: Task = {
        id: `optimistic-${crypto.randomUUID()}`,
        title: input.title,
        description: input.description ?? null,
        status: "inbox",
        position: 0,
        dueDate: input.dueDate ?? null,
        parentTaskId: input.parentTaskId ?? null,
        recursWeekly: input.recursWeekly ?? false,
        weekday: input.weekday ?? null,
        recurrenceTemplateId: null,
        occurrenceDate: null,
        deletedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      // A template is a recurrence rule, not a work item — it must never enter
      // `tasks`, or the board would render the rule alongside the instances it
      // generates. Its instance shows up on the next fetch instead.
      const isTemplate = input.recursWeekly === true;
      set({
        tasks: isTemplate ? previousTasks : [...previousTasks, optimisticTask],
        error: null,
        isCreating: true,
      });

      try {
        const created = await TaskRepository.createTask(input);
        if (isTemplate) {
          // The rule itself belongs in `templates`, not on the board. Its first
          // instance appears on the next fetch, via regeneration.
          set({ templates: [...get().templates, created] });
        } else {
          set({
            tasks: revertDoneAncestors(
              get().tasks.map((t) =>
                t.id === optimisticTask.id ? created : t,
              ),
              created.parentTaskId,
            ),
          });
        }
        emit({
          type: "task.created",
          payload: { taskId: created.id },
          timestamp: Date.now(),
        });
      } catch (err) {
        set({ tasks: previousTasks, error: toUserMessage(err) });
      } finally {
        set({ isCreating: false });
      }
    },

    updateTask: async (id, updates) => {
      const previousTasks = get().tasks;
      set({
        tasks: previousTasks.map((t) =>
          t.id === id ? { ...t, ...updates } : t,
        ),
        error: null,
      });
      addPending(id);

      try {
        const updated = await TaskRepository.updateTask(id, updates);
        set({ tasks: get().tasks.map((t) => (t.id === id ? updated : t)) });
        emit({
          type: "task.updated",
          payload: { taskId: id },
          timestamp: Date.now(),
        });
      } catch (err) {
        set({ tasks: previousTasks, error: toUserMessage(err) });
      } finally {
        removePending(id);
      }
    },

    updateStatus: async (id, status) => {
      const previousTasks = get().tasks;
      set({
        tasks: previousTasks.map((t) => (t.id === id ? { ...t, status } : t)),
        error: null,
      });
      addPending(id);

      try {
        const updated = await TaskRepository.updateTaskStatus(id, status);
        set({ tasks: applyStatusCascade(get().tasks, updated) });
        emit({
          type: status === "done" ? "task.completed" : "task.updated",
          payload: { taskId: updated.id },
          timestamp: Date.now(),
        });
      } catch (err) {
        set({ tasks: previousTasks, error: toUserMessage(err) });
      } finally {
        removePending(id);
      }
    },

    reorderTask: async (id, position) => {
      const previousTasks = get().tasks;
      set({
        tasks: previousTasks.map((t) => (t.id === id ? { ...t, position } : t)),
        error: null,
      });
      addPending(id);

      try {
        await TaskRepository.reorderTask(id, position);
      } catch (err) {
        set({ tasks: previousTasks, error: toUserMessage(err) });
      } finally {
        removePending(id);
      }
    },

    moveTask: async (id, changes) => {
      const previousTasks = get().tasks;
      set({
        tasks: previousTasks.map((t) =>
          t.id === id
            ? {
                ...t,
                position: changes.position,
                ...(changes.status !== undefined && { status: changes.status }),
              }
            : t,
        ),
        error: null,
      });
      addPending(id);

      try {
        const updated = await TaskRepository.moveTask(id, changes);
        set({
          tasks:
            changes.status === undefined
              ? replaceTask(get().tasks, updated)
              : applyStatusCascade(get().tasks, updated),
        });
        emit({
          type: changes.status === "done" ? "task.completed" : "task.updated",
          payload: { taskId: id },
          timestamp: Date.now(),
        });
      } catch (err) {
        set({ tasks: previousTasks, error: toUserMessage(err) });
      } finally {
        removePending(id);
      }
    },

    deleteTask: async (id) => {
      const previousTasks = get().tasks;
      // Optimistically drop the whole subtree, matching the repository's
      // recursive soft-delete cascade (not just direct children).
      const toRemove = new Set([id, ...descendantIds(previousTasks, id)]);
      set({
        tasks: previousTasks.filter((t) => !toRemove.has(t.id)),
        error: null,
      });
      addPending(id);

      try {
        await TaskRepository.deleteTask(id);
        emit({
          type: "task.deleted",
          payload: { taskId: id },
          timestamp: Date.now(),
        });
      } catch (err) {
        set({ tasks: previousTasks, error: toUserMessage(err) });
      } finally {
        removePending(id);
      }
    },
  };
});
