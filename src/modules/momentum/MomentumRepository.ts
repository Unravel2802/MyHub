import { supabase } from "@/src/lib/supabaseClient";
import type { AchievementKey } from "@/src/modules/momentum/achievementCatalog";

// Published contract for Momentum (myhub_plan.md Part B, Phase 5). Soft deletes
// only. This module owns exactly one table — `achievements` (migration 0010).
// Everything else it needs, it reads through the OTHER modules' repositories
// (rule 1: never reach into another module's tables directly).

export interface AchievementUnlock {
  id: string;
  key: string;
  unlockedAt: string;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AchievementRow {
  id: string;
  key: string;
  unlocked_at: string;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

function fromRow(row: AchievementRow): AchievementUnlock {
  return {
    id: row.id,
    key: row.key,
    unlockedAt: row.unlocked_at,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getUnlocks(): Promise<AchievementUnlock[]> {
  const { data, error } = await supabase
    .from("achievements")
    .select("*")
    .is("deleted_at", null)
    .order("unlocked_at", { ascending: false });

  if (error) throw error;
  return data.map(fromRow);
}

// Idempotent by construction: the unique constraint on (key) makes a duplicate
// insert a no-op rather than an error, so two tabs racing to unlock the same
// achievement can't double-insert. This is the LAST of the three idempotency
// layers — the store has two more in front of it (see useMomentumStore).
//
// The constraint is PLAIN, not partial (migration 0017). Migration 0010's
// original partial index (`where deleted_at is null`) could not serve as an
// ON CONFLICT target — PostgREST emits a bare `ON CONFLICT (key)`, which
// Postgres can't match to a partial index — so this upsert failed with 42P10
// on every unlock and nothing ever persisted. See migration 0017.
export async function insertUnlocks(
  keys: AchievementKey[],
): Promise<AchievementUnlock[]> {
  if (keys.length === 0) return [];

  const { data, error } = await supabase
    .from("achievements")
    .upsert(
      keys.map((key) => ({ key })),
      { onConflict: "key", ignoreDuplicates: true },
    )
    .select();

  if (error) throw error;
  return (data ?? []).map(fromRow);
}
