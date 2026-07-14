import { ProgressBar } from "@/src/components/ui/ProgressBar";
import { StatCard } from "@/src/components/ui/StatCard";
import { timeAllocation } from "@/src/modules/prep/prepAllocation";
import type { PrepEntry } from "@/src/modules/prep/types";

const areaLabels = {
  algorithm: "Algorithms",
  system_design: "System design",
  behavioral: "Behavioral",
  ml_system_design: "ML system design",
  resume_deep_dive: "Resume deep-dive",
} as const;

export function TimeAllocationPanel({ entries }: { entries: PrepEntry[] }) {
  const allocation = timeAllocation(entries);

  return (
    <section
      aria-labelledby="time-allocation-heading"
      className="rounded-lg border border-border bg-surface p-5"
    >
      <h2
        className="text-lg font-semibold text-foreground"
        id="time-allocation-heading"
      >
        Prep time allocation
      </h2>
      <p className="mt-1 text-sm text-muted">
        Target share of eligible practice time from roadmap §11.3.
      </p>
      <div className="mt-4 grid gap-3">
        {allocation.map((area, index) => (
          <div
            className="fade-up grid gap-2 rounded-md border border-border p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] sm:items-center"
            key={area.area}
            style={{ ["--i" as string]: index }}
          >
            <StatCard
              hint={`Target ${Math.round(area.targetPct * 100)}%`}
              label={areaLabels[area.area]}
              value={
                area.actualPct === null
                  ? "—"
                  : `${Math.round(area.actualPct * 100)}%`
              }
            />
            <ProgressBar progress={area.actualPct ?? 0} />
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">
        Mock-interview time excluded (§11.3).
      </p>
    </section>
  );
}
