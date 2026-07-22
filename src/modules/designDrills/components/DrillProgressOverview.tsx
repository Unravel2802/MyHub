"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import type { HueName } from "@/src/components/moduleHues";
import { Badge } from "@/src/components/ui/Badge";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { Panel } from "@/src/components/ui/Panel";
import { ProgressBar } from "@/src/components/ui/ProgressBar";
import { StatCard } from "@/src/components/ui/StatCard";
import { DESIGN_DRILL_CATEGORY_HUES } from "@/src/modules/designDrills/designDrillHues";
import {
  drillCoverage,
  reviewQueue,
  type CoverageBucket,
  type ReviewItem,
} from "@/src/modules/designDrills/progress";
import type {
  DesignDrill,
  DesignDrillAttempt,
  DesignDrillDifficulty,
  DesignDrillSelfRating,
} from "@/src/modules/designDrills/types";

const categoryLabels = {
  system_design: "System design",
  ml_system_design: "ML system design",
} as const;

const difficultyLabels: Record<DesignDrillDifficulty, string> = {
  warmup: "Warmup",
  core: "Core",
  advanced: "Advanced",
};

const difficultyHues: Record<DesignDrillDifficulty, HueName> = {
  warmup: "emerald",
  core: "amber",
  advanced: "rose",
};

const ratingHues: Record<DesignDrillSelfRating, HueName> = {
  strong: "emerald",
  solid: "blue",
  weak: "rose",
};

const ratingLabels: Record<DesignDrillSelfRating, string> = {
  strong: "Strong",
  solid: "Solid",
  weak: "Weak",
};

const MAX_REVISIT_ITEMS = 6;

function progress(bucket: CoverageBucket): number {
  return bucket.total === 0 ? 0 : bucket.attempted / bucket.total;
}

function reasonLabel(item: ReviewItem): string {
  if (item.reason === "never_attempted") return "New";
  const overdueDays = Math.floor(Math.abs(item.dueInDays ?? 0));
  return overdueDays >= 1 ? `Overdue ${overdueDays}d` : "Due";
}

interface CoverageRowProps {
  bucket: CoverageBucket;
  hue: HueName;
  label: string;
}

function CoverageRow({ bucket, hue, label }: CoverageRowProps) {
  return (
    <li>
      <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-body">{label}</span>
        <span className="tabular-nums text-muted">
          {bucket.attempted} / {bucket.total}
        </span>
      </div>
      <ProgressBar hue={hue} progress={progress(bucket)} />
    </li>
  );
}

interface DrillProgressOverviewProps {
  attempts: DesignDrillAttempt[];
  drills: DesignDrill[];
}

export function DrillProgressOverview({
  attempts,
  drills,
}: DrillProgressOverviewProps) {
  const coverage = useMemo(
    () => drillCoverage(drills, attempts),
    [attempts, drills],
  );
  const revisitItems = useMemo(() => {
    const now = new Date();
    return reviewQueue(drills, attempts, now)
      .filter((item) => item.reason !== "practiced")
      .slice(0, MAX_REVISIT_ITEMS);
  }, [attempts, drills]);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,1fr)]">
      <Panel
        description="Distinct drills with at least one completed, self-graded attempt."
        overline="Progress"
        title="Coverage"
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            hint="Drills attempted across the full bank"
            hue="teal"
            label="Overall coverage"
            value={`${coverage.overall.attempted} / ${coverage.overall.total}`}
          />
          {(["strong", "solid", "weak"] as const).map((rating) => (
            <StatCard
              hint="Most recent completed rating"
              hue={ratingHues[rating]}
              key={rating}
              label={ratingLabels[rating]}
              value={coverage.latestRatingCounts[rating]}
            />
          ))}
        </div>

        <div className="mt-5 grid gap-5 border-t border-border pt-5 sm:grid-cols-2">
          <section aria-labelledby="coverage-category-heading">
            <h3
              className="text-xs font-medium uppercase tracking-widest text-muted"
              id="coverage-category-heading"
            >
              By category
            </h3>
            <ul className="mt-3 grid gap-3">
              {(["system_design", "ml_system_design"] as const).map(
                (category) => (
                  <CoverageRow
                    bucket={coverage.byCategory[category]}
                    hue={DESIGN_DRILL_CATEGORY_HUES[category]}
                    key={category}
                    label={categoryLabels[category]}
                  />
                ),
              )}
            </ul>
          </section>

          <section aria-labelledby="coverage-difficulty-heading">
            <h3
              className="text-xs font-medium uppercase tracking-widest text-muted"
              id="coverage-difficulty-heading"
            >
              By difficulty
            </h3>
            <ul className="mt-3 grid gap-3">
              {(["warmup", "core", "advanced"] as const).map((difficulty) => (
                <CoverageRow
                  bucket={coverage.byDifficulty[difficulty]}
                  hue={difficultyHues[difficulty]}
                  key={difficulty}
                  label={difficultyLabels[difficulty]}
                />
              ))}
            </ul>
          </section>
        </div>
      </Panel>

      <Panel
        description="New drills and completed reps whose review interval has elapsed."
        overline="Review queue"
        title="Revisit weak drills"
      >
        {revisitItems.length === 0 ? (
          <EmptyState
            compact
            description="Nothing needs another rep today."
            icon={CheckCircle2}
            title="All caught up"
          />
        ) : (
          <ul className="grid gap-2">
            {revisitItems.map((item) => (
              <li key={item.drill.id}>
                <Link
                  aria-label={`Review ${item.drill.title}: ${reasonLabel(item)}`}
                  className="group flex items-center justify-between gap-3 rounded-md border border-border bg-surface-subtle px-3 py-2.5 hover:border-accent-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                  href={`/design-drills/${item.drill.slug}`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-foreground group-hover:text-accent-strong">
                      {item.drill.title}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Badge
                        tone={
                          item.reason === "never_attempted"
                            ? "accent"
                            : "danger"
                        }
                      >
                        {reasonLabel(item)}
                      </Badge>
                      {item.lastRating ? (
                        <Badge hue={ratingHues[item.lastRating]}>
                          Last: {ratingLabels[item.lastRating]}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted">
                          No completed rep
                        </span>
                      )}
                    </span>
                  </span>
                  <ArrowRight
                    aria-hidden
                    className="size-4 shrink-0 text-muted group-hover:text-accent-strong"
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
