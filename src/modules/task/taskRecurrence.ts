import { addDays, format, startOfWeek } from "date-fns";
import type { Task, Weekday } from "@/src/modules/task/types";

// Pure domain logic for minimal weekly recurrence (myhub_plan.md Part A §A.2).
// No DB access: the repository supplies the templates and the set of occurrences
// that already exist, and this decides which ones are missing.

export interface RecurrenceTemplate {
  id: string;
  weekday: Weekday;
}

export interface PendingOccurrence {
  templateId: string;
  // yyyy-MM-dd, the date this instance is for. Also becomes its due date.
  occurrenceDate: string;
}

// Identity of a single generated instance. Mirrors the unique index on
// (recurrence_template_id, occurrence_date) in migration 0002.
export function occurrenceKey(templateId: string, occurrenceDate: string) {
  return `${templateId}:${occurrenceDate}`;
}

// The date `weekday` falls on within the Monday-start week containing `today`.
//
// Weekdays are Sunday-indexed (0 = Sunday) because that's what Date.getDay()
// returns, but the week itself starts on Monday — so Sunday is the *last* day of
// its week, not the first. Getting this backwards would file Sunday's block under
// the previous week.
export function occurrenceDateFor(weekday: Weekday, today: Date): string {
  const monday = startOfWeek(today, { weekStartsOn: 1 });
  const offsetFromMonday = weekday === 0 ? 6 : weekday - 1;
  return format(addDays(monday, offsetFromMonday), "yyyy-MM-dd");
}

// Which templates still owe an instance for the current week.
//
// `existingKeys` must include soft-deleted instances. A deleted instance means
// "not doing it this week" — regenerating it would both resurrect work the user
// dismissed and violate the unique index.
export function missingOccurrences(
  templates: RecurrenceTemplate[],
  existingKeys: ReadonlySet<string>,
  today: Date,
): PendingOccurrence[] {
  const pending: PendingOccurrence[] = [];

  for (const template of templates) {
    const occurrenceDate = occurrenceDateFor(template.weekday, today);
    if (existingKeys.has(occurrenceKey(template.id, occurrenceDate))) continue;
    pending.push({ templateId: template.id, occurrenceDate });
  }

  return pending;
}

// A template is a rule, not a work item — the board must never render one.
export function isTemplate(task: Task): boolean {
  return task.recursWeekly;
}

export function toTemplate(task: Task): RecurrenceTemplate | null {
  if (!task.recursWeekly || task.weekday === null) return null;
  return { id: task.id, weekday: task.weekday };
}
