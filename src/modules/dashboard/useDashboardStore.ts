import { create } from "zustand";
import type { Task } from "@/src/modules/task/types";
import type {
  Application,
  Interview,
} from "@/src/modules/jobApplications/types";
import type { Scorecard, TopicStat } from "@/src/modules/prep/prepScorecard";
import type {
  GateChecklistProgress,
  PostMortemReminder,
} from "@/src/modules/dashboard/dashboardSelectors";

// Published store contract for the Daily Dashboard (myhub_plan.md §2.3). No new
// table, no new repository — this store's job is pure aggregation over the
// other three modules' already-published repositories, kept current by
// subscribing to their Event Bus events. See docs/handoff/daily-dashboard.md
// for the fetch/subscribe wiring, which is Codex's to implement.
//
// Boundary rule (an explicit assumption, since §2.3 doesn't spell out HOW the
// aggregation reads other modules' data — see the handoff doc): this store may
// call TaskRepository / PrepRepository / ApplicationRepository /
// InterviewRepository directly, the same way any module calls its own
// repository, because myhub_plan.md's Repository Pattern rule makes each
// Repository the sanctioned data-access boundary for its module, not something
// private to it. What it must NOT do is import another module's Zustand store,
// its components, or any non-exported internals — cross-module UI/state stays
// off limits; only the Repository read path is shared.
export interface DashboardStore {
  scheduleBlocks: Task[];
  followUps: Application[];
  postMortemReminders: PostMortemReminder[];
  gateChecklist: GateChecklistProgress | null;
  prepScorecard: Scorecard | null;
  weakestTopics: TopicStat[];
  isLoading: boolean;
  error: string | null;

  // Fetches from all four repositories, runs the dashboardSelectors.ts
  // aggregations, and populates the fields above. Call once on mount.
  fetchAll: () => Promise<void>;

  // Subscribes to task.completed, application.stage_changed,
  // interview.completed, and prep.logged via src/lib/events.ts's `on()`, and
  // re-runs fetchAll on each. Returns the unsubscribe function — call it on
  // unmount. Deliberately coarse (refetch everything on any relevant event)
  // rather than patching individual fields: the panels are cheap reads and a
  // full refetch can't drift out of sync the way incremental patching can.
  subscribeToUpdates: () => () => void;
}

const NOT_IMPLEMENTED = () => {
  throw new Error("not implemented");
};

export const useDashboardStore = create<DashboardStore>(() => ({
  scheduleBlocks: [],
  followUps: [],
  postMortemReminders: [],
  gateChecklist: null,
  prepScorecard: null,
  weakestTopics: [],
  isLoading: false,
  error: null,

  fetchAll: NOT_IMPLEMENTED,
  subscribeToUpdates: NOT_IMPLEMENTED,
}));

// Re-exported so Codex's fetchAll implementation and the panel components use
// the same list of interview objects the selector was tested against, without
// importing jobApplications' internals directly.
export type { Interview };
