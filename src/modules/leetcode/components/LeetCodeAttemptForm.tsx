"use client";

import { format } from "date-fns";
import { type FormEvent, useState } from "react";
import type { CreateAttemptInput } from "@/src/modules/leetcode/LeetCodeRepository";
import type { LeetCodeOutcome } from "@/src/modules/leetcode/types";
import {
  inputClass,
  outcomeLabels,
} from "@/src/modules/leetcode/components/leetcodeUi";

const languages = [
  { value: "typescript", label: "TypeScript" },
  { value: "javascript", label: "JavaScript" },
  { value: "python", label: "Python3" },
  { value: "cpp", label: "C++" },
  { value: "java", label: "Java" },
  { value: "go", label: "Go" },
  { value: "sql", label: "SQL" },
];

interface LeetCodeAttemptFormProps {
  disabled: boolean;
  problemId: string;
  onSubmit: (input: CreateAttemptInput) => Promise<void>;
}

export function LeetCodeAttemptForm({
  disabled,
  problemId,
  onSubmit,
}: LeetCodeAttemptFormProps) {
  const [date, setDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [timeToSolveMin, setTimeToSolveMin] = useState("");
  const [outcome, setOutcome] = useState<LeetCodeOutcome>("solved");
  const [notes, setNotes] = useState("");
  const [solutionCode, setSolutionCode] = useState("");
  const [solutionLanguage, setSolutionLanguage] = useState("python");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const hasSolution = solutionCode.trim() !== "";
    await onSubmit({
      problemId,
      date,
      timeToSolveMin: timeToSolveMin === "" ? null : Number(timeToSolveMin),
      outcome,
      notes: notes.trim() || null,
      solutionCode: hasSolution ? solutionCode : null,
      solutionLanguage: hasSolution ? solutionLanguage : null,
    });
    setTimeToSolveMin("");
    setNotes("");
    setSolutionCode("");
  }

  return (
    <form
      aria-label="Log attempt"
      className="grid gap-3 rounded-lg border border-border bg-surface-subtle p-4"
      onSubmit={handleSubmit}
    >
      <div>
        <h3 className="font-semibold text-foreground">Log an attempt</h3>
        <p className="mt-1 text-sm text-muted">
          Record this sitting without overwriting earlier solutions.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="grid gap-1.5 text-sm font-medium text-body">
          Attempt date
          <input
            className={inputClass}
            disabled={disabled}
            onChange={(event) => setDate(event.target.value)}
            required
            type="date"
            value={date}
          />
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-body">
          Time to solve (minutes)
          <input
            className={inputClass}
            disabled={disabled}
            min="0"
            onChange={(event) => setTimeToSolveMin(event.target.value)}
            type="number"
            value={timeToSolveMin}
          />
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-body">
          Outcome
          <select
            className={inputClass}
            disabled={disabled}
            onChange={(event) =>
              setOutcome(event.target.value as LeetCodeOutcome)
            }
            value={outcome}
          >
            {(Object.entries(outcomeLabels) as [LeetCodeOutcome, string][]).map(
              ([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ),
            )}
          </select>
        </label>
      </div>
      <label className="grid gap-1.5 text-sm font-medium text-body">
        Attempt notes
        <textarea
          className="min-h-24 rounded-md border border-input bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
          disabled={disabled}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="What worked, what failed, and what to revisit?"
          value={notes}
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-[12rem_minmax(0,1fr)]">
        <label className="grid content-start gap-1.5 text-sm font-medium text-body">
          Solution language
          <select
            className={inputClass}
            disabled={disabled}
            onChange={(event) => setSolutionLanguage(event.target.value)}
            value={solutionLanguage}
          >
            {languages.map((language) => (
              <option key={language.value} value={language.value}>
                {language.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-body">
          Solution code
          <textarea
            className="min-h-40 rounded-md border border-input bg-surface px-3 py-2 font-mono text-sm leading-6 text-foreground outline-none focus:border-accent"
            disabled={disabled}
            onChange={(event) => setSolutionCode(event.target.value)}
            placeholder="Optional solution from this attempt"
            spellCheck={false}
            value={solutionCode}
          />
        </label>
      </div>
      <div>
        <button
          className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:bg-disabled"
          disabled={disabled}
          type="submit"
        >
          Log attempt
        </button>
      </div>
    </form>
  );
}
