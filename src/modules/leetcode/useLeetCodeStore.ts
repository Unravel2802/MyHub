import { create } from "zustand";
import { format } from "date-fns";
import * as LeetCodeRepository from "@/src/modules/leetcode/LeetCodeRepository";
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
import { emit } from "@/src/lib/events";

// Published store contract for the LeetCode Tracker. One store per module —
// this must never reach into usePrepStore or vice versa; the only sanctioned
// cross-module signals are `leetcode.problem_logged` and
// `leetcode.attempt_logged` on the Event Bus (src/lib/events.ts).
//
// CONTRACT ONLY: the async action bodies below are Codex's to implement,
// against LeetCodeRepository.ts (already published and tested) — mechanical
// Supabase round-trips, optimistic-set-then-rollback plumbing (mirror
// usePrepStore.ts's createEntry/updateEntry/deleteEntry pattern exactly:
// optimistic update, roll back `previousX` and set `error` via
// toUserMessage() on failure, track in-flight ids in `pendingIds`), and
// emitting the published success events from createProblem/createAttempt. The shape
// below is not Codex's to change — if the UI needs something this doesn't
// expose, flag it rather than widening a payload or bypassing the store.

// The sitting that happened when a problem was first added. Adding a problem
// you just did IS a rep, so the add form logs it as a real attempt row rather
// than leaning on leetcode_problems.createdAt — which is what
// problemCountInMonth's comment describes and what left first sittings
// contributing 0 minutes to Prep Tracker's time allocation
// (totalAttemptTimeMin only ever saw attempt rows). `problemId` is supplied by
// createProblem from the row it just inserted, so it isn't the caller's to
// pass.
export type FirstAttemptInput = Omit<CreateAttemptInput, "problemId">;

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
  // Emits `leetcode.problem_logged`, and — when `firstAttempt` is given —
  // `leetcode.attempt_logged` for the sitting that came with it. The two
  // inserts are not one transaction: the attempt is written only after the
  // problem comes back with an id. If that second insert fails the problem
  // still exists in the DB, so local state KEEPS it and rolls back only the
  // attempt — state stays true to the DB, and the user re-logs the sitting
  // from the detail view. Accepted over an RPC for a single-user app.
  createProblem: (
    input: CreateProblemInput,
    firstAttempt?: FirstAttemptInput,
  ) => Promise<void>;
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

const FAILURE_MESSAGE = "Something went wrong, please try again later.";

function toUserMessage(error: unknown): string {
  console.error(error);
  return FAILURE_MESSAGE;
}

function applyProblemUpdates(
  problem: LeetCodeProblem,
  updates: Partial<CreateProblemInput>,
): LeetCodeProblem {
  return {
    ...problem,
    ...(updates.title !== undefined && { title: updates.title }),
    ...(updates.questionNumber !== undefined && {
      questionNumber: updates.questionNumber,
    }),
    ...(updates.difficulty !== undefined && {
      difficulty: updates.difficulty,
    }),
    ...(updates.tags !== undefined && { tags: updates.tags }),
    ...(updates.notes !== undefined && { notes: updates.notes }),
    ...(updates.status !== undefined && { status: updates.status }),
  };
}

function applyAttemptUpdates(
  attempt: LeetCodeAttempt,
  updates: Partial<CreateAttemptInput>,
): LeetCodeAttempt {
  return {
    ...attempt,
    ...(updates.problemId !== undefined && {
      problemId: updates.problemId,
    }),
    ...(updates.date !== undefined && { date: updates.date }),
    ...(updates.timeToSolveMin !== undefined && {
      timeToSolveMin: updates.timeToSolveMin,
    }),
    ...(updates.outcome !== undefined && { outcome: updates.outcome }),
    ...(updates.notes !== undefined && { notes: updates.notes }),
    ...(updates.solutionCode !== undefined && {
      solutionCode: updates.solutionCode,
    }),
    ...(updates.solutionLanguage !== undefined && {
      solutionLanguage: updates.solutionLanguage,
    }),
  };
}

