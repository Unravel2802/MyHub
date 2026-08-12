import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/src/lib/cn";

interface TaskCardProps {
  accentClassName?: string;
  checked?: boolean;
  className?: string;
  disabled?: boolean;
  label: ReactNode;
  meta?: ReactNode;
  onComplete?: () => void;
}

export function TaskCard({
  accentClassName = "bg-accent",
  checked = false,
  className,
  disabled = false,
  label,
  meta,
  onComplete,
}: TaskCardProps) {
  return (
    <article
      className={cn(
        "flex items-start gap-3 rounded-lg border border-border bg-surface p-sm",
        (checked || disabled) && "opacity-60",
        className,
      )}
    >
      <button
        aria-label="Mark complete"
        aria-pressed={checked}
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full border border-input bg-transparent text-primary-foreground hover:border-input-hover disabled:cursor-default",
          checked && "border-accent bg-accent",
        )}
        disabled={disabled || checked}
        onClick={onComplete}
        type="button"
      >
        {checked ? <Check aria-hidden="true" className="size-3" /> : null}
      </button>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-sm font-medium leading-snug text-foreground",
            checked && "line-through",
          )}
        >
          {label}
        </p>
        {meta ? <div className="mt-1 text-xs text-muted">{meta}</div> : null}
      </div>
      <span
        aria-hidden="true"
        className={cn("mt-1.5 size-2 shrink-0 rounded-full", accentClassName)}
      />
    </article>
  );
}
