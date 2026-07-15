"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/src/components/AppShell";
import { StatCard } from "@/src/components/ui/StatCard";
import { RoadmapTimeline } from "@/src/modules/roadmap/components/RoadmapTimeline";
import { ReadinessRadar } from "@/src/modules/roadmap/components/ReadinessRadar";
import { ActivityHeatmap } from "@/src/modules/momentum/components/ActivityHeatmap";
import { useRoadmapStore } from "@/src/modules/roadmap/useRoadmapStore";
import { useMomentumStore } from "@/src/modules/momentum/useMomentumStore";

export function RoadmapPage() {
  const store = useRoadmapStore();
  const { fetchRoadmap } = store;
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  useEffect(() => {
    void fetchRoadmap();
  }, [fetchRoadmap]);

  // Derived, not an effect: default to the month you're actually IN, so the page
  // lands on "what do I do now" rather than making you hunt for yourself on the
  // track. Doing this with setState-in-an-effect would cascade a second render
  // for no reason — the value is a pure function of what we already have.
  const activeMonth = selectedMonth ?? store.currentMonth;

  const pending = useMemo(() => new Set(store.pendingKeys), [store.pendingKeys]);
  const missed = store.months.filter((m) => m.status === "missed").length;

  // Activity data lives on the momentum store (it fetches all four sources every
  // refresh, and AppShell mounts it on every page), so the heatmap reads it here
  // rather than the roadmap store fetching tasks a second time.
  const activityGrid = useMomentumStore((state) => state.activityGrid);

  return (
    <AppShell activeHref="/roadmap" title="Roadmap">
      <section className="min-w-0 px-4 py-6 sm:px-6 lg:px-8">
        <header>
          <p className="text-xs font-medium uppercase tracking-widest text-muted">
            Engineering-first roadmap
          </p>
          <h2 className="mt-1 text-3xl font-semibold tracking-tight">
            Where you stand
          </h2>
        </header>

        {store.error ? (
          <p
            aria-live="assertive"
            className="mt-5 rounded-md border border-danger-border bg-danger-surface px-3 py-2 text-sm text-danger"
            role="alert"
          >
            {store.error}
          </p>
        ) : null}

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {/* The one number that never stops mattering. */}
          <StatCard
            hint="until graduation"
            label="May 2027"
            size="hero"
            tone={store.daysLeft > 0 ? "accent" : "default"}
            value={`${store.daysLeft} days`}
          />
          <StatCard
            hint="criteria met across the plan"
            label="Overall progress"
            tone={store.progress > 0 ? "success" : "default"}
            value={`${Math.round(store.progress * 100)}%`}
          />
          {/* Never tint a zero — a card highlighting the absence of misses would
              be celebrating nothing. Only turns red when there IS something. */}
          <StatCard
            hint={missed > 0 ? "months you can't get back" : "nothing missed yet"}
            label="Missed months"
            tone={missed > 0 ? "danger" : "default"}
            value={missed}
          />
        </div>

        <div className="mt-8 grid gap-10">
          <RoadmapTimeline
            currentMonth={store.currentMonth}
            months={store.months}
            onSelectMonth={setSelectedMonth}
            onToggleCriterion={(key, next) => void store.toggleCriterion(key, next)}
            pendingKeys={pending}
            selectedMonth={activeMonth}
          />

          <ActivityHeatmap grid={activityGrid} />

          <ReadinessRadar
            evidenceFor={store.evidenceFor}
            onSetLevel={(area, level) => void store.setReadiness(area, level)}
            pendingKeys={pending}
            readiness={store.readiness}
          />
        </div>
      </section>
    </AppShell>
  );
}
