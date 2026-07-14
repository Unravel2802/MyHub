import { create } from "zustand";
import * as MomentumRepository from "@/src/modules/momentum/MomentumRepository";
import * as TaskRepository from "@/src/modules/task/TaskRepository";
import * as PrepRepository from "@/src/modules/prep/PrepRepository";
import * as ApplicationRepository from "@/src/modules/jobApplications/ApplicationRepository";
import * as InterviewRepository from "@/src/modules/jobApplications/InterviewRepository";
import * as OutreachRepository from "@/src/modules/outreach/OutreachRepository";
import { on } from "@/src/lib/events";
import {
  evaluateAchievements,
  newUnlocks,
} from "@/src/modules/momentum/achievementEngine";
import { activityDates, computeStreak } from "@/src/modules/momentum/streaks";
import type { Streak } from "@/src/modules/momentum/streaks";
import type { AchievementKey } from "@/src/modules/momentum/achievementCatalog";
import type { AchievementUnlock } from "@/src/modules/momentum/MomentumRepository";

// Published store contract for Momentum (myhub_plan.md Part B, Phase 5).
//
// Cross-module reads go through the other modules' REPOSITORIES, never their
// stores (rule 1) — same pattern useDashboardStore already established. This
// store is mounted once, by AppShell, since the streak indicator lives in the
// nav rail and is therefore on every page.

export interface MomentumStore {
  streak: Streak;
  unlocked: AchievementUnlock[];
  // Achievements unlocked in THIS session that haven't been shown yet. The UI
  // pops a toast per entry and calls dismissToast.
  pendingToasts: AchievementKey[];
  isLoading: boolean;
  error: string | null;

  refresh: () => Promise<void>;
  dismissToast: (key: AchievementKey) => void;
  subscribeToUpdates: () => () => void;
}

const EMPTY_STREAK: Streak = { current: 0, longest: 0, activeToday: false };

const FAILURE_MESSAGE = "Something went wrong, please try again later.";

function toUserMessage(error: unknown): string {
  console.error(error);
  return FAILURE_MESSAGE;
}

// Layer 1 of three-layer idempotency: an in-flight guard. Module-scoped rather
// than store state on purpose — it must be checked and set SYNCHRONOUSLY, with
// no await in between, or two refreshes triggered in the same tick (a very
// normal thing when two events fire together) would both pass the check.
let refreshInFlight = false;

export const useMomentumStore = create<MomentumStore>((set, get) => ({
  streak: EMPTY_STREAK,
  unlocked: [],
  pendingToasts: [],
  isLoading: false,
  error: null,

  refresh: async () => {
    if (refreshInFlight) return;
    refreshInFlight = true;
    set({ isLoading: true, error: null });

    try {
      const [
        tasks,
        prepEntries,
        behavioralStories,
        applications,
        interviews,
        outreachEntries,
        persistedUnlocks,
      ] = await Promise.all([
        TaskRepository.getTasks(),
        PrepRepository.getEntries(),
        PrepRepository.getStories(),
        ApplicationRepository.getApplications(),
        InterviewRepository.getInterviews(),
        OutreachRepository.getEntries(),
        MomentumRepository.getUnlocks(),
      ]);

      const today = new Date();
      const streak = computeStreak(
        activityDates({ tasks, prepEntries, applications, outreachEntries }),
        today,
      );

      const earned = evaluateAchievements({
        tasks,
        prepEntries,
        behavioralStories,
        applications,
        interviews,
        outreachEntries,
        today,
      });

      const persistedKeys = new Set(
        persistedUnlocks.map((unlock) => unlock.key),
      );
      const fresh = newUnlocks(earned, persistedKeys);

      // Layer 2: commit the new state SYNCHRONOUSLY, before awaiting the
      // insert. If a racing refresh started while the insert is in flight, it
      // would re-read `unlocked` from the DB (which doesn't have these rows
      // yet) and re-queue the same toasts — so we optimistically fold them in
      // here first, and the in-flight guard above covers the window. Layer 3 is
      // the DB's ignore-duplicates upsert, which catches the cross-TAB case
      // neither of the in-memory layers can see.
      if (fresh.length > 0) {
        set({
          streak,
          unlocked: persistedUnlocks,
          pendingToasts: [...get().pendingToasts, ...fresh],
          isLoading: false,
        });
        const inserted = await MomentumRepository.insertUnlocks(fresh);
        set({ unlocked: [...inserted, ...persistedUnlocks] });
      } else {
        set({ streak, unlocked: persistedUnlocks, isLoading: false });
      }
    } catch (error) {
      set({ isLoading: false, error: toUserMessage(error) });
    } finally {
      refreshInFlight = false;
    }
  },

  dismissToast: (key) =>
    set({
      pendingToasts: get().pendingToasts.filter((pending) => pending !== key),
    }),

  // Recompute whenever anything that feeds an achievement changes. Returns the
  // unsubscribe function — AppShell calls this in an effect and cleans up.
  subscribeToUpdates: () =>
    on((event) => {
      switch (event.type) {
        case "task.completed":
        // A completion can be UNDONE, and the streak has to shrink when it is.
        // Listening only to task.completed meant the streak could only ever
        // grow: reopen the task behind a 1-day streak and the flame stayed lit
        // until the next page load.
        //
        // Deliberately NOT task.updated — that fires on every title edit, due
        // date change and reorder, and each one would trigger a full
        // seven-repository refetch. task.uncompleted fires only on the
        // transition that can actually change the answer.
        case "task.uncompleted":
        case "prep.logged":
        case "application.stage_changed":
        case "interview.completed":
        case "outreach.logged":
          void get().refresh();
          break;
        default:
          break;
      }
    }),
}));
