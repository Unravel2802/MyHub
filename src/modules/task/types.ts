export type TaskStatus = "inbox" | "todo" | "in_progress" | "done";

// 0 = Sunday, matching Date.getDay(). Stored as smallint 0-6.
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  position: number;
  dueDate: string | null;
  parentTaskId: string | null;
  // Recurrence (myhub_plan.md §2.3). A task is exactly one of three things:
  //   - an ordinary task: recursWeekly false, both recurrence fields null
  //   - a template:       recursWeekly true, weekday set — a rule, never shown
  //                       on the board, never completed
  //   - an instance:      recurrenceTemplateId + occurrenceDate set — the weekly
  //                       copy of a template that you actually work on
  recursWeekly: boolean;
  weekday: Weekday | null;
  recurrenceTemplateId: string | null;
  occurrenceDate: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
