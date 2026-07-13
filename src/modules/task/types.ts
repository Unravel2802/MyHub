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
  // Recurrence (myhub_plan.md Part A §A.2). A task is exactly one of three things:
  //   - an ordinary task: recursWeekly false, both recurrence fields null
  //   - a template:       recursWeekly true, weekday set — a rule, never shown
  //                       on the board, never completed
  //   - an instance:      recurrenceTemplateId + occurrenceDate set — the weekly
  //                       copy of a template that you actually work on
  recursWeekly: boolean;
  weekday: Weekday | null;
  recurrenceTemplateId: string | null;
  occurrenceDate: string | null;
  // Set the instant status transitions TO "done" (directly, or via a cascade
  // completing a descendant/ancestor); cleared the instant it leaves "done".
  // Added for Momentum's streak tracking (myhub_plan.md Part B, Phase 2) —
  // updatedAt isn't usable for this since any later edit overwrites it, not
  // just a completion.
  completedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
