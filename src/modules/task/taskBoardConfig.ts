import type { TaskStatus } from "@/src/modules/task/types";
import type { HueName } from "@/src/components/moduleHues";

export type ColumnConfig = {
  status: TaskStatus;
  title: string;
  description: string;
  accent: HueName | null;
  emptyCopy: string;
};

export const columns: ColumnConfig[] = [
  {
    status: "inbox",
    title: "Inbox",
    description: "New captures waiting for triage",
    accent: "blue",
    emptyCopy: "New quick captures will show up here.",
  },
  {
    status: "todo",
    title: "Todo",
    description: "Ready to start next",
    accent: "amber",
    emptyCopy: "Prioritized tasks will show up here.",
  },
  {
    status: "in_progress",
    title: "In Progress",
    description: "Current focus",
    accent: "teal",
    emptyCopy: "Move a task here when work starts.",
  },
  {
    status: "done",
    title: "Done",
    description: "Completed this week",
    accent: null,
    emptyCopy: "Completed tasks will show up here.",
  },
];
