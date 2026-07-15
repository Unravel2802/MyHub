"use client";

import type { ActivityGrid } from "@/src/modules/momentum/activityGrid";

// The GitHub-style contribution grid (docs/color-refresh.md K2). Color IS the
// data here: an emerald ramp by how much you did that day. The streak finally
// has somewhere to see itself across the whole run to graduation.

// level -> class. Level 0 is bare surface, NOT green-0 — an empty day is
// absence, and absence is never tinted (the rule that's bitten three times).
const LEVEL_CLASS: Record<number, string> = {
  0: "bg-surface-subtle",
  1: "bg-hue-emerald-surface",
  2: "bg-hue-emerald/40",
  3: "bg-hue-emerald/70",
  4: "bg-hue-emerald",
};

function label(count: number, key: string): string {
  if (count === 0) return `${key}: nothing logged`;
  return `${key}: ${count} ${count === 1 ? "thing" : "things"} logged`;
}

export function ActivityHeatmap({ grid }: { grid: ActivityGrid }) {
  if (grid.weeks.length === 0) return null;

  return (
    <section aria-labelledby="heatmap-heading" className="grid gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2
          className="text-xl font-semibold tracking-tight text-foreground"
          id="heatmap-heading"
        >
          Activity
        </h2>
        <p className="text-xs uppercase tracking-widest text-muted">
          {grid.total} logged over {grid.activeDays} active days
        </p>
      </div>

      <div className="overflow-x-auto pb-1">
        <div className="flex gap-1">
          {grid.weeks.map((week) => (
            <div className="grid gap-1" key={week[0].key}>
              {week.map((day) =>
                day.future ? (
                  // A day that hasn't happened is a spacer, not a missed day —
                  // it keeps the grid aligned without implying you failed at it.
                  <div
                    aria-hidden
                    className="h-3 w-3 rounded-[2px] opacity-0"
                    key={day.key}
                  />
                ) : (
                  <div
                    aria-label={label(day.count, day.key)}
                    className={`h-3 w-3 rounded-[2px] transition-colors duration-200 ${LEVEL_CLASS[day.level]}`}
                    key={day.key}
                    title={label(day.count, day.key)}
                  />
                ),
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Legend. The emerald ramp, less -> more. */}
      <div className="flex items-center gap-1.5 text-xs text-muted">
        <span>Less</span>
        {[0, 1, 2, 3, 4].map((level) => (
          <span
            className={`h-3 w-3 rounded-[2px] ${LEVEL_CLASS[level]}`}
            key={level}
          />
        ))}
        <span>More</span>
      </div>
    </section>
  );
}
