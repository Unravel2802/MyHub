// The achievement catalog (myhub_plan.md Part B, Phase 5).
//
// Two rules this file exists to enforce, both locked decisions:
//
//   1. NO XP, NO LEVELS. Every achievement is a discrete, named thing you did.
//      An abstract points total would be a number the roadmap never asked for,
//      and optimizing it would mean optimizing something other than getting
//      hired.
//   2. EVERY NUMBER TRACES TO engineering_first_roadmap_v2.md. If a threshold
//      here can't be pointed at a section of the roadmap, it doesn't belong —
//      the whole value of this module is that hitting a milestone in the app
//      means something real, not that a designer thought 25 was a nice number.
//      The `source` field below is that traceability, kept in the data rather
//      than in a comment so it can't drift out of sight.

export type AchievementCategory = "prep" | "career" | "consistency";

export interface Achievement {
  key: string;
  title: string;
  description: string;
  category: AchievementCategory;
  // Which part of the roadmap this number comes from. Not rendered as-is
  // necessarily, but it's the receipt.
  source: string;
}

export const ACHIEVEMENTS = [
  // --- Prep: algorithms (§6.5 December 75-100; February 150) -----------------
  {
    key: "first_prep_entry",
    title: "First Rep",
    description: "Log your first prep session.",
    category: "prep",
    source: "§6 — the habit starts somewhere",
  },
  {
    key: "algorithms_10",
    title: "Warming Up",
    description: "Solve 10 algorithm problems.",
    category: "prep",
    source: "§6.5 — on the way to December's 75",
  },
  {
    key: "algorithms_50",
    title: "Halfway to December",
    description: "Solve 50 algorithm problems.",
    category: "prep",
    source: "§6.5 — December target is 75-100",
  },
  {
    key: "algorithms_75",
    title: "December Baseline",
    description: "Solve 75 algorithm problems — the December floor.",
    category: "prep",
    source: "§6.5 — December semester review, lower bound",
  },
  {
    key: "algorithms_100",
    title: "December Ceiling",
    description: "Solve 100 algorithm problems — the top of the December range.",
    category: "prep",
    source: "§6.5 — December semester review, upper bound",
  },
  {
    key: "algorithms_150",
    title: "February Target",
    description: "Solve 150 algorithm problems.",
    category: "prep",
    source: "§6.5 — technical targets by end of February",
  },

  // --- Prep: design + mocks (§6.5) -------------------------------------------
  {
    key: "system_design_6",
    title: "System Design: December",
    description: "Complete 6 system design sessions.",
    category: "prep",
    source: "§6.5 — December target",
  },
  {
    key: "system_design_10",
    title: "System Design: February",
    description: "Complete 10 system design sessions.",
    category: "prep",
    source: "§6.5 — February target",
  },
  {
    key: "ml_system_design_5",
    title: "ML Systems",
    description: "Complete 5 ML system design sessions.",
    category: "prep",
    source: "§6.5 — February target",
  },
  {
    key: "first_mock",
    title: "Into the Ring",
    description: "Complete your first mock interview.",
    category: "prep",
    source: "§11.2 — weekly mock cadence begins",
  },
  {
    key: "mocks_14",
    title: "Full Mock Slate",
    description:
      "Complete 14 mock interviews — December's 6 coding + 6 system design + 2 ML.",
    category: "prep",
    source: "§6.5 — December mock targets, summed",
  },
  {
    key: "behavioral_stories_8",
    title: "Story Bank",
    description:
      "Write 8 behavioral stories with concise and extended versions.",
    category: "prep",
    source: "§6.5 — February behavioral target",
  },

  // --- Career: the pipeline (§11.2) ------------------------------------------
  {
    key: "first_application",
    title: "In the Game",
    description: "Log your first job application.",
    category: "career",
    source: "§11.2 — the pipeline opens",
  },
  {
    key: "applications_10",
    title: "Pipeline Building",
    description: "Log 10 job applications.",
    category: "career",
    source: "§11.2 — 5-10 applications per week",
  },
  {
    key: "applications_50",
    title: "Volume Game",
    description: "Log 50 job applications.",
    category: "career",
    source: "§11.2 — sustained weekly application cadence",
  },
  {
    key: "first_outreach",
    title: "Reaching Out",
    description: "Log your first outreach conversation.",
    category: "career",
    source: "§11.2 — 2-3 outreach conversations per week",
  },
  {
    key: "first_interview",
    title: "They Called Back",
    description: "Reach your first real interview.",
    category: "career",
    source: "§11.2 — the funnel converts",
  },
  {
    key: "post_mortem_24h",
    title: "Fresh Post-Mortem",
    description:
      "Write an interview post-mortem within 24 hours of the interview.",
    category: "career",
    source: "§11.2 — the 24-hour post-mortem habit",
  },

  // --- Consistency: streaks and cadence --------------------------------------
  {
    key: "perfect_cadence_week",
    title: "Perfect Week",
    description:
      "Hit every weekly target in one week: 5+ applications, 2+ outreach, 1+ mock.",
    category: "consistency",
    source: "§11.2 — the three weekly cadence targets",
  },
  {
    key: "gate_complete",
    title: "Gate Cleared",
    description: "Finish every item on a monthly gate checklist.",
    category: "consistency",
    source: "§14 — monthly gates",
  },
  {
    key: "streak_7",
    title: "One Week Lit",
    description: "Stay active 7 days in a row.",
    category: "consistency",
    source: "§14 — the daily habit is the whole engine",
  },
  {
    key: "streak_30",
    title: "One Month Lit",
    description: "Stay active 30 days in a row.",
    category: "consistency",
    source: "§14 — the daily habit is the whole engine",
  },
  {
    key: "streak_100",
    title: "Hundred Days",
    description: "Stay active 100 days in a row.",
    category: "consistency",
    source: "§14 — the daily habit is the whole engine",
  },
] as const satisfies readonly Achievement[];

export type AchievementKey = (typeof ACHIEVEMENTS)[number]["key"];

export const ACHIEVEMENTS_BY_KEY: Record<AchievementKey, Achievement> =
  Object.fromEntries(
    ACHIEVEMENTS.map((achievement) => [achievement.key, achievement]),
  ) as Record<AchievementKey, Achievement>;

export const ACHIEVEMENT_COUNT = ACHIEVEMENTS.length;
