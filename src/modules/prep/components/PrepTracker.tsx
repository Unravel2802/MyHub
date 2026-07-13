"use client";

import { format } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/src/components/AppShell";
import { BehavioralStories } from "@/src/modules/prep/components/BehavioralStories";
import { PrepEntryForm } from "@/src/modules/prep/components/PrepEntryForm";
import { PrepEntryList } from "@/src/modules/prep/components/PrepEntryList";
import { PrepScorecard } from "@/src/modules/prep/components/PrepScorecard";
import { usePrepStore } from "@/src/modules/prep/usePrepStore";

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

  useEffect(() => {
    void Promise.all([fetchEntries(), fetchStories()]);
  }, [fetchEntries, fetchStories]);

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
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted">
              Interview preparation
            </p>
            <h2 className="mt-1 text-3xl font-semibold text-foreground">
              Build measurable reps
            </h2>
          </div>
          <button
            className="h-10 rounded-md border border-input bg-surface px-4 text-sm text-body hover:border-input-hover"
            disabled={isLoading}
            onClick={() => void Promise.all([fetchEntries(), fetchStories()])}
            type="button"
          >
            Refresh
          </button>
        </header>

        {error ? (
          <p className="mb-5 rounded-md border border-danger-border bg-danger-surface px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="grid content-start gap-6">
            <PrepEntryForm disabled={isCreating} onCreate={createEntry} />
            <PrepEntryList
              entries={entries}
              onDelete={confirmEntryDelete}
              pendingIds={pending}
            />
          </div>
          <div className="grid content-start gap-6">
            <PrepScorecard
              month={month}
              onMonthChange={setMonth}
              scorecard={monthlyScorecard}
              topics={topics}
            />
            <BehavioralStories
              disabled={isCreating}
              onCreate={createStory}
              onDelete={confirmStoryDelete}
              onUpdate={updateStory}
              pendingIds={pending}
              stories={stories}
            />
          </div>
        </div>
      </section>
    </AppShell>
  );
}
