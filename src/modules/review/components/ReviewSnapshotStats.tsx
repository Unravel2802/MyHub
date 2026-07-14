import { StatCard } from "@/src/components/ui/StatCard";
import type { WeeklyReviewSnapshot } from "@/src/modules/review/reviewLogic";

function targetLabel(target: { min: number; max?: number }) {
  return target.max ? `${target.min}-${target.max}` : `${target.min}`;
}

export function ReviewSnapshotStats({
  snapshot,
}: {
  snapshot: WeeklyReviewSnapshot | null;
}) {
  if (!snapshot) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <StatCard
        label="Applications"
        size="hero"
        value={snapshot.cadence.applications.count}
        hint={`Target ${targetLabel(snapshot.cadence.applications.target)}`}
      />
      <StatCard
        label="Outreach"
        value={snapshot.cadence.outreach.count}
        hint={`Target ${targetLabel(snapshot.cadence.outreach.target)}`}
      />
      <StatCard
        label="Mock interviews"
        value={snapshot.cadence.mockInterviews.count}
        hint={`Target ${targetLabel(snapshot.cadence.mockInterviews.target)}`}
      />
      <StatCard
        label="Algorithms"
        value={snapshot.scorecard.solved}
        hint={`${snapshot.scorecard.attempted} attempted`}
      />
      <StatCard
        label="System design"
        value={snapshot.scorecard.countsByType.system_design}
      />
      <StatCard
        label="Checkpoint"
        value={`${snapshot.checkpoint.algorithm.actual}/${snapshot.checkpoint.algorithm.target}`}
        hint={snapshot.checkpoint.checkpoint.label}
      />
    </div>
  );
}
