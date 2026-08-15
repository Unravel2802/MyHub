"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { useMemo, useState } from "react";
import { hueFor } from "@/src/components/moduleHues";
import { Badge } from "@/src/components/ui/Badge";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { HUE_TEXT } from "@/src/components/ui/hueClasses";
import type { CreateProblemInput } from "@/src/modules/leetcode/LeetCodeRepository";
import type {
  LeetCodeAttempt,
  LeetCodeDifficulty,
  LeetCodeProblem,
  LeetCodeStatus,
} from "@/src/modules/leetcode/types";
import {
  LEETCODE_STATUSES,
  attemptStats,
} from "@/src/modules/leetcode/leetcodeBoard";
import {
  difficultyLabels,
  inputClass,
  parseTags,
  statusLabels,
} from "@/src/modules/leetcode/components/leetcodeUi";
import { LEETCODE_DIFFICULTY_HUES } from "@/src/modules/leetcode/leetcodeHues";

type SortKey =
  | "questionNumber"
  | "title"
  | "difficulty"
  | "status"
  | "tags"
  | "lastAttempted";

type AttemptStats = {
  count: number;
  lastAttempt: LeetCodeAttempt | null;
};

const difficultyRank: Record<LeetCodeDifficulty, number> = {
  easy: 0,
  medium: 1,
  hard: 2,
};

const statusRank = Object.fromEntries(
  LEETCODE_STATUSES.map((status, index) => [status, index]),
) as Record<LeetCodeStatus, number>;

function nullableComparison<T>(
  left: T | null,
  right: T | null,
  compare: (leftValue: T, rightValue: T) => number,
) {
  if (left === null) return right === null ? 0 : 1;
  if (right === null) return -1;
  return compare(left, right);
}

export function sortLeetCodeProblems(
  problems: LeetCodeProblem[],
  sortKey: SortKey,
  ascending: boolean,
  statsFor: (problemId: string) => AttemptStats,
) {
  return problems.toSorted((left, right) => {
    let comparison = 0;
    let hasNulls = false;

    if (sortKey === "questionNumber") {
      hasNulls = left.questionNumber === null || right.questionNumber === null;
      comparison = nullableComparison(
        left.questionNumber,
        right.questionNumber,
        (leftNumber, rightNumber) => leftNumber - rightNumber,
      );
    }
    if (sortKey === "title") comparison = left.title.localeCompare(right.title);
    if (sortKey === "difficulty") {
      comparison =
        difficultyRank[left.difficulty] - difficultyRank[right.difficulty];
    }
    if (sortKey === "status") {
      comparison = statusRank[left.status] - statusRank[right.status];
    }
    if (sortKey === "tags") {
      comparison = left.tags.join(", ").localeCompare(right.tags.join(", "));
    }
    if (sortKey === "lastAttempted") {
      const leftDate = statsFor(left.id).lastAttempt?.date ?? null;
      const rightDate = statsFor(right.id).lastAttempt?.date ?? null;
      hasNulls = leftDate === null || rightDate === null;
      comparison = nullableComparison(
        leftDate,
        rightDate,
        (leftValue, rightValue) => leftValue.localeCompare(rightValue),
      );
    }

    // Pairs involving a null are left un-negated so nulls stay last in both
    // directions. Still a consistent total order — non-nulls ranked among
    // themselves, nulls equal to each other and after all of them — so the
    // comparator is safe to hand to toSorted.
    return ascending || hasNulls ? comparison : -comparison;
  });
}

interface TagsCellProps {
  disabled: boolean;
  problem: LeetCodeProblem;
  onUpdate: (id: string, updates: Partial<CreateProblemInput>) => Promise<void>;
}

