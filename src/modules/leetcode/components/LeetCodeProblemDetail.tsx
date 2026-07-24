"use client";

import { ArrowLeft, ExternalLink, Trash2 } from "lucide-react";
import { Badge } from "@/src/components/ui/Badge";
import { EmptyState } from "@/src/components/ui/EmptyState";
import type {
  CreateAttemptInput,
  CreateProblemInput,
} from "@/src/modules/leetcode/LeetCodeRepository";
import type {
  LeetCodeAttempt,
  LeetCodeProblem,
} from "@/src/modules/leetcode/types";
import { LeetCodeAttemptForm } from "@/src/modules/leetcode/components/LeetCodeAttemptForm";
import { LeetCodeProblemForm } from "@/src/modules/leetcode/components/LeetCodeProblemForm";
import { LeetCodeSolutionCode } from "@/src/modules/leetcode/components/LeetCodeSolutionCode";
import {
  difficultyLabels,
  difficultyTones,
  outcomeLabels,
  outcomeTones,
  statusLabels,
} from "@/src/modules/leetcode/components/leetcodeUi";

interface LeetCodeProblemDetailProps {
  attempts: LeetCodeAttempt[];
  disabled: boolean;
  pendingIds: ReadonlySet<string>;
  problem: LeetCodeProblem;
  onBack: () => void;
  onCreateAttempt: (input: CreateAttemptInput) => Promise<void>;
  onDeleteAttempt: (id: string) => Promise<void>;
  onDeleteProblem: (id: string) => Promise<void>;
  onUpdateProblem: (
    id: string,
    updates: Partial<CreateProblemInput>,
  ) => Promise<void>;
}

export function LeetCodeProblemDetail({
  attempts,
  disabled,
  pendingIds,
  problem,
  onBack,
  onCreateAttempt,
  onDeleteAttempt,
  onDeleteProblem,
  onUpdateProblem,
}: LeetCodeProblemDetailProps) {
  return (
    <section
      aria-labelledby="leetcode-detail-heading"
      className="grid gap-4 rounded-lg border border-border bg-surface p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button
            className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-foreground"
            onClick={onBack}
            type="button"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Back to problem bank
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <h3
              className="text-xl font-semibold tracking-tight text-foreground"
              id="leetcode-detail-heading"
            >
              {problem.title}
            </h3>
            <Badge tone={difficultyTones[problem.difficulty]}>
              {difficultyLabels[problem.difficulty]}
            </Badge>
            <Badge tone={problem.status === "solved" ? "success" : "neutral"}>
              {statusLabels[problem.status]}
            </Badge>
          </div>
          {problem.tags.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {problem.tags.map((tag) => (
                <Badge key={tag} tone="neutral">
                  {tag}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {problem.url ? (
            <a
              className="inline-flex h-9 items-center gap-2 rounded-md border border-input bg-surface px-3 text-sm font-medium text-body hover:border-input-hover"
              href={problem.url}
              rel="noreferrer"
              target="_blank"
            >
              Open problem
              <ExternalLink aria-hidden="true" className="size-4" />
            </a>
          ) : null}
          <button
            aria-label={`Delete ${problem.title}`}
            className="inline-flex size-9 items-center justify-center rounded-md border border-danger-border text-danger hover:bg-danger-surface disabled:opacity-60"
            disabled={pendingIds.has(problem.id)}
            onClick={() => {
              if (window.confirm(`Delete "${problem.title}"?`)) {
                void onDeleteProblem(problem.id);
              }
            }}
            type="button"
          >
            <Trash2 aria-hidden="true" className="size-4" />
          </button>
        </div>
      </div>

      <details className="rounded-lg border border-border">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-foreground">
          Edit problem details
        </summary>
        <div className="border-t border-border p-4">
          <LeetCodeProblemForm
            disabled={pendingIds.has(problem.id)}
            initialProblem={problem}
            onSubmit={(updates) => onUpdateProblem(problem.id, updates)}
          />
        </div>
      </details>

      <LeetCodeAttemptForm
        disabled={disabled}
        onSubmit={onCreateAttempt}
        problemId={problem.id}
      />

      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h4 className="font-semibold text-foreground">Attempt history</h4>
          <Badge tone="neutral">{attempts.length}</Badge>
        </div>
        {attempts.length === 0 ? (
          <EmptyState
            compact
            description="Log the first sitting to start a reviewable history."
            title="No attempts yet"
          />
        ) : (
          <ol className="grid max-h-[44rem] gap-3 overflow-y-auto overscroll-contain pr-1">
            {attempts.map((attempt) => (
              <li
                className="rounded-lg border border-border bg-surface-subtle p-4"
                key={attempt.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-foreground">
                      {attempt.date}
                    </p>
                    <Badge tone={outcomeTones[attempt.outcome]}>
                      {outcomeLabels[attempt.outcome]}
                    </Badge>
                    <span className="text-xs text-muted">
                      {attempt.timeToSolveMin === null
                        ? "Time not recorded"
                        : `${attempt.timeToSolveMin} min`}
                    </span>
                  </div>
                  <button
                    className="text-xs font-medium text-danger hover:underline disabled:opacity-60"
                    disabled={pendingIds.has(attempt.id)}
                    onClick={() => {
                      if (window.confirm("Delete this attempt?")) {
                        void onDeleteAttempt(attempt.id);
                      }
                    }}
                    type="button"
                  >
                    Delete attempt
                  </button>
                </div>
                {attempt.notes ? (
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-body">
                    {attempt.notes}
                  </p>
                ) : null}
                {attempt.solutionCode && attempt.solutionLanguage ? (
                  <div className="mt-3">
                    <LeetCodeSolutionCode
                      code={attempt.solutionCode}
                      language={attempt.solutionLanguage}
                    />
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
