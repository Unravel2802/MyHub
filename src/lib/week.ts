import { addDays, format, startOfWeek } from "date-fns";

// The Monday-Sunday week boundary, as yyyy-MM-dd strings for comparing against
// plain date columns (occurrence_date, date).
//
// Lives in src/lib, not in a module: Dashboard's weekly cadence and Outreach's
// own cadence card ask the same question, and a second private copy is how the
// two drift into disagreeing about which week it is.
//
// format(), NOT toISOString(): toISOString converts through UTC, which shifts
// the boundary by a day in any zone that isn't UTC+0. format() reads the local
// wall-clock date, matching how taskRecurrence.ts computes the same boundary.
export function weekBounds(today: Date): {
  mondayStr: string;
  sundayStr: string;
} {
  const monday = startOfWeek(today, { weekStartsOn: 1 });
  const sunday = addDays(monday, 6);
  return {
    mondayStr: format(monday, "yyyy-MM-dd"),
    sundayStr: format(sunday, "yyyy-MM-dd"),
  };
}

/** Whether a yyyy-MM-dd date string falls in the Monday-start week of `today`. */
export function isInWeekOf(dateStr: string, today: Date): boolean {
  const { mondayStr, sundayStr } = weekBounds(today);
  return dateStr >= mondayStr && dateStr <= sundayStr;
}
