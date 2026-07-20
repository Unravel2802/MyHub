import { StatCard } from "@/src/components/ui/StatCard";
import type { Scorecard, TopicStat } from "@/src/modules/prep/prepScorecard";
import {
  activeCheckpoint,
  mockSubtypeProgress,
} from "@/src/modules/prep/prepTargets";
import type { PrepEntry } from "@/src/modules/prep/types";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { PREP_TYPE_HUES } from "@/src/modules/prep/prepTypeHues";
import { HUE_BORDER_TOP } from "@/src/components/ui/hueClasses";

type PrepScorecardProps = {
  month: string;
  scorecard: Scorecard;
  topics: TopicStat[];
  entries: PrepEntry[];
  onMonthChange: (month: string) => void;
};

const countLabels: { key: keyof Scorecard["countsByType"]; label: string }[] = [
  { key: "algorithm", label: "Algorithms" },
  { key: "system_design", label: "System design" },
  { key: "ml_system_design", label: "ML system design" },
  { key: "behavioral", label: "Behavioral" },
  { key: "mock_interview", label: "Mocks" },
];

function percent(value: number | null) {
  return value === null ? "No judged attempts" : `${Math.round(value * 100)}%`;
}

export function PrepScorecard({
  month,
  scorecard,
  topics,
  entries,
  onMonthChange,
}: PrepScorecardProps) {
  const checkpoint = activeCheckpoint(new Date().toISOString().slice(0, 10));
  const subtypeProgress = mockSubtypeProgress(entries, checkpoint);
  return (
    <section
      aria-labelledby="scorecard-heading"
      className="rounded-lg border border-border bg-surface p-5"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            className="text-lg font-semibold text-foreground"
            id="scorecard-heading"
          >
            Monthly scorecard
          </h2>
          <p className="mt-1 text-sm text-muted">
            Actual reps, without invented targets.
          </p>
        </div>
        <label className="grid gap-1 text-xs font-medium text-muted">
          Month
          <input
            className="h-9 rounded-md border border-input bg-surface px-3 text-sm text-foreground"
            onChange={(event) => onMonthChange(event.target.value)}
            type="month"
            value={month}
          />
        </label>
      </div>

      {/* StatCard, not hand-rolled tiles. These were bespoke divs, which is why
          "ML system design" wrapped to two lines and dropped its number a line
          below the four tiles beside it — the row visibly broke. StatCard carries
          the label min-height that keeps a wrapped label from shifting its value. */}
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {countLabels.map((item) => (
          <div
            className={`rounded-lg border-t-2 ${scorecard.countsByType[item.key] > 0 ? HUE_BORDER_TOP[PREP_TYPE_HUES[item.key]] : "border-t-border"}`}
            key={item.key}
          >
            <StatCard
              label={item.label}
              value={scorecard.countsByType[item.key]}
            />
          </div>
        ))}
      </div>

      {/* No-data cases render as an em-dash with the explanation as a HINT.
          "No judged attempts" and "No timing data" were previously set at value
          size and weight — a sentence dressed up as a statistic, which reads as
          noise in a row of numbers. Same null-vs-zero discipline as the funnel:
          absence is "—", never a number. */}
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Solved / attempted"
          value={`${scorecard.solved} / ${scorecard.attempted}`}
        />
        <StatCard
          hint={
            scorecard.solveRate === null ? "No judged attempts yet" : undefined
          }
          label="Solve rate"
          value={
            scorecard.solveRate === null ? "—" : percent(scorecard.solveRate)
          }
        />
        <StatCard
          hint={
            scorecard.averageTimeToSolveMin === null
              ? "No timed attempts yet"
              : undefined
          }
          label="Average solve time"
          value={
            scorecard.averageTimeToSolveMin === null
              ? "—"
              : `${Math.round(scorecard.averageTimeToSolveMin)} min`
          }
        />
      </div>

      <div className="mt-5">
        <h3 className="text-sm font-semibold text-foreground">
          Weakest measured topics
        </h3>
        {topics.length === 0 ? (
          <EmptyState
            description="Judge one algorithm rep to turn your weakest topic into a targeted next step."
            title="No measured topics yet"
          />
        ) : (
          <ul className="mt-2 grid gap-2 sm:grid-cols-3">
            {topics.map((topic) => (
              <li
                className="rounded-md bg-surface-subtle p-3"
                key={topic.topic}
              >
                <p className="font-medium text-foreground">{topic.topic}</p>
                <p className="mt-1 text-xs text-muted">
                  {Math.round(topic.solveRate * 100)}% · {topic.solved}/
                  {topic.attempted} solved
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {subtypeProgress ? (
        <div className="mt-5 rounded-md border border-border p-3">
          <h3 className="text-sm font-semibold text-foreground">
            {subtypeProgress.checkpoint.label} mock breakdown
          </h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {(
              [
                ["coding", "Coding"],
                ["system_design", "System design"],
                ["ml_system_design", "ML system design"],
              ] as const
            ).map(([key, label]) => (
              <div className="rounded-md bg-surface-subtle p-3" key={key}>
                <p className="text-xs text-muted">{label}</p>
                <p className="mt-1 font-semibold text-foreground">
                  {subtypeProgress.bySubtype[key].actual}/
                  {subtypeProgress.bySubtype[key].target}
                </p>
              </div>
            ))}
          </div>
          {subtypeProgress.unclassified > 0 ? (
            <p className="mt-3 text-xs text-muted">
              {subtypeProgress.unclassified} unclassified mocks
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
