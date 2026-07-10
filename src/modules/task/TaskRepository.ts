import { supabase } from "@/src/lib/supabaseClient";
import type { Task, TaskStatus } from "@/src/modules/task/types";

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
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      title: input.title,
      parent_task_id: input.parentTaskId ?? null,
      due_date: input.dueDate ?? null,
      position: input.position ?? 0,
    })
    .select()
    .single();

  if (error) throw error;

  if (input.parentTaskId) {
    await revertAncestorsToIncomplete(input.parentTaskId);
  }

  return fromRow(data);
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
