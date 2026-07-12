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

export const WEEKLY_SCHEDULE_SEED: WeeklyScheduleSeedEntry[] = [
  {
    weekday: 1,
    title: "Algorithms practice",
    description: "90 min. §14 sample week, Monday.",
  },
  {
    weekday: 1,
    title: "Backend / systems study",
    description: "60 min. §14 sample week, Monday.",
  },
  {
    weekday: 2,
    title: "Flagship project work",
    description: "90 min. §14 sample week, Tuesday.",
  },
  {
    weekday: 2,
    title: "RL sidecar project work",
    description: "60 min. §14 sample week, Tuesday.",
  },
  {
    weekday: 3,
    title: "Distributed systems / ML systems study",
    description: "90 min. §14 sample week, Wednesday.",
  },
  {
    weekday: 3,
    title: "Interview practice",
    description: "60 min. §14 sample week, Wednesday.",
  },
  {
    weekday: 4,
    title: "Project work",
    description: "2 hrs. §14 sample week, Thursday.",
  },
  {
    weekday: 4,
    title: "Technical writing",
    description: "30 min. §14 sample week, Thursday.",
  },
  {
    weekday: 5,
    title: "Applications",
    description: "60 min. §14 sample week, Friday.",
  },
  {
    weekday: 5,
    title: "Networking / mock interviews",
    description: "60 min. §14 sample week, Friday.",
  },
  {
    weekday: 6,
    title: "Deep engineering block",
    description:
      "3 hrs — one system-design case. §14 sample week, Saturday.",
  },
  {
    weekday: 0,
    title: "Weekly review",
    description: "§14 sample week, Sunday.",
  },
  {
    weekday: 0,
    title: "Resume / GitHub upkeep",
    description: "§14 sample week, Sunday.",
  },
];
