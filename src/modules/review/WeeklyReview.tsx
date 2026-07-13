"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/src/components/AppShell";
import { StatCard } from "@/src/components/ui/StatCard";
import {
  QUARTERLY_QUESTIONS,
  weekStartKeyOf,
} from "@/src/modules/review/reviewLogic";
import type { QuarterlyAnswers } from "@/src/modules/review/types";
import { useReviewStore } from "@/src/modules/review/useReviewStore";

function targetLabel(target: { min: number; max?: number }) {
  return target.max ? `${target.min}-${target.max}` : `${target.min}`;
}

function SnapshotStats({
  snapshot,
  label,
}: {
  snapshot: ReturnType<typeof useReviewStore.getState>["currentSnapshot"];
  label: string;
}) {
  if (!snapshot) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <StatCard
        label={`${label} applications`}
        value={snapshot.cadence.applications.count}
        hint={`Target ${targetLabel(snapshot.cadence.applications.target)}`}
      />
      <StatCard
        label={`${label} outreach`}
        value={snapshot.cadence.outreach.count}
        hint={`Target ${targetLabel(snapshot.cadence.outreach.target)}`}
      />
      <StatCard
        label={`${label} mock interviews`}
        value={snapshot.cadence.mockInterviews.count}
        hint={`Target ${targetLabel(snapshot.cadence.mockInterviews.target)}`}
      />
      <StatCard
        label={`${label} algorithms`}
        value={snapshot.scorecard.solved}
        hint={`${snapshot.scorecard.attempted} attempted`}
      />
      <StatCard
        label={`${label} system design`}
        value={snapshot.scorecard.countsByType.system_design}
      />
      <StatCard
        label={`${label} checkpoint`}
        value={`${snapshot.checkpoint.algorithm.actual}/${snapshot.checkpoint.algorithm.target}`}
        hint={snapshot.checkpoint.checkpoint.label}
      />
    </div>
  );
}

export function WeeklyReview() {
  const store = useReviewStore();
  const [wentWell, setWentWell] = useState("");
  const [needsWork, setNeedsWork] = useState("");
  const [nextWeekFix, setNextWeekFix] = useState("");
  const [quarterlyAnswers, setQuarterlyAnswers] = useState<QuarterlyAnswers>(
    {},
  );
  const [today, setToday] = useState<Date | null>(null);
  useEffect(() => {
    // Read the browser clock after hydration so boundary-week rendering is
    // deterministic when the UI test freezes time.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToday(new Date());
  }, []);
  const effectiveToday = today ?? new Date();
  const currentWeek = weekStartKeyOf(effectiveToday);
  const existingReview = store.reviewForWeek(currentWeek);
  const { fetchReviews } = store;

  useEffect(() => {
    void fetchReviews();
  }, [fetchReviews]);

  useEffect(() => {
    if (!existingReview) return;
    // The fetched review is the source for initializing this form. The key
    // dependency below prevents overwriting edits on unrelated store updates.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWentWell(existingReview.wentWell ?? "");
    setNeedsWork(existingReview.needsWork ?? "");
    setNextWeekFix(existingReview.nextWeekFix ?? "");
    setQuarterlyAnswers(existingReview.quarterlyAnswers ?? {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingReview?.id]);

  async function save() {
    await store.saveReview({
      today: effectiveToday,
      wentWell: wentWell.trim() || null,
      needsWork: needsWork.trim() || null,
      nextWeekFix: nextWeekFix.trim() || null,
      quarterlyAnswers: store.isQuarterBoundary(effectiveToday)
        ? quarterlyAnswers
        : null,
    });
  }

  const field =
    "min-h-24 w-full rounded-md border border-input bg-surface px-3 py-2 text-sm";
  return (
    <AppShell activeHref="/review" title="Weekly Review">
      <section className="min-w-0 px-4 py-6 sm:px-6 lg:px-8">
        <header>
          <p className="text-sm font-medium text-muted">Sunday ritual</p>
          <h2 className="mt-1 text-3xl font-semibold">Weekly Review</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Look honestly at this week, then choose one fix for the next.
          </p>
        </header>

        {store.error ? (
          <p className="mt-5 rounded-md border border-danger-border bg-danger-surface px-3 py-2 text-sm text-danger">
            {store.error}
          </p>
        ) : null}

        <div className="mt-6 grid gap-3">
          <h3 className="text-xl font-semibold">This week</h3>
          <SnapshotStats label="Live" snapshot={store.currentSnapshot} />
        </div>

        <form
          className="mt-8 grid gap-4 rounded-lg border border-border bg-surface p-5"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <h3 className="text-xl font-semibold">Reflection</h3>
          <label className="grid gap-1.5 text-sm font-medium text-body">
            What went well?
            <textarea
              className={field}
              onChange={(event) => setWentWell(event.target.value)}
              value={wentWell}
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-body">
            What needs work?
            <textarea
              className={field}
              onChange={(event) => setNeedsWork(event.target.value)}
              value={needsWork}
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-body">
            One fix for next week
            <textarea
              className={field}
              onChange={(event) => setNextWeekFix(event.target.value)}
              value={nextWeekFix}
            />
          </label>

          {today && store.isQuarterBoundary(today) ? (
            <fieldset className="grid gap-4 border-t border-border pt-4">
              <legend className="text-lg font-semibold">
                Quarterly questions
              </legend>
              {QUARTERLY_QUESTIONS.map((question, index) => (
                <label
                  className="grid gap-1.5 text-sm font-medium text-body"
                  key={question}
                >
                  {question}
                  <textarea
                    className={field}
                    onChange={(event) =>
                      setQuarterlyAnswers((answers) => ({
                        ...answers,
                        [index]: event.target.value,
                      }))
                    }
                    value={quarterlyAnswers[index] ?? ""}
                  />
                </label>
              ))}
            </fieldset>
          ) : null}
          <button
            className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:bg-disabled"
            disabled={store.isSaving}
            type="submit"
          >
            {store.isSaving ? "Saving..." : "Save review"}
          </button>
        </form>

        <section
          aria-labelledby="past-reviews-heading"
          className="mt-8 grid gap-4"
        >
          <h3 className="text-xl font-semibold" id="past-reviews-heading">
            Past reviews
          </h3>
          {store.reviews.length === 0 ? (
            <p className="text-sm text-muted">No saved reviews yet.</p>
          ) : (
            store.reviews.map((review) => (
              <article
                className="grid gap-4 rounded-lg border border-border bg-surface p-5"
                key={review.id}
              >
                <div>
                  <h4 className="font-semibold">Week of {review.weekStart}</h4>
                  <SnapshotStats label="Frozen" snapshot={review.snapshot} />
                </div>
                <div className="grid gap-2 text-sm">
                  {review.wentWell ? (
                    <p>
                      <strong>Went well:</strong> {review.wentWell}
                    </p>
                  ) : null}
                  {review.needsWork ? (
                    <p>
                      <strong>Needs work:</strong> {review.needsWork}
                    </p>
                  ) : null}
                  {review.nextWeekFix ? (
                    <p>
                      <strong>Next week:</strong> {review.nextWeekFix}
                    </p>
                  ) : null}
                </div>
              </article>
            ))
          )}
        </section>
      </section>
    </AppShell>
  );
}
