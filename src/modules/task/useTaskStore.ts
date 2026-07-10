import { create } from "zustand";
import * as TaskRepository from "@/src/modules/task/TaskRepository";
import { MaxDepthError } from "@/src/modules/task/TaskRepository";
import type { Task, TaskStatus } from "@/src/modules/task/types";
import { emit } from "@/src/lib/events";

interface TaskStore {
  tasks: Task[];
  isLoading: boolean;
  error: string | null;
  columnFilters: TaskStatus[];
  // In-flight tracking so the UI can disable controls / show spinners per card.
  isCreating: boolean;
  pendingIds: string[];
  fetchTasks: () => Promise<void>;
  setColumnFilters: (statuses: TaskStatus[]) => void;
  createTask: (input: {
    title: string;
    parentTaskId?: string | null;
    dueDate?: string | null;
  }) => Promise<void>;
  updateTask: (
    id: string,
    updates: Partial<Pick<Task, "title" | "dueDate">>,
  ) => Promise<void>;
  updateStatus: (id: string, status: TaskStatus) => Promise<void>;
  reorderTask: (id: string, position: number) => Promise<void>;
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

export const useTaskStore = create<TaskStore>((set, get) => {
  const addPending = (id: string) =>
    set({ pendingIds: [...get().pendingIds, id] });
  const removePending = (id: string) =>
    set({ pendingIds: get().pendingIds.filter((x) => x !== id) });

  return {
    tasks: [],
    isLoading: false,
    error: null,
    columnFilters: [],
    isCreating: false,
    pendingIds: [],

    fetchTasks: async () => {
      set({ isLoading: true, error: null });
      try {
        const tasks = await TaskRepository.getTasks();
        set({ tasks, isLoading: false });
      } catch (err) {
        set({ isLoading: false, error: toUserMessage(err) });
      }
    },

    setColumnFilters: (statuses) => set({ columnFilters: statuses }),

    createTask: async (input) => {
      const previousTasks = get().tasks;
      const optimisticTask: Task = {
        id: `optimistic-${crypto.randomUUID()}`,
        title: input.title,
        status: "inbox",
        position: 0,
        dueDate: input.dueDate ?? null,
        parentTaskId: input.parentTaskId ?? null,
        deletedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      set({
        tasks: [...previousTasks, optimisticTask],
        error: null,
        isCreating: true,
      });

      try {
        const created = await TaskRepository.createTask(input);
        set({
          tasks: get().tasks.map((t) =>
            t.id === optimisticTask.id ? created : t,
          ),
        });
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
        await get().fetchTasks();
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

    deleteTask: async (id) => {
      const previousTasks = get().tasks;
      set({
        tasks: previousTasks.filter(
          (t) => t.id !== id && t.parentTaskId !== id,
        ),
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
