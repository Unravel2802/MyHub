"use client";

import { useId, useState } from "react";
import {
  formatChartRange,
  formatChartValue,
  parseChartBlock,
  type ChartSpec,
} from "../chartBlock";
import { CHART_DIMENSIONS, chartAxisTitle, chartLayout } from "../chartLayout";
import { Figure } from "./Figure";
import { VisualBlockFrame } from "./VisualBlockFrame";

function barPath(start: number, end: number, y: number): string {
  const direction = end < start ? -1 : 1;
  const edge = Math.abs(end - start) < 2 ? start + direction * 2 : end;
  const radius = Math.min(4, Math.abs(edge - start));
  const height = CHART_DIMENSIONS.barHeight;
  return `M ${start} ${y} H ${edge - direction * radius} Q ${edge} ${y} ${edge} ${y + radius} V ${y + height - radius} Q ${edge} ${y + height} ${edge - direction * radius} ${y + height} H ${start} Z`;
}

function BarChart({ spec }: { spec: ChartSpec }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const tooltipId = useId();
  const active = focused ?? hovered;
  const layout = chartLayout(spec);
  const {
    left,
    plotWidth: width,
    top,
    rowHeight,
    viewBoxWidth,
    fontSize,
    minWidth,
    barHeight,
  } = CHART_DIMENSIONS;
  const bottom = top + spec.rows.length * rowHeight;
  const height = bottom + 62;
  const x = (value: number) => left + layout.ratio(value) * width;
  const baseline = left + layout.baseline * width;
  const label = (index: number) =>
    `${spec.rows[index].label}: ${formatChartRange(spec.rows[index].low, spec.rows[index].high, spec.unit)}`;
  const row = active === null ? null : spec.rows[active];
  const axisTitle = chartAxisTitle(spec.unit);
  return (
    <>
      <div className="overflow-x-auto p-3">
        <svg
          viewBox={`0 0 ${viewBoxWidth} ${height}`}
          className="w-full font-mono"
          style={{ minWidth, fontSize }}
          role="img"
          aria-label={spec.rows.map((_, index) => label(index)).join("; ")}
        >
          {layout.ticks.map((value) => (
            <g key={value}>
              <line
                x1={x(value)}
                x2={x(value)}
                y1={top - 4}
                y2={bottom}
                stroke="var(--border)"
              />
              <text
                x={x(value)}
                y={bottom + 22}
                textAnchor="middle"
                fill="var(--muted)"
              >
                {formatChartValue(value, spec.unit)}
              </text>
            </g>
          ))}
          <line
            x1={baseline}
            x2={baseline}
            y1={top - 4}
            y2={bottom}
            stroke="var(--muted)"
          />
          {spec.rows.map((entry, index) => {
            const y = top + index * rowHeight;
            const end = x(entry.low);
            const rangeEnd = x(entry.high);
            const highlighted = spec.highlight === entry.label;
            const color = highlighted ? "var(--hue-amber)" : "var(--track)";
            const rangeColor = highlighted
              ? "var(--hue-amber-border)"
              : "var(--track-border)";
            return (
              <g
                key={`${entry.label}-${index}`}
                data-chart-row
                tabIndex={0}
                role="group"
                aria-label={label(index)}
                aria-describedby={active === index ? tooltipId : undefined}
                style={{ outline: "none" }}
                onMouseEnter={() => setHovered(index)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setFocused(index)}
                onBlur={() => setFocused(null)}
              >
                <rect
                  x="0"
                  y={y - 2}
                  width={viewBoxWidth - 4}
                  height={rowHeight - 2}
                  rx="4"
                  fill={
                    active === index ? "var(--surface-subtle)" : "transparent"
                  }
                  stroke={focused === index ? "var(--track)" : "transparent"}
                />
                <text
                  x={left - 12}
                  y={y + 19}
                  textAnchor="end"
                  fill="var(--body)"
                >
                  {entry.label}
                </text>
                {entry.low === entry.high ? (
                  <path d={barPath(baseline, end, y + 4)} fill={color} />
                ) : (
                  <>
                    <rect
                      x={Math.min(baseline, end)}
                      y={y + 4}
                      width={Math.abs(end - baseline)}
                      height={barHeight}
                      fill={color}
                    />
                    <path d={barPath(end, rangeEnd, y + 4)} fill={rangeColor} />
                  </>
                )}
                <text
                  x={Math.max(end, rangeEnd, baseline) + 8}
                  y={y + 19}
                  fill="var(--foreground)"
                  fontWeight="600"
                >
                  {formatChartRange(entry.low, entry.high, spec.unit)}
                </text>
              </g>
            );
          })}
          {axisTitle && (
            <text x={left} y={height - 8} fill="var(--muted)">
              {axisTitle}
            </text>
          )}
        </svg>
      </div>
      <div className="min-h-9 px-4 pb-3 font-mono text-xs text-body">
        {row && (
          <div id={tooltipId} role="tooltip">
            {label(active!)}
            {spec.scale === "log"
              ? ` · ${formatChartRange(row.low / spec.rows[0].low, row.high / spec.rows[0].low, null)}× the first row`
              : ""}
          </div>
        )}
      </div>
      <table className="sr-only">
        <caption>{spec.title ?? "Chart data"}</caption>
        <thead>
          <tr>
            <th scope="col">Label</th>
            <th scope="col">Value</th>
          </tr>
        </thead>
        <tbody>
          {spec.rows.map((entry, index) => (
            <tr key={index}>
              <th scope="row">{entry.label}</th>
              <td>{formatChartRange(entry.low, entry.high, spec.unit)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

export function ChartBlock({ raw, caption }: { raw: string; caption: string }) {
  const parsed = parseChartBlock(raw);
  if (!parsed.ok)
    return (
      <div>
        <p className="text-sm text-danger">Chart error: {parsed.error}</p>
        <Figure raw={raw} caption={caption} />
      </div>
    );
  return (
    <VisualBlockFrame
      label="CHART"
      title={parsed.spec.title ?? caption}
      caption={parsed.spec.caption}
      raw={raw}
    >
      <BarChart spec={parsed.spec} />
    </VisualBlockFrame>
  );
}
