"use client";

import { format } from "date-fns";
import { Dumbbell } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/src/components/AppShell";
import { PageHeader } from "@/src/components/ui/PageHeader";
import { StatCard } from "@/src/components/ui/StatCard";
import { BehavioralStories } from "@/src/modules/prep/components/BehavioralStories";
import { PrepEntryForm } from "@/src/modules/prep/components/PrepEntryForm";
import { PrepEntryList } from "@/src/modules/prep/components/PrepEntryList";
import { PrepScorecard } from "@/src/modules/prep/components/PrepScorecard";
import { TimeAllocationPanel } from "@/src/modules/prep/components/TimeAllocationPanel";
import { usePrepStore } from "@/src/modules/prep/usePrepStore";
import { scorecardFor } from "@/src/modules/prep/prepScorecard";
import {
  activeCheckpoint,
  progressTowardCheckpoint,
} from "@/src/modules/prep/prepTargets";
import { hueFor } from "@/src/components/moduleHues";
import { register, unregister } from "@/src/lib/commandPalette";
import { registerShortcuts, unregisterShortcuts } from "@/src/lib/shortcuts";
import { on } from "@/src/lib/events";
import * as LeetCodeRepository from "@/src/modules/leetcode/LeetCodeRepository";
import type { LeetCodeProblem } from "@/src/modules/leetcode/types";
import {
  problemCountInMonth,
  problemCountThrough,
} from "@/src/modules/leetcode/leetcodeBoard";

interface PrepTrackerProps {
  children?: ReactNode;
}

export function PrepTracker({ children }: PrepTrackerProps) {
  const {
    entries,
    stories,
    isLoading,
    isCreating,
    pendingIds,
    error,
    fetchEntries,
    createEntry,
    deleteEntry,
    fetchStories,
    createStory,
    updateStory,
    deleteStory,
    weakestTopics,
  } = usePrepStore();
  const [month, setMonth] = useState(() => format(new Date(), "yyyy-MM"));
  const pending = useMemo(() => new Set(pendingIds), [pendingIds]);
  const topics = weakestTopics(3, month);
  const checkpoint = activeCheckpoint(format(new Date(), "yyyy-MM-dd"));

  // LeetCode Tracker problems count as algorithm reps here too (read via its
  // Repository, mirroring useDashboardStore's cross-module pattern — Prep
  // doesn't reach into another module's store or components, architecture
  // rule 1). Refetched on `leetcode.problem_logged` so a problem added in
  // the LeetCode Tracker section below updates this count without a manual
  // refresh.
  const [leetcodeProblems, setLeetcodeProblems] = useState<LeetCodeProblem[]>(
    [],
  );
  const fetchLeetcodeProblems = () =>
    LeetCodeRepository.getProblems()
      .then(setLeetcodeProblems)
      .catch(() => undefined);

  const monthlyScorecard = scorecardFor(
    entries,
    month,
    problemCountInMonth(leetcodeProblems, month),
  );
  const checkpointProgress = progressTowardCheckpoint(
    entries,
    checkpoint,
    problemCountThrough(leetcodeProblems, checkpoint.throughDate),
  );

  useEffect(() => {
    void Promise.all([fetchEntries(), fetchStories(), fetchLeetcodeProblems()]);
    const unsubscribe = on((event) => {
      if (event.type === "leetcode.problem_logged") {
        void fetchLeetcodeProblems();
      }
    });
    return () => {
      unsubscribe();
    };
  }, [fetchEntries, fetchStories]);

  useEffect(() => {
    register("prep", [
      {
        id: "new-entry",
        label: "New prep entry",
        keywords: ["prep", "practice", "log"],
        action: () => {
          document
            .getElementById("log-prep-heading")
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        },
      },
      {
        id: "refresh",
        label: "Refresh prep tracker",
        keywords: ["prep", "refresh", "reload"],
        action: () => document.getElementById("prep-refresh")?.click(),
      },
    ]);
    registerShortcuts("prep", [
      {
        combo: "n p",
        commandId: "prep.new-entry",
        description: "Log a prep entry",
      },
      {
        combo: "r p",
        commandId: "prep.refresh",
        description: "Refresh prep data",
      },
    ]);
    return () => {
      unregisterShortcuts("prep");
      unregister("prep");
    };
  }, []);

  function confirmEntryDelete(id: string, topic: string) {
    if (window.confirm(`Delete prep session "${topic}"?`)) {
      void deleteEntry(id);
    }
  }

  function confirmStoryDelete(id: string, title: string) {
    if (window.confirm(`Delete behavioral story "${title}"?`)) {
      void deleteStory(id);
    }
  }

  return (
    <AppShell activeHref="/prep" title="Prep Tracker">
      <section className="page-fade min-w-0 px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader
          actions={
            <button
              className="h-10 rounded-md border border-input bg-surface px-4 text-sm text-body hover:border-input-hover"
              disabled={isLoading}
              id="prep-refresh"
              onClick={() => void Promise.all([fetchEntries(), fetchStories()])}
              type="button"
            >
              Refresh
            </button>
          }
          bleed
          className="mb-6"
          eyebrow="Interview preparation"
          hue={hueFor("/prep")}
          icon={Dumbbell}
          title="Build measurable reps"
        />

        {error ? (
          <p
            aria-live="assertive"
            className="mb-5 rounded-md border border-danger-border bg-danger-surface px-3 py-2 text-sm text-danger"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <div className="grid gap-6">
          <StatCard
            hue={
              checkpointProgress.algorithm.actual > 0
                ? hueFor("/prep")
                : undefined
            }
            hint={`${checkpointProgress.algorithm.actual}/${checkpointProgress.algorithm.target} algorithms · ${checkpointProgress.systemDesign.actual}/${checkpointProgress.systemDesign.target} system design`}
            label={checkpoint.label}
            size="hero"
            value={`${Math.round(Math.min(checkpointProgress.algorithm.progress, 1) * 100)}%`}
          />
          <div className="grid content-start gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <PrepScorecard
              entries={entries}
              month={month}
              onMonthChange={setMonth}
              scorecard={monthlyScorecard}
              topics={topics}
            />
            <TimeAllocationPanel entries={entries} />
          </div>
          {children}
          <PrepEntryForm disabled={isCreating} onCreate={createEntry} />
          <BehavioralStories
            disabled={isCreating}
            onCreate={createStory}
            onDelete={confirmStoryDelete}
            onUpdate={updateStory}
            pendingIds={pending}
            stories={stories}
          />
          <PrepEntryList
            entries={entries}
            onDelete={confirmEntryDelete}
            pendingIds={pending}
          />
        </div>
      </section>
    </AppShell>
  );
}
