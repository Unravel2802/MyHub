"use client";

import { PiggyBank } from "lucide-react";
import { Panel } from "@/src/components/ui/Panel";
import { StatCard } from "@/src/components/ui/StatCard";
import { formatCents } from "@/src/lib/money";
import { SavingsEditor } from "@/src/modules/finance/components/SavingsEditor";

export interface Runway {
  months: number;
  avgMonthlyBurnCents: number;
}

interface RunwayPanelProps {
  runway: Runway | null;
  currentSavingsCents: number | null;
  onSaveSavings: (currentSavingsCents: number) => Promise<void>;
}

export function RunwayPanel({
  runway,
  currentSavingsCents,
  onSaveSavings,
}: RunwayPanelProps) {
  return (
    <Panel
      description="A projection from current savings and completed-month net burn."
      overline="Cash cushion"
      title="Runway"
    >
      <StatCard
        hint={
          runway
            ? `${formatCents(runway.avgMonthlyBurnCents)} average monthly burn`
            : "No completed-month burn to project."
        }
        hue={runway && runway.months > 0 ? "lime" : undefined}
        label="Estimated runway"
        value={runway ? `${runway.months.toFixed(1)} months` : "—"}
      />
      <div className="mt-4 rounded-lg border border-border bg-surface-subtle p-4">
        <div className="mb-3 flex items-center gap-2">
          <PiggyBank aria-hidden="true" className="size-5 text-muted" />
          <p className="font-medium text-foreground">Savings balance</p>
        </div>
        {/* Keyed on the stored value so the editor re-seeds its input when the
            save lands, instead of holding the text the user typed. */}
        <SavingsEditor
          currentSavingsCents={currentSavingsCents}
          key={currentSavingsCents ?? "loading"}
          onSubmit={onSaveSavings}
        />
      </div>
    </Panel>
  );
}
