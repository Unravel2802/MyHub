import { describe, expect, it } from "vitest";
import { outreachCountThisWeek } from "@/src/modules/outreach/outreachCadence";
import type { OutreachEntry } from "@/src/modules/outreach/types";

function entry(overrides: Partial<OutreachEntry> & Pick<OutreachEntry, "id">) {
  return {
    contactName: null,
    companyId: null,
    channel: "linkedin" as const,
    date: "2026-07-15",
    notes: null,
    deletedAt: null,
    createdAt: "2026-07-15T00:00:00.000Z",
    updatedAt: "2026-07-15T00:00:00.000Z",
    ...overrides,
  };
}

// Wed 2026-07-15 => week runs Mon 07-13 .. Sun 07-19.
const WEDNESDAY = new Date("2026-07-15T12:00:00");

describe("outreachCountThisWeek", () => {
  it("counts entries inside the Monday-start week, inclusive of both ends", () => {
    const entries = [
      entry({ id: "mon", date: "2026-07-13" }),
      entry({ id: "wed", date: "2026-07-15" }),
      entry({ id: "sun", date: "2026-07-19" }),
    ];

    expect(outreachCountThisWeek(entries, WEDNESDAY)).toBe(3);
  });

  it("excludes the days just outside the week", () => {
    const entries = [
      entry({ id: "prev-sun", date: "2026-07-12" }),
      entry({ id: "next-mon", date: "2026-07-20" }),
    ];

    expect(outreachCountThisWeek(entries, WEDNESDAY)).toBe(0);
  });

  it("ignores soft-deleted entries", () => {
    const entries = [
      entry({ id: "live", date: "2026-07-15" }),
      entry({
        id: "gone",
        date: "2026-07-15",
        deletedAt: "2026-07-16T00:00:00.000Z",
      }),
    ];

    expect(outreachCountThisWeek(entries, WEDNESDAY)).toBe(1);
  });

  // The reason the schema has a `date` column separate from created_at:
  // logging Friday's chat on Sunday still belongs to Friday's week.
  it("counts by the conversation date, not when it was logged", () => {
    const entries = [
      entry({
        id: "backdated",
        date: "2026-07-15",
        createdAt: "2026-08-01T00:00:00.000Z",
      }),
    ];

    expect(outreachCountThisWeek(entries, WEDNESDAY)).toBe(1);
  });
});
