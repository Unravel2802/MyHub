import { ArrowLeft, Check, ChevronDown, CircleX } from "lucide-react";
import { Badge } from "@/src/components/ui/Badge";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { Markdown } from "@/src/components/ui/Markdown";
import { DrillBookmarkButton } from "@/src/modules/designDrills/components/DrillBookmarkButton";
import { DrillBrief } from "@/src/modules/designDrills/components/DrillBrief";
import { DESIGN_DRILL_CATEGORY_HUES } from "@/src/modules/designDrills/designDrillHues";
import type {
  DesignDrill,
  DesignDrillAttempt,
  DesignDrillSelfRating,
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

const ratingDetails: Record<
  DesignDrillSelfRating,
  { height: string; label: string; tone: "danger" | "accent" | "success" }
> = {
  weak: { height: "h-2", label: "Weak", tone: "danger" },
  solid: { height: "h-4", label: "Solid", tone: "accent" },
  strong: { height: "h-6", label: "Strong", tone: "success" },
};

function SelfRatingTrend({ attempts }: { attempts: DesignDrillAttempt[] }) {
  const ratedAttempts = attempts
    .filter(
      (
        attempt,
      ): attempt is DesignDrillAttempt & {
        selfRating: DesignDrillSelfRating;
      } => attempt.selfRating !== null,
    )
    .slice(0, 8)
    .reverse();

  if (ratedAttempts.length < 2) return null;

  const ratings = ratedAttempts.map((attempt) => attempt.selfRating);

  return (
    <div className="mt-4 rounded-md border border-border bg-surface-subtle px-4 py-3">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h3 className="text-sm font-medium text-foreground">
            Self-rating trend
          </h3>
          <p className="mt-0.5 text-xs text-muted">
            Last {ratedAttempts.length} rated attempts · oldest to newest
          </p>
        </div>
        <div
          aria-label={`Self-rating trend, oldest to newest: ${ratings.join(", ")}`}
          className="flex h-8 items-end gap-1.5"
          role="img"
        >
          {ratedAttempts.map((attempt) => {
            const rating = ratingDetails[attempt.selfRating];
            return (
              <span
                aria-hidden
                className={`w-5 rounded-sm ${rating.height} ${
                  rating.tone === "success"
                    ? "bg-success"
                    : rating.tone === "danger"
                      ? "bg-danger"
                      : "bg-accent"
                }`}
                key={attempt.id}
                title={rating.label}
              />
            );
          })}
        </div>
      </div>
      <div className="mt-2 flex justify-end gap-3 text-[11px] text-muted">
        <span>Weak</span>
        <span>Solid</span>
        <span>Strong</span>
      </div>
    </div>
  );
}

interface DrillDetailProps {
  drill: DesignDrill;
  isStarting: boolean;
  pastAttempts: DesignDrillAttempt[];
  bookmarked: boolean;
  bookmarkPending: boolean;
  onBack: () => void;
  onToggleBookmark: () => void;
  onStart: () => void;
}

export function DrillDetail({
  drill,
  isStarting,
  pastAttempts,
  bookmarked,
  bookmarkPending,
  onBack,
  onToggleBookmark,
  onStart,
}: DrillDetailProps) {
  const completedAttempts = pastAttempts
    .filter(
      (attempt): attempt is DesignDrillAttempt & { completedAt: string } =>
        attempt.completedAt !== null,
    )
    .sort(
      (left, right) =>
        new Date(right.completedAt).getTime() -
        new Date(left.completedAt).getTime(),
    );

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <button
          className="flex items-center gap-1.5 text-sm text-muted hover:text-body"
          onClick={onBack}
          type="button"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Back to drills
        </button>
        <div className="flex items-center gap-2">
          <DrillBookmarkButton
            bookmarked={bookmarked}
            disabled={bookmarkPending}
            drillTitle={drill.title}
            onToggle={onToggleBookmark}
          />
          <button
            className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
            disabled={isStarting}
            onClick={onStart}
            type="button"
          >
            {isStarting ? "Starting…" : "Start timed attempt"}
          </button>
        </div>
      </div>

      <section className="overflow-hidden rounded-lg border border-border bg-surface">
        <div className="px-5 pb-4 pt-5">
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
        </div>
        <DrillBrief drill={drill} />
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
        <SelfRatingTrend attempts={completedAttempts} />
        {completedAttempts.length === 0 ? (
          <EmptyState
            description="Start a timed attempt when you want to practice this design under interview conditions."
            title="No completed attempts yet"
          />
        ) : (
          <ol
            aria-label="Completed attempt timeline"
            className="mt-4 grid gap-3"
          >
            {completedAttempts.map((attempt, index) => {
              const rubricHits = new Set(attempt.rubricHits);
              return (
                <li
                  aria-label={`Attempt ${index + 1}, completed ${new Date(
                    attempt.completedAt,
                  ).toLocaleDateString()}`}
                  className="relative rounded-md border border-border bg-surface-subtle p-4 text-sm text-body"
                  key={attempt.id}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">
                      {new Date(attempt.completedAt).toLocaleDateString()}
                    </span>
                    <span className="text-muted" aria-label="Duration">
                      {attempt.durationSec === null
                        ? "Duration —"
                        : formatDuration(attempt.durationSec)}
                    </span>
                    {attempt.selfRating ? (
                      <Badge tone={ratingDetails[attempt.selfRating].tone}>
                        {ratingDetails[attempt.selfRating].label}
                      </Badge>
                    ) : null}
                  </div>

                  <ul aria-label="Rubric results" className="mt-3 grid gap-1.5">
                    {drill.rubric.map((bullet, rubricIndex) => {
                      const hit = rubricHits.has(rubricIndex);
                      return (
                        <li
                          className={
                            hit
                              ? "flex items-start gap-2 text-body"
                              : "flex items-start gap-2 text-muted"
                          }
                          key={rubricIndex}
                        >
                          {hit ? (
                            <Check
                              aria-label="Hit"
                              className="mt-0.5 size-4 shrink-0 text-success"
                            />
                          ) : (
                            <CircleX
                              aria-label="Missed"
                              className="mt-0.5 size-4 shrink-0"
                            />
                          )}
                          <span>{bullet}</span>
                        </li>
                      );
                    })}
                  </ul>

                  {attempt.notes ? (
                    <details className="group mt-3 border-t border-border pt-3">
                      <summary className="flex cursor-pointer list-none items-center gap-1.5 font-medium text-accent-strong hover:text-accent">
                        <ChevronDown
                          aria-hidden
                          className="size-4 transition-transform group-open:rotate-180"
                        />
                        View notes
                      </summary>
                      <Markdown className="mt-3">{attempt.notes}</Markdown>
                    </details>
                  ) : (
                    <p className="mt-3 border-t border-border pt-3 text-xs text-muted">
                      No notes saved
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
