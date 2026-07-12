import { create } from "zustand";
import { format } from "date-fns";
import * as PrepRepository from "@/src/modules/prep/PrepRepository";
import type {
  CreatePrepEntryInput,
  UpsertStoryInput,
} from "@/src/modules/prep/PrepRepository";
import type { BehavioralStory, PrepEntry } from "@/src/modules/prep/types";
import type { Scorecard, TopicStat } from "@/src/modules/prep/prepScorecard";
import {
  scorecardFor,
  weakestTopics as weakestTopicsFor,
} from "@/src/modules/prep/prepScorecard";
import { emit } from "@/src/lib/events";

// Published store contract for the Prep Tracker. One store per module — this must
// never reach into useTaskStore or vice versa; the Dashboard reads both through
// the Event Bus.
//
// The action bodies are Codex's to implement (AGENTS.md, capacity amendment).
// The shape below is not: if the UI needs something this doesn't expose, flag it.

export interface PrepStore {
  entries: PrepEntry[];
  stories: BehavioralStory[];
  isLoading: boolean;
  error: string | null;
  // In-flight tracking, mirroring useTaskStore so the UI can disable per-row
  // controls rather than freezing the whole panel.
  isCreating: boolean;
  pendingIds: string[];

  fetchEntries: () => Promise<void>;
  // Emits `prep.logged` on success — that's what the Dashboard's running totals
  // subscribe to. Optimistic insert, roll back and set `error` on failure.
  createEntry: (input: CreatePrepEntryInput) => Promise<void>;
  updateEntry: (
    id: string,
    updates: Partial<CreatePrepEntryInput>,
  ) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;

  fetchStories: () => Promise<void>;
  createStory: (input: UpsertStoryInput) => Promise<void>;
  updateStory: (
    id: string,
    updates: Partial<UpsertStoryInput>,
  ) => Promise<void>;
  deleteStory: (id: string) => Promise<void>;

  // Derived, not stored: computed from `entries` via prepScorecard.ts. `month` is
  // yyyy-MM. Targets to compare against are NOT here — they live in
  // engineering_first_roadmap_v2.md, which isn't in the repo yet.
  scorecard: (month: string) => Scorecard;
  weakestTopics: (limit?: number, month?: string) => TopicStat[];
}

const FAILURE_MESSAGE = "Something went wrong, please try again later.";

function toUserMessage(error: unknown): string {
  console.error(error);
  if (error instanceof Error && error.message) return error.message;
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return FAILURE_MESSAGE;
}

function applyEntryUpdates(
  entry: PrepEntry,
  updates: Partial<CreatePrepEntryInput>,
): PrepEntry {
  return {
    ...entry,
    ...(updates.entryType !== undefined && { entryType: updates.entryType }),
    ...(updates.topic !== undefined && { topic: updates.topic }),
    ...(updates.date !== undefined && { date: updates.date }),
    ...(updates.durationMin !== undefined && {
      durationMin: updates.durationMin,
    }),
    ...(updates.timeToSolveMin !== undefined && {
      timeToSolveMin: updates.timeToSolveMin,
    }),
    ...(updates.outcome !== undefined && { outcome: updates.outcome }),
    ...(updates.notes !== undefined && { notes: updates.notes }),
  };
}

function applyStoryUpdates(
  story: BehavioralStory,
  updates: Partial<UpsertStoryInput>,
): BehavioralStory {
  return {
    ...story,
    ...(updates.title !== undefined && { title: updates.title }),
    ...(updates.theme !== undefined && { theme: updates.theme }),
    ...(updates.conciseVersion !== undefined && {
      conciseVersion: updates.conciseVersion,
    }),
    ...(updates.extendedVersion !== undefined && {
      extendedVersion: updates.extendedVersion,
    }),
  };
}

