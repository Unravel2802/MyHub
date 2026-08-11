"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Map } from "lucide-react";
import { PageTemplate } from "@/src/components/ui/PageTemplate";
import { StatCard } from "@/src/components/ui/StatCard";
import { RoadmapTimeline } from "@/src/modules/roadmap/components/RoadmapTimeline";
import { ReadinessRadar } from "@/src/modules/roadmap/components/ReadinessRadar";
import { ActivityHeatmap } from "@/src/components/ui/ActivityHeatmap";
import { useRoadmapStore } from "@/src/modules/roadmap/useRoadmapStore";
import { useActivityGrid } from "@/src/components/momentumState";
import { hueFor } from "@/src/components/moduleHues";
import { register, unregister } from "@/src/lib/commandPalette";
import { registerShortcuts, unregisterShortcuts } from "@/src/lib/shortcuts";

export function RoadmapPage() {
  const router = useRouter();
  const store = useRoadmapStore();
  const { fetchRoadmap } = store;
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  useEffect(() => {
    void fetchRoadmap();
  }, [fetchRoadmap]);

  useEffect(() => {
    register("roadmap", [
      {
        id: "go-to-page",
        label: "Go to Roadmap",
        keywords: ["roadmap", "plan", "graduation"],
        action: () => router.push("/roadmap"),
      },
      {
        id: "focus-readiness",
        label: "View graduation readiness",
        keywords: ["roadmap", "readiness", "radar", "graduation"],
        action: () =>
          document
            .getElementById("readiness-heading")
            ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      },
    ]);
    registerShortcuts("roadmap", [
      {
        combo: "g r",
        commandId: "roadmap.go-to-page",
        description: "Open the roadmap",
      },
      {
        combo: "v r",
        commandId: "roadmap.focus-readiness",
        description: "View graduation readiness",
      },
    ]);
    return () => {
      unregisterShortcuts("roadmap");
      unregister("roadmap");
    };
  }, [router]);

  // Derived, not an effect: default to the month you're actually IN, so the page
  // lands on "what do I do now" rather than making you hunt for yourself on the
  // track. Doing this with setState-in-an-effect would cascade a second render
  // for no reason — the value is a pure function of what we already have.
  const activeMonth = selectedMonth ?? store.currentMonth;

  const pending = useMemo(
    () => new Set(store.pendingKeys),
    [store.pendingKeys],
  );
  const missed = store.months.filter((m) => m.status === "missed").length;

  // Activity data lives on the momentum store (it fetches all four sources every
  // refresh, and AppShell mounts it on every page), so the heatmap reads it here
  // rather than the roadmap store fetching tasks a second time.
  const activityGrid = useActivityGrid();

  return (
    <PageTemplate
      error={store.error}
      eyebrow="Engineering-first roadmap"
      hero={
        <StatCard
          hint="until graduation"
          label="May 2027"
          size="hero"
          hue={hueFor("/roadmap")}
          value={`${store.daysLeft} days`}
        />
      }
      href="/roadmap"
      icon={Map}
      stats={[
        <StatCard
          hint="criteria met across the plan"
          key="overall-progress"
          label="Overall progress"
          tone={store.progress > 0 ? "success" : "default"}
          value={`${Math.round(store.progress * 100)}%`}
        />,
        <StatCard
          hint={missed > 0 ? "months you can't get back" : "nothing missed yet"}
          key="missed-months"
          label="Missed months"
          tone={missed > 0 ? "danger" : "default"}
          value={missed}
        />,
      ]}
      title="Where you stand"
    >
      <div className="grid gap-10">
        <RoadmapTimeline
          currentMonth={store.currentMonth}
          months={store.months}
          onSelectMonth={setSelectedMonth}
          onToggleCriterion={(key, next) =>
            void store.toggleCriterion(key, next)
          }
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
    </PageTemplate>
  );
}
