"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Clock } from "lucide-react";
import { Badge } from "@/src/components/ui/Badge";
import type { SubmitAttemptInput } from "@/src/modules/designDrills/DesignDrillsRepository";
import { DESIGN_DRILL_CATEGORY_HUES } from "@/src/modules/designDrills/designDrillHues";
import { DrillBrief } from "@/src/modules/designDrills/components/DrillBrief";
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
  const [elapsedSec, setElapsedSec] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [rubricHits, setRubricHits] = useState<Set<number>>(new Set());
  const [selfRating, setSelfRating] = useState<DesignDrillSelfRating | "">("");

  const startedAtMs = useMemo(
    () => new Date(attempt.startedAt).getTime(),
    [attempt.startedAt],
  );

  useEffect(() => {
    const tick = () =>
      setElapsedSec(Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [startedAtMs]);

  // Autosave the scratchpad 1.5s after the last keystroke — frequent enough
  // that a closed tab loses at most a few seconds of writing, not the whole
  // attempt.
  useEffect(() => {
    if (notes === (attempt.notes ?? "")) return;
    const timeout = setTimeout(() => onSaveNotes(notes), 1500);
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          className="flex items-center gap-1.5 text-sm text-muted hover:text-body"
          onClick={onExit}
          type="button"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Back to drills
        </button>
        <div
          className="flex items-center gap-2 rounded-md border border-border bg-surface-subtle px-3 py-1.5 font-mono text-sm tabular-nums text-foreground"
          role="timer"
        >
          <Clock aria-hidden className="size-4 text-muted" />
          {formatElapsed(elapsedSec)}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <section className="rounded-lg border border-border bg-surface p-5">
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
          <div className="mt-4">
            <DrillBrief drill={drill} />
          </div>

          {completedPastAttempts.length > 0 ? (
            <div className="mt-6 border-t border-border pt-4">
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

        <section className="grid content-start gap-4">
          <div className="rounded-lg border border-border bg-surface p-5">
            <label className="grid gap-1.5 text-sm font-medium text-body">
              Your design (scratchpad)
              <textarea
                className="min-h-80 rounded-md border border-input bg-surface px-3 py-2 font-mono text-sm text-foreground outline-none placeholder:text-subtle focus:border-accent"
                onChange={(event) => setNotes(event.target.value)}
                placeholder={
                  "Requirements & scale\n\nAPI design\n\nHigh-level design\n\nDeep dive\n\nTrade-offs"
                }
                value={notes}
              />
            </label>
          </div>

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
