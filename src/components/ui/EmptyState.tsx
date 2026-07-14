import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  // Sell the NEXT ACTION, tied to the roadmap. Not "No prep sessions logged
  // yet." — that's a shrug, and it's the default state of the one feature whose
  // entire job is motivation. Say what logging one actually gets you.
  description: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center rounded-lg border border-dashed border-border text-center ${compact ? "px-3 py-4" : "px-6 py-10"}`}
    >
      {icon ? (
        <div aria-hidden className="mb-3 text-3xl">
          {icon}
        </div>
      ) : null}
      <p className="font-semibold tracking-tight text-foreground">{title}</p>
      <p className="mt-1 max-w-sm text-sm leading-relaxed text-muted">
        {description}
      </p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
