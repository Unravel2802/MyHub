import type {
  BehavioralStory,
  PrepEntry,
  PrepEntryType,
  PrepOutcome,
} from "@/src/modules/prep/types";

// Published contract for the Prep Tracker (myhub_plan.md §2.3). Tables land in
// migration 0003; the scorecard maths lives in prepScorecard.ts and is already
// unit-tested. What's left is the Supabase wiring — see
// docs/handoff/prep-tracker.md.
//
// Soft deletes only: `deleted_at`, never a DELETE.

export interface CreatePrepEntryInput {
  entryType: PrepEntryType;
  topic?: string | null;
  // yyyy-MM-dd. Defaults to today when omitted — you usually log the rep you just
  // finished, but a post-mortem written the next morning still belongs to the day
  // the interview happened.
  date?: string;
  durationMin?: number | null;
  // Algorithm entries only. The DB rejects it on any other entry type.
  timeToSolveMin?: number | null;
  // The DB rejects an outcome that doesn't match the entry type: algorithm entries
  // are solved/partial/failed, everything else is pass/needs_work.
  outcome?: PrepOutcome | null;
  notes?: string | null;
}

export async function getEntries(): Promise<PrepEntry[]> {
  throw new Error("not implemented");
}

// Emitting `prep.logged` is the STORE's job, not this one — repositories don't
// touch the Event Bus.
export async function createEntry(
  input: CreatePrepEntryInput,
): Promise<PrepEntry> {
  void input;
  throw new Error("not implemented");
}

export async function updateEntry(
  id: string,
  updates: Partial<CreatePrepEntryInput>,
): Promise<PrepEntry> {
  void id;
  void updates;
  throw new Error("not implemented");
}

export async function deleteEntry(id: string): Promise<void> {
  void id;
  throw new Error("not implemented");
}

export async function getStories(): Promise<BehavioralStory[]> {
  throw new Error("not implemented");
}

export interface UpsertStoryInput {
  title: string;
  theme?: string | null;
  conciseVersion?: string | null;
  extendedVersion?: string | null;
}

export async function createStory(
  input: UpsertStoryInput,
): Promise<BehavioralStory> {
  void input;
  throw new Error("not implemented");
}

export async function updateStory(
  id: string,
  updates: Partial<UpsertStoryInput>,
): Promise<BehavioralStory> {
  void id;
  void updates;
  throw new Error("not implemented");
}

export async function deleteStory(id: string): Promise<void> {
  void id;
  throw new Error("not implemented");
}
