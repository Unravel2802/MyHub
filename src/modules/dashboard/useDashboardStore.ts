import { create } from "zustand";
import { format } from "date-fns";
import { on } from "@/src/lib/events";
import * as ApplicationRepository from "@/src/modules/jobApplications/ApplicationRepository";
import * as InterviewRepository from "@/src/modules/jobApplications/InterviewRepository";
import * as OutreachRepository from "@/src/modules/outreach/OutreachRepository";
import * as PrepRepository from "@/src/modules/prep/PrepRepository";
import {
  scorecardFor,
  weakestTopics as weakestTopicsFor,
} from "@/src/modules/prep/prepScorecard";
import {
  activeCheckpoint,
  FEBRUARY_2027_BEHAVIORAL_STORY_TARGET,
  progressTowardCheckpoint,
} from "@/src/modules/prep/prepTargets";
import * as TaskRepository from "@/src/modules/task/TaskRepository";
import type { Task } from "@/src/modules/task/types";
import type {
  Application,
  Interview,
} from "@/src/modules/jobApplications/types";
import type { Scorecard, TopicStat } from "@/src/modules/prep/prepScorecard";
import type { CheckpointProgress } from "@/src/modules/prep/prepTargets";
import type {
  PostMortemReminder,
  WeeklyCadence,
} from "@/src/modules/dashboard/dashboardSelectors";
import {
  applicationsNeedingFollowUp,
  interviewsNeedingPostMortem,
  thisWeeksScheduleBlocks,
  weeklyCadence as weeklyCadenceFor,
} from "@/src/modules/dashboard/dashboardSelectors";

// Published store contract for the Daily Dashboard (myhub_plan.md Part A §A.2). No new
// table, no new repository — this store's job is pure aggregation over the
// other four modules' already-published repositories, kept current by
// subscribing to their Event Bus events. See docs/handoff/daily-dashboard.md
// for the fetch/subscribe wiring.
//
// Boundary rule (an explicit assumption, since myhub_plan.md Part A §A.2 doesn't spell out HOW the
// aggregation reads other modules' data — see the handoff doc): this store may
// call TaskRepository / PrepRepository / ApplicationRepository /
// InterviewRepository / OutreachRepository directly, the same way any module
// calls its own repository, because myhub_plan.md's Repository Pattern rule
// makes each Repository the sanctioned data-access boundary for its module,
// not something private to it. What it must NOT do is import another module's
// Zustand store, its components, or any non-exported internals — cross-module
// UI/state stays off limits; only the Repository read path is shared.
export interface DashboardStore {
  scheduleBlocks: Task[];
  followUps: Application[];
  postMortemReminders: PostMortemReminder[];
  prepScorecard: Scorecard | null;
  weakestTopics: TopicStat[];
  // Added 2026-07-13, now that engineering_first_roadmap_v2.md's numbers exist.
  checkpointProgress: CheckpointProgress | null;
  behavioralStoryProgress: { actual: number; target: number } | null;
  weeklyCadence: WeeklyCadence | null;
  isLoading: boolean;
  error: string | null;

  // Fetches from all five repositories, runs the dashboardSelectors.ts /
  // prepScorecard.ts / prepTargets.ts aggregations, and populates the fields
  // above. Call once on mount.
  fetchAll: () => Promise<void>;

  // Subscribes to task.completed, application.stage_changed,
  // interview.completed, and prep.logged via src/lib/events.ts's `on()`, and
  // re-runs fetchAll on each. Returns the unsubscribe function — call it on
  // unmount. Deliberately coarse (refetch everything on any relevant event)
  // rather than patching individual fields: the panels are cheap reads and a
  // full refetch can't drift out of sync the way incremental patching can.
  //
  // Outreach Log has no Event Bus type — a logged conversation doesn't trigger
  // a refetch on its own. Accepted gap: one of the four events above will
  // refresh the weekly-cadence panel soon enough.
  subscribeToUpdates: () => () => void;
}

export const useDashboardStore = create<DashboardStore>(() => ({
  scheduleBlocks: [],
  followUps: [],
  postMortemReminders: [],
  prepScorecard: null,
  weakestTopics: [],
  checkpointProgress: null,
  behavioralStoryProgress: null,
  weeklyCadence: null,
  isLoading: false,
  error: null,

  fetchAll: async () => {
    useDashboardStore.setState({ isLoading: true, error: null });

    try {
      const [
        tasks,
        prepEntries,
        applications,
        interviews,
        outreachEntries,
        stories,
      ] = await Promise.all([
        TaskRepository.getTasks(),
        PrepRepository.getEntries(),
        ApplicationRepository.getApplications(),
        InterviewRepository.getInterviews(),
        OutreachRepository.getEntries(),
        PrepRepository.getStories(),
      ]);

      const now = new Date();
      const today = format(now, "yyyy-MM-dd");
      const currentMonth = format(now, "yyyy-MM");
      const checkpoint = activeCheckpoint(today);

      useDashboardStore.setState({
        scheduleBlocks: thisWeeksScheduleBlocks(tasks, now),
        followUps: applicationsNeedingFollowUp(applications, today),
        postMortemReminders: interviewsNeedingPostMortem(interviews, now),
        prepScorecard: scorecardFor(prepEntries, currentMonth),
        weakestTopics: weakestTopicsFor(prepEntries),
        checkpointProgress: progressTowardCheckpoint(prepEntries, checkpoint),
        behavioralStoryProgress: {
          actual: stories.length,
          target: FEBRUARY_2027_BEHAVIORAL_STORY_TARGET,
        },
        weeklyCadence: weeklyCadenceFor(
          applications,
          outreachEntries,
          prepEntries,
          now,
        ),
        isLoading: false,
        error: null,
      });
    } catch (error) {
      console.error(error);
      useDashboardStore.setState({
        isLoading: false,
        error: "Something went wrong, please try again later.",
      });
    }
  },

  subscribeToUpdates: () => {
    const refresh = () => {
      void useDashboardStore.getState().fetchAll();
    };

    const unsubscribers = [
      on((event) => {
        if (event.type === "task.completed") refresh();
      }),
      on((event) => {
        if (event.type === "application.stage_changed") refresh();
      }),
      on((event) => {
        if (event.type === "interview.completed") refresh();
      }),
      on((event) => {
        if (event.type === "prep.logged") refresh();
      }),
    ];

    return () => {
      for (const unsubscribe of unsubscribers) unsubscribe();
    };
  },
}));

// Re-exported so Codex's fetchAll implementation and the panel components use
// the same list of interview objects the selector was tested against, without
// importing jobApplications' internals directly.
export type { Interview };
