"use client";

import { Code2, LayoutGrid, RefreshCw, TableProperties } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/src/components/ui/Badge";
import { LeetCodeBoard } from "@/src/modules/leetcode/components/LeetCodeBoard";
import { LeetCodeProblemDetail } from "@/src/modules/leetcode/components/LeetCodeProblemDetail";
import { LeetCodeProblemForm } from "@/src/modules/leetcode/components/LeetCodeProblemForm";
import { LeetCodeTable } from "@/src/modules/leetcode/components/LeetCodeTable";
import { useLeetCodeStore } from "@/src/modules/leetcode/useLeetCodeStore";

type View = "table" | "board";

export function LeetCodeTracker() {
  const {
    problems,
    isLoading,
    error,
    isCreating,
    pendingIds,
    fetchProblems,
    createProblem,
    updateProblem,
    deleteProblem,
    fetchAttempts,
    createAttempt,
    deleteAttempt,
    groupByStatus,
    attemptsForProblem,
    attemptStats,
  } = useLeetCodeStore();
  const [view, setView] = useState<View>("table");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const pending = useMemo(() => new Set(pendingIds), [pendingIds]);
  const selected =
    problems.find((problem) => problem.id === selectedId) ?? null;

  useEffect(() => {
    void Promise.all([fetchProblems(), fetchAttempts()]);
  }, [fetchAttempts, fetchProblems]);

  if (selected) {
    return (
      <div className="grid gap-4">
        {error ? (
          <p
            aria-live="assertive"
            className="rounded-md border border-danger-border bg-danger-surface px-3 py-2 text-sm text-danger"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        <LeetCodeProblemDetail
          attempts={attemptsForProblem(selected.id)}
          disabled={isCreating}
          onBack={() => setSelectedId(null)}
          onCreateAttempt={createAttempt}
          onDeleteAttempt={deleteAttempt}
          onDeleteProblem={deleteProblem}
          onUpdateProblem={updateProblem}
          pendingIds={pending}
          problem={selected}
        />
      </div>
    );
  }

  return (
    <section
      aria-labelledby="leetcode-tracker-heading"
      className="grid gap-4 rounded-lg border border-border bg-surface p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Code2 aria-hidden="true" className="size-5 text-accent-strong" />
            <h2
              className="text-lg font-semibold tracking-tight text-foreground"
              id="leetcode-tracker-heading"
            >
              LeetCode Tracker
            </h2>
            <Badge tone="neutral">{problems.length}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted">
            Keep the problem bank separate from each attempt and solution.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div
            aria-label="LeetCode view"
            className="inline-flex rounded-md border border-input bg-surface-subtle p-1"
            role="group"
          >
            <button
              aria-pressed={view === "table"}
              className={`inline-flex h-8 items-center gap-2 rounded px-3 text-sm font-medium ${
                view === "table"
                  ? "bg-surface text-accent-strong shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
              onClick={() => setView("table")}
              type="button"
            >
              <TableProperties aria-hidden="true" className="size-4" />
              Table
            </button>
            <button
              aria-pressed={view === "board"}
              className={`inline-flex h-8 items-center gap-2 rounded px-3 text-sm font-medium ${
                view === "board"
                  ? "bg-surface text-accent-strong shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
              onClick={() => setView("board")}
              type="button"
            >
              <LayoutGrid aria-hidden="true" className="size-4" />
              Board
            </button>
          </div>
          <button
            aria-label="Refresh LeetCode tracker"
            className="inline-flex size-10 items-center justify-center rounded-md border border-input bg-surface text-body hover:border-input-hover disabled:opacity-60"
            disabled={isLoading}
            onClick={() => void Promise.all([fetchProblems(), fetchAttempts()])}
            type="button"
          >
            <RefreshCw
              aria-hidden="true"
              className={`size-4 ${isLoading ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </div>

      {error ? (
        <p
          aria-live="assertive"
          className="rounded-md border border-danger-border bg-danger-surface px-3 py-2 text-sm text-danger"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <LeetCodeProblemForm disabled={isCreating} onSubmit={createProblem} />

      {view === "table" ? (
        <LeetCodeTable
          onSelect={setSelectedId}
          onUpdate={updateProblem}
          pendingIds={pending}
          problems={problems}
        />
      ) : (
        <LeetCodeBoard
          attemptStats={attemptStats}
          groups={groupByStatus()}
          onSelect={setSelectedId}
          onUpdate={updateProblem}
          pendingIds={pending}
          problems={problems}
        />
      )}
    </section>
  );
}
