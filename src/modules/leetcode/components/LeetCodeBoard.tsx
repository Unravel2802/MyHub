"use client";

import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { Badge } from "@/src/components/ui/Badge";
import { EmptyState } from "@/src/components/ui/EmptyState";
import type { CreateProblemInput } from "@/src/modules/leetcode/LeetCodeRepository";
import { LEETCODE_STATUSES } from "@/src/modules/leetcode/leetcodeBoard";
import type {
  LeetCodeAttempt,
  LeetCodeProblem,
  LeetCodeStatus,
} from "@/src/modules/leetcode/types";
import {
  difficultyLabels,
  difficultyTones,
  statusLabels,
} from "@/src/modules/leetcode/components/leetcodeUi";

type AttemptStats = {
  count: number;
  lastAttempt: LeetCodeAttempt | null;
};

interface ProblemCardProps {
  attemptStats: AttemptStats;
  disabled: boolean;
  problem: LeetCodeProblem;
  onSelect: (id: string) => void;
}

function ProblemCard({
  attemptStats,
  disabled,
  problem,
  onSelect,
}: ProblemCardProps) {
  const {
    attributes,
    isDragging,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
  } = useDraggable({
    id: problem.id,
    disabled,
  });

  return (
    <article
      aria-label={`LeetCode problem: ${problem.title}`}
      className={`shrink-0 rounded-md border border-border bg-surface p-3 shadow-sm ${
        isDragging ? "opacity-40" : ""
      }`}
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
    >
      <div className="flex items-start justify-between gap-2">
        <button
          className="min-w-0 text-left font-medium text-foreground hover:text-accent-strong"
          onClick={() => onSelect(problem.id)}
          type="button"
        >
          {problem.title}
        </button>
        <button
          aria-label={`Drag ${problem.title}`}
          className="shrink-0 cursor-grab rounded p-1 text-muted hover:bg-surface-subtle hover:text-foreground active:cursor-grabbing disabled:cursor-not-allowed"
          disabled={disabled}
          ref={setActivatorNodeRef}
          type="button"
          {...attributes}
          {...listeners}
        >
          <GripVertical aria-hidden="true" className="size-4" />
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Badge tone={difficultyTones[problem.difficulty]}>
          {difficultyLabels[problem.difficulty]}
        </Badge>
        {problem.tags.slice(0, 3).map((tag) => (
          <Badge key={tag} tone="neutral">
            {tag}
          </Badge>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">
        {attemptStats.count} attempt{attemptStats.count === 1 ? "" : "s"}
        {attemptStats.lastAttempt
          ? ` · last ${attemptStats.lastAttempt.date}`
          : ""}
      </p>
    </article>
  );
}

interface StatusColumnProps {
  attemptStats: (problemId: string) => AttemptStats;
  pendingIds: ReadonlySet<string>;
  problems: LeetCodeProblem[];
  status: LeetCodeStatus;
  onSelect: (id: string) => void;
}

function StatusColumn({
  attemptStats,
  pendingIds,
  problems,
  status,
  onSelect,
}: StatusColumnProps) {
  const { isOver, setNodeRef } = useDroppable({ id: status });

  return (
    <section
      aria-labelledby={`leetcode-${status}-heading`}
      className={`flex min-h-64 min-w-64 flex-col overflow-hidden rounded-lg border bg-surface-subtle ${
        isOver ? "border-accent bg-accent-surface" : "border-border"
      }`}
      ref={setNodeRef}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-3">
        <h4
          className="font-semibold text-foreground"
          id={`leetcode-${status}-heading`}
        >
          {statusLabels[status]}
        </h4>
        <Badge tone="neutral">{problems.length}</Badge>
      </div>
      <div className="flex max-h-[32rem] flex-1 flex-col gap-3 overflow-y-auto overscroll-contain p-3">
        {problems.length === 0 ? (
          <EmptyState
            className="flex-1"
            compact
            description="Drag a problem here when its review state changes."
            title="No problems"
          />
        ) : (
          problems.map((problem) => (
            <ProblemCard
              attemptStats={attemptStats(problem.id)}
              disabled={pendingIds.has(problem.id)}
              key={problem.id}
              onSelect={onSelect}
              problem={problem}
            />
          ))
        )}
      </div>
    </section>
  );
}

interface LeetCodeBoardProps {
  attemptStats: (problemId: string) => AttemptStats;
  groups: Record<LeetCodeStatus, LeetCodeProblem[]>;
  pendingIds: ReadonlySet<string>;
  problems: LeetCodeProblem[];
  onSelect: (id: string) => void;
  onUpdate: (id: string, updates: Partial<CreateProblemInput>) => Promise<void>;
}

export function LeetCodeBoard({
  attemptStats,
  groups,
  pendingIds,
  problems,
  onSelect,
  onUpdate,
}: LeetCodeBoardProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  function handleDragEnd(event: DragEndEvent) {
    const id = String(event.active.id);
    const over = event.over?.id ? String(event.over.id) : null;
    if (!over || !LEETCODE_STATUSES.includes(over as LeetCodeStatus)) return;

    const problem = problems.find((candidate) => candidate.id === id);
    const status = over as LeetCodeStatus;
    if (!problem || problem.status === status) return;
    void onUpdate(id, { status });
  }

  return (
    <DndContext onDragEnd={handleDragEnd} sensors={sensors}>
      <div
        aria-label="LeetCode status board"
        className="grid gap-4 overflow-x-auto pb-2 lg:grid-cols-2 2xl:grid-cols-4"
        role="group"
      >
        {LEETCODE_STATUSES.map((status) => (
          <StatusColumn
            attemptStats={attemptStats}
            key={status}
            onSelect={onSelect}
            pendingIds={pendingIds}
            problems={groups[status]}
            status={status}
          />
        ))}
      </div>
    </DndContext>
  );
}
