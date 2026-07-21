import type {
  DesignDrill,
  DesignDrillAttempt,
  DesignDrillCategory,
  DesignDrillDifficulty,
  DesignDrillSelfRating,
} from "@/src/modules/designDrills/types";
import { parseSolutionDetail } from "@/src/modules/designDrills/solutionDetail";
import { supabase } from "@/src/lib/supabaseClient";

interface DesignDrillRow {
  id: string;
  slug: string;
  category: DesignDrillCategory;
  difficulty: DesignDrillDifficulty;
  title: string;
  prompt: string;
  rubric: string[];
  solution: string;
  // jsonb — Supabase hands it back already parsed (object | null), so it's
  // `unknown` here and validated by parseSolutionDetail before it reaches the
  // typed domain model.
  solution_detail: unknown;
  estimated_minutes: number;
  tags: string[];
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

interface DesignDrillAttemptRow {
  id: string;
  drill_id: string;
  started_at: string;
  completed_at: string | null;
  duration_sec: number | null;
  notes: string | null;
  rubric_hits: number[];
  self_rating: DesignDrillSelfRating | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

function drillFromRow(row: DesignDrillRow): DesignDrill {
  return {
    id: row.id,
    slug: row.slug,
    category: row.category,
    difficulty: row.difficulty,
    title: row.title,
    prompt: row.prompt,
    rubric: row.rubric,
    solution: row.solution,
    solutionDetail: parseSolutionDetail(row.solution_detail, row.slug),
    estimatedMinutes: row.estimated_minutes,
    tags: row.tags,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function attemptFromRow(row: DesignDrillAttemptRow): DesignDrillAttempt {
  return {
    id: row.id,
    drillId: row.drill_id,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    durationSec: row.duration_sec,
    notes: row.notes,
    rubricHits: row.rubric_hits,
    selfRating: row.self_rating,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Published contract for Design Drills (a new module — see migration 0024's
// header for why it's not folded into Prep Tracker). Soft deletes only:
// `deleted_at`, never a DELETE.

export async function getDrills(): Promise<DesignDrill[]> {
  const { data, error } = await supabase
    .from("design_drills")
    .select("*")
    .is("deleted_at", null)
    .order("category", { ascending: true })
    .order("difficulty", { ascending: true })
    .order("title", { ascending: true });

  if (error) throw error;
  return data.map(drillFromRow);
}

export async function getAttempts(): Promise<DesignDrillAttempt[]> {
  const { data, error } = await supabase
    .from("design_drill_attempts")
    .select("*")
    .is("deleted_at", null)
    .order("started_at", { ascending: false });

  if (error) throw error;
  return data.map(attemptFromRow);
}

// Starts the clock: inserts an in-progress attempt (completed_at/duration_sec/
// self_rating all null, enforced by the DB's completion-is-atomic CHECK).
export async function startAttempt(
  drillId: string,
): Promise<DesignDrillAttempt> {
  const { data, error } = await supabase
    .from("design_drill_attempts")
    .insert({ drill_id: drillId })
    .select()
    .single();

  if (error) throw error;
  return attemptFromRow(data);
}

export interface SubmitAttemptInput {
  durationSec: number;
  notes: string | null;
  rubricHits: number[];
  selfRating: DesignDrillSelfRating;
}

// Submits an in-progress attempt: sets completed_at and the three fields the
// DB's CHECK requires together. Emitting `drill.completed` is the STORE's job,
// not this one — repositories don't touch the Event Bus.
export async function submitAttempt(
  id: string,
  input: SubmitAttemptInput,
): Promise<DesignDrillAttempt> {
  const { data, error } = await supabase
    .from("design_drill_attempts")
    .update({
      completed_at: new Date().toISOString(),
      duration_sec: input.durationSec,
      notes: input.notes,
      rubric_hits: input.rubricHits,
      self_rating: input.selfRating,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return attemptFromRow(data);
}

// Saves scratchpad progress on an attempt that's still in flight (no
// completed_at) without submitting it — the workspace autosaves notes
// periodically so a closed tab doesn't lose a write-up mid-attempt.
export async function saveAttemptNotes(
  id: string,
  notes: string,
): Promise<DesignDrillAttempt> {
  const { data, error } = await supabase
    .from("design_drill_attempts")
    .update({ notes })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return attemptFromRow(data);
}

export async function deleteAttempt(id: string): Promise<void> {
  const { error } = await supabase
    .from("design_drill_attempts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}

// --- Bookmarks (Phase 3) -----------------------------------------------------
// A bookmark lives in its own soft-deletable table (see migration 0029), so
// these return/act on drill ids rather than the bookmark rows themselves — the
// UI only cares "is this drill starred". The store guards against double-adding,
// so `addBookmark` is a plain insert (the partial unique index tolerates a prior
// soft-deleted row for the same drill).

export async function listBookmarkedDrillIds(): Promise<string[]> {
  const { data, error } = await supabase
    .from("design_drill_bookmarks")
    .select("drill_id")
    .is("deleted_at", null);

  if (error) throw error;
  return data.map((row) => row.drill_id as string);
}

export async function addBookmark(drillId: string): Promise<void> {
  const { error } = await supabase
    .from("design_drill_bookmarks")
    .insert({ drill_id: drillId });

  if (error) throw error;
}

// Soft-deletes only the active bookmark for the drill, leaving any historical
// rows untouched.
export async function removeBookmark(drillId: string): Promise<void> {
  const { error } = await supabase
    .from("design_drill_bookmarks")
    .update({ deleted_at: new Date().toISOString() })
    .eq("drill_id", drillId)
    .is("deleted_at", null);

  if (error) throw error;
}