function TagsCell({ disabled, problem, onUpdate }: TagsCellProps) {
  const [value, setValue] = useState(problem.tags.join(", "));

  function save() {
    const tags = parseTags(value);
    setValue(tags.join(", "));
    if (tags.join("\u0000") !== problem.tags.join("\u0000")) {
      void onUpdate(problem.id, { tags });
    }
  }

  return (
    <input
      aria-label={`Tags for ${problem.title}`}
      className="h-8 min-w-36 rounded-md border border-transparent bg-transparent px-2 text-xs text-body hover:border-input focus:border-accent focus:bg-surface focus:outline-none"
      disabled={disabled}
      onBlur={save}
      onChange={(event) => setValue(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
      value={value}
    />
  );
}

interface LeetCodeTableProps {
  // The attempt rows themselves, not the store's attemptStats accessor. That
  // accessor closes over get(), so its identity never changes — memoizing the
  // sort against it means the sort's only real dependency is invisible to
  // React, and it recomputes solely because `problems` happens to change too.
  // Today every path that logs an attempt also unmounts this table or replaces
  // `problems`, so nothing is visibly broken; taking the rows keeps it that
  // way once one doesn't.
  attempts: LeetCodeAttempt[];
  pendingIds: ReadonlySet<string>;
  problems: LeetCodeProblem[];
  onSelect: (id: string) => void;
  onUpdate: (id: string, updates: Partial<CreateProblemInput>) => Promise<void>;
}

export function LeetCodeTable({
  attempts,
  pendingIds,
  problems,
  onSelect,
  onUpdate,
}: LeetCodeTableProps) {
  const moduleHue = hueFor("/prep");
  const [difficulty, setDifficulty] = useState<LeetCodeDifficulty | "all">(
    "all",
  );
  const [status, setStatus] = useState<LeetCodeStatus | "all">("all");
  const [tag, setTag] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("lastAttempted");
  const [ascending, setAscending] = useState(false);

  const statsFor = useMemo(
    () => (problemId: string) => attemptStats(attempts, problemId),
    [attempts],
  );

  const tags = useMemo(
    () =>
      Array.from(new Set(problems.flatMap((problem) => problem.tags))).sort(
        (a, b) => a.localeCompare(b),
      ),
    [problems],
  );

  const visible = useMemo(() => {
    const filtered = problems.filter(
      (problem) =>
        (difficulty === "all" || problem.difficulty === difficulty) &&
        (status === "all" || problem.status === status) &&
        (tag === "all" || problem.tags.includes(tag)),
    );

    return sortLeetCodeProblems(filtered, sortKey, ascending, statsFor);
  }, [ascending, difficulty, problems, sortKey, statsFor, status, tag]);

  function toggleSort(nextKey: SortKey) {
    if (nextKey === sortKey) {
      setAscending((current) => !current);
    } else {
      setSortKey(nextKey);
      setAscending(true);
    }
  }

  function sortButton(label: string, key: SortKey) {
    const Icon = ascending ? ArrowUp : ArrowDown;
    return (
      <button
        className="inline-flex items-center gap-1 font-semibold text-foreground hover:text-accent-strong"
        onClick={() => toggleSort(key)}
        type="button"
      >
        {label}
        {sortKey === key ? (
          <Icon
            aria-label={ascending ? "ascending" : "descending"}
            className={`size-3.5 ${HUE_TEXT[moduleHue]}`}
          />
        ) : null}
      </button>
    );
  }

  return (
    <div className="grid gap-3">
      <div
        aria-label="Filter LeetCode problems"
        className="grid gap-3 sm:grid-cols-3"
        role="group"
      >
        <label className="grid gap-1 text-xs font-medium text-muted">
          Difficulty
          <select
            className={inputClass}
            onChange={(event) =>
              setDifficulty(event.target.value as LeetCodeDifficulty | "all")
            }
            value={difficulty}
          >
            <option value="all">All difficulties</option>
            {(
              Object.entries(difficultyLabels) as [LeetCodeDifficulty, string][]
            ).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-medium text-muted">
          Status
          <select
            className={inputClass}
            onChange={(event) =>
              setStatus(event.target.value as LeetCodeStatus | "all")
            }
            value={status}
          >
            <option value="all">All statuses</option>
            {LEETCODE_STATUSES.map((value) => (
              <option key={value} value={value}>
                {statusLabels[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-medium text-muted">
          Tag
          <select
            className={inputClass}
            onChange={(event) => setTag(event.target.value)}
            value={tag}
          >
            <option value="all">All tags</option>
            {tags.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          compact
          description="Add a problem or widen the current filters."
          title="No matching problems"
        />
      ) : (
        <div className="max-h-[38rem] max-w-full overflow-auto rounded-lg border border-border">
          <table className="min-w-[680px] w-full border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 bg-surface-subtle text-xs text-muted">
              <tr>
                <th className="px-3 py-2">
                  {sortButton("#", "questionNumber")}
                </th>
                <th className="px-3 py-2">{sortButton("Problem", "title")}</th>
                <th className="px-3 py-2">
                  {sortButton("Difficulty", "difficulty")}
                </th>
                <th className="px-3 py-2">{sortButton("Status", "status")}</th>
                <th className="px-3 py-2">{sortButton("Tags", "tags")}</th>
                <th className="px-3 py-2">
                  {sortButton("Last attempted", "lastAttempted")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.map((problem) => {
                const pending = pendingIds.has(problem.id);
                return (
                  <tr
                    className="bg-surface hover:bg-surface-subtle"
                    key={problem.id}
                  >
                    <td className="px-3 py-3 text-muted">
                      {problem.questionNumber ?? "—"}
                    </td>
                    <td className="px-3 py-3">
                      <button
                        className="font-medium text-foreground hover:text-accent-strong"
                        onClick={() => onSelect(problem.id)}
                        type="button"
                      >
                        {problem.title}
                      </button>
                    </td>
                    <td className="px-3 py-3">
                      <Badge hue={LEETCODE_DIFFICULTY_HUES[problem.difficulty]}>
                        {difficultyLabels[problem.difficulty]}
                      </Badge>
                    </td>
                    <td className="px-3 py-3">
                      <select
                        aria-label={`Status for ${problem.title}`}
                        className="h-8 rounded-md border border-input bg-surface px-2 text-xs text-body"
                        disabled={pending}
                        onChange={(event) =>
                          void onUpdate(problem.id, {
                            status: event.target.value as LeetCodeStatus,
                          })
                        }
                        value={problem.status}
                      >
                        {LEETCODE_STATUSES.map((value) => (
                          <option key={value} value={value}>
                            {statusLabels[value]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-1 py-2">
                      <TagsCell
                        disabled={pending}
                        key={`${problem.id}:${problem.tags.join(",")}`}
                        onUpdate={onUpdate}
                        problem={problem}
                      />
                    </td>
                    <td className="px-3 py-3 text-muted">
                      {statsFor(problem.id).lastAttempt?.date ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
