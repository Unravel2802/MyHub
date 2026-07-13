import { StatCard } from "@/src/components/ui/StatCard";
import type { FunnelStats } from "@/src/modules/jobApplications/funnelStats";

function rate(value: number | null) {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

export function FunnelPanel({ funnel }: { funnel: FunnelStats }) {
  return (
    <section aria-labelledby="funnel-heading" className="grid gap-3">
      <h2 className="text-xl font-semibold text-foreground" id="funnel-heading">
        Funnel snapshot
      </h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Response rate" value={rate(funnel.responseRate)} />
        <StatCard label="Interview rate" value={rate(funnel.interviewRate)} />
        <StatCard
          label="Offer rate"
          value={rate(funnel.offerRate)}
          tone="accent"
        />
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4 lg:grid-cols-8">
        {Object.entries(funnel.byStage).map(([stage, count]) => (
          <div
            className="rounded-md border border-border bg-surface-subtle p-2"
            key={stage}
          >
            <p className="text-xs capitalize text-muted">
              {stage.replaceAll("_", " ")}
            </p>
            <p className="mt-1 font-semibold text-foreground">{count}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