export const useLeetCodeStore = create<LeetCodeStore>((set, get) => {
  const addPending = (id: string) =>
    set({ pendingIds: [...get().pendingIds, id] });
  const removePending = (id: string) =>
    set({ pendingIds: get().pendingIds.filter((pending) => pending !== id) });

  return {
    problems: [],
    attempts: [],
    isLoading: false,
    error: null,
    isCreating: false,
    pendingIds: [],

    fetchProblems: async () => {
      set({ isLoading: true, error: null });
      try {
        const problems = await LeetCodeRepository.getProblems();
        set({ problems, isLoading: false });
      } catch (error) {
        set({ isLoading: false, error: toUserMessage(error) });
      }
    },

    createProblem: async (input, firstAttempt) => {
      const previousProblems = get().problems;
      const now = new Date().toISOString();
      const optimistic: LeetCodeProblem = {
        id: `optimistic-${crypto.randomUUID()}`,
        title: input.title,
        questionNumber: input.questionNumber ?? null,
        difficulty: input.difficulty,
        tags: input.tags ?? [],
        notes: input.notes ?? null,
        status: input.status ?? "to_review",
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      set({
        problems: [optimistic, ...previousProblems],
        isCreating: true,
        error: null,
      });

      try {
        const created = await LeetCodeRepository.createProblem(input);
        set({
          problems: get().problems.map((problem) =>
            problem.id === optimistic.id ? created : problem,
          ),
        });
        emit({
          type: "leetcode.problem_logged",
          payload: { problemId: created.id },
          timestamp: Date.now(),
        });

        if (firstAttempt) {
          // Deliberately not optimistic: there is no problem id to hang an
          // attempt off until the insert above resolves, and the add form is
          // already blocked on `isCreating`. A failure here leaves `created`
          // in place — see the contract note on createProblem.
          const attempt = await LeetCodeRepository.createAttempt({
            ...firstAttempt,
            problemId: created.id,
          });
          set({ attempts: [attempt, ...get().attempts] });
          emit({
            type: "leetcode.attempt_logged",
            payload: {
              attemptId: attempt.id,
              problemId: attempt.problemId,
              outcome: attempt.outcome,
            },
            timestamp: Date.now(),
          });
        }
      } catch (error) {
        // Roll the problem back only if it never landed; once `created`
        // replaced the optimistic row it is real and stays.
        const rolledBack = get().problems.some(
          (problem) => problem.id === optimistic.id,
        )
          ? { problems: previousProblems }
          : {};
        set({ ...rolledBack, error: toUserMessage(error) });
      } finally {
        set({ isCreating: false });
      }
    },

    updateProblem: async (id, updates) => {
      const previousProblems = get().problems;
      set({
        problems: previousProblems.map((problem) =>
          problem.id === id ? applyProblemUpdates(problem, updates) : problem,
        ),
        error: null,
      });
      addPending(id);

      try {
        const updated = await LeetCodeRepository.updateProblem(id, updates);
        set({
          problems: get().problems.map((problem) =>
            problem.id === id ? updated : problem,
          ),
        });
      } catch (error) {
        set({ problems: previousProblems, error: toUserMessage(error) });
      } finally {
        removePending(id);
      }
    },

    deleteProblem: async (id) => {
      const previousProblems = get().problems;
      set({
        problems: previousProblems.filter((problem) => problem.id !== id),
        error: null,
      });
      addPending(id);

      try {
        await LeetCodeRepository.deleteProblem(id);
      } catch (error) {
        set({ problems: previousProblems, error: toUserMessage(error) });
      } finally {
        removePending(id);
      }
    },

    fetchAttempts: async () => {
      try {
        const attempts = await LeetCodeRepository.getAttempts();
        set({ attempts });
      } catch (error) {
        set({ error: toUserMessage(error) });
      }
    },

    createAttempt: async (input) => {
      const previousAttempts = get().attempts;
      const now = new Date().toISOString();
      const optimistic: LeetCodeAttempt = {
        id: `optimistic-${crypto.randomUUID()}`,
        problemId: input.problemId,
        date: input.date ?? format(new Date(), "yyyy-MM-dd"),
        timeToSolveMin: input.timeToSolveMin ?? null,
        outcome: input.outcome,
        notes: input.notes ?? null,
        solutionCode: input.solutionCode ?? null,
        solutionLanguage: input.solutionLanguage ?? null,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      set({
        attempts: [optimistic, ...previousAttempts],
        isCreating: true,
        error: null,
      });

      try {
        const created = await LeetCodeRepository.createAttempt(input);
        set({
          attempts: get().attempts.map((attempt) =>
            attempt.id === optimistic.id ? created : attempt,
          ),
        });
        emit({
          type: "leetcode.attempt_logged",
          payload: {
            attemptId: created.id,
            problemId: created.problemId,
            outcome: created.outcome,
          },
          timestamp: Date.now(),
        });
      } catch (error) {
        set({ attempts: previousAttempts, error: toUserMessage(error) });
      } finally {
        set({ isCreating: false });
      }
    },

    updateAttempt: async (id, updates) => {
      const previousAttempts = get().attempts;
      set({
        attempts: previousAttempts.map((attempt) =>
          attempt.id === id ? applyAttemptUpdates(attempt, updates) : attempt,
        ),
        error: null,
      });
      addPending(id);

      try {
        const updated = await LeetCodeRepository.updateAttempt(id, updates);
        set({
          attempts: get().attempts.map((attempt) =>
            attempt.id === id ? updated : attempt,
          ),
        });
      } catch (error) {
        set({ attempts: previousAttempts, error: toUserMessage(error) });
      } finally {
        removePending(id);
      }
    },

    deleteAttempt: async (id) => {
      const previousAttempts = get().attempts;
      set({
        attempts: previousAttempts.filter((attempt) => attempt.id !== id),
        error: null,
      });
      addPending(id);

      try {
        await LeetCodeRepository.deleteAttempt(id);
      } catch (error) {
        set({ attempts: previousAttempts, error: toUserMessage(error) });
      } finally {
        removePending(id);
      }
    },

    groupByStatus: () => groupByStatusFor(get().problems),
    attemptsForProblem: (problemId) =>
      attemptsForProblemFor(get().attempts, problemId),
    attemptStats: (problemId) => attemptStatsFor(get().attempts, problemId),
  };
});
