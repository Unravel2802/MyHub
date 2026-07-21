import { create } from "zustand";
import * as DesignDrillsRepository from "@/src/modules/designDrills/DesignDrillsRepository";
import type { SubmitAttemptInput } from "@/src/modules/designDrills/DesignDrillsRepository";
import type {
  DesignDrill,
  DesignDrillAttempt,
} from "@/src/modules/designDrills/types";
import { emit } from "@/src/lib/events";

// One store per module. This must never reach into usePrepStore or vice versa
// — Prep Tracker learns a drill was completed only via the `drill.completed`
// Event Bus event, same as every other cross-module signal.

export interface DesignDrillsStore {
  drills: DesignDrill[];
  attempts: DesignDrillAttempt[];
  isLoading: boolean;
  error: string | null;
  // In-flight tracking, mirroring usePrepStore so the UI can disable per-row
  // controls rather than freezing the whole panel.
  isStarting: boolean;
  pendingIds: string[];
  // Ids of drills the user has starred. Loaded via fetchBookmarks; kept as a
  // flat id list (bookmarks live in their own table, not on the drill row).
  bookmarkedDrillIds: string[];

  fetchDrills: () => Promise<void>;
  fetchAttempts: () => Promise<void>;
  // Starts the clock on a new attempt and returns it directly — the workspace
  // needs the attempt id synchronously to target subsequent autosave/submit
  // calls, rather than re-deriving it from a list re-render.
  startAttempt: (drillId: string) => Promise<DesignDrillAttempt>;
  // Emits `drill.completed` on success.
  submitAttempt: (id: string, input: SubmitAttemptInput) => Promise<void>;
  // Autosaves the scratchpad on an in-progress attempt. Deliberately does not
  // roll back the typed text on failure — losing what the user just wrote
  // because of a transient network error is worse than a stale copy on the
  // server; it only surfaces `error` and retries on the next autosave tick.
  saveAttemptNotes: (id: string, notes: string) => Promise<void>;
  deleteAttempt: (id: string) => Promise<void>;

  fetchBookmarks: () => Promise<void>;
  // Optimistically stars/unstars a drill and rolls back on failure. Tracks the
  // drill id in pendingIds while the write is in flight, like the other mutators.
  toggleBookmark: (drillId: string) => Promise<void>;

  attemptsForDrill: (drillId: string) => DesignDrillAttempt[];
  isBookmarked: (drillId: string) => boolean;
  // Resolves a drill from its URL slug, for the deep-linkable
  // /design-drills/[slug] route. Returns undefined while drills are still
  // loading or when the slug matches nothing — the route treats undefined as
  // "not found" (render a not-found state / call notFound()).
  drillBySlug: (slug: string) => DesignDrill | undefined;
}

const FAILURE_MESSAGE = "Something went wrong, please try again later.";

function toUserMessage(error: unknown): string {
  console.error(error);
  return FAILURE_MESSAGE;
}

