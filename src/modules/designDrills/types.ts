export type DesignDrillCategory = "system_design" | "ml_system_design";

export type DesignDrillDifficulty = "warmup" | "core" | "advanced";

// Self-assigned after the clock stops, against the rubric — mirrors the
// pass/needs_work shape Prep Tracker uses for non-algorithm entries, but named
// distinctly since a drill is scored against a fixed rubric, not a binary pass.
export type DesignDrillSelfRating = "strong" | "solid" | "weak";

// A single quantitative back-of-the-envelope figure. For design drills this is
// what replaces algorithmic Big-O: throughput, latency budgets, storage, cost.
export interface DrillEstimate {
  // e.g. "Write throughput", "Read latency p99", "Storage / yr", "Monthly cost".
  label: string;
  // e.g. "~12K rps", "<100 ms", "~40 TB", "~$8k". A short display string, not a
  // number — the unit and the "~" are part of the value.
  value: string;
  // Optional one-line basis for the figure ("100M writes/day, 10x peak"). Plain
  // text, not markdown.
  note?: string;
}

// One editorial section of a worked solution — the "Approach", a deep-dive, a
// "Tradeoffs" block. `id` is a stable slug used as the anchor target for the
// outline nav and for `#section` deep-links, so it must be URL-safe and unique
// within a drill.
export interface DrillSolutionSection {
  id: string;
  heading: string;
  // GFM markdown: prose, bullets, tables, fenced code. Rendered via the shared
  // `<Markdown>` component (XSS-safe, no raw HTML).
  body: string;
}

// The structured, LeetCode-editorial-style solution. `summary` is the intuition
// thesis shown up top; `sections` are the ordered editorial body; `estimates`
// is the quantitative panel; `references` is optional further reading.
export interface DrillSolution {
  summary: string;
  sections: DrillSolutionSection[];
  estimates: DrillEstimate[];
  references?: { label: string; url: string }[];
}

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
  // Legacy plain-text worked solution, rendered pre-wrap. Retained as the
  // fallback for any drill whose structured `solutionDetail` hasn't been
  // authored yet. Empty string means "not written yet".
  solution: string;
  // The structured editorial solution. Null ⇒ fall back to the plain-text
  // `solution` above. Always viewable (not gated behind finishing an attempt),
  // per the module's product call.
  solutionDetail: DrillSolution | null;
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
