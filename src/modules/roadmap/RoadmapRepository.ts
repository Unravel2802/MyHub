import { supabase } from "@/src/lib/supabaseClient";
import type {
  ReadinessAssessment,
  ReadinessLevel,
  RoadmapTick,
} from "@/src/modules/roadmap/types";

// Published contract for the Roadmap (docs/roadmap-module.md). Soft deletes
// only. Owns one table: roadmap_progress (migration 0014).
//
// The catalog is NOT here — the roadmap's content is code (roadmapCatalog.ts),
// because it changes via a commit, not via a click. This repository stores only
// what's genuinely data: what you ticked, and how you rate yourself.

interface RoadmapRow {
  id: string;
  kind: "criterion" | "readiness";
  item_key: string;
  completed_at: string | null;
  level: ReadinessLevel | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RoadmapProgress {
  ticks: RoadmapTick[];
  readiness: ReadinessAssessment[];
}

export async function getProgress(): Promise<RoadmapProgress> {
  const { data, error } = await supabase
    .from("roadmap_progress")
    .select("*")
    .is("deleted_at", null);

  if (error) throw error;

  const rows = data as RoadmapRow[];
  return {
    ticks: rows
      .filter((row) => row.kind === "criterion" && row.completed_at !== null)
      .map((row) => ({
        itemKey: row.item_key,
        completedAt: row.completed_at!,
      })),
    readiness: rows
      .filter((row) => row.kind === "readiness" && row.level !== null)
      .map((row) => ({ areaKey: row.item_key, level: row.level! })),
  };
}

// Tick a manual criterion. Upsert on item_key so re-ticking after an un-tick
// reuses the row rather than stacking duplicates — backed by the partial unique
// index in migration 0014.
export async function tickCriterion(itemKey: string): Promise<void> {
  const { error } = await supabase.from("roadmap_progress").upsert(
    {
      kind: "criterion",
      item_key: itemKey,
      completed_at: new Date().toISOString(),
      level: null,
      deleted_at: null,
    },
    { onConflict: "item_key" },
  );

  if (error) throw error;
}

// Un-tick. Soft delete, per the project's rule — nothing is ever hard-deleted
// from application code. The partial unique index ignores soft-deleted rows, so
// re-ticking later works.
export async function untickCriterion(itemKey: string): Promise<void> {
  const { error } = await supabase
    .from("roadmap_progress")
    .update({ deleted_at: new Date().toISOString() })
    .eq("item_key", itemKey)
    .eq("kind", "criterion")
    .is("deleted_at", null);

  if (error) throw error;
}

// Self-assessed readiness for one of §6.1's seven areas.
export async function setReadiness(
  areaKey: string,
  level: ReadinessLevel,
): Promise<void> {
  const { error } = await supabase.from("roadmap_progress").upsert(
    {
      kind: "readiness",
      item_key: areaKey,
      level,
      completed_at: null,
      deleted_at: null,
    },
    { onConflict: "item_key" },
  );

  if (error) throw error;
}
