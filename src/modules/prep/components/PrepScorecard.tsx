import type { Scorecard, TopicStat } from "@/src/modules/prep/prepScorecard";

type PrepScorecardProps = {
  month: string;
  scorecard: Scorecard;
  topics: TopicStat[];
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
  onMonthChange,
}: PrepScorecardProps) {
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

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {countLabels.map((item) => (
          <div className="rounded-md bg-surface-subtle p-3" key={item.key}>
            <p className="text-xs text-muted">{item.label}</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">
              {scorecard.countsByType[item.key]}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-border p-3">
          <p className="text-xs text-muted">Solved / attempted</p>
          <p className="mt-1 font-semibold text-foreground">
            {scorecard.solved} / {scorecard.attempted}
          </p>
        </div>
        <div className="rounded-md border border-border p-3">
          <p className="text-xs text-muted">Solve rate</p>
          <p className="mt-1 font-semibold text-foreground">
            {percent(scorecard.solveRate)}
          </p>
        </div>
        <div className="rounded-md border border-border p-3">
          <p className="text-xs text-muted">Average solve time</p>
          <p className="mt-1 font-semibold text-foreground">
            {scorecard.averageTimeToSolveMin === null
              ? "No timing data"
              : `${Math.round(scorecard.averageTimeToSolveMin)} min`}
          </p>
        </div>
      </div>

      <div className="mt-5">
        <h3 className="text-sm font-semibold text-foreground">
          Weakest measured topics
        </h3>
        {topics.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            No judged algorithm topics yet.
          </p>
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
    </section>
  );
}
