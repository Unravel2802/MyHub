"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/src/components/AppShell";
import { PageHeader } from "@/src/components/ui/PageHeader";
import { EmptyState } from "@/src/components/ui/EmptyState";
import {
  QUARTERLY_QUESTIONS,
  weekStartKeyOf,
} from "@/src/modules/review/reviewLogic";
import type { QuarterlyAnswers } from "@/src/modules/review/types";
import { useReviewStore } from "@/src/modules/review/useReviewStore";
import { ReviewSnapshotStats } from "@/src/modules/review/components/ReviewSnapshotStats";
import { hueFor } from "@/src/components/moduleHues";
import { register, unregister } from "@/src/lib/commandPalette";

export function WeeklyReview() {
  const router = useRouter();
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
    register("weekly-review", [
      {
        id: "go-to-page",
        label: "Go to Weekly Review",
        keywords: ["review", "weekly", "ritual"],
        action: () => router.push("/review"),
      },
    ]);
    return () => unregister("weekly-review");
  }, [router]);

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
        <PageHeader
          bleed
          description="Look honestly at this week, then choose one fix for the next."
          eyebrow="Sunday ritual"
          hue={hueFor("/review")}
          title="Weekly Review"
        />

        {store.error ? (
          <p
            aria-live="assertive"
            className="mt-5 rounded-md border border-danger-border bg-danger-surface px-3 py-2 text-sm text-danger"
            role="alert"
          >
            {store.error}
          </p>
        ) : null}

        <div className="mt-6 grid gap-3">
          <h3 className="text-xl font-semibold">This week</h3>
          <ReviewSnapshotStats snapshot={store.currentSnapshot} />
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
            <EmptyState
              description="Save this week's reflection to create a frozen record you can trust later."
              title="No past reviews yet"
            />
          ) : (
            store.reviews.map((review) => (
              <article
                className="grid gap-4 rounded-lg border border-border bg-surface p-5"
                key={review.id}
              >
                <div>
                  <h4 className="font-semibold">Week of {review.weekStart}</h4>
                  <ReviewSnapshotStats snapshot={review.snapshot} />
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
