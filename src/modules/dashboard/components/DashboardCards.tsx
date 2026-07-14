import { ProgressBar } from "@/src/components/ui/ProgressBar";
import type { TargetProgress } from "@/src/modules/prep/prepTargets";

export function TargetCard({
  label,
  target,
}: {
  label: string;
  target: TargetProgress;
}) {
  const met = target.actual >= target.target;
  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p
          className={`text-sm font-semibold ${met ? "text-accent-strong" : "text-foreground"}`}
        >
          {target.actual}/{target.target}
        </p>
      </div>
      <ProgressBar progress={target.progress} />
      <p className="mt-2 text-xs text-muted">
        {met
          ? `Target met (${Math.round(target.progress * 100)}%)`
          : `${Math.round(target.progress * 100)}% complete`}
      </p>
    </div>
  );
}

export function CadenceCard({
  label,
  count,
  target,
}: {
  label: string;
  count: number;
  target: { min: number; max?: number };
}) {
  const targetText = target.max
    ? `${target.min}-${target.max}`
    : `${target.min}+`;
  const status =
    count >= target.min ? "On target" : `${target.min - count} to go`;
  return (
    <div className="rounded-md border border-border bg-surface p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold text-foreground">{count}</p>
      <p className="mt-1 text-sm text-muted">Target {targetText} this week</p>
      <p
        className={`mt-3 text-xs font-medium ${count >= target.min ? "text-accent-strong" : "text-danger"}`}
      >
        {status}
      </p>
    </div>
  );
}
