import { create } from "zustand";
import * as TaskRepository from "@/src/modules/task/TaskRepository";
import type { Task, TaskStatus } from "@/src/modules/task/types";
import { emit } from "@/src/lib/events";

interface TaskStore {
  tasks: Task[];
  isLoading: boolean;
  error: string | null;
  columnFilters: TaskStatus[];
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

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  isLoading: false,
  error: null,
  columnFilters: [],

  fetchTasks: async () => {
    set({ isLoading: true, error: null });
    try {
      const tasks = await TaskRepository.getTasks();
      set({ tasks, isLoading: false });
    } catch {
      set({ isLoading: false, error: FAILURE_MESSAGE });
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
    set({ tasks: [...previousTasks, optimisticTask], error: null });

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
    } catch {
      set({ tasks: previousTasks, error: FAILURE_MESSAGE });
    }
  },

  updateTask: async (id, updates) => {
    const previousTasks = get().tasks;
    set({
      tasks: previousTasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
      error: null,
    });

    try {
      const updated = await TaskRepository.updateTask(id, updates);
      set({ tasks: get().tasks.map((t) => (t.id === id ? updated : t)) });
      emit({
        type: "task.updated",
        payload: { taskId: id },
        timestamp: Date.now(),
      });
    } catch {
      set({ tasks: previousTasks, error: FAILURE_MESSAGE });
    }
  },

  updateStatus: async (id, status) => {
    const previousTasks = get().tasks;
    set({
      tasks: previousTasks.map((t) => (t.id === id ? { ...t, status } : t)),
      error: null,
    });

    try {
      const updated = await TaskRepository.updateTaskStatus(id, status);
      await get().fetchTasks();
      emit({
        type: status === "done" ? "task.completed" : "task.updated",
        payload: { taskId: updated.id },
        timestamp: Date.now(),
      });
    } catch {
      set({ tasks: previousTasks, error: FAILURE_MESSAGE });
    }
  },

  reorderTask: async (id, position) => {
    const previousTasks = get().tasks;
    set({
      tasks: previousTasks.map((t) => (t.id === id ? { ...t, position } : t)),
      error: null,
    });

    try {
      await TaskRepository.reorderTask(id, position);
    } catch {
      set({ tasks: previousTasks, error: FAILURE_MESSAGE });
    }
  },

  deleteTask: async (id) => {
    const previousTasks = get().tasks;
    set({
      tasks: previousTasks.filter((t) => t.id !== id && t.parentTaskId !== id),
      error: null,
    });

    try {
      await TaskRepository.deleteTask(id);
      emit({
        type: "task.deleted",
        payload: { taskId: id },
        timestamp: Date.now(),
      });
    } catch {
      set({ tasks: previousTasks, error: FAILURE_MESSAGE });
    }
  },
}));
