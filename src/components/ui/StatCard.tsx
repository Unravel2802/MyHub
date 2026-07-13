import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "accent" | "success" | "danger";
}

// Tone tints the container as well as the number. A dense grid of tiles is
// scanned peripherally — a coloured digit alone is easy to miss, whereas a
// tinted card reads at a glance, which is the whole job of a stat tile.
// Kept SUBTLE: these sit many-to-a-screen, and a saturated fill would turn a
// dashboard into a stoplight.
const toneClasses = {
  default: "border-border bg-surface-subtle",
  accent: "border-accent-border bg-accent-surface",
  success: "border-success-border bg-success-surface",
  danger: "border-danger-border bg-danger-surface",
} as const;

const valueClasses = {
  default: "text-foreground",
  accent: "text-accent-strong",
  success: "text-success",
  danger: "text-danger",
} as const;

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: StatCardProps) {
  return (
    <div
      className={`rounded-lg border px-4 py-3 transition-colors ${toneClasses[tone]}`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </p>
      {/* tabular-nums so a value ticking 9 -> 10 doesn't shift the tile's width */}
      <p
        className={`mt-1 text-2xl font-semibold tabular-nums ${valueClasses[tone]}`}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
