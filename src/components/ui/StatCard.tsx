import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "accent" | "danger";
}

const toneClasses = {
  default: "text-foreground",
  accent: "text-accent-strong",
  danger: "text-danger",
} as const;

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: StatCardProps) {
  return (
    <div className="rounded-lg border border-border bg-surface-subtle px-4 py-3">
      <p className="text-xs font-medium uppercase text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${toneClasses[tone]}`}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
