import { create } from "zustand";
import * as ReviewRepository from "@/src/modules/review/ReviewRepository";
import * as PrepRepository from "@/src/modules/prep/PrepRepository";
import * as ApplicationRepository from "@/src/modules/jobApplications/ApplicationRepository";
import * as OutreachRepository from "@/src/modules/outreach/OutreachRepository";
import {
  buildSnapshot,
  isQuarterBoundaryWeek,
  weekStartKeyOf,
} from "@/src/modules/review/reviewLogic";
import type { WeeklyReviewSnapshot } from "@/src/modules/review/reviewLogic";
import type { QuarterlyAnswers, WeeklyReview } from "@/src/modules/review/types";

// Published store contract for the Weekly Review (myhub_plan.md Part B,
// Phase 6). Cross-module data comes through the other modules' REPOSITORIES,
// never their stores (rule 1) — same as useDashboardStore and useMomentumStore.

export interface ReviewStore {
  reviews: WeeklyReview[];
  // The live numbers for the week being reviewed, recomputed on fetch. This is
  // what the form shows you WHILE you write. It is NOT what gets stored — the
  // snapshot is captured fresh at save time, so a review saved at 9pm records
  // 9pm's numbers, not whatever was on screen when the page loaded.
  currentSnapshot: WeeklyReviewSnapshot | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;

  fetchReviews: () => Promise<void>;
  // Saves (or re-saves) the review for the week containing `today`. Captures a
  // fresh snapshot at call time.
  saveReview: (input: {
    today: Date;
    wentWell?: string | null;
    needsWork?: string | null;
    nextWeekFix?: string | null;
    quarterlyAnswers?: QuarterlyAnswers | null;
  }) => Promise<void>;

  // Convenience selectors so components don't re-derive these.
  reviewForWeek: (weekStart: string) => WeeklyReview | null;
  // Whether the week containing `today` should show the five §15 questions.
  isQuarterBoundary: (today: Date) => boolean;
}

const FAILURE_MESSAGE = "Something went wrong, please try again later.";

function toUserMessage(error: unknown): string {
  console.error(error);
  return FAILURE_MESSAGE;
}

async function snapshotFor(today: Date): Promise<WeeklyReviewSnapshot> {
  const [applications, outreachEntries, prepEntries] = await Promise.all([
    ApplicationRepository.getApplications(),
    OutreachRepository.getEntries(),
    PrepRepository.getEntries(),
  ]);

  return buildSnapshot(applications, outreachEntries, prepEntries, today);
}

export const useReviewStore = create<ReviewStore>((set, get) => ({
  reviews: [],
  currentSnapshot: null,
  isLoading: false,
  isSaving: false,
  error: null,

  fetchReviews: async () => {
    set({ isLoading: true, error: null });
    try {
      const [reviews, currentSnapshot] = await Promise.all([
        ReviewRepository.getReviews(),
        snapshotFor(new Date()),
      ]);
      set({ reviews, currentSnapshot, isLoading: false });
    } catch (error) {
      set({ isLoading: false, error: toUserMessage(error) });
    }
  },

  saveReview: async ({ today, ...fields }) => {
    set({ isSaving: true, error: null });
    try {
      // Snapshot captured HERE, at save time — not reused from
      // `currentSnapshot`, which could be minutes or hours stale if the page
      // has been open while you worked.
      const snapshot = await snapshotFor(today);
      const saved = await ReviewRepository.upsertReview({
        weekStart: weekStartKeyOf(today),
        ...fields,
        snapshot,
      });

      // Upsert semantics: replace the existing review for this week if there
      // is one, rather than appending a duplicate.
      const others = get().reviews.filter(
        (review) => review.weekStart !== saved.weekStart,
      );
      set({
        reviews: [saved, ...others].sort((a, b) =>
          b.weekStart.localeCompare(a.weekStart),
        ),
        currentSnapshot: snapshot,
        isSaving: false,
      });
    } catch (error) {
      set({ isSaving: false, error: toUserMessage(error) });
    }
  },

  reviewForWeek: (weekStart) =>
    get().reviews.find((review) => review.weekStart === weekStart) ?? null,

  isQuarterBoundary: (today) => isQuarterBoundaryWeek(today),
}));
