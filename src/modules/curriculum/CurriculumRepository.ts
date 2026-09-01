import { supabase } from "@/src/lib/supabaseClient";
import type { LessonKey, LessonProgress } from "@/src/modules/curriculum/types";

// Published contract for the Curriculum. Owns one table: curriculum_progress
// (migration 0043). Soft deletes only.
//
// The catalog and the chapters are NOT here — the graph is code
// (curriculumCatalog.ts) and the prose is files (content.ts), because both
// change via a commit rather than a click. This repository stores only what is
// genuinely data: which chapters you have read, and which you flagged.

interface ProgressRow {
  id: string;
  item_key: string;
  completed_at: string | null;
  starred: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function getProgress(): Promise<LessonProgress[]> {
  const { data, error } = await supabase
    .from("curriculum_progress")
    .select("item_key, completed_at, starred")
    .is("deleted_at", null);

  if (error) throw error;

  return (
    data as Pick<ProgressRow, "item_key" | "completed_at" | "starred">[]
  ).map((row) => ({
    key: row.item_key,
    completedAt: row.completed_at,
    starred: row.starred,
  }));
}

// Mark a chapter read, or un-read.
//
// Un-reading nulls `completed_at` rather than soft-deleting the row, because
// the row also carries `starred` — deleting it would silently drop a flag the
// user set deliberately. Upsert on item_key, backed by the partial unique index
// in migration 0043.
export async function setCompleted(
  key: LessonKey,
  completed: boolean,
): Promise<void> {
  const { error } = await supabase.from("curriculum_progress").upsert(
    {
      item_key: key,
      completed_at: completed ? new Date().toISOString() : null,
      deleted_at: null,
    },
    { onConflict: "item_key" },
  );

  if (error) throw error;
}

// Flag a chapter to come back to. Independent of completion — the chapters
// worth re-reading are usually ones you have already read once.
export async function setStarred(
  key: LessonKey,
  starred: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("curriculum_progress")
    .upsert(
      { item_key: key, starred, deleted_at: null },
      { onConflict: "item_key" },
    );

  if (error) throw error;
}
