import type { Task } from "@/src/modules/task/types";

// Root task = level 1, its subtask = level 2, its sub-subtask = level 3.
// A 4th level is not allowed (spec §4: "multi-level nesting, but maximum of 3 levels").
export const MAX_TASK_DEPTH = 3;

// Depth of a task counting itself and all ancestors (root = 1). Pure/client-side:
// derives from the already-loaded task list, no DB round-trip.
export function taskDepth(tasks: Task[], id: string): number {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  let depth = 0;
  let current: Task | undefined = byId.get(id);
  while (current) {
    depth += 1;
    current = current.parentTaskId ? byId.get(current.parentTaskId) : undefined;
  }
  return depth;
}

// Whether a new subtask can be added under the given task without exceeding the
// depth limit. Use this to enable/disable the "add subtask" control in the UI.
export function canAddSubtask(tasks: Task[], id: string): boolean {
  return taskDepth(tasks, id) < MAX_TASK_DEPTH;
}
