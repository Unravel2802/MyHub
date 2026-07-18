// Weekly schedule seed data (engineering_first_roadmap_v2.md §14's sample
// week). Pure data, no DB access — the seed script (Codex's, see
// docs/handoff/seed-scripts.md) reads this and calls
// TaskRepository.createTask({ recursWeekly: true, weekday, title,
// description }) once per entry.
//
// 0 = Sunday, matching Date.getDay() and Task Engine's Weekday type — see
// src/modules/task/types.ts.

export interface WeeklyScheduleSeedEntry {
  weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  title: string;
  description: string;
}

// Internship-adjusted week (was engineering_first_roadmap_v2.md §14's
// full-throttle sample week). A weekday internship carries most of the day, so
// weekday evenings get a single focused ~45-60 min block and the heavier study
// / deep-work shifts to the weekend. Friday is a deliberate rest night. Tune
// the titles, minutes, and weekdays freely — this is just a starting shape.
export const WEEKLY_SCHEDULE_SEED: WeeklyScheduleSeedEntry[] = [
  {
    weekday: 1,
    title: "Algorithms practice",
    description: "45 min. Internship-week: one weekday evening block.",
  },
  {
    weekday: 2,
    title: "Flagship project work",
    description: "60 min. Internship-week: one weekday evening block.",
  },
  {
    weekday: 3,
    title: "Interview practice",
    description: "45 min. Internship-week: one weekday evening block.",
  },
  {
    weekday: 4,
    title: "Applications",
    description: "45 min. Keep the job-search moving on a weekday.",
  },
  // Friday: intentionally no block — a recovery night during internship weeks.
  {
    weekday: 6,
    title: "Deep engineering block",
    description: "2.5 hrs — one system-design case. Weekend carries the depth.",
  },
  {
    weekday: 6,
    title: "Backend / systems study",
    description: "60 min. Saturday, moved off the weekday load.",
  },
  {
    weekday: 0,
    title: "Weekly review",
    description: "Sunday reflection + plan the coming week.",
  },
  {
    weekday: 0,
    title: "Project catch-up (flagship / RL sidecar)",
    description: "90 min. Sunday, to make up for lighter weekdays.",
  },
  {
    weekday: 0,
    title: "Resume / GitHub upkeep",
    description: "30 min. Sunday.",
  },
];
