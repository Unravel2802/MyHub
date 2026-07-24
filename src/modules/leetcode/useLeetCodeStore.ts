import { create } from "zustand";
import type {
  CreateAttemptInput,
  CreateProblemInput,
} from "@/src/modules/leetcode/LeetCodeRepository";
import type {
  LeetCodeAttempt,
  LeetCodeProblem,
} from "@/src/modules/leetcode/types";
import {
  attemptStats as attemptStatsFor,
  attemptsForProblem as attemptsForProblemFor,
  groupByStatus as groupByStatusFor,
} from "@/src/modules/leetcode/leetcodeBoard";

// Published store contract for the LeetCode Tracker. One store per module —
// this must never reach into usePrepStore or vice versa; the only sanctioned
// cross-module signal is `leetcode.attempt_logged` on the Event Bus
// (src/lib/events.ts).
//
// CONTRACT ONLY: the async action bodies below are Codex's to implement,
// against LeetCodeRepository.ts (already published and tested) — mechanical
// Supabase round-trips, optimistic-set-then-rollback plumbing (mirror
// usePrepStore.ts's createEntry/updateEntry/deleteEntry pattern exactly:
// optimistic update, roll back `previousX` and set `error` via
// toUserMessage() on failure, track in-flight ids in `pendingIds`), and
// emitting `leetcode.attempt_logged` on a successful createAttempt. The shape
// below is not Codex's to change — if the UI needs something this doesn't
// expose, flag it rather than widening a payload or bypassing the store.

export interface LeetCodeStore {
  problems: LeetCodeProblem[];
  attempts: LeetCodeAttempt[];
  isLoading: boolean;
  error: string | null;
  isCreating: boolean;
  // In-flight tracking, mirroring usePrepStore/useDesignDrillsStore so the UI
  // can disable per-row controls rather than freezing the whole panel.
  pendingIds: string[];

  fetchProblems: () => Promise<void>;
  createProblem: (input: CreateProblemInput) => Promise<void>;
  // Used for both field edits and status-board drag moves (updates.status).
  updateProblem: (
    id: string,
    updates: Partial<CreateProblemInput>,
  ) => Promise<void>;
  deleteProblem: (id: string) => Promise<void>;

  fetchAttempts: () => Promise<void>;
  // Emits `leetcode.attempt_logged` on success — mirrors usePrepStore's
  // createEntry emitting `prep.logged`.
  createAttempt: (input: CreateAttemptInput) => Promise<void>;
  updateAttempt: (
    id: string,
    updates: Partial<CreateAttemptInput>,
  ) => Promise<void>;
  deleteAttempt: (id: string) => Promise<void>;

  // Derived, not stored — see leetcodeBoard.ts (already implemented, unit
  // tested, not Codex's to touch).
  groupByStatus: () => ReturnType<typeof groupByStatusFor>;
  attemptsForProblem: (problemId: string) => LeetCodeAttempt[];
  attemptStats: (problemId: string) => ReturnType<typeof attemptStatsFor>;
}

// Add this back when wiring the action bodies (every other module's store
// has the identical pair — see usePrepStore.ts/useDesignDrillsStore.ts):
//
// const FAILURE_MESSAGE = "Something went wrong, please try again later.";
// function toUserMessage(error: unknown): string {
//   console.error(error);
//   return FAILURE_MESSAGE;
// }

const NOT_IMPLEMENTED = "Not implemented — see useLeetCodeStore.ts contract.";

export const useLeetCodeStore = create<LeetCodeStore>((_set, get) => ({
  problems: [],
  attempts: [],
  isLoading: false,
  error: null,
  isCreating: false,
  pendingIds: [],

  fetchProblems: async () => {
    throw new Error(NOT_IMPLEMENTED);
  },
  createProblem: async () => {
    throw new Error(NOT_IMPLEMENTED);
  },
  updateProblem: async () => {
    throw new Error(NOT_IMPLEMENTED);
  },
  deleteProblem: async () => {
    throw new Error(NOT_IMPLEMENTED);
  },

  fetchAttempts: async () => {
    throw new Error(NOT_IMPLEMENTED);
  },
  createAttempt: async () => {
    throw new Error(NOT_IMPLEMENTED);
  },
  updateAttempt: async () => {
    throw new Error(NOT_IMPLEMENTED);
  },
  deleteAttempt: async () => {
    throw new Error(NOT_IMPLEMENTED);
  },

  groupByStatus: () => groupByStatusFor(get().problems),
  attemptsForProblem: (problemId) =>
    attemptsForProblemFor(get().attempts, problemId),
  attemptStats: (problemId) => attemptStatsFor(get().attempts, problemId),
}));
