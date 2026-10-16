"use client";

import { useId, useState } from "react";
import { VisualBlockFrame } from "../components/VisualBlockFrame";
import { estimate, type EstimateInput } from "./estimate";

const verdictCopy = {
  partition:
    "Writes exceed one Postgres primary → partition, or a different store",
  cache: "Reads dominate → caching is the main lever",
  cdn: "Media dominates storage → object storage + CDN",
  egress: "Egress would pass $50k/month → the CDN pays for itself",
};

function compact(value: number): string {
  const scale =
    value >= 1e9
      ? ([1e9, "B"] as const)
      : value >= 1e6
        ? ([1e6, "M"] as const)
        : value >= 1e3
          ? ([1e3, "k"] as const)
          : ([1, ""] as const);
  return `${Number((value / scale[0]).toPrecision(2))}${scale[1]}`;
}
function bytes(value: number): string {
  const [size, unit] =
    value >= 1e15
      ? ([1e15, "PB"] as const)
      : value >= 1e12
        ? ([1e12, "TB"] as const)
        : ([1e9, "GB"] as const);
  return `${Number((value / size).toPrecision(2))} ${unit}`;
}

export default function EstimationCalculator() {
  const id = useId();
  const [input, setInput] = useState<EstimateInput>({
    dau: 1e8,
    postsPerUser: 2,
    feedOpensPerUser: 20,
    peakMultiplier: 5,
    mediaShare: 0.1,
  });
  const result = estimate(input);
  const controls = [
    {
      key: "dau",
      label: "Daily active users",
      min: 6,
      max: 9,
      step: 0.01,
      value: Math.log10(input.dau),
      display: compact(input.dau),
      decode: (value: number) => 10 ** value,
    },
    {
      key: "postsPerUser",
      label: "Posts per user per day",
      min: 0.5,
      max: 10,
      step: 0.5,
      value: input.postsPerUser,
      display: String(input.postsPerUser),
    },
    {
      key: "feedOpensPerUser",
      label: "Feed opens per user per day",
      min: 1,
      max: 50,
      step: 1,
      value: input.feedOpensPerUser,
      display: String(input.feedOpensPerUser),
    },
    {
      key: "peakMultiplier",
      label: "Peak ÷ average",
      min: 2,
      max: 10,
      step: 1,
      value: input.peakMultiplier,
      display: `${input.peakMultiplier}×`,
    },
    {
      key: "mediaShare",
      label: "Posts with a 2 MB image",
      min: 0,
      max: 50,
      step: 1,
      value: input.mediaShare * 100,
      display: `${Math.round(input.mediaShare * 100)}%`,
      decode: (value: number) => value / 100,
    },
  ] as const;
  const stats = [
    ["Peak writes", `${compact(result.peakWritesPerSec)}/s`],
    ["Peak reads", `${compact(result.peakReadsPerSec)} QPS`],
    ["Text storage / year, ×3", bytes(result.textStoragePerYearBytes)],
    ["Media / day", bytes(result.mediaPerDayBytes)],
  ];
  return (
    <VisualBlockFrame
      label="INTERACTIVE"
      title="Run the estimate yourself"
      caption="Starts at the chapter's numbers. Drag a slider and watch which architectural conclusions flip."
    >
      <div className="space-y-6 p-4 sm:p-5">
        <div className="grid gap-5 sm:grid-cols-2">
          {controls.map((control) => (
            <div className="min-w-0" key={control.key}>
              <div className="flex flex-wrap justify-between gap-2 text-sm">
                <label htmlFor={`${id}-${control.key}`} className="text-body">
                  {control.label}
                </label>
                <output
                  htmlFor={`${id}-${control.key}`}
                  className="font-mono tabular-nums text-[var(--track)]"
                >
                  {control.display}
                </output>
              </div>
              <input
                id={`${id}-${control.key}`}
                type="range"
                min={control.min}
                max={control.max}
                step={control.step}
                value={control.value}
                aria-valuetext={control.display}
                className="mt-3 block w-full accent-[var(--track)]"
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setInput((current) => ({
                    ...current,
                    [control.key]:
                      "decode" in control ? control.decode(value) : value,
                  }));
                }}
              />
            </div>
          ))}
        </div>
        <dl className="grid grid-cols-2 gap-3">
          {stats.map(([label, value]) => (
            <div
              key={label}
              className="min-w-0 rounded-lg border border-border bg-surface-subtle p-3"
            >
              <dt className="font-mono text-[11px] text-muted">{label}</dt>
              <dd className="mt-2 font-mono text-xl font-semibold tabular-nums text-foreground sm:text-2xl">
                {value}
              </dd>
            </div>
          ))}
        </dl>
        <ul className="space-y-3 text-sm">
          {result.verdicts.map((verdict) => (
            <li
              data-verdict={verdict.id}
              data-on={verdict.on}
              key={verdict.id}
              className={`flex gap-3 ${verdict.on ? "text-foreground" : "text-muted"}`}
            >
              <span
                aria-hidden
                className={`font-mono ${verdict.on ? "text-[var(--track)]" : "text-muted"}`}
              >
                {verdict.on ? "→" : "○"}
              </span>
              <span>{verdictCopy[verdict.id]}</span>
            </li>
          ))}
        </ul>
      </div>
    </VisualBlockFrame>
  );
}
