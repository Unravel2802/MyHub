import { StatCard } from "@/src/components/ui/StatCard";
import { formatCents } from "@/src/lib/money";
import type { TradingStats } from "@/src/modules/trading/tradingStats";

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function pnlTone(cents: number | null): "default" | "success" | "danger" {
  if (cents === null || cents === 0) return "default";
  return cents > 0 ? "success" : "danger";
}

export function TradingStatsGrid({ stats }: { stats: TradingStats }) {
  return (
    <section aria-labelledby="trading-stats-heading">
      <h2
        className="text-sm font-semibold uppercase tracking-widest text-muted"
        id="trading-stats-heading"
      >
        Performance
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Closed trades" value={stats.closedTrades} />
        <StatCard
          hint={stats.winRate === null ? "No closed trades yet" : undefined}
          label="Win rate"
          value={stats.winRate === null ? "—" : percent(stats.winRate)}
        />
        <StatCard
          label="Total P&L"
          tone={pnlTone(stats.totalPnlCents)}
          value={formatCents(stats.totalPnlCents)}
        />
        <StatCard
          hint={
            stats.expectancyCents === null
              ? "No realised outcomes yet"
              : undefined
          }
          label="Expectancy"
          tone={pnlTone(stats.expectancyCents)}
          value={
            stats.expectancyCents === null
              ? "—"
              : formatCents(stats.expectancyCents)
          }
        />
        <StatCard
          hint={
            stats.averageWinCents === null ? "No winning trades yet" : undefined
          }
          label="Average win"
          tone={stats.averageWinCents === null ? "default" : "success"}
          value={
            stats.averageWinCents === null
              ? "—"
              : formatCents(stats.averageWinCents)
          }
        />
        <StatCard
          hint={
            stats.averageLossCents === null ? "No losing trades yet" : undefined
          }
          label="Average loss"
          tone={stats.averageLossCents === null ? "default" : "danger"}
          value={
            stats.averageLossCents === null
              ? "—"
              : formatCents(stats.averageLossCents)
          }
        />
        <StatCard
          hint={
            stats.profitFactor === null ? "Needs at least one loss" : undefined
          }
          label="Profit factor"
          value={
            stats.profitFactor === null ? "—" : stats.profitFactor.toFixed(2)
          }
        />
        <StatCard
          hint={
            stats.averageRMultiple === null ? "No measurable R yet" : undefined
          }
          label="Average R"
          value={
            stats.averageRMultiple === null
              ? "—"
              : `${stats.averageRMultiple.toFixed(2)}R`
          }
        />
        <StatCard
          hint={
            stats.ruleCompliance === null ? "No judged entries yet" : undefined
          }
          label="Rule compliance"
          value={
            stats.ruleCompliance === null ? "—" : percent(stats.ruleCompliance)
          }
        />
        <StatCard label="Days logged" value={stats.daysLogged} />
      </div>
    </section>
  );
}
