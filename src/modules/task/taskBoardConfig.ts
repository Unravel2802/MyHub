import type { TaskStatus } from "@/src/modules/task/types";

export type ColumnConfig = {
  status: TaskStatus;
  title: string;
  description: string;
  accent: string;
  emptyCopy: string;
};

export const columns: ColumnConfig[] = [
  {
    status: "inbox",
    title: "Inbox",
    description: "New captures waiting for triage",
    accent: "bg-sky-500",
    emptyCopy: "New quick captures will show up here.",
  },
  {
    status: "todo",
    title: "Todo",
    description: "Ready to start next",
    accent: "bg-amber-500",
    emptyCopy: "Prioritized tasks will show up here.",
  },
  {
    status: "in_progress",
    title: "In Progress",
    description: "Current focus",
    accent: "bg-teal-600",
    emptyCopy: "Move a task here when work starts.",
  },
  {
    status: "done",
    title: "Done",
    description: "Completed this week",
    accent: "bg-zinc-500",
    emptyCopy: "Completed tasks will show up here.",
  },
];
