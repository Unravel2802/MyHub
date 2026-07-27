import { TrendingUp } from "lucide-react";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { Panel } from "@/src/components/ui/Panel";
import { formatCents } from "@/src/lib/money";
import type { EquityCurve } from "@/src/modules/trading/equityCurve";

const WIDTH = 640;
const HEIGHT = 220;
const PADDING = 24;

export function TradingEquityCurve({ curve }: { curve: EquityCurve }) {
  if (curve.points.length === 0) {
    return (
      <Panel title="Equity curve">
        <EmptyState
          compact
          description="Close a position to plot realised P&L over time."
          icon={TrendingUp}
          title="No realised trades yet"
        />
      </Panel>
    );
  }

  const values = [0, ...curve.points.map((point) => point.cumulativeCents)];
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const range = maximum - minimum || 1;
  const plotWidth = WIDTH - PADDING * 2;
  const plotHeight = HEIGHT - PADDING * 2;
  const coordinateFor = (value: number, index: number) => {
    const x =
      curve.points.length === 1
        ? WIDTH / 2
        : PADDING + (index / (curve.points.length - 1)) * plotWidth;
    const y = PADDING + ((maximum - value) / range) * plotHeight;
    return { x, y };
  };
  const coordinates = curve.points.map((point, index) =>
    coordinateFor(point.cumulativeCents, index),
  );
  const points = coordinates.map(({ x, y }) => `${x},${y}`).join(" ");
  const zeroY = PADDING + ((maximum - 0) / range) * plotHeight;
  const strokeClass =
    curve.finalCents > 0
      ? "stroke-success"
      : curve.finalCents < 0
        ? "stroke-danger"
        : "stroke-accent";

  return (
    <Panel
      aside={
        <span
          className={`text-sm font-semibold tabular-nums ${
            curve.finalCents > 0
              ? "text-success"
              : curve.finalCents < 0
                ? "text-danger"
                : "text-foreground"
          }`}
        >
          {formatCents(curve.finalCents)}
        </span>
      }
      description={
        curve.maxDrawdownCents === null
          ? undefined
          : `Max drawdown ${formatCents(curve.maxDrawdownCents)}`
      }
      title="Equity curve"
    >
      <svg
        aria-label={`Equity curve ending at ${formatCents(curve.finalCents)}`}
        className="h-auto w-full"
        role="img"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      >
        <line
          className="stroke-border"
          strokeDasharray="4 4"
          x1={PADDING}
          x2={WIDTH - PADDING}
          y1={zeroY}
          y2={zeroY}
        />
        <polyline
          className={`fill-none ${strokeClass}`}
          points={points}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="3"
        />
        {coordinates.map(({ x, y }, index) => (
          <circle
            className={`${strokeClass} fill-surface`}
            cx={x}
            cy={y}
            key={curve.points[index].tradeId}
            r="4"
            strokeWidth="2"
          />
        ))}
      </svg>
    </Panel>
  );
}
