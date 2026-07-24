import { format } from "date-fns";
import { type FormEvent, useState } from "react";
import type { CreatePrepEntryInput } from "@/src/modules/prep/PrepRepository";
import type {
  MockSubtype,
  PrepEntryType,
  PrepOutcome,
} from "@/src/modules/prep/types";

const entryTypes: { value: PrepEntryType; label: string }[] = [
  { value: "system_design", label: "System design" },
  { value: "ml_system_design", label: "ML system design" },
  { value: "behavioral", label: "Behavioral practice" },
  { value: "mock_interview", label: "Mock interview" },
  { value: "resume_deep_dive", label: "Resume deep-dive" },
];

const mockSubtypes: { value: MockSubtype; label: string }[] = [
  { value: "coding", label: "Coding" },
  { value: "system_design", label: "System design" },
  { value: "ml_system_design", label: "ML system design" },
];

const sessionOutcomes: { value: PrepOutcome; label: string }[] = [
  { value: "pass", label: "Pass" },
  { value: "needs_work", label: "Needs work" },
];

type PrepEntryFormProps = {
  disabled: boolean;
  onCreate: (input: CreatePrepEntryInput) => Promise<void>;
};

function optionalNumber(value: string): number | null {
  return value === "" ? null : Number(value);
}

export function PrepEntryForm({ disabled, onCreate }: PrepEntryFormProps) {
  const [entryType, setEntryType] = useState<PrepEntryType>("system_design");
  const [topic, setTopic] = useState("");
  const [date, setDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [durationMin, setDurationMin] = useState("");
  const [mockSubtype, setMockSubtype] = useState<MockSubtype | "">("");
  const [outcome, setOutcome] = useState<PrepOutcome | "">("");
  const [notes, setNotes] = useState("");

  function handleTypeChange(nextType: PrepEntryType) {
    setEntryType(nextType);
    setOutcome("");
    if (nextType !== "mock_interview") setMockSubtype("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onCreate({
      entryType,
      topic: topic.trim() || null,
      date,
      durationMin: optionalNumber(durationMin),
      timeToSolveMin: null,
      outcome: outcome || null,
      notes: notes.trim() || null,
      ...(entryType === "mock_interview" && mockSubtype ? { mockSubtype } : {}),
    });
    setTopic("");
    setDurationMin("");
    setOutcome("");
    setMockSubtype("");
    setNotes("");
  }

  const inputClass =
    "h-10 rounded-md border border-input bg-surface px-3 text-sm text-foreground outline-none placeholder:text-subtle focus:border-accent disabled:bg-surface-subtle";

  return (
    <form
      aria-labelledby="log-prep-heading"
      className="grid gap-4 rounded-lg border border-border bg-surface p-5"
      onSubmit={handleSubmit}
    >
      <div>
        <h2
          className="text-lg font-semibold text-foreground"
          id="log-prep-heading"
        >
          Log a prep session
        </h2>
        <p className="mt-1 text-sm text-muted">
          Capture the rep while the details are fresh.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-medium text-body">
          Practice type
          <select
            className={inputClass}
            disabled={disabled}
            onChange={(event) =>
              handleTypeChange(event.target.value as PrepEntryType)
            }
            value={entryType}
          >
            {entryTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1.5 text-sm font-medium text-body">
          Date
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
          Topic
          <input
            className={inputClass}
            disabled={disabled}
            onChange={(event) => setTopic(event.target.value)}
            placeholder="Graphs, rate limiter, conflict..."
            value={topic}
          />
        </label>

        <label className="grid gap-1.5 text-sm font-medium text-body">
          Session length (minutes)
          <input
            className={inputClass}
            disabled={disabled}
            min="0"
            onChange={(event) => setDurationMin(event.target.value)}
            type="number"
            value={durationMin}
          />
        </label>

        {entryType === "mock_interview" ? (
          <label className="grid gap-1.5 text-sm font-medium text-body">
            Mock subtype
            <select
              className={inputClass}
              disabled={disabled}
              onChange={(event) =>
                setMockSubtype(event.target.value as MockSubtype | "")
              }
              value={mockSubtype}
            >
              <option value="">Unclassified</option>
              {mockSubtypes.map((subtype) => (
                <option key={subtype.value} value={subtype.value}>
                  {subtype.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="grid gap-1.5 text-sm font-medium text-body">
          Outcome
          <select
            className={inputClass}
            disabled={disabled}
            onChange={(event) =>
              setOutcome(event.target.value as PrepOutcome | "")
            }
            value={outcome}
          >
            <option value="">Not judged yet</option>
            {sessionOutcomes.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="grid gap-1.5 text-sm font-medium text-body">
        Notes / post-mortem
        <textarea
          className="min-h-24 rounded-md border border-input bg-surface px-3 py-2 text-sm text-foreground outline-none placeholder:text-subtle focus:border-accent disabled:bg-surface-subtle"
          disabled={disabled}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="What worked, what broke, and what to try next"
          value={notes}
        />
      </label>

      <button
        className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-disabled"
        disabled={disabled}
        type="submit"
      >
        Log session
      </button>
    </form>
  );
}
