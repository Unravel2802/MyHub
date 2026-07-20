"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/src/components/ui/Badge";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { DESIGN_DRILL_CATEGORY_HUES } from "@/src/modules/designDrills/designDrillHues";
import type {
  DesignDrill,
  DesignDrillAttempt,
  DesignDrillCategory,
  DesignDrillDifficulty,
} from "@/src/modules/designDrills/types";
import { Dumbbell } from "lucide-react";

const categoryLabels: Record<DesignDrillCategory, string> = {
  system_design: "System design",
  ml_system_design: "ML system design",
};

const difficultyLabels: Record<DesignDrillDifficulty, string> = {
  warmup: "Warmup",
  core: "Core",
  advanced: "Advanced",
};

const difficultyTone: Record<
  DesignDrillDifficulty,
  "success" | "accent" | "danger"
> = {
  warmup: "success",
  core: "accent",
  advanced: "danger",
};

const selectClass =
  "h-10 rounded-md border border-input bg-surface px-3 text-sm text-foreground outline-none focus:border-accent";

interface DrillListProps {
  drills: DesignDrill[];
  attempts: DesignDrillAttempt[];
  isStarting: boolean;
  startingDrillId: string | null;
  onStart: (drillId: string) => void;
}

export function DrillList({
  drills,
  attempts,
  isStarting,
  startingDrillId,
  onStart,
}: DrillListProps) {
  const [category, setCategory] = useState<DesignDrillCategory | "all">("all");
  const [difficulty, setDifficulty] = useState<DesignDrillDifficulty | "all">(
    "all",
  );

  const filtered = useMemo(
    () =>
      drills.filter(
        (drill) =>
          (category === "all" || drill.category === category) &&
          (difficulty === "all" || drill.difficulty === difficulty),
      ),
    [drills, category, difficulty],
  );

  const completedByDrill = useMemo(() => {
    const map = new Map<string, DesignDrillAttempt[]>();
    for (const attempt of attempts) {
      if (!attempt.completedAt) continue;
      const existing = map.get(attempt.drillId) ?? [];
      existing.push(attempt);
      map.set(attempt.drillId, existing);
    }
    return map;
  }, [attempts]);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="grid gap-1 text-xs font-medium text-muted">
          Category
          <select
            className={selectClass}
            onChange={(event) =>
              setCategory(event.target.value as DesignDrillCategory | "all")
            }
            value={category}
          >
            <option value="all">All categories</option>
            <option value="system_design">System design</option>
            <option value="ml_system_design">ML system design</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs font-medium text-muted">
          Difficulty
          <select
            className={selectClass}
            onChange={(event) =>
              setDifficulty(event.target.value as DesignDrillDifficulty | "all")
            }
            value={difficulty}
          >
            <option value="all">All difficulties</option>
            <option value="warmup">Warmup</option>
            <option value="core">Core</option>
            <option value="advanced">Advanced</option>
          </select>
        </label>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          description="No drills match this filter — try widening it."
          icon={Dumbbell}
          title="Nothing here"
        />
      ) : (
        <ul className="grid gap-3">
          {filtered.map((drill) => {
            const completed = completedByDrill.get(drill.id) ?? [];
            const lastRating = completed[0]?.selfRating ?? null;
            const startingThis = isStarting && startingDrillId === drill.id;
            return (
              <li
                className="rounded-lg border border-border bg-surface p-4"
                key={drill.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold tracking-tight text-foreground">
                        {drill.title}
                      </h3>
                      <Badge hue={DESIGN_DRILL_CATEGORY_HUES[drill.category]}>
                        {categoryLabels[drill.category]}
                      </Badge>
                      <Badge tone={difficultyTone[drill.difficulty]}>
                        {difficultyLabels[drill.difficulty]}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      ~{drill.estimatedMinutes} min ·{" "}
                      {completed.length === 0
                        ? "No attempts yet"
                        : `${completed.length} attempt${completed.length === 1 ? "" : "s"}${
                            lastRating ? ` · last: ${lastRating}` : ""
                          }`}
                    </p>
                    {drill.tags.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {drill.tags.map((tag) => (
                          <Badge key={tag} tone="neutral">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <button
                    className="h-10 shrink-0 rounded-md border border-accent-border bg-accent-surface px-4 text-sm font-medium text-accent-strong hover:border-accent disabled:opacity-60"
                    disabled={isStarting}
                    onClick={() => onStart(drill.id)}
                    type="button"
                  >
                    {startingThis ? "Starting…" : "Start drill"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
