import { addDays, format, startOfWeek } from "date-fns";

// Builds the calendar grid the activity heatmap renders (docs/color-refresh.md
// K2). Pure — takes the per-day counts from activityCounts and lays them out as
// GitHub-style week columns.
//
// This is the four-time timezone offender's territory (streaks, task archive,
// board stats, roadmap months), so every day is a local wall-clock key via
// format(), never `.toISOString().slice()`, and weeks start Monday to match
// weekBounds / taskRecurrence / the roadmap. One idea of "a day" and "a week"
// across the whole app.

export interface ActivityDay {
  key: string; // yyyy-MM-dd, local
  count: number;
  // 0-4: the emerald ramp bucket. 0 is an EMPTY day — rendered as bare surface,
  // never as green-0, because absence is not activity (the tint-on-nothing rule
  // that has already bitten three times).
  level: 0 | 1 | 2 | 3 | 4;
  // Days after `today` (this week has future cells) render as spacers, not as
  // empty-but-real days — you can't have failed to act on a day that hasn't
  // happened.
  future: boolean;
}

export interface ActivityGrid {
  // Column-major: weeks[w][d] where d is 0=Mon..6=Sun. The heatmap draws each
  // inner array as a vertical column.
  weeks: ActivityDay[][];
  total: number;
  activeDays: number;
}

const dayKey = (date: Date) => format(date, "yyyy-MM-dd");

// Counts map to a fixed ramp rather than a relative one: a "4" always means the
// same effort regardless of your best day, so the grid doesn't quietly re-scale
// and make a slow week look identical to a heavy one.
function levelFor(count: number): ActivityDay["level"] {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 5) return 3;
  return 4;
}

export function buildActivityGrid(
  counts: Map<string, number>,
  from: Date,
  today: Date,
): ActivityGrid {
  // Start on the Monday of `from`'s week so the top row is always Monday, even
  // when the roadmap began mid-week.
  const gridStart = startOfWeek(from, { weekStartsOn: 1 });
  const todayKey = dayKey(today);

  const weeks: ActivityDay[][] = [];
  let total = 0;
  let activeDays = 0;

  let cursor = gridStart;
  // Include the whole week that contains `today` — its remaining days become
  // future spacers.
  const lastDay = addDays(startOfWeek(today, { weekStartsOn: 1 }), 6);

  while (cursor <= lastDay) {
    const week: ActivityDay[] = [];
    for (let d = 0; d < 7; d++) {
      const key = dayKey(cursor);
      const future = key > todayKey;
      const count = future ? 0 : (counts.get(key) ?? 0);
      if (count > 0) {
        total += count;
        activeDays += 1;
      }
      week.push({ key, count, level: future ? 0 : levelFor(count), future });
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
  }

  return { weeks, total, activeDays };
}
