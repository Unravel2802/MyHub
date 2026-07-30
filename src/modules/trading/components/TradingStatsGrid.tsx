import type { ReactNode } from "react";
import { StatCard } from "@/src/components/ui/StatCard";
import { formatCents } from "@/src/lib/money";
import type { TradingStats } from "@/src/modules/trading/tradingStats";

interface NumericStatCardProps {
  absent?: boolean;
  format?: (value: number) => ReactNode;
  hint?: ReactNode;
  label: string;
  size?: "default" | "hero";
  tone?: "default" | "accent" | "success" | "danger";
  value: number | null;
  whenAbsent?: ReactNode;
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function pnlTone(cents: number | null): "default" | "success" | "danger" {
  if (cents === null || cents === 0) return "default";
  return cents > 0 ? "success" : "danger";
}

function NumericStatCard({
  absent,
  format,
  hint,
  label,
  size,
  tone,
  value,
  whenAbsent,
}: NumericStatCardProps) {
  return (
    <StatCard
      absent={absent}
      hint={hint}
      label={label}
      size={size}
      tone={tone}
      value={value === null ? null : format ? format(value) : value}
      whenAbsent={whenAbsent}
    />
  );
}

export function TradingStatsHero({ stats }: { stats: TradingStats }) {
  // Total P&L is a sum over closed trades, so zero closed trades forces it to
  // 0 whether or not you've made a decision worth measuring — the same
  // "sentence styled as a statistic" the Dashboard's hero was flagged for
  // (docs/ui-upgrade-wave3.md §2.2), just arriving through arithmetic instead
  // of an empty API response. StatCard's own null/zero detection can't see
  // this: it only gets the pre-formatted string "$0.00", not the trade count
  // that makes this particular zero vacuous rather than measured. `absent`
  // is the escape hatch built for exactly that gap — say so explicitly, using
  // the context StatCard doesn't have. Once there IS a closed trade, a real
  // $0.00 (a breakeven result) renders as ordinary full-weight data, tinted
  // and gradiented like any other measured value.
  const noTradesYet = stats.closedTrades === 0;
  return (
    <NumericStatCard
      absent={noTradesYet}
      format={formatCents}
      label="Total P&L"
      size="hero"
      tone={pnlTone(stats.totalPnlCents)}
      value={stats.totalPnlCents}
      whenAbsent="Log your first trade"
    />
  );
}

export function tradingSecondaryStats(stats: TradingStats): ReactNode[] {
  return [
    <StatCard
      key="closed-trades"
      label="Closed trades"
      value={stats.closedTrades}
    />,
    <NumericStatCard
      format={formatCents}
      hint={
        stats.expectancyCents === null ? "No realised outcomes yet" : undefined
      }
      key="expectancy"
      label="Expectancy"
      tone={pnlTone(stats.expectancyCents)}
      value={stats.expectancyCents}
    />,
    <NumericStatCard
      format={(value) => `${value.toFixed(2)}R`}
      hint={stats.averageRMultiple === null ? "No measurable R yet" : undefined}
      key="average-r"
      label="Average R"
      value={stats.averageRMultiple}
    />,
    <NumericStatCard
      format={percent}
      hint={stats.ruleCompliance === null ? "No judged entries yet" : undefined}
      key="rule-compliance"
      label="Rule compliance"
      value={stats.ruleCompliance}
    />,
  ];
}

export function TradingEquityStats({ stats }: { stats: TradingStats }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <NumericStatCard
        format={percent}
        hint={stats.winRate === null ? "No closed trades yet" : undefined}
        label="Win rate"
        value={stats.winRate}
      />
      <NumericStatCard
        format={(value) => value.toFixed(2)}
        hint={
          stats.profitFactor === null ? "Needs at least one loss" : undefined
        }
        label="Profit factor"
        value={stats.profitFactor}
      />
    </div>
  );
}

export function TradingPositionStats({ stats }: { stats: TradingStats }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <NumericStatCard
        format={formatCents}
        hint={
          stats.averageWinCents === null ? "No winning trades yet" : undefined
        }
        label="Average win"
        tone="success"
        value={stats.averageWinCents}
      />
      <NumericStatCard
        format={formatCents}
        hint={
          stats.averageLossCents === null ? "No losing trades yet" : undefined
        }
        label="Average loss"
        tone="danger"
        value={stats.averageLossCents}
      />
      <StatCard label="Days logged" value={stats.daysLogged} />
    </div>
  );
}
