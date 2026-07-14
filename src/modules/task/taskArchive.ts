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
  // `== null` (loose) catches undefined as well as null. A row from a database
  // that hasn't run migration 0013 yet — or any mock missing the column — maps
  // to `undefined`, and a strict `=== null` check would sail past it into
  // `new Date(undefined)`, which is an Invalid Date and makes format() throw
  // RangeError. Defensive on purpose: the shape of a row is not something this
  // function should be able to crash on.
  if (task.completedAt == null) return null;

  const completed = new Date(task.completedAt);
  if (Number.isNaN(completed.getTime())) return null;
  return format(completed, "yyyy-MM-dd");
}

export function isArchived(task: Task, today: Date): boolean {
  // Loose `!=` again, and it matters more here than anywhere: with a strict
  // `!== null`, a task whose `archived_at` column doesn't exist arrives as
  // `undefined`, reads as archived, and EVERY task silently vanishes from the
  // board. That is exactly what happened — the board went blank against a mock
  // that lacked the column, and would have done the same against the real
  // database in the window before migration 0013 was applied.
  if (task.archivedAt != null) return true;
  // Only DONE tasks can age out. An open task is never archived by time, no
  // matter how long it's been sitting there — that's a backlog, not an archive.
  if (task.status !== "done") return false;

  const completedDay = completedDayKey(task);
  // A done task with NO usable completion date stays on the board.
  //
  // The tempting rule is the opposite — "undated means old, archive it" — and
  // that's what this did first. It's wrong, and dangerously so: it makes a task
  // the user can plainly see disappear from the board on nothing more than a
  // GUESS that it's old, with no undo and no signal that it happened. Archiving
  // must be something you did (`archivedAt`) or something provable (completed in
  // an earlier week). "We don't know when this finished" is neither.
  //
  // Erring toward visible is the cheap mistake here: a stale card on the board is
  // an annoyance, a silently vanished one is lost work.
  if (completedDay === null) return false;

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
