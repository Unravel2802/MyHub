"use client";

import { type FormEvent, useState } from "react";
import type { CreateProblemInput } from "@/src/modules/leetcode/LeetCodeRepository";
import type {
  LeetCodeDifficulty,
  LeetCodeProblem,
  LeetCodeStatus,
} from "@/src/modules/leetcode/types";
import {
  difficultyLabels,
  inputClass,
  parseTags,
  statusLabels,
} from "@/src/modules/leetcode/components/leetcodeUi";
import { LEETCODE_STATUSES } from "@/src/modules/leetcode/leetcodeBoard";

interface LeetCodeProblemFormProps {
  disabled: boolean;
  initialProblem?: LeetCodeProblem;
  onSubmit: (input: CreateProblemInput) => Promise<void>;
}

export function LeetCodeProblemForm({
  disabled,
  initialProblem,
  onSubmit,
}: LeetCodeProblemFormProps) {
  const [title, setTitle] = useState(initialProblem?.title ?? "");
  const [questionNumber, setQuestionNumber] = useState(
    initialProblem?.questionNumber?.toString() ?? "",
  );
  const [difficulty, setDifficulty] = useState<LeetCodeDifficulty>(
    initialProblem?.difficulty ?? "medium",
  );
  const [tags, setTags] = useState(initialProblem?.tags.join(", ") ?? "");
  const [notes, setNotes] = useState(initialProblem?.notes ?? "");
  const [timeMin, setTimeMin] = useState(
    initialProblem?.timeMin?.toString() ?? "",
  );
  const [status, setStatus] = useState<LeetCodeStatus>(
    initialProblem?.status ?? "to_review",
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    const trimmedNumber = questionNumber.trim();
    const parsedNumber = trimmedNumber ? Number(trimmedNumber) : null;
    const trimmedTimeMin = timeMin.trim();
    const parsedTimeMin = trimmedTimeMin ? Number(trimmedTimeMin) : null;

    await onSubmit({
      title: trimmedTitle,
      questionNumber:
        parsedNumber !== null && Number.isFinite(parsedNumber)
          ? parsedNumber
          : null,
      difficulty,
      tags: parseTags(tags),
      notes: notes.trim() || null,
      timeMin:
        parsedTimeMin !== null && Number.isFinite(parsedTimeMin)
          ? parsedTimeMin
          : null,
      status,
    });

    if (!initialProblem) {
      setTitle("");
      setQuestionNumber("");
      setTags("");
      setNotes("");
      setTimeMin("");
      setDifficulty("medium");
      setStatus("to_review");
    }
  }

  return (
    <form
      aria-label={initialProblem ? "Edit problem" : "Add problem"}
      className="grid gap-3 rounded-lg border border-border bg-surface-subtle p-4"
      onSubmit={handleSubmit}
    >
      <div>
        <h3 className="font-semibold text-foreground">
          {initialProblem ? "Edit problem" : "Add a problem"}
        </h3>
        {!initialProblem ? (
          <p className="mt-1 text-sm text-muted">
            Build a reusable problem bank, then log each sitting separately.
          </p>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <label className="grid gap-1.5 text-sm font-medium text-body xl:col-span-2">
          Problem title
          <input
            className={inputClass}
            disabled={disabled}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Two Sum"
            required
            value={title}
          />
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-body xl:col-span-2">
          LeetCode #
          <input
            className={inputClass}
            disabled={disabled}
            min={1}
            onChange={(event) => setQuestionNumber(event.target.value)}
            placeholder="1"
            type="number"
            value={questionNumber}
          />
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-body">
          Difficulty
          <select
            className={inputClass}
            disabled={disabled}
            onChange={(event) =>
              setDifficulty(event.target.value as LeetCodeDifficulty)
            }
            value={difficulty}
          >
            {(
              Object.entries(difficultyLabels) as [LeetCodeDifficulty, string][]
            ).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-body xl:col-span-3">
          Tags
          <input
            className={inputClass}
            disabled={disabled}
            onChange={(event) => setTags(event.target.value)}
            placeholder="Array, Hash Table"
            value={tags}
          />
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-body">
          Time spent (minutes)
          <input
            className={inputClass}
            disabled={disabled}
            min={0}
            onChange={(event) => setTimeMin(event.target.value)}
            type="number"
            value={timeMin}
          />
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-body md:col-span-2 xl:col-span-5">
          Problem notes
          <textarea
            className="min-h-24 rounded-md border border-input bg-surface px-3 py-2 text-sm text-foreground outline-none placeholder:text-subtle focus:border-accent disabled:bg-surface-subtle"
            disabled={disabled}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Patterns, pitfalls, and what to revisit"
            value={notes}
          />
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-body">
          Status
          <select
            className={inputClass}
            disabled={disabled}
            onChange={(event) =>
              setStatus(event.target.value as LeetCodeStatus)
            }
            value={status}
          >
            {LEETCODE_STATUSES.map((value) => (
              <option key={value} value={value}>
                {statusLabels[value]}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end">
          <button
            className="h-10 w-full rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:bg-disabled"
            disabled={disabled || !title.trim()}
            type="submit"
          >
            {initialProblem ? "Save changes" : "Add problem"}
          </button>
        </div>
      </div>
    </form>
  );
}
