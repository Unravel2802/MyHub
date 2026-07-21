import { Star } from "lucide-react";
import { cn } from "@/src/lib/cn";

interface DrillBookmarkButtonProps {
  bookmarked: boolean;
  disabled: boolean;
  drillTitle: string;
  onToggle: () => void;
}

export function DrillBookmarkButton({
  bookmarked,
  disabled,
  drillTitle,
  onToggle,
}: DrillBookmarkButtonProps) {
  const label = bookmarked
    ? `Remove ${drillTitle} bookmark`
    : `Bookmark ${drillTitle}`;

  return (
    <button
      aria-label={label}
      aria-pressed={bookmarked}
      className={cn(
        "inline-flex size-10 shrink-0 items-center justify-center rounded-md border border-input bg-surface text-muted hover:border-input-hover hover:text-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:opacity-60",
        bookmarked && "border-accent-border text-accent-strong",
      )}
      disabled={disabled}
      onClick={onToggle}
      title={label}
      type="button"
    >
      <Star
        aria-hidden
        className={cn("size-4", bookmarked && "fill-current")}
      />
    </button>
  );
}
