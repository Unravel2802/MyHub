import type { HueName } from "@/src/components/moduleHues";
import type {
  LeetCodeDifficulty,
  LeetCodeOutcome,
  LeetCodeStatus,
} from "@/src/modules/leetcode/types";

export const LEETCODE_DIFFICULTY_HUES: Record<LeetCodeDifficulty, HueName> = {
  easy: "emerald",
  medium: "amber",
  hard: "rose",
};

export const LEETCODE_STATUS_HUES: Record<LeetCodeStatus, HueName> = {
  to_review: "cyan",
  in_progress: "amber",
  solved: "emerald",
  needs_revisit: "rose",
};

export const LEETCODE_OUTCOME_HUES: Record<LeetCodeOutcome, HueName> = {
  solved: "emerald",
  partial: "amber",
  failed: "rose",
};
