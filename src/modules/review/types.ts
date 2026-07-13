import type { WeeklyReviewSnapshot } from "@/src/modules/review/reviewLogic";

// Answers to the five §15 questions, keyed by the question's index in
// QUARTERLY_QUESTIONS. Only present on quarter-boundary weeks.
export type QuarterlyAnswers = Record<string, string>;

export interface WeeklyReview {
  id: string;
  // yyyy-MM-dd, always a Monday.
  weekStart: string;
  wentWell: string | null;
  needsWork: string | null;
  nextWeekFix: string | null;
  quarterlyAnswers: QuarterlyAnswers | null;
  // The week's numbers as they stood when this review was saved. Never
  // recomputed — see migration 0011.
  snapshot: WeeklyReviewSnapshot;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
