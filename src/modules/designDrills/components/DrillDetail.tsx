import { ArrowLeft } from "lucide-react";
import { Badge } from "@/src/components/ui/Badge";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { DrillBrief } from "@/src/modules/designDrills/components/DrillBrief";
import { DESIGN_DRILL_CATEGORY_HUES } from "@/src/modules/designDrills/designDrillHues";
import type {
  DesignDrill,
  DesignDrillAttempt,
} from "@/src/modules/designDrills/types";

const categoryLabels = {
  system_design: "System design",
  ml_system_design: "ML system design",
} as const;

function formatDuration(totalSec: number): string {
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

interface DrillDetailProps {
  drill: DesignDrill;
  isStarting: boolean;
  pastAttempts: DesignDrillAttempt[];
  onBack: () => void;
  onStart: () => void;
}

export function DrillDetail({
  drill,
  isStarting,
  pastAttempts,
  onBack,
  onStart,
}: DrillDetailProps) {
  const completedAttempts = pastAttempts.filter(
    (attempt) => attempt.completedAt,
  );

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          className="flex items-center gap-1.5 text-sm text-muted hover:text-body"
          onClick={onBack}
          type="button"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Back to drills
        </button>
        <button
          className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
          disabled={isStarting}
          onClick={onStart}
          type="button"
        >
          {isStarting ? "Starting…" : "Start timed attempt"}
        </button>
      </div>

      <section className="rounded-lg border border-border bg-surface p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            {drill.title}
          </h2>
          <Badge hue={DESIGN_DRILL_CATEGORY_HUES[drill.category]}>
            {categoryLabels[drill.category]}
          </Badge>
        </div>
        <p className="mt-1 text-xs text-muted">
          Target: ~{drill.estimatedMinutes} min
        </p>
        <div className="mt-4">
          <DrillBrief drill={drill} />
        </div>
      </section>

      <section
        aria-labelledby="past-attempts-heading"
        className="rounded-lg border border-border bg-surface p-5"
      >
        <h2
          className="text-lg font-semibold tracking-tight text-foreground"
          id="past-attempts-heading"
        >
          Your past attempts
        </h2>
        {completedAttempts.length === 0 ? (
          <EmptyState
            description="Start a timed attempt when you want to practice this design under interview conditions."
            title="No completed attempts yet"
          />
        ) : (
          <ul className="mt-3 grid gap-2">
            {completedAttempts.map((attempt) => (
              <li
                className="flex flex-wrap items-center gap-2 rounded-md bg-surface-subtle px-3 py-2 text-sm text-body"
                key={attempt.id}
              >
                <span className="text-muted">
                  {new Date(attempt.startedAt).toLocaleDateString()}
                </span>
                <span>
                  {attempt.durationSec === null
                    ? "—"
                    : formatDuration(attempt.durationSec)}
                </span>
                {attempt.selfRating ? (
                  <Badge tone="neutral">{attempt.selfRating}</Badge>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
