"use client";

import { useEffect, useState } from "react";
import { hueVar, type HueName } from "@/src/components/moduleHues";

type ProgressBarProps = {
  progress: number;
  hue?: HueName;
};

const hueClasses: Record<HueName, string> = {
  accent: "bg-accent",
  amber: "bg-hue-amber",
  orange: "bg-hue-orange",
  rose: "bg-hue-rose",
  violet: "bg-hue-violet",
  blue: "bg-hue-blue",
  cyan: "bg-hue-cyan",
  teal: "bg-hue-teal",
  emerald: "bg-hue-emerald",
  fuchsia: "bg-hue-fuchsia",
};

export function ProgressBar({ progress, hue }: ProgressBarProps) {
  // The FILL clamps to 0-100%, but `progress` itself is deliberately uncapped
  // upstream (prepTargets lets it exceed 1 so "180/150" and "150/150" read
  // differently). Clamping here only stops the bar overflowing its track.
  const percent = Math.min(100, Math.max(0, progress * 100));

  // Mount at 0 and set the real width after paint, so the transition below
  // actually FIRES. It never did: the bar mounted already at its final width,
  // so there was nothing to animate from — a transition that had been dead code
  // since it was written.
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setWidth(percent));
    return () => cancelAnimationFrame(frame);
  }, [percent]);

  const started = percent > 0;

  return (
    <div
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={Math.round(percent)}
      className="h-2 w-full overflow-hidden rounded-full bg-surface-subtle"
      role="progressbar"
    >
      {started ? (
        <div
          // motion-reduce disables the sweep for anyone who's asked the OS for
          // less animation.
          className={`hue-progress h-full rounded-full ${hue ? hueClasses[hue] : "bg-accent"} transition-[width] duration-700 ease-out motion-reduce:transition-none`}
          style={{
            ["--hue" as string]: hueVar(hue ?? "accent"),
            width: `${width}%`,
          }}
        />
      ) : (
        // At 0% a plain empty track reads as BROKEN, not as "not started" —
        // which on a fresh account is every progress bar on the page, on the one
        // feature meant to motivate. A faint accent seed says "this is a bar,
        // and it's waiting for you".
        <div aria-hidden className="h-full w-1.5 rounded-full bg-accent/30" />
      )}
    </div>
  );
}
