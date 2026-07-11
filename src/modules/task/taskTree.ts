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

// All descendant ids of a task (children, grandchildren, …), excluding the task
// itself. Client-side mirror of the repository's soft-delete cascade — use it to
// optimistically remove a whole subtree from the board.
export function descendantIds(tasks: Task[], id: string): string[] {
  const childrenByParent = new Map<string, string[]>();
  for (const t of tasks) {
    if (t.parentTaskId) {
      const siblings = childrenByParent.get(t.parentTaskId) ?? [];
      siblings.push(t.id);
      childrenByParent.set(t.parentTaskId, siblings);
    }
  }

  const result: string[] = [];
  const stack = [...(childrenByParent.get(id) ?? [])];
  while (stack.length > 0) {
    const current = stack.pop()!;
    result.push(current);
    stack.push(...(childrenByParent.get(current) ?? []));
  }
  return result;
}

// Fractional position for a card dropped between two neighbors. Pass the position
// of the card immediately before / after the drop target, or null when dropping
// at the start/end of a column. Pair with the store's moveTask on drop.
export function positionBetween(
  before: number | null,
  after: number | null,
): number {
  if (before === null && after === null) return 0;
  if (before === null) return after! - 1;
  if (after === null) return before + 1;
  return (before + after) / 2;
}
