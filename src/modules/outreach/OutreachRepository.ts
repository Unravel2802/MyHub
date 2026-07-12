import type { OutreachChannel, OutreachEntry } from "@/src/modules/outreach/types";

// Published contract for the Outreach Log (myhub_plan.md §2.3, §2.5). Soft
// deletes only. See docs/handoff/outreach-log.md for the wiring brief.
//
// No Event Bus type for this module: nothing downstream reacts to a logged
// conversation the way the Dashboard reacts to interview.completed. The
// Dashboard's weekly-cadence panel reads this table directly through
// getEntries, the same "no new repository, read the others' repositories"
// rule Daily Dashboard already follows for its own aggregation.

export interface CreateOutreachEntryInput {
  contactName?: string | null;
  companyId?: string | null;
  channel: OutreachChannel;
  date?: string;
  notes?: string | null;
}

export async function getEntries(): Promise<OutreachEntry[]> {
  throw new Error("not implemented");
}

export async function createEntry(
  input: CreateOutreachEntryInput,
): Promise<OutreachEntry> {
  void input;
  throw new Error("not implemented");
}

export async function updateEntry(
  id: string,
  updates: Partial<CreateOutreachEntryInput>,
): Promise<OutreachEntry> {
  void id;
  void updates;
  throw new Error("not implemented");
}

export async function deleteEntry(id: string): Promise<void> {
  void id;
  throw new Error("not implemented");
}
