import { supabase } from "@/src/lib/supabaseClient";
import type { Task, TaskStatus } from "@/src/modules/task/types";
import { MAX_TASK_DEPTH } from "@/src/modules/task/taskTree";

// Thrown when creating a subtask would exceed the nesting limit (spec §4).
// Carries a stable `code` so the store/UI can distinguish it from generic failures.
export class MaxDepthError extends Error {
  readonly code = "max_depth" as const;
  constructor() {
    super(`Subtasks can only nest ${MAX_TASK_DEPTH} levels deep`);
    this.name = "MaxDepthError";
  }
}

interface TaskRow {
  id: string;
  title: string;
  status: TaskStatus;
  position: number;
  due_date: string | null;
  parent_task_id: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

function fromRow(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    position: row.position,
    dueDate: row.due_date,
    parentTaskId: row.parent_task_id,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getTasks(): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .is("deleted_at", null)
    .order("position", { ascending: true });

  if (error) throw error;
  return data.map(fromRow);
}

export async function createTask(input: {
  title: string;
  parentTaskId?: string | null;
  dueDate?: string | null;
  position?: number;
}): Promise<Task> {
  // Enforce the nesting limit before inserting: a new child sits one level below
  // its parent, so the parent must be shallower than the max depth.
  if (input.parentTaskId) {
    const parentDepth = await getDepth(input.parentTaskId);
    if (parentDepth >= MAX_TASK_DEPTH) {
      throw new MaxDepthError();
    }
  }

  // New tasks land in the inbox column; append them to the end so ordering is
  // stable and drag-and-drop has distinct positions to reorder against.
  const position = input.position ?? (await nextPosition("inbox"));

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      title: input.title,
      parent_task_id: input.parentTaskId ?? null,
      due_date: input.dueDate ?? null,
      position,
    })
    .select()
    .single();

  if (error) throw error;

  if (input.parentTaskId) {
    await revertAncestorsToIncomplete(input.parentTaskId);
  }

  return fromRow(data);
}

// The next position at the end of a column: one past the current max among
// non-deleted tasks of that status (0 when the column is empty).
async function nextPosition(status: TaskStatus): Promise<number> {
  const { data, error } = (await supabase
    .from("tasks")
    .select("position")
    .eq("status", status)
    .is("deleted_at", null)) as {
    data: { position: number }[] | null;
    error: unknown;
  };

  if (error) throw error;
  const positions = (data ?? []).map((r) => r.position);
  return positions.length > 0 ? Math.max(...positions) + 1 : 0;
}

// Depth of a task counting itself and all ancestors (root = 1), via the DB.
// Authoritative counterpart to taskTree.taskDepth, which the UI uses client-side.
async function getDepth(taskId: string): Promise<number> {
  let depth = 0;
  let currentId: string | null = taskId;

  while (currentId) {
    const { data, error } = (await supabase
      .from("tasks")
      .select("parent_task_id")
      .eq("id", currentId)
      .single()) as {
      data: { parent_task_id: string | null } | null;
      error: unknown;
    };

    if (error) throw error;
    depth += 1;
    currentId = data?.parent_task_id ?? null;
  }

  return depth;
}

export async function updateTask(
  id: string,
  updates: Partial<Pick<Task, "title" | "dueDate">>,
): Promise<Task> {
  const { data, error } = await supabase
    .from("tasks")
    .update({
      ...(updates.title !== undefined && { title: updates.title }),
      ...(updates.dueDate !== undefined && { due_date: updates.dueDate }),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return fromRow(data);
}

// Move a task to a new position, optionally into a different column, in a single
// write. Used for drag-and-drop drops (within-column reorder and cross-column
// moves). When the status changes, runs the same parent auto-complete / revert
// cascade as updateTaskStatus so completion behavior stays consistent.
export async function moveTask(
  id: string,
  changes: { status?: TaskStatus; position: number },
): Promise<Task> {
  const { data, error } = await supabase
    .from("tasks")
    .update({
      position: changes.position,
      ...(changes.status !== undefined && { status: changes.status }),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  const task = fromRow(data);

  if (changes.status !== undefined && task.parentTaskId) {
    if (changes.status === "done") {
      await autoCompleteAncestors(task.parentTaskId);
    } else {
      await revertAncestorsToIncomplete(task.parentTaskId);
    }
  }

  return task;
}

export async function reorderTask(id: string, position: number): Promise<Task> {
  const { data, error } = await supabase
    .from("tasks")
    .update({ position })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return fromRow(data);
}

export async function updateTaskStatus(
  id: string,
  status: TaskStatus,
): Promise<Task> {
  const { data, error } = await supabase
    .from("tasks")
    .update({ status })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  const task = fromRow(data);

  if (status === "done" && task.parentTaskId) {
    await autoCompleteAncestors(task.parentTaskId);
  } else if (status !== "done" && task.parentTaskId) {
    await revertAncestorsToIncomplete(task.parentTaskId);
  }

  return task;
}

export async function deleteTask(id: string): Promise<void> {
  const idsToDelete = await collectDescendantIds([id]);
  const { error } = await supabase
    .from("tasks")
    .update({ deleted_at: new Date().toISOString() })
    .in("id", idsToDelete);

  if (error) throw error;
}

async function collectDescendantIds(rootIds: string[]): Promise<string[]> {
  const allIds = [...rootIds];
  let frontier = rootIds;

  while (frontier.length > 0) {
    const { data, error } = await supabase
      .from("tasks")
      .select("id")
      .in("parent_task_id", frontier)
      .is("deleted_at", null);

    if (error) throw error;
    if (data.length === 0) break;

    const childIds = data.map((row) => row.id);
    allIds.push(...childIds);
    frontier = childIds;
  }

  return allIds;
}

async function autoCompleteAncestors(parentId: string): Promise<void> {
  let currentParentId: string | null = parentId;

  while (currentParentId) {
    const { data: siblings, error: siblingsError } = await supabase
      .from("tasks")
      .select("status")
      .eq("parent_task_id", currentParentId)
      .is("deleted_at", null);

    if (siblingsError) throw siblingsError;
    if (siblings.length === 0 || !siblings.every((s) => s.status === "done"))
      break;

    const response = await supabase
      .from("tasks")
      .update({ status: "done" satisfies TaskStatus })
      .eq("id", currentParentId)
      .select("parent_task_id")
      .single();

    if (response.error) throw response.error;
    const parent = response.data as { parent_task_id: string | null };
    currentParentId = parent.parent_task_id;
  }
}

async function revertAncestorsToIncomplete(parentId: string): Promise<void> {
  let currentParentId: string | null = parentId;

  while (currentParentId) {
    const response = await supabase
      .from("tasks")
      .select("status, parent_task_id")
      .eq("id", currentParentId)
      .single();

    if (response.error) throw response.error;
    const parent = response.data as {
      status: TaskStatus;
      parent_task_id: string | null;
    };
    if (parent.status !== "done") break;

    const { error: updateError } = await supabase
      .from("tasks")
      .update({ status: "todo" satisfies TaskStatus })
      .eq("id", currentParentId);

    if (updateError) throw updateError;
    currentParentId = parent.parent_task_id;
  }
}
