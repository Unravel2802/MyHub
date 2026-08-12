import type { ReactNode } from "react";
import { cn } from "@/src/lib/cn";

interface StatTileProps {
  className?: string;
  label: ReactNode;
  progress?: number;
  suffix?: ReactNode;
  value: ReactNode;
}

export function StatTile({
  className,
  label,
  progress,
  suffix,
  value,
}: StatTileProps) {
  const percent = Math.min(100, Math.max(0, (progress ?? 0) * 100));

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-surface p-sm",
        className,
      )}
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
        {label}
      </p>
      <div className="mt-xs flex items-baseline gap-1 font-mono tabular-nums">
        <span className="text-2xl font-semibold leading-none tracking-[-0.03em] text-foreground">
          {value}
        </span>
        {suffix ? <span className="text-xs text-muted">{suffix}</span> : null}
      </div>
      {progress === undefined ? null : (
        <progress
          aria-label={`${String(label)} progress`}
          className="mt-xs block h-[3px] w-full appearance-none overflow-hidden rounded-full bg-border [&::-moz-progress-bar]:rounded-full [&::-moz-progress-bar]:bg-accent [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-border [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-accent"
          max={100}
          value={percent}
        />
      )}
    </div>
  );
}
