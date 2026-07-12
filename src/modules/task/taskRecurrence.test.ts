import { describe, expect, it } from "vitest";
import {
  missingOccurrences,
  occurrenceDateFor,
  occurrenceKey,
  type RecurrenceTemplate,
} from "@/src/modules/task/taskRecurrence";

// 2026-07-12 is a Sunday; the Monday-start week containing it runs
// Mon 2026-07-06 .. Sun 2026-07-12.
const SUNDAY = new Date("2026-07-12T09:00:00");
const WEDNESDAY = new Date("2026-07-08T09:00:00");
const MONDAY = new Date("2026-07-06T00:30:00");

describe("occurrenceDateFor", () => {
  it("maps each weekday to its date in the Monday-start week", () => {
    expect(occurrenceDateFor(1, WEDNESDAY)).toBe("2026-07-06"); // Monday
    expect(occurrenceDateFor(3, WEDNESDAY)).toBe("2026-07-08"); // Wednesday
    expect(occurrenceDateFor(6, WEDNESDAY)).toBe("2026-07-11"); // Saturday
  });

  // Sunday is getDay() === 0 but the LAST day of a Monday-start week. If this
  // regressed, Sunday's block would be dated to the previous week.
  it("puts Sunday at the end of the week, not the start", () => {
    expect(occurrenceDateFor(0, WEDNESDAY)).toBe("2026-07-12");
  });

  it("returns the same week for every day within that week", () => {
    for (const today of [MONDAY, WEDNESDAY, SUNDAY]) {
      expect(occurrenceDateFor(1, today)).toBe("2026-07-06");
      expect(occurrenceDateFor(0, today)).toBe("2026-07-12");
    }
  });

  it("rolls over to the next week's dates once the week turns", () => {
    const nextMonday = new Date("2026-07-13T09:00:00");
    expect(occurrenceDateFor(1, nextMonday)).toBe("2026-07-13");
    expect(occurrenceDateFor(0, nextMonday)).toBe("2026-07-19");
  });
});

describe("missingOccurrences", () => {
  const monday: RecurrenceTemplate = { id: "t-mon", weekday: 1 };
  const sunday: RecurrenceTemplate = { id: "t-sun", weekday: 0 };

  it("generates the whole week up front, not just today", () => {
    // Asked on Monday, Sunday's block is still owed — the Dashboard shows the
    // week ahead, so we don't wait until the day arrives.
    const pending = missingOccurrences([monday, sunday], new Set(), MONDAY);

    expect(pending).toEqual([
      { templateId: "t-mon", occurrenceDate: "2026-07-06" },
      { templateId: "t-sun", occurrenceDate: "2026-07-12" },
    ]);
  });

  it("is idempotent: a second load generates nothing", () => {
    const existing = new Set([occurrenceKey("t-mon", "2026-07-06")]);
    const pending = missingOccurrences([monday], existing, WEDNESDAY);

    expect(pending).toEqual([]);
  });

  it("does not resurrect an instance the user deleted this week", () => {
    // The repository passes soft-deleted instances in existingKeys precisely so
    // that dismissing this week's block keeps it dismissed.
    const existing = new Set([occurrenceKey("t-mon", "2026-07-06")]);

    expect(missingOccurrences([monday], existing, WEDNESDAY)).toEqual([]);
  });

  it("still generates next week after this week's instance exists", () => {
    const existing = new Set([occurrenceKey("t-mon", "2026-07-06")]);
    const nextWeek = new Date("2026-07-15T09:00:00");

    expect(missingOccurrences([monday], existing, nextWeek)).toEqual([
      { templateId: "t-mon", occurrenceDate: "2026-07-13" },
    ]);
  });

  it("returns nothing when there are no templates", () => {
    expect(missingOccurrences([], new Set(), MONDAY)).toEqual([]);
  });
});
