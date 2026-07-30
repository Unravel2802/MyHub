import type { ButtonHTMLAttributes } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/src/lib/cn";

export type RefreshButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> & {
  /** Visual variant: 'text' (default, majority pattern) or 'icon' (for tight spaces). */
  variant?: "text" | "icon";
  /** Button text label when variant === 'text'. Defaults to "Refresh". */
  label?: string;
  /** Accessible label. Defaults to label (or "Refresh") when variant === 'icon'. */
  ariaLabel?: string;
  /** True when a refresh operation is currently in progress. */
  isRefreshing?: boolean;
};

export function RefreshButton({
  variant = "text",
  label = "Refresh",
  ariaLabel,
  isRefreshing = false,
  disabled,
  className,
  type = "button",
  ...props
}: RefreshButtonProps) {
  const isDisabled = disabled || isRefreshing;
  const effectiveAriaLabel =
    ariaLabel ??
    (props["aria-label"] || (variant === "icon" ? label : undefined));

  if (variant === "icon") {
    return (
      <button
        type={type}
        aria-label={effectiveAriaLabel || label}
        disabled={isDisabled}
        className={cn(
          "inline-flex size-10 items-center justify-center rounded-md border border-input bg-surface text-body transition-colors hover:border-input-hover hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60",
          className,
        )}
        {...props}
      >
        <RefreshCw
          aria-hidden="true"
          className={cn("size-4", isRefreshing && "animate-spin")}
        />
      </button>
    );
  }

  return (
    <button
      type={type}
      aria-label={effectiveAriaLabel}
      disabled={isDisabled}
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-md border border-input bg-surface px-4 text-sm font-medium text-body transition-colors hover:border-input-hover hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    >
      <RefreshCw
        aria-hidden="true"
        className={cn("size-4 shrink-0", isRefreshing && "animate-spin")}
      />
      <span>{label}</span>
    </button>
  );
}
