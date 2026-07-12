import { create } from "zustand";
import type {
  CreatePrepEntryInput,
  UpsertStoryInput,
} from "@/src/modules/prep/PrepRepository";
import type { BehavioralStory, PrepEntry } from "@/src/modules/prep/types";
import type { Scorecard, TopicStat } from "@/src/modules/prep/prepScorecard";

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

const NOT_IMPLEMENTED = () => {
  throw new Error("not implemented");
};

export const usePrepStore = create<PrepStore>(() => ({
  entries: [],
  stories: [],
  isLoading: false,
  error: null,
  isCreating: false,
  pendingIds: [],

  fetchEntries: NOT_IMPLEMENTED,
  createEntry: NOT_IMPLEMENTED,
  updateEntry: NOT_IMPLEMENTED,
  deleteEntry: NOT_IMPLEMENTED,

  fetchStories: NOT_IMPLEMENTED,
  createStory: NOT_IMPLEMENTED,
  updateStory: NOT_IMPLEMENTED,
  deleteStory: NOT_IMPLEMENTED,

  scorecard: NOT_IMPLEMENTED,
  weakestTopics: NOT_IMPLEMENTED,
}));
