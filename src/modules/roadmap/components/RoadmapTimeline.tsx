"use client";

import { ProgressBar } from "@/src/components/ui/ProgressBar";
import { Badge } from "@/src/components/ui/Badge";
import type { MonthState, MonthStatus } from "@/src/modules/roadmap/types";

type RoadmapTimelineProps = {
  months: MonthState[];
  currentMonth: string | null;
  selectedMonth: string | null;
  pendingKeys: ReadonlySet<string>;
  onSelectMonth: (key: string) => void;
  onToggleCriterion: (key: string, next: boolean) => void;
};

// The station's ring. `missed` is a RED ring and it stays that way — not
// softened, not rolled forward. A roadmap that hides an incomplete month is how
// you drift a whole semester without noticing (§16). The discomfort is the
// feature.
const stationClasses: Record<MonthStatus, string> = {
  done: "border-accent bg-accent text-primary-foreground",
  in_progress: "border-accent bg-accent-surface text-accent-strong",
  upcoming: "border-border bg-surface text-muted",
  missed: "border-danger bg-danger-surface text-danger",
};

const statusLabel: Record<MonthStatus, string> = {
  done: "Done",
  in_progress: "In progress",
  upcoming: "Upcoming",
  missed: "Missed",
};

const badgeTone: Record<MonthStatus, "success" | "accent" | "neutral" | "danger"> =
  {
    done: "success",
    in_progress: "accent",
    upcoming: "neutral",
    missed: "danger",
  };

export function RoadmapTimeline({
  months,
  currentMonth,
  selectedMonth,
  pendingKeys,
  onSelectMonth,
  onToggleCriterion,
}: RoadmapTimelineProps) {
  const selected =
    months.find((state) => state.month.key === selectedMonth) ?? null;

  // How far along the track the accent fill reaches. Whole months behind you
  // count fully; the month you're INSIDE fills proportionally, so the line
  // advances as you tick things off rather than jumping a month at a time.
  const doneBefore = months.findIndex(
    (state) => state.month.key === currentMonth,
  );
  const currentState = months.find(
    (state) => state.month.key === currentMonth,
  );
  const withinCurrent =
    currentState && currentState.totalCount > 0
      ? currentState.metCount / currentState.totalCount
      : 0;
  const fillIndex = doneBefore < 0 ? months.length : doneBefore + withinCurrent;
  const fillPercent =
    months.length > 1 ? (fillIndex / (months.length - 1)) * 100 : 0;

  return (
    <section aria-labelledby="timeline-heading" className="grid gap-5">
      <h2
        className="text-xl font-semibold tracking-tight text-foreground"
        id="timeline-heading"
      >
        The line to graduation
      </h2>

      <div className="overflow-x-auto pb-2">
        <div className="relative min-w-[900px] px-4 pt-6">
          {/* The track. Muted and dashed ahead of you, solid accent behind. */}
          <div
            aria-hidden
            className="absolute left-4 right-4 top-10 h-0.5 border-t-2 border-dashed border-border"
          />
          <div
            aria-hidden
            className="absolute left-4 top-10 h-0.5 bg-accent transition-[width] duration-700 ease-out motion-reduce:transition-none"
            style={{ width: `calc((100% - 2rem) * ${fillPercent / 100})` }}
          />

          <ol className="relative flex items-start justify-between">
            {months.map((state) => {
              const isCurrent = state.month.key === currentMonth;
              const isSelected = state.month.key === selectedMonth;
              return (
                <li className="flex flex-col items-center" key={state.month.key}>
                  <button
                    aria-current={isCurrent ? "step" : undefined}
                    aria-expanded={isSelected}
                    aria-label={`${state.month.label} — ${statusLabel[state.status]}, ${state.metCount} of ${state.totalCount} complete`}
                    className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold transition-all duration-200 ease-in-out hover:scale-110 motion-reduce:hover:scale-100 ${stationClasses[state.status]} ${isCurrent ? "pulse-glow" : ""} ${isSelected ? "ring-2 ring-accent ring-offset-2 ring-offset-canvas" : ""}`}
                    onClick={() => onSelectMonth(state.month.key)}
                    type="button"
                  >
                    {state.status === "done" ? "✓" : state.status === "missed" ? "!" : ""}
                  </button>
                  <span
                    className={`mt-2 text-xs font-medium ${isCurrent ? "text-accent-strong" : "text-muted"}`}
                  >
                    {state.month.label.split(" ")[0]}
                  </span>
                  <span className="text-[10px] tabular-nums text-subtle">
                    {state.metCount}/{state.totalCount}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      {selected ? (
        <article className="rounded-lg border border-border bg-surface p-5">
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-widest text-muted">
                {selected.month.theme}
              </p>
              <h3 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
                {selected.month.label}
              </h3>
            </div>
            <Badge tone={badgeTone[selected.status]}>
              {statusLabel[selected.status]}
            </Badge>
          </header>

          {selected.month.gate ? (
            <p className="mt-3 rounded-md border border-border bg-surface-subtle p-3 text-sm leading-relaxed text-body">
              <span className="font-semibold text-foreground">Gate: </span>
              {selected.month.gate}
            </p>
          ) : null}

          <ul className="mt-4 grid gap-3">
            {selected.criteria.map((state) => {
              const { criterion } = state;

              // An auto criterion is NEVER tickable. The number is the truth —
              // a roadmap you can mark complete without doing the work is a
              // roadmap that lies to you.
              if (criterion.kind === "auto" && state.progress) {
                const { actual, target } = state.progress;
                return (
                  <li className="grid gap-1.5" key={criterion.key}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span
                        className={`text-sm ${state.met ? "text-foreground" : "text-body"}`}
                      >
                        {state.met ? "✓ " : ""}
                        {criterion.label}
                      </span>
                      <span className="shrink-0 text-xs font-medium tabular-nums text-muted">
                        {actual}/{target}
                      </span>
                    </div>
                    <ProgressBar progress={target === 0 ? 1 : actual / target} />
                    <span className="text-xs text-subtle">{criterion.source}</span>
                  </li>
                );
              }

              return (
                <li key={criterion.key}>
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      checked={state.met}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-input accent-accent"
                      disabled={pendingKeys.has(criterion.key)}
                      onChange={(event) =>
                        onToggleCriterion(criterion.key, event.target.checked)
                      }
                      type="checkbox"
                    />
                    <span className="min-w-0">
                      <span
                        className={`block text-sm ${state.met ? "text-foreground line-through decoration-muted" : "text-body"}`}
                      >
                        {criterion.label}
                      </span>
                      <span className="block text-xs text-subtle">
                        {criterion.source}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </article>
      ) : null}
    </section>
  );
}
