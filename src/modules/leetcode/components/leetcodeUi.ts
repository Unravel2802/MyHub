import type {
  LeetCodeDifficulty,
  LeetCodeOutcome,
  LeetCodeStatus,
} from "@/src/modules/leetcode/types";

export const difficultyLabels: Record<LeetCodeDifficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

export const difficultyTones: Record<
  LeetCodeDifficulty,
  "success" | "accent" | "danger"
> = {
  easy: "success",
  medium: "accent",
  hard: "danger",
};

export const statusLabels: Record<LeetCodeStatus, string> = {
  to_review: "To review",
  in_progress: "In progress",
  solved: "Solved",
  needs_revisit: "Needs revisit",
};

export const outcomeLabels: Record<LeetCodeOutcome, string> = {
  solved: "Solved",
  partial: "Partial",
  failed: "Failed",
};

export const outcomeTones: Record<
  LeetCodeOutcome,
  "success" | "accent" | "danger"
> = {
  solved: "success",
  partial: "accent",
  failed: "danger",
};

export const inputClass =
  "h-10 min-w-0 w-full rounded-md border border-input bg-surface px-3 text-sm text-foreground outline-none focus:border-accent disabled:bg-surface-subtle";

export function parseTags(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  );
}
