import { columns } from "@/src/modules/task/taskBoardConfig";
import { positionBetween } from "@/src/modules/task/taskTree";
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

export function isTaskStatus(value: string): value is TaskStatus {
  return columns.some((column) => column.status === value);
}

export function getTaskStatus(tasks: Task[], id: string) {
  return tasks.find((task) => task.id === id)?.status ?? null;
}

export function getDropPosition(
  targetTasks: Task[],
  activeId: string,
  overId: string | null,
) {
  const orderedTasks = targetTasks
    .filter((task) => task.id !== activeId)
    .sort((a, b) => a.position - b.position);

  if (orderedTasks.length === 0) return 0;
  if (!overId || overId === activeId) {
    return orderedTasks[orderedTasks.length - 1].position + 1000;
  }

  const overIndex = orderedTasks.findIndex((task) => task.id === overId);
  if (overIndex === -1) {
    return orderedTasks[orderedTasks.length - 1].position + 1000;
  }

  const previousTask = orderedTasks[overIndex - 1];
  const nextTask = orderedTasks[overIndex];

  return positionBetween(previousTask?.position ?? null, nextTask.position);
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
