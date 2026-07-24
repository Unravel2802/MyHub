"use client";

import { ArrowDown, ArrowUp, ExternalLink } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/src/components/ui/Badge";
import { EmptyState } from "@/src/components/ui/EmptyState";
import type { CreateProblemInput } from "@/src/modules/leetcode/LeetCodeRepository";
import type {
  LeetCodeAttempt,
  LeetCodeDifficulty,
  LeetCodeProblem,
  LeetCodeStatus,
} from "@/src/modules/leetcode/types";
import { LEETCODE_STATUSES } from "@/src/modules/leetcode/leetcodeBoard";
import {
  difficultyLabels,
  difficultyTones,
  inputClass,
  parseTags,
  statusLabels,
} from "@/src/modules/leetcode/components/leetcodeUi";

type AttemptStats = {
  count: number;
  lastAttempt: LeetCodeAttempt | null;
};

type SortKey =
  "title" | "difficulty" | "status" | "tags" | "attempts" | "lastAttempt";

const difficultyRank: Record<LeetCodeDifficulty, number> = {
  easy: 0,
  medium: 1,
  hard: 2,
};

const statusRank = Object.fromEntries(
  LEETCODE_STATUSES.map((status, index) => [status, index]),
) as Record<LeetCodeStatus, number>;

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
  attemptStats: (problemId: string) => AttemptStats;
  pendingIds: ReadonlySet<string>;
  problems: LeetCodeProblem[];
  onSelect: (id: string) => void;
  onUpdate: (id: string, updates: Partial<CreateProblemInput>) => Promise<void>;
}

export function LeetCodeTable({
  attemptStats,
  pendingIds,
  problems,
  onSelect,
  onUpdate,
}: LeetCodeTableProps) {
  const [difficulty, setDifficulty] = useState<LeetCodeDifficulty | "all">(
    "all",
  );
  const [status, setStatus] = useState<LeetCodeStatus | "all">("all");
  const [tag, setTag] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("title");
  const [ascending, setAscending] = useState(true);

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

    return filtered.toSorted((left, right) => {
      const leftStats = attemptStats(left.id);
      const rightStats = attemptStats(right.id);
      let comparison = 0;

      if (sortKey === "title")
        comparison = left.title.localeCompare(right.title);
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
      if (sortKey === "attempts") {
        comparison = leftStats.count - rightStats.count;
      }
      if (sortKey === "lastAttempt") {
        comparison = (leftStats.lastAttempt?.date ?? "").localeCompare(
          rightStats.lastAttempt?.date ?? "",
        );
      }

      return ascending ? comparison : -comparison;
    });
  }, [ascending, attemptStats, difficulty, problems, sortKey, status, tag]);

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
            className="size-3.5"
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
          <table className="min-w-[880px] w-full border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 bg-surface-subtle text-xs text-muted">
              <tr>
                <th className="px-3 py-2">{sortButton("Problem", "title")}</th>
                <th className="px-3 py-2">
                  {sortButton("Difficulty", "difficulty")}
                </th>
                <th className="px-3 py-2">{sortButton("Status", "status")}</th>
                <th className="px-3 py-2">{sortButton("Tags", "tags")}</th>
                <th className="px-3 py-2 text-right">
                  {sortButton("Attempts", "attempts")}
                </th>
                <th className="px-3 py-2">
                  {sortButton("Last attempt", "lastAttempt")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.map((problem) => {
                const stats = attemptStats(problem.id);
                const pending = pendingIds.has(problem.id);
                return (
                  <tr
                    className="bg-surface hover:bg-surface-subtle"
                    key={problem.id}
                  >
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          className="font-medium text-foreground hover:text-accent-strong"
                          onClick={() => onSelect(problem.id)}
                          type="button"
                        >
                          {problem.title}
                        </button>
                        {problem.url ? (
                          <a
                            aria-label={`Open ${problem.title} on LeetCode`}
                            className="text-muted hover:text-foreground"
                            href={problem.url}
                            rel="noreferrer"
                            target="_blank"
                          >
                            <ExternalLink
                              aria-hidden="true"
                              className="size-3.5"
                            />
                          </a>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <Badge tone={difficultyTones[problem.difficulty]}>
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
                    <td className="px-3 py-3 text-right tabular-nums text-body">
                      {stats.count}
                    </td>
                    <td className="px-3 py-3 text-muted">
                      {stats.lastAttempt?.date ?? "Never"}
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
