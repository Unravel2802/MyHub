"use client";

import Link from "next/link";
import { format } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { ThemeToggle } from "@/src/components/ThemeToggle";
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
    <main className="min-h-screen bg-canvas text-foreground">
      <div className="grid min-h-screen lg:grid-cols-[260px_1fr]">
        <aside className="flex flex-col gap-8 overflow-y-auto border-b border-border bg-surface px-6 py-6 lg:sticky lg:top-0 lg:h-screen lg:self-start lg:border-b-0 lg:border-r">
          <div>
            <p className="text-sm font-semibold text-accent-strong">MyHub</p>
            <h1 className="mt-2 text-2xl font-semibold text-foreground">
              Prep Tracker
            </h1>
            <nav aria-label="MyHub modules" className="mt-6 grid gap-2 text-sm">
              <Link
                className="rounded-md px-3 py-2 text-body hover:bg-surface-subtle"
                href="/dashboard"
              >
                Dashboard
              </Link>
              <Link
                className="rounded-md px-3 py-2 text-body hover:bg-surface-subtle"
                href="/"
              >
                Task Engine
              </Link>
              <Link
                aria-current="page"
                className="rounded-md bg-surface-subtle px-3 py-2 font-medium text-foreground"
                href="/prep"
              >
                Prep Tracker
              </Link>
              <Link
                className="rounded-md px-3 py-2 text-body hover:bg-surface-subtle"
                href="/applications"
              >
                Job CRM
              </Link>
              <Link
                className="rounded-md px-3 py-2 text-body hover:bg-surface-subtle"
                href="/outreach"
              >
                Outreach Log
              </Link>
            </nav>
          </div>
          <div className="lg:mt-auto">
            <ThemeToggle />
          </div>
        </aside>

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
      </div>
    </main>
  );
}
