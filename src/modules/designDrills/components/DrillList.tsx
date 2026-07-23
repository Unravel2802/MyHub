"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Dumbbell, Search } from "lucide-react";
import { Badge } from "@/src/components/ui/Badge";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { DrillBookmarkButton } from "@/src/modules/designDrills/components/DrillBookmarkButton";
import { DESIGN_DRILL_CATEGORY_HUES } from "@/src/modules/designDrills/designDrillHues";
import { filterDesignDrills } from "@/src/modules/designDrills/filterDesignDrills";
import type {
  DesignDrill,
  DesignDrillAttempt,
  DesignDrillCategory,
  DesignDrillDifficulty,
} from "@/src/modules/designDrills/types";

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

const PAGE_SIZE = 10;

interface DrillListProps {
  drills: DesignDrill[];
  attempts: DesignDrillAttempt[];
  isStarting: boolean;
  startingDrillId: string | null;
  isBookmarked: (drillId: string) => boolean;
  pendingIds: string[];
  onStart: (drillId: string) => void;
  onToggleBookmark: (drillId: string) => void;
}

export function DrillList({
  drills,
  attempts,
  isStarting,
  startingDrillId,
  isBookmarked,
  pendingIds,
  onStart,
  onToggleBookmark,
}: DrillListProps) {
  const [category, setCategory] = useState<DesignDrillCategory | "all">("all");
  const [difficulty, setDifficulty] = useState<DesignDrillDifficulty | "all">(
    "all",
  );
  const [query, setQuery] = useState("");
  const [bookmarkedOnly, setBookmarkedOnly] = useState(false);
  const [tag, setTag] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const tags = useMemo(
    () =>
      Array.from(new Set(drills.flatMap((drill) => drill.tags))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [drills],
  );

  const filtered = useMemo(
    () =>
      filterDesignDrills(
        drills,
        { bookmarkedOnly, category, difficulty, query, tag },
        isBookmarked,
      ),
    [bookmarkedOnly, category, difficulty, drills, isBookmarked, query, tag],
  );

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageStart = (page - 1) * PAGE_SIZE;
  const paginated = filtered.slice(pageStart, pageStart + PAGE_SIZE);

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
      <div className="grid gap-3 lg:grid-cols-[minmax(14rem,1fr)_auto_auto_auto] lg:items-end">
        <label className="grid gap-1 text-xs font-medium text-muted">
          Search drills
          <span className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
            />
            <input
              className="h-10 w-full rounded-md border border-input bg-surface pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-subtle focus:border-accent"
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Title, prompt, or tag"
              type="search"
              value={query}
            />
          </span>
        </label>
        <label className="grid gap-1 text-xs font-medium text-muted">
          Category
          <select
            className={selectClass}
            onChange={(event) => {
              setCategory(event.target.value as DesignDrillCategory | "all");
              setPage(1);
            }}
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
            onChange={(event) => {
              setDifficulty(
                event.target.value as DesignDrillDifficulty | "all",
              );
              setPage(1);
            }}
            value={difficulty}
          >
            <option value="all">All difficulties</option>
            <option value="warmup">Warmup</option>
            <option value="core">Core</option>
            <option value="advanced">Advanced</option>
          </select>
        </label>
        <button
          aria-pressed={bookmarkedOnly}
          className={`h-10 rounded-md border px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas ${
            bookmarkedOnly
              ? "border-accent-border bg-accent-surface text-accent-strong"
              : "border-input bg-surface text-body hover:border-input-hover"
          }`}
          onClick={() => {
            setBookmarkedOnly((current) => !current);
            setPage(1);
          }}
          type="button"
        >
          Bookmarked only
        </button>
      </div>

      {tags.length > 0 ? (
        <fieldset>
          <legend className="text-xs font-medium text-muted">Topics</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              aria-pressed={tag === null}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                tag === null
                  ? "border-accent-border bg-accent-surface text-accent-strong"
                  : "border-border bg-surface-subtle text-muted hover:border-input-hover hover:text-body"
              }`}
              onClick={() => {
                setTag(null);
                setPage(1);
              }}
              type="button"
            >
              All topics
            </button>
            {tags.map((candidate) => (
              <button
                aria-pressed={tag === candidate}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${
                  tag === candidate
                    ? "border-accent-border bg-accent-surface text-accent-strong"
                    : "border-border bg-surface-subtle text-muted hover:border-input-hover hover:text-body"
                }`}
                key={candidate}
                onClick={() => {
                  setTag((current) =>
                    current === candidate ? null : candidate,
                  );
                  setPage(1);
                }}
                type="button"
              >
                {candidate}
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}

      {filtered.length === 0 ? (
        <EmptyState
          description="No drills match this filter — try widening it."
          icon={Dumbbell}
          title="Nothing here"
        />
      ) : (
        <div className="grid gap-3">
          <ul className="grid gap-3">
            {paginated.map((drill, index) => {
              const completed = completedByDrill.get(drill.id) ?? [];
              const lastRating = completed[0]?.selfRating ?? null;
              const startingThis = isStarting && startingDrillId === drill.id;
              const ordinal = pageStart + index + 1;
              return (
                <li
                  className="rounded-lg border border-border bg-surface p-4"
                  key={drill.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="min-w-6 text-xs font-medium tabular-nums text-muted">
                          {ordinal}
                        </span>
                        <h3>
                          <Link
                            className="font-semibold tracking-tight text-foreground hover:text-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                            href={`/design-drills/${drill.slug}`}
                          >
                            {drill.title}
                          </Link>
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
                    <div className="flex shrink-0 items-center gap-2">
                      <DrillBookmarkButton
                        bookmarked={isBookmarked(drill.id)}
                        disabled={pendingIds.includes(drill.id)}
                        drillTitle={drill.title}
                        onToggle={() => onToggleBookmark(drill.id)}
                      />
                      <button
                        className="h-10 rounded-md border border-accent-border bg-accent-surface px-4 text-sm font-medium text-accent-strong hover:border-accent disabled:opacity-60"
                        disabled={isStarting}
                        onClick={() => onStart(drill.id)}
                        type="button"
                      >
                        {startingThis ? "Starting…" : "Start drill"}
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {filtered.length > PAGE_SIZE ? (
            <nav
              aria-label="Drill pages"
              className="flex flex-wrap items-center justify-center gap-2"
            >
              <button
                className="h-9 rounded-md border border-input bg-surface px-3 text-sm font-medium text-body hover:border-input-hover disabled:opacity-50"
                disabled={page === 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                type="button"
              >
                Previous
              </button>
              {Array.from({ length: totalPages }, (_, index) => index + 1).map(
                (pageNumber) => (
                  <button
                    aria-current={pageNumber === page ? "page" : undefined}
                    aria-label={`Page ${pageNumber}`}
                    className={`size-9 rounded-md border text-sm font-medium ${
                      pageNumber === page
                        ? "border-accent-border bg-accent-surface text-accent-strong"
                        : "border-input bg-surface text-body hover:border-input-hover"
                    }`}
                    key={pageNumber}
                    onClick={() => setPage(pageNumber)}
                    type="button"
                  >
                    {pageNumber}
                  </button>
                ),
              )}
              <button
                className="h-9 rounded-md border border-input bg-surface px-3 text-sm font-medium text-body hover:border-input-hover disabled:opacity-50"
                disabled={page === totalPages}
                onClick={() =>
                  setPage((current) => Math.min(totalPages, current + 1))
                }
                type="button"
              >
                Next
              </button>
            </nav>
          ) : null}
        </div>
      )}
    </div>
  );
}
