import { columns } from "@/src/modules/task/taskBoardConfig";
import type { Task, TaskStatus } from "@/src/modules/task/types";

export type TaskStats = {
  label: string;
  value: number;
};

export function formatStatus(status: TaskStatus) {
  return columns.find((column) => column.status === status)?.title ?? status;
}

export function formatDueDate(dueDate: string | null) {
  if (!dueDate) return "No due date";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(`${dueDate}T00:00:00`));
}

export function filterVisibleTasks(tasks: Task[], searchTerm: string) {
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const activeTasks = tasks.filter((task) => !task.deletedAt);

  if (!normalizedSearch) return activeTasks;

  return activeTasks.filter((task) =>
    task.title.toLowerCase().includes(normalizedSearch),
  );
}

export function groupTasksByStatus(tasks: Task[]) {
  return columns.reduce<Record<TaskStatus, Task[]>>(
    (acc, column) => {
      acc[column.status] = tasks
        .filter((task) => task.status === column.status)
        .sort((a, b) => a.position - b.position);
      return acc;
    },
    {
      inbox: [],
      todo: [],
      in_progress: [],
      done: [],
    },
  );
}

export function getTaskStats(tasks: Task[], today: string): TaskStats[] {
  const activeTasks = tasks.filter((task) => !task.deletedAt);

  return [
    {
      label: "Open tasks",
      value: activeTasks.filter((task) => task.status !== "done").length,
    },
    {
      label: "Due today",
      value: activeTasks.filter((task) => task.dueDate === today).length,
    },
    {
      label: "Completed",
      value: activeTasks.filter((task) => task.status === "done").length,
    },
  ];
}
