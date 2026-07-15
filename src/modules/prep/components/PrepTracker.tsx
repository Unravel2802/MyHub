"use client";

import { format } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/src/components/AppShell";
import { PageHeader } from "@/src/components/ui/PageHeader";
import { StatCard } from "@/src/components/ui/StatCard";
import { BehavioralStories } from "@/src/modules/prep/components/BehavioralStories";
import { PrepEntryForm } from "@/src/modules/prep/components/PrepEntryForm";
import { PrepEntryList } from "@/src/modules/prep/components/PrepEntryList";
import { PrepScorecard } from "@/src/modules/prep/components/PrepScorecard";
import { TimeAllocationPanel } from "@/src/modules/prep/components/TimeAllocationPanel";
import { usePrepStore } from "@/src/modules/prep/usePrepStore";
import {
  activeCheckpoint,
  progressTowardCheckpoint,
} from "@/src/modules/prep/prepTargets";
import { hueFor } from "@/src/components/moduleHues";
import { register, unregister } from "@/src/lib/commandPalette";

export function PrepTracker() {
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
    scorecard,
    weakestTopics,
  } = usePrepStore();
  const [month, setMonth] = useState(() => format(new Date(), "yyyy-MM"));
  const pending = useMemo(() => new Set(pendingIds), [pendingIds]);
  const monthlyScorecard = scorecard(month);
  const topics = weakestTopics(3, month);
  const checkpoint = activeCheckpoint(format(new Date(), "yyyy-MM-dd"));
  const checkpointProgress = progressTowardCheckpoint(entries, checkpoint);

  useEffect(() => {
    void Promise.all([fetchEntries(), fetchStories()]);
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
    ]);
    return () => unregister("prep");
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
      <section className="min-w-0 px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader
          actions={
            <button
              className="h-10 rounded-md border border-input bg-surface px-4 text-sm text-body hover:border-input-hover"
              disabled={isLoading}
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
          <BehavioralStories
            disabled={isCreating}
            onCreate={createStory}
            onDelete={confirmStoryDelete}
            onUpdate={updateStory}
            pendingIds={pending}
            stories={stories}
          />
          {/* The entry LIST is data — it belongs on the page, not hidden behind a
              "Log a prep session" toggle. Burying your recent sessions under a
              form is exactly the form-first pattern the IA flip was undoing. */}
          <PrepEntryList
            entries={entries}
            onDelete={confirmEntryDelete}
            pendingIds={pending}
          />
          {/* `open` by default, matching the CRM's "Add to your pipeline". The
              form sits BELOW the data, which is the point — collapsing it
              entirely also hid it from the keyboard and from the specs. */}
          <details className="rounded-lg border border-border bg-surface" open>
            <summary className="cursor-pointer px-5 py-4 text-lg font-semibold tracking-tight text-foreground">
              Log a prep session
            </summary>
            <div className="border-t border-border p-5">
              <PrepEntryForm disabled={isCreating} onCreate={createEntry} />
            </div>
          </details>
        </div>
      </section>
    </AppShell>
  );
}
