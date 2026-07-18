import { supabase } from "@/src/lib/supabaseClient";
import type { WeeklyReviewSnapshot } from "@/src/modules/review/reviewLogic";
import type {
  QuarterlyAnswers,
  WeeklyReview,
} from "@/src/modules/review/types";

// Published contract for the Weekly Review (myhub_plan.md Part B, Phase 6).
// Soft deletes only. Owns one table: weekly_reviews (migration 0011).

interface WeeklyReviewRow {
  id: string;
  week_start: string;
  went_well: string | null;
  needs_work: string | null;
  next_week_fix: string | null;
  quarterly_answers: QuarterlyAnswers | null;
  snapshot: WeeklyReviewSnapshot;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

function fromRow(row: WeeklyReviewRow): WeeklyReview {
  return {
    id: row.id,
    weekStart: row.week_start,
    wentWell: row.went_well,
    needsWork: row.needs_work,
    nextWeekFix: row.next_week_fix,
    quarterlyAnswers: row.quarterly_answers,
    snapshot: row.snapshot,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface UpsertReviewInput {
  // yyyy-MM-dd, must be a Monday — use reviewLogic.weekStartKeyOf, don't build
  // it by hand.
  weekStart: string;
  wentWell?: string | null;
  needsWork?: string | null;
  nextWeekFix?: string | null;
  quarterlyAnswers?: QuarterlyAnswers | null;
  // Captured by the CALLER at save time via reviewLogic.buildSnapshot — this
  // repository never computes it, because "the numbers as of when you saved"
  // is a decision only the caller's clock can make.
  snapshot: WeeklyReviewSnapshot;
}

export async function getReviews(): Promise<WeeklyReview[]> {
  const { data, error } = await supabase
    .from("weekly_reviews")
    .select("*")
    .is("deleted_at", null)
    .order("week_start", { ascending: false });

  if (error) throw error;
  return data.map(fromRow);
}

export async function getReviewForWeek(
  weekStart: string,
): Promise<WeeklyReview | null> {
  const { data, error } = await supabase
    .from("weekly_reviews")
    .select("*")
    .eq("week_start", weekStart)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw error;
  return data ? fromRow(data) : null;
}

// Re-saving a week's review UPDATES it rather than stacking a second row —
// backed by the plain unique constraint on (week_start) from migration 0018.
// (Migration 0011's original PARTIAL index couldn't be an ON CONFLICT target,
// so this upsert failed with 42P10 and every save silently rolled back — see
// migration 0018.) Reviewing is iterative: you write something Sunday morning
// and add to it Sunday night, and that shouldn't produce two conflicting
// records of the same week.
export async function upsertReview(
  input: UpsertReviewInput,
): Promise<WeeklyReview> {
  const { data, error } = await supabase
    .from("weekly_reviews")
    .upsert(
      {
        week_start: input.weekStart,
        went_well: input.wentWell ?? null,
        needs_work: input.needsWork ?? null,
        next_week_fix: input.nextWeekFix ?? null,
        quarterly_answers: input.quarterlyAnswers ?? null,
        snapshot: input.snapshot,
      },
      { onConflict: "week_start" },
    )
    .select()
    .single();

  if (error) throw error;
  return fromRow(data);
}
