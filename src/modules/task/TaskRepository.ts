import { supabase } from "@/src/lib/supabaseClient";
import {
  missingOccurrences,
  occurrenceKey,
  toTemplate,
} from "@/src/modules/task/taskRecurrence";
import type { Task, TaskStatus, Weekday } from "@/src/modules/task/types";
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
  description: string | null;
  status: TaskStatus;
  position: number;
  due_date: string | null;
  parent_task_id: string | null;
  recurs_weekly: boolean;
  weekday: Weekday | null;
  recurrence_template_id: string | null;
  occurrence_date: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

function fromRow(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    position: row.position,
    dueDate: row.due_date,
    parentTaskId: row.parent_task_id,
    recursWeekly: row.recurs_weekly,
    weekday: row.weekday,
    recurrenceTemplateId: row.recurrence_template_id,
    occurrenceDate: row.occurrence_date,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Board tasks: ordinary tasks and generated instances. Templates are excluded —
// they're recurrence rules, not work items, and must never render on the board.
export async function getTasks(): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("recurs_weekly", false)
    .is("deleted_at", null)
    .order("position", { ascending: true });

  if (error) throw error;
  return data.map(fromRow);
}

export async function createTask(input: {
  title: string;
  description?: string | null;
  parentTaskId?: string | null;
  dueDate?: string | null;
  position?: number;
  // Pass both to create a recurrence template instead of an ordinary task.
  recursWeekly?: boolean;
  weekday?: Weekday | null;
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
      description: input.description ?? null,
      parent_task_id: input.parentTaskId ?? null,
      due_date: input.dueDate ?? null,
      position,
      recurs_weekly: input.recursWeekly ?? false,
      weekday: input.weekday ?? null,
    })
    .select()
    .single();

  if (error) throw error;

  if (input.parentTaskId) {
    await revertAncestorsToIncomplete(input.parentTaskId);
  }

  return fromRow(data);
}

// ---------------------------------------------------------------------------
// Weekly recurrence — published contract (myhub_plan.md §2.3)
//
// The pure decision logic lives in taskRecurrence.ts and is already unit-tested;
// what's left below is the Supabase wiring. See docs/handoff/task-recurrence.md.
// ---------------------------------------------------------------------------

// The recurrence rules themselves (recurs_weekly = true). Not board tasks — use
// this for a "manage recurring blocks" surface.
export async function getTemplates(): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("recurs_weekly", true)
    .is("deleted_at", null)
    .order("weekday", { ascending: true });

  if (error) throw error;
  return data.map(fromRow);
}

// Ensure every template has an instance for the Monday-start week containing
// `today`, and return the instances that were newly created (empty on a repeat
// load). Must be idempotent: it runs on every fetchTasks.
//
// Implementation contract:
//   1. Load templates (recurs_weekly, not deleted) -> taskRecurrence.toTemplate
//   2. Load existing instances for those template ids, INCLUDING soft-deleted
//      ones, and build a Set of taskRecurrence.occurrenceKey(...). Soft-deleted
//      instances must count as existing: a dismissed block stays dismissed.
//   3. taskRecurrence.missingOccurrences(templates, existingKeys, today)
//   4. Insert one task per pending occurrence, copying title/description from the
//      template, with status "todo", due_date = occurrence_date, and
//      recurrence_template_id / occurrence_date set. Position goes to the end of
//      the todo column (nextPosition).
//   5. A unique-violation (Postgres 23505) from the tasks_one_instance_per_occurrence
//      index means a concurrent load won the race — treat it as success, not an
//      error, and skip that row rather than surfacing a banner.
export async function regenerateWeeklyInstances(
  today: Date = new Date(),
): Promise<Task[]> {
  const templateTasks = await getTemplates();
  const templates = templateTasks.flatMap((task) => {
    const template = toTemplate(task);
    return template ? [template] : [];
  });
  if (templates.length === 0) return [];

  const templateIds = templates.map((template) => template.id);
  const { data: existingRows, error: existingError } = (await supabase
    .from("tasks")
    .select("recurrence_template_id, occurrence_date")
    .in("recurrence_template_id", templateIds)) as {
    data:
      | {
          recurrence_template_id: string | null;
          occurrence_date: string | null;
        }[]
      | null;
    error: unknown;
  };

  if (existingError) throw existingError;
  const existingKeys = new Set(
    (existingRows ?? []).flatMap((row) =>
      row.recurrence_template_id && row.occurrence_date
        ? [occurrenceKey(row.recurrence_template_id, row.occurrence_date)]
        : [],
    ),
  );
  const pending = missingOccurrences(templates, existingKeys, today);
  if (pending.length === 0) return [];

  const templateById = new Map(templateTasks.map((task) => [task.id, task]));
  const firstPosition = await nextPosition("todo");
  const created: Task[] = [];

  for (const [index, occurrence] of pending.entries()) {
    const template = templateById.get(occurrence.templateId);
    if (!template) continue;

    const { data, error } = await supabase
      .from("tasks")
      .insert({
        title: template.title,
        description: template.description,
        status: "todo" satisfies TaskStatus,
        position: firstPosition + index,
        due_date: occurrence.occurrenceDate,
        recurs_weekly: false,
        weekday: null,
        recurrence_template_id: occurrence.templateId,
        occurrence_date: occurrence.occurrenceDate,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") continue;
      throw error;
    }
    created.push(fromRow(data));
  }

  return created;
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

  if (changes.status === "done") {
    await completeDescendants(task.id);
  }

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

  if (status === "done") {
    await completeDescendants(task.id);
    if (task.parentTaskId) {
      await autoCompleteAncestors(task.parentTaskId);
    }
  } else if (task.parentTaskId) {
    await revertAncestorsToIncomplete(task.parentTaskId);
  }

  return task;
}

export async function deleteTask(id: string): Promise<void> {
  const descendants = await getDescendantIds(id);
  const idsToDelete = [id, ...descendants];
  const { error } = await supabase
    .from("tasks")
    .update({ deleted_at: new Date().toISOString() })
    .in("id", idsToDelete);

  if (error) throw error;
}

// One round trip via a recursive CTE (migration 0005), not a level-by-level
// application-side walk. Excludes `id` itself — every caller adds it back in
// if it needs it, mirroring how each call site actually uses the result.
async function getDescendantIds(id: string): Promise<string[]> {
  const { data, error } = await supabase.rpc("task_descendant_ids", {
    root_id: id,
  });

  if (error) throw error;
  return (data as { id: string }[]).map((row) => row.id);
}

async function completeDescendants(taskId: string): Promise<void> {
  const descendantIds = await getDescendantIds(taskId);
  if (descendantIds.length === 0) return;

  const { error } = await supabase
    .from("tasks")
    .update({ status: "done" satisfies TaskStatus })
    .in("id", descendantIds);

  if (error) throw error;
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
