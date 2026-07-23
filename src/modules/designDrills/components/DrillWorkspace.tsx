"use client";

import { useEffect, useId, useState } from "react";
import { ArrowLeft, Check, Clock, Loader2, Pause, Play } from "lucide-react";
import { Badge } from "@/src/components/ui/Badge";
import type { SubmitAttemptInput } from "@/src/modules/designDrills/DesignDrillsRepository";
import { DESIGN_DRILL_CATEGORY_HUES } from "@/src/modules/designDrills/designDrillHues";
import { DrillBrief } from "@/src/modules/designDrills/components/DrillBrief";
import { CodePad } from "@/src/modules/designDrills/components/CodePad";
import type {
  DesignDrill,
  DesignDrillAttempt,
  DesignDrillSelfRating,
} from "@/src/modules/designDrills/types";

const categoryLabels = {
  system_design: "System design",
  ml_system_design: "ML system design",
} as const;

const selfRatings: { value: DesignDrillSelfRating; label: string }[] = [
  {
    value: "strong",
    label: "Strong — I'd be confident shipping this in an onsite",
  },
  { value: "solid", label: "Solid — hit the shape, missed some depth" },
  { value: "weak", label: "Weak — I'd want another rep before an interview" },
];

function formatElapsed(totalSec: number): string {
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

interface DrillWorkspaceProps {
  drill: DesignDrill;
  attempt: DesignDrillAttempt;
  pending: boolean;
  pastAttempts: DesignDrillAttempt[];
  onSaveNotes: (notes: string) => void;
  onSubmit: (input: SubmitAttemptInput) => Promise<void>;
  onExit: () => void;
}

export function DrillWorkspace({
  drill,
  attempt,
  pending,
  pastAttempts,
  onSaveNotes,
  onSubmit,
  onExit,
}: DrillWorkspaceProps) {
  const [notes, setNotes] = useState(attempt.notes ?? "");
  const [revealed, setRevealed] = useState(false);
  const [rubricHits, setRubricHits] = useState<Set<number>>(new Set());
  const [selfRating, setSelfRating] = useState<DesignDrillSelfRating | "">("");
  // Tracks what's actually been persisted so save status can be derived at
  // render time (notes !== lastSavedNotes => still dirty) rather than stored
  // as its own state var that could drift from the real autosave effect.
  const [lastSavedNotes, setLastSavedNotes] = useState(attempt.notes ?? "");
  const [hasSaved, setHasSaved] = useState(false);
  const scratchpadId = useId();

  const saveStatus: "idle" | "saving" | "saved" =
    notes !== lastSavedNotes ? "saving" : hasSaved ? "saved" : "idle";

  // Timer is pausable, unlike a plain `Date.now() - startedAt` stopwatch:
  // `accumulatedMs` banks time from prior running spans, `runningSince` is the
  // start of the current span (null while paused). Initialized from the
  // attempt's persisted `startedAt` so a page reload resumes the real elapsed
  // time instead of restarting from zero.
  const [accumulatedMs, setAccumulatedMs] = useState(() =>
    Math.max(0, Date.now() - new Date(attempt.startedAt).getTime()),
  );
  const [runningSince, setRunningSince] = useState<number | null>(() =>
    Date.now(),
  );
  const [elapsedSec, setElapsedSec] = useState(() =>
    Math.floor(accumulatedMs / 1000),
  );

  useEffect(() => {
    if (runningSince === null) return;
    const tick = () =>
      setElapsedSec(
        Math.floor((accumulatedMs + Date.now() - runningSince) / 1000),
      );
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [accumulatedMs, runningSince]);

  function toggleTimer() {
    if (runningSince === null) {
      setRunningSince(Date.now());
    } else {
      setAccumulatedMs((ms) => ms + Date.now() - runningSince);
      setRunningSince(null);
    }
  }

  // Autosave the scratchpad 1.5s after the last keystroke — frequent enough
  // that a closed tab loses at most a few seconds of writing, not the whole
  // attempt.
  useEffect(() => {
    if (notes === (attempt.notes ?? "")) return;
    const timeout = setTimeout(() => {
      onSaveNotes(notes);
      setLastSavedNotes(notes);
      setHasSaved(true);
    }, 1500);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes]);

  function toggleRubricHit(index: number) {
    setRubricHits((current) => {
      const next = new Set(current);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  async function handleFinish() {
    if (!selfRating) return;
    await onSubmit({
      durationSec: elapsedSec,
      notes: notes || null,
      rubricHits: Array.from(rubricHits).sort((a, b) => a - b),
      selfRating,
    });
    onExit();
  }

  const completedPastAttempts = pastAttempts.filter((past) => past.completedAt);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <button
          className="flex items-center gap-1.5 text-sm text-muted hover:text-body"
          onClick={onExit}
          type="button"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Back to drills
        </button>
        <div className="flex items-center gap-1.5 rounded-md border border-border bg-surface-subtle pl-3 pr-1.5 py-1.5">
          <span
            className="flex items-center gap-2 font-mono text-sm tabular-nums text-foreground"
            role="timer"
          >
            <Clock aria-hidden className="size-4 text-muted" />
            {formatElapsed(elapsedSec)}
          </span>
          <button
            aria-label={runningSince === null ? "Resume timer" : "Pause timer"}
            className="flex size-6 items-center justify-center rounded text-muted hover:bg-surface hover:text-body"
            onClick={toggleTimer}
            title={runningSince === null ? "Resume timer" : "Pause timer"}
            type="button"
          >
            {runningSince === null ? (
              <Play aria-hidden className="size-3.5" />
            ) : (
              <Pause aria-hidden className="size-3.5" />
            )}
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="overflow-hidden rounded-lg border border-border bg-surface lg:h-[calc(100vh-11rem)] lg:overflow-y-auto">
          <div className="px-5 pb-4 pt-5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold tracking-tight text-foreground">
                {drill.title}
              </h2>
              <Badge hue={DESIGN_DRILL_CATEGORY_HUES[drill.category]}>
                {categoryLabels[drill.category]}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted">
              Target: ~{drill.estimatedMinutes} min
            </p>
          </div>

          <DrillBrief drill={drill} />

          {completedPastAttempts.length > 0 ? (
            <div className="border-t border-border px-5 pb-5 pt-4">
              <h3 className="text-xs font-medium uppercase tracking-widest text-muted">
                Your past attempts
              </h3>
              <ul className="mt-2 grid gap-1.5 text-sm text-body">
                {completedPastAttempts.map((past) => (
                  <li className="flex items-center gap-2" key={past.id}>
                    <span className="text-muted">
                      {new Date(past.startedAt).toLocaleDateString()}
                    </span>
                    <span>
                      {past.durationSec ? formatElapsed(past.durationSec) : "—"}
                    </span>
                    {past.selfRating ? (
                      <Badge tone="neutral">{past.selfRating}</Badge>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <section className="grid gap-4 lg:h-[calc(100vh-11rem)] lg:grid-rows-[1fr_auto]">
          <label className="sr-only" htmlFor={scratchpadId}>
            Your design (scratchpad)
          </label>
          <CodePad
            className="min-h-[28rem] lg:min-h-0 lg:h-full"
            id={scratchpadId}
            label="Your design (scratchpad)"
            onChange={setNotes}
            onReset={() => setNotes("")}
            placeholder={
              "Requirements & scale\n\nAPI design\n\nHigh-level design\n\nDeep dive\n\nTrade-offs"
            }
            status={
              saveStatus === "idle" ? null : (
                <span className="flex items-center gap-1.5 text-xs text-muted">
                  {saveStatus === "saving" ? (
                    <>
                      <Loader2 aria-hidden className="size-3.5 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <Check aria-hidden className="size-3.5 text-success" />
                      Saved
                    </>
                  )}
                </span>
              )
            }
            value={notes}
          />

          {!revealed ? (
            <button
              className="h-11 rounded-md border border-accent-border bg-accent-surface px-4 text-sm font-medium text-accent-strong hover:border-accent"
              onClick={() => setRevealed(true)}
              type="button"
            >
              Submit &amp; self-grade
            </button>
          ) : (
            <div className="rounded-lg border border-border bg-surface p-5">
              <h3 className="text-lg font-semibold tracking-tight text-foreground">
                Self-grade against the rubric
              </h3>
              <p className="mt-1 text-sm text-muted">
                Check what your answer actually covered — be honest, this is for
                you.
              </p>
              <ul className="mt-3 grid gap-2">
                {drill.rubric.map((item, index) => (
                  <li key={item}>
                    <label className="flex items-start gap-2 text-sm text-body">
                      <input
                        checked={rubricHits.has(index)}
                        className="mt-1"
                        onChange={() => toggleRubricHit(index)}
                        type="checkbox"
                      />
                      <span>{item}</span>
                    </label>
                  </li>
                ))}
              </ul>

              <fieldset className="mt-4 grid gap-2">
                <legend className="text-sm font-medium text-body">
                  Overall self-rating
                </legend>
                {selfRatings.map((option) => (
                  <label
                    className="flex items-start gap-2 text-sm text-body"
                    key={option.value}
                  >
                    <input
                      checked={selfRating === option.value}
                      className="mt-1"
                      name="self-rating"
                      onChange={() => setSelfRating(option.value)}
                      type="radio"
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </fieldset>

              <button
                className="mt-4 h-11 w-full rounded-md border border-accent-border bg-accent-surface px-4 text-sm font-medium text-accent-strong hover:border-accent disabled:opacity-60"
                disabled={!selfRating || pending}
                onClick={() => void handleFinish()}
                type="button"
              >
                {pending ? "Saving…" : "Finish attempt"}
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
