export type DesignDrillCategory = "system_design" | "ml_system_design";

export type DesignDrillDifficulty = "warmup" | "core" | "advanced";

// Self-assigned after the clock stops, against the rubric — mirrors the
// pass/needs_work shape Prep Tracker uses for non-algorithm entries, but named
// distinctly since a drill is scored against a fixed rubric, not a binary pass.
export type DesignDrillSelfRating = "strong" | "solid" | "weak";

export interface DesignDrill {
  id: string;
  slug: string;
  category: DesignDrillCategory;
  difficulty: DesignDrillDifficulty;
  title: string;
  // Markdown. The full prompt: scale, constraints, functional asks.
  prompt: string;
  // One bullet per array element — what a strong answer hits. Reveal only
  // after an attempt is submitted; showing it alongside the prompt defeats
  // the point of a timed practice rep.
  rubric: string[];
  // The full worked solution (markdown-ish plain text, rendered pre-wrap like
  // `prompt`). Unlike the rubric this is deliberately ALWAYS viewable — a
  // LeetCode-style reference tab, per the user's product call. Empty string
  // means "not written yet".
  solution: string;
  estimatedMinutes: number;
  tags: string[];
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DesignDrillAttempt {
  id: string;
  drillId: string;
  startedAt: string;
  // Null while the attempt is in progress.
  completedAt: string | null;
  durationSec: number | null;
  // The write-up / scratchpad itself, so past attempts stay reviewable.
  notes: string | null;
  // Indices into the drill's rubric bullets the user self-checked as covered —
  // a snapshot at submit time. Empty while in progress or if a submitted
  // attempt genuinely hit nothing.
  rubricHits: number[];
  selfRating: DesignDrillSelfRating | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
