import { create } from "zustand";
import * as RoadmapRepository from "@/src/modules/roadmap/RoadmapRepository";
import * as PrepRepository from "@/src/modules/prep/PrepRepository";
import * as ApplicationRepository from "@/src/modules/jobApplications/ApplicationRepository";
import * as CompanyRepository from "@/src/modules/jobApplications/CompanyRepository";
import * as OutreachRepository from "@/src/modules/outreach/OutreachRepository";
import {
  currentMonthKey,
  daysUntilGraduation,
  evaluateRoadmap,
  overallProgress,
  readinessEvidence,
} from "@/src/modules/roadmap/roadmapProgress";
import type { RoadmapSnapshot } from "@/src/modules/roadmap/roadmapProgress";
import type { ReadinessEvidenceResult } from "@/src/modules/roadmap/roadmapProgress";
import type {
  MonthKey,
  MonthState,
  ReadinessLevel,
} from "@/src/modules/roadmap/types";

// Published store contract for the Roadmap. Cross-module data comes through the
// other modules' REPOSITORIES, never their stores (rule 1) — same pattern as
// useDashboardStore and useMomentumStore.

export interface RoadmapStore {
  months: MonthState[];
  readiness: Record<string, ReadinessLevel>;
  currentMonth: MonthKey | null;
  progress: number;
  daysLeft: number;
  isLoading: boolean;
  error: string | null;
  pendingKeys: string[];

  fetchRoadmap: () => Promise<void>;
  // Manual criteria only. An auto criterion can never be ticked — the number IS
  // the truth, and a roadmap you can mark complete without doing the work is a
  // roadmap that lies to you.
  toggleCriterion: (itemKey: string, next: boolean) => Promise<void>;
  setReadiness: (areaKey: string, level: ReadinessLevel) => Promise<void>;
  // The MEASURED level for an area, to show beside the claimed one. Null where
  // the bar is a judgment and no number can honestly stand in for it.
  evidenceFor: (areaKey: string) => ReadinessEvidenceResult | null;
}

const FAILURE_MESSAGE = "Something went wrong, please try again later.";

function toUserMessage(error: unknown): string {
  console.error(error);
  return FAILURE_MESSAGE;
}

const EMPTY_SNAPSHOT: RoadmapSnapshot = {
  prepEntries: [],
  behavioralStories: [],
  applications: [],
  companies: [],
  outreachEntries: [],
};

export const useRoadmapStore = create<RoadmapStore>((set, get) => {
  // Kept outside the rendered state: it's the raw material for re-evaluation
  // after a tick, not something the UI renders directly.
  let snapshot: RoadmapSnapshot = EMPTY_SNAPSHOT;
  let ticked = new Set<string>();

  const recompute = (today = new Date()) => {
    const months = evaluateRoadmap(snapshot, ticked, today);
    set({
      months,
      currentMonth: currentMonthKey(today),
      progress: overallProgress(months),
      daysLeft: daysUntilGraduation(today),
    });
  };

  const addPending = (key: string) =>
    set({ pendingKeys: [...get().pendingKeys, key] });
  const removePending = (key: string) =>
    set({ pendingKeys: get().pendingKeys.filter((k) => k !== key) });

  return {
    months: [],
    readiness: {},
    currentMonth: null,
    progress: 0,
    daysLeft: 0,
    isLoading: false,
    error: null,
    pendingKeys: [],

    fetchRoadmap: async () => {
      set({ isLoading: true, error: null });
      try {
        const [
          prepEntries,
          behavioralStories,
          applications,
          companies,
          outreachEntries,
          stored,
        ] = await Promise.all([
          PrepRepository.getEntries(),
          PrepRepository.getStories(),
          ApplicationRepository.getApplications(),
          CompanyRepository.getCompanies(),
          OutreachRepository.getEntries(),
          RoadmapRepository.getProgress(),
        ]);

        snapshot = {
          prepEntries,
          behavioralStories,
          applications,
          companies,
          outreachEntries,
        };
        ticked = new Set(stored.ticks.map((tick) => tick.itemKey));

        set({
          readiness: Object.fromEntries(
            stored.readiness.map((entry) => [entry.areaKey, entry.level]),
          ),
          isLoading: false,
        });
        recompute();
      } catch (error) {
        set({ isLoading: false, error: toUserMessage(error) });
      }
    },

    toggleCriterion: async (itemKey, next) => {
      const previous = new Set(ticked);
      // Optimistic: tick locally and re-evaluate immediately, so the month's
      // status and the timeline's fill move the instant you click.
      if (next) ticked.add(itemKey);
      else ticked.delete(itemKey);
      recompute();
      addPending(itemKey);

      try {
        if (next) await RoadmapRepository.tickCriterion(itemKey);
        else await RoadmapRepository.untickCriterion(itemKey);
      } catch (error) {
        ticked = previous;
        recompute();
        set({ error: toUserMessage(error) });
      } finally {
        removePending(itemKey);
      }
    },

    setReadiness: async (areaKey, level) => {
      const previous = get().readiness;
      set({ readiness: { ...previous, [areaKey]: level } });
      addPending(areaKey);

      try {
        await RoadmapRepository.setReadiness(areaKey, level);
      } catch (error) {
        set({ readiness: previous, error: toUserMessage(error) });
      } finally {
        removePending(areaKey);
      }
    },

    evidenceFor: (areaKey) => readinessEvidence(areaKey, snapshot),
  };
});