export const usePrepStore = create<PrepStore>((set, get) => {
  const addPending = (id: string) =>
    set({ pendingIds: [...get().pendingIds, id] });
  const removePending = (id: string) =>
    set({ pendingIds: get().pendingIds.filter((pending) => pending !== id) });

  return {
    entries: [],
    stories: [],
    isLoading: false,
    error: null,
    isCreating: false,
    pendingIds: [],

    fetchEntries: async () => {
      set({ isLoading: true, error: null });
      try {
        const entries = await PrepRepository.getEntries();
        set({ entries, isLoading: false });
      } catch (error) {
        set({ isLoading: false, error: toUserMessage(error) });
      }
    },

    createEntry: async (input) => {
      const previousEntries = get().entries;
      const now = new Date().toISOString();
      const optimistic: PrepEntry = {
        id: `optimistic-${crypto.randomUUID()}`,
        entryType: input.entryType,
        topic: input.topic ?? null,
        date: input.date ?? format(new Date(), "yyyy-MM-dd"),
        durationMin: input.durationMin ?? null,
        timeToSolveMin: input.timeToSolveMin ?? null,
        outcome: input.outcome ?? null,
        notes: input.notes ?? null,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      set({
        entries: [optimistic, ...previousEntries],
        isCreating: true,
        error: null,
      });

      try {
        const created = await PrepRepository.createEntry(input);
        set({
          entries: get().entries.map((entry) =>
            entry.id === optimistic.id ? created : entry,
          ),
        });
        emit({
          type: "prep.logged",
          payload: { entryId: created.id, prepType: created.entryType },
          timestamp: Date.now(),
        });
      } catch (error) {
        set({ entries: previousEntries, error: toUserMessage(error) });
      } finally {
        set({ isCreating: false });
      }
    },

    updateEntry: async (id, updates) => {
      const previousEntries = get().entries;
      set({
        entries: previousEntries.map((entry) =>
          entry.id === id ? applyEntryUpdates(entry, updates) : entry,
        ),
        error: null,
      });
      addPending(id);

      try {
        const updated = await PrepRepository.updateEntry(id, updates);
        set({
          entries: get().entries.map((entry) =>
            entry.id === id ? updated : entry,
          ),
        });
      } catch (error) {
        set({ entries: previousEntries, error: toUserMessage(error) });
      } finally {
        removePending(id);
      }
    },

    deleteEntry: async (id) => {
      const previousEntries = get().entries;
      set({
        entries: previousEntries.filter((entry) => entry.id !== id),
        error: null,
      });
      addPending(id);

      try {
        await PrepRepository.deleteEntry(id);
      } catch (error) {
        set({ entries: previousEntries, error: toUserMessage(error) });
      } finally {
        removePending(id);
      }
    },

    fetchStories: async () => {
      try {
        const stories = await PrepRepository.getStories();
        set({ stories });
      } catch (error) {
        set({ error: toUserMessage(error) });
      }
    },

    createStory: async (input) => {
      const previousStories = get().stories;
      const now = new Date().toISOString();
      const optimistic: BehavioralStory = {
        id: `optimistic-${crypto.randomUUID()}`,
        title: input.title,
        theme: input.theme ?? null,
        conciseVersion: input.conciseVersion ?? null,
        extendedVersion: input.extendedVersion ?? null,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      set({
        stories: [optimistic, ...previousStories],
        isCreating: true,
        error: null,
      });

      try {
        const created = await PrepRepository.createStory(input);
        set({
          stories: get().stories.map((story) =>
            story.id === optimistic.id ? created : story,
          ),
        });
      } catch (error) {
        set({ stories: previousStories, error: toUserMessage(error) });
      } finally {
        set({ isCreating: false });
      }
    },

    updateStory: async (id, updates) => {
      const previousStories = get().stories;
      set({
        stories: previousStories.map((story) =>
          story.id === id ? applyStoryUpdates(story, updates) : story,
        ),
        error: null,
      });
      addPending(id);

      try {
        const updated = await PrepRepository.updateStory(id, updates);
        set({
          stories: get().stories.map((story) =>
            story.id === id ? updated : story,
          ),
        });
      } catch (error) {
        set({ stories: previousStories, error: toUserMessage(error) });
      } finally {
        removePending(id);
      }
    },

    deleteStory: async (id) => {
      const previousStories = get().stories;
      set({
        stories: previousStories.filter((story) => story.id !== id),
        error: null,
      });
      addPending(id);

      try {
        await PrepRepository.deleteStory(id);
      } catch (error) {
        set({ stories: previousStories, error: toUserMessage(error) });
      } finally {
        removePending(id);
      }
    },

    scorecard: (month) => scorecardFor(get().entries, month),
    weakestTopics: (limit, month) =>
      weakestTopicsFor(get().entries, limit, month),
  };
});
