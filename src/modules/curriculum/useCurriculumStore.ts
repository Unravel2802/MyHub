import { create } from "zustand";
import * as CurriculumRepository from "@/src/modules/curriculum/CurriculumRepository";
import type { LessonKey } from "@/src/modules/curriculum/types";

// Published store contract for the Curriculum.
//
// Deliberately THIN: it holds your ticks and nothing else. The catalog is a
// static import and the chapter index arrives as a prop from the server
// component that read it off disk, so neither belongs in client state — and
// every number the page shows is a pure function of the three
// (curriculumProgress.ts), computed in a `useMemo` rather than mirrored into
// the store where it could drift.

export interface CurriculumStore {
  // key -> when you read it. A Set would be enough for the checkboxes, but the
  // timestamp is what a "recently read" list is built from later.
  completed: Record<LessonKey, string>;
  starred: Record<LessonKey, true>;
  isLoading: boolean;
  error: string | null;
  // Keys with a write in flight, so a row can show its own spinner without the
  // page-wide loading state flickering on every checkbox.
  pendingKeys: string[];

  fetchProgress: () => Promise<void>;
  setCompleted: (key: LessonKey, next: boolean) => Promise<void>;
  setStarred: (key: LessonKey, next: boolean) => Promise<void>;
}

const FAILURE_MESSAGE = "Something went wrong, please try again later.";

function toUserMessage(error: unknown): string {
  console.error(error);
  return FAILURE_MESSAGE;
}

export const useCurriculumStore = create<CurriculumStore>((set, get) => {
  const addPending = (key: LessonKey) =>
    set({ pendingKeys: [...get().pendingKeys, key] });
  const removePending = (key: LessonKey) =>
    set({ pendingKeys: get().pendingKeys.filter((entry) => entry !== key) });

  return {
    completed: {},
    starred: {},
    isLoading: false,
    error: null,
    pendingKeys: [],

    fetchProgress: async () => {
      set({ isLoading: true, error: null });
      try {
        const rows = await CurriculumRepository.getProgress();
        set({
          completed: Object.fromEntries(
            rows
              .filter((row) => row.completedAt !== null)
              .map((row) => [row.key, row.completedAt!]),
          ),
          starred: Object.fromEntries(
            rows.filter((row) => row.starred).map((row) => [row.key, true]),
          ),
          isLoading: false,
        });
      } catch (error) {
        set({ isLoading: false, error: toUserMessage(error) });
      }
    },

    setCompleted: async (key, next) => {
      const previous = get().completed;
      // Optimistic: the tick, the topic's bar, the track ring and the graph
      // node all move on the same frame, because they all read from this map.
      const optimistic = { ...previous };
      if (next) optimistic[key] = new Date().toISOString();
      else delete optimistic[key];
      set({ completed: optimistic, error: null });
      addPending(key);

      try {
        await CurriculumRepository.setCompleted(key, next);
      } catch (error) {
        set({ completed: previous, error: toUserMessage(error) });
      } finally {
        removePending(key);
      }
    },

    setStarred: async (key, next) => {
      const previous = get().starred;
      const optimistic = { ...previous };
      if (next) optimistic[key] = true;
      else delete optimistic[key];
      set({ starred: optimistic, error: null });
      addPending(key);

      try {
        await CurriculumRepository.setStarred(key, next);
      } catch (error) {
        set({ starred: previous, error: toUserMessage(error) });
      } finally {
        removePending(key);
      }
    },
  };
});
