import { format, startOfWeek } from "date-fns";
import type { Task } from "@/src/modules/task/types";

// Which completed tasks have left the board, and why (migration 0013).
//
// A done task leaves the board two ways:
//   - MANUALLY: you archived it. `archivedAt` is set. Explicit, immediate.
//   - BY AGE: it was completed before this week. Derived from `completedAt` at
//     render time; nothing is written. This is what makes the Done column's
//     "Completed this week" label finally true — it had been claiming that
//     while actually accumulating forever.
//
// Archiving is NOT deleting. The row stays live and keeps its completedAt, so
// Momentum's streak still counts the day. That separation is the whole point:
// deleting a finished task used to be the only way to tidy up, and it silently
// erased streak history.

// Monday-start, local wall clock. Same convention as dashboardSelectors'
// weekBounds and taskRecurrence — the app has exactly one idea of "this week".
export function weekStartKey(today: Date): string {
  return format(startOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd");
}

// format(), NOT `.slice(0, 10)`. completedAt is a timestamptz INSTANT; slicing
// its ISO string reads the UTC date, which is the wrong day for anyone east or
// west of UTC. Finishing a task at 9pm in UTC+7 would otherwise look like
// tomorrow's completion and could hide it from the current week a day early.
// Same trap the streak code documents.
function completedDayKey(task: Task): string | null {
  return task.completedAt === null
    ? null
    : format(new Date(task.completedAt), "yyyy-MM-dd");
}

export function isArchived(task: Task, today: Date): boolean {
  if (task.archivedAt !== null) return true;
  // Only DONE tasks can age out. An open task is never archived by time, no
  // matter how long it's been sitting there — that's a backlog, not an archive.
  if (task.status !== "done") return false;

  const completedDay = completedDayKey(task);
  // A done task with no completedAt predates the timestamp column and can't be
  // dated. Treat it as archived rather than pinning it to the board forever —
  // it is, by definition, old.
  if (completedDay === null) return true;

  return completedDay < weekStartKey(today);
}

// The board's view: everything not archived.
export function boardTasks(tasks: Task[], today: Date): Task[] {
  return tasks.filter((task) => !isArchived(task, today));
}

// The archive view's: everything archived, newest completion first. Tasks with
// no completedAt sort last — they're the undateable stragglers.
export function archivedTasks(tasks: Task[], today: Date): Task[] {
  return tasks
    .filter((task) => !task.deletedAt && isArchived(task, today))
    .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
}
