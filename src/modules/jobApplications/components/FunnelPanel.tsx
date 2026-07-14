import { StatCard } from "@/src/components/ui/StatCard";
import type { FunnelStats } from "@/src/modules/jobApplications/funnelStats";
import type { ApplicationStage } from "@/src/modules/jobApplications/types";

// `capitalize` on the raw enum rendered "oa" as "Oa". Acronyms don't survive a
// CSS text-transform — they need a label map.
const STAGE_LABELS: Record<ApplicationStage, string> = {
  researching: "Researching",
  applied: "Applied",
  oa: "OA",
  phone_screen: "Phone screen",
  onsite: "Onsite",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

function rate(value: number | null) {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

// Tint only when there's something to celebrate. A card showing "—" (no data)
// or 0% must never be tinted: it draws the eye to ABSENCE. This card was
// accent-tinted while displaying an em-dash — the same mistake already fixed on
// the achievements "Current streak: 0 days" card.
function toneFor(value: number | null) {
  return value !== null && value > 0
    ? ("success" as const)
    : ("default" as const);
}

export function FunnelPanel({ funnel }: { funnel: FunnelStats }) {
  return (
    <section aria-labelledby="funnel-heading" className="grid gap-3">
      <h2
        className="text-xl font-semibold tracking-tight text-foreground"
        id="funnel-heading"
      >
        Funnel snapshot
      </h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          hint={
            funnel.pastApplied === 0
              ? "No applications sent yet"
              : `of ${funnel.pastApplied} sent`
          }
          label="Response rate"
          tone={toneFor(funnel.responseRate)}
          value={rate(funnel.responseRate)}
        />
        <StatCard
          label="Interview rate"
          tone={toneFor(funnel.interviewRate)}
          value={rate(funnel.interviewRate)}
        />
        <StatCard
          label="Offer rate"
          tone={toneFor(funnel.offerRate)}
          value={rate(funnel.offerRate)}
        />
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4 lg:grid-cols-8">
        {(Object.entries(funnel.byStage) as [ApplicationStage, number][]).map(
          ([stage, count]) => (
            <div
              className="rounded-md border border-border bg-surface-subtle p-2 transition-colors duration-200 ease-in-out"
              key={stage}
            >
              <p className="text-xs uppercase tracking-widest text-muted">
                {STAGE_LABELS[stage]}
              </p>
              <p
                className={`mt-1 font-semibold tabular-nums ${
                  count > 0 ? "text-foreground" : "text-muted"
                }`}
              >
                {count}
              </p>
            </div>
          ),
        )}
      </div>
    </section>
  );
}