export const useDesignDrillsStore = create<DesignDrillsStore>((set, get) => {
  const addPending = (id: string) =>
    set({ pendingIds: [...get().pendingIds, id] });
  const removePending = (id: string) =>
    set({ pendingIds: get().pendingIds.filter((pending) => pending !== id) });

  return {
    drills: [],
    attempts: [],
    isLoading: false,
    error: null,
    isStarting: false,
    pendingIds: [],
    bookmarkedDrillIds: [],

    fetchDrills: async () => {
      set({ isLoading: true, error: null });
      try {
        const drills = await DesignDrillsRepository.getDrills();
        set({ drills, isLoading: false });
      } catch (error) {
        set({ isLoading: false, error: toUserMessage(error) });
      }
    },

    fetchAttempts: async () => {
      try {
        const attempts = await DesignDrillsRepository.getAttempts();
        set({ attempts });
      } catch (error) {
        set({ error: toUserMessage(error) });
      }
    },

    startAttempt: async (drillId) => {
      const previousAttempts = get().attempts;
      const now = new Date().toISOString();
      const optimistic: DesignDrillAttempt = {
        id: `optimistic-${crypto.randomUUID()}`,
        drillId,
        startedAt: now,
        completedAt: null,
        durationSec: null,
        notes: null,
        rubricHits: [],
        selfRating: null,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      set({
        attempts: [optimistic, ...previousAttempts],
        isStarting: true,
        error: null,
      });

      try {
        const created = await DesignDrillsRepository.startAttempt(drillId);
        set({
          attempts: get().attempts.map((attempt) =>
            attempt.id === optimistic.id ? created : attempt,
          ),
        });
        return created;
      } catch (error) {
        set({ attempts: previousAttempts, error: toUserMessage(error) });
        throw error;
      } finally {
        set({ isStarting: false });
      }
    },

    submitAttempt: async (id, input) => {
      const previousAttempts = get().attempts;
      const current = previousAttempts.find((attempt) => attempt.id === id);
      if (!current) return;

      const optimistic: DesignDrillAttempt = {
        ...current,
        completedAt: new Date().toISOString(),
        durationSec: input.durationSec,
        notes: input.notes,
        rubricHits: input.rubricHits,
        selfRating: input.selfRating,
      };
      set({
        attempts: get().attempts.map((attempt) =>
          attempt.id === id ? optimistic : attempt,
        ),
        error: null,
      });
      addPending(id);

      try {
        const updated = await DesignDrillsRepository.submitAttempt(id, input);
        set({
          attempts: get().attempts.map((attempt) =>
            attempt.id === id ? updated : attempt,
          ),
        });
        const drill = get().drills.find((d) => d.id === updated.drillId);
        if (drill) {
          emit({
            type: "drill.completed",
            payload: {
              attemptId: updated.id,
              drillId: updated.drillId,
              category: drill.category,
            },
            timestamp: Date.now(),
          });
        }
      } catch (error) {
        set({ attempts: previousAttempts, error: toUserMessage(error) });
      } finally {
        removePending(id);
      }
    },

    saveAttemptNotes: async (id, notes) => {
      set({
        attempts: get().attempts.map((attempt) =>
          attempt.id === id ? { ...attempt, notes } : attempt,
        ),
      });

      try {
        await DesignDrillsRepository.saveAttemptNotes(id, notes);
      } catch (error) {
        set({ error: toUserMessage(error) });
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
        await DesignDrillsRepository.deleteAttempt(id);
      } catch (error) {
        set({ attempts: previousAttempts, error: toUserMessage(error) });
      } finally {
        removePending(id);
      }
    },

    fetchBookmarks: async () => {
      try {
        const bookmarkedDrillIds =
          await DesignDrillsRepository.listBookmarkedDrillIds();
        set({ bookmarkedDrillIds });
      } catch (error) {
        set({ error: toUserMessage(error) });
      }
    },

    toggleBookmark: async (drillId) => {
      const previous = get().bookmarkedDrillIds;
      const wasBookmarked = previous.includes(drillId);
      set({
        bookmarkedDrillIds: wasBookmarked
          ? previous.filter((id) => id !== drillId)
          : [...previous, drillId],
        error: null,
      });
      addPending(drillId);

      try {
        if (wasBookmarked) {
          await DesignDrillsRepository.removeBookmark(drillId);
        } else {
          await DesignDrillsRepository.addBookmark(drillId);
        }
      } catch (error) {
        set({ bookmarkedDrillIds: previous, error: toUserMessage(error) });
      } finally {
        removePending(drillId);
      }
    },

    attemptsForDrill: (drillId) =>
      get().attempts.filter((attempt) => attempt.drillId === drillId),

    isBookmarked: (drillId) => get().bookmarkedDrillIds.includes(drillId),

    drillBySlug: (slug) => get().drills.find((drill) => drill.slug === slug),
  };
});
