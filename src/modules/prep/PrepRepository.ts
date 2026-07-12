import type {
  BehavioralStory,
  PrepEntry,
  PrepEntryType,
  PrepOutcome,
} from "@/src/modules/prep/types";
import { format } from "date-fns";
import { supabase } from "@/src/lib/supabaseClient";

interface PrepEntryRow {
  id: string;
  entry_type: PrepEntryType;
  topic: string | null;
  date: string;
  duration_min: number | null;
  time_to_solve_min: number | null;
  outcome: PrepOutcome | null;
  notes: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

interface BehavioralStoryRow {
  id: string;
  title: string;
  theme: string | null;
  concise_version: string | null;
  extended_version: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

function entryFromRow(row: PrepEntryRow): PrepEntry {
  return {
    id: row.id,
    entryType: row.entry_type,
    topic: row.topic,
    date: row.date,
    durationMin: row.duration_min,
    timeToSolveMin: row.time_to_solve_min,
    outcome: row.outcome,
    notes: row.notes,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function storyFromRow(row: BehavioralStoryRow): BehavioralStory {
  return {
    id: row.id,
    title: row.title,
    theme: row.theme,
    conciseVersion: row.concise_version,
    extendedVersion: row.extended_version,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function entryWrite(input: Partial<CreatePrepEntryInput>) {
  return {
    ...(input.entryType !== undefined && { entry_type: input.entryType }),
    ...(input.topic !== undefined && { topic: input.topic }),
    ...(input.date !== undefined && { date: input.date }),
    ...(input.durationMin !== undefined && {
      duration_min: input.durationMin,
    }),
    ...(input.timeToSolveMin !== undefined && {
      time_to_solve_min: input.timeToSolveMin,
    }),
    ...(input.outcome !== undefined && { outcome: input.outcome }),
    ...(input.notes !== undefined && { notes: input.notes }),
  };
}

function storyWrite(input: Partial<UpsertStoryInput>) {
  return {
    ...(input.title !== undefined && { title: input.title }),
    ...(input.theme !== undefined && { theme: input.theme }),
    ...(input.conciseVersion !== undefined && {
      concise_version: input.conciseVersion,
    }),
    ...(input.extendedVersion !== undefined && {
      extended_version: input.extendedVersion,
    }),
  };
}

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
  const { data, error } = await supabase
    .from("prep_entries")
    .select("*")
    .is("deleted_at", null)
    .order("date", { ascending: false });

  if (error) throw error;
  return data.map(entryFromRow);
}

// Emitting `prep.logged` is the STORE's job, not this one — repositories don't
// touch the Event Bus.
export async function createEntry(
  input: CreatePrepEntryInput,
): Promise<PrepEntry> {
  const { data, error } = await supabase
    .from("prep_entries")
    .insert({
      ...entryWrite(input),
      date: input.date ?? format(new Date(), "yyyy-MM-dd"),
    })
    .select()
    .single();

  if (error) throw error;
  return entryFromRow(data);
}

export async function updateEntry(
  id: string,
  updates: Partial<CreatePrepEntryInput>,
): Promise<PrepEntry> {
  const { data, error } = await supabase
    .from("prep_entries")
    .update(entryWrite(updates))
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return entryFromRow(data);
}

export async function deleteEntry(id: string): Promise<void> {
  const { error } = await supabase
    .from("prep_entries")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}

export async function getStories(): Promise<BehavioralStory[]> {
  const { data, error } = await supabase
    .from("behavioral_stories")
    .select("*")
    .is("deleted_at", null)
    .order("theme", { ascending: true })
    .order("title", { ascending: true });

  if (error) throw error;
  return data.map(storyFromRow);
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
  const { data, error } = await supabase
    .from("behavioral_stories")
    .insert(storyWrite(input))
    .select()
    .single();

  if (error) throw error;
  return storyFromRow(data);
}

export async function updateStory(
  id: string,
  updates: Partial<UpsertStoryInput>,
): Promise<BehavioralStory> {
  const { data, error } = await supabase
    .from("behavioral_stories")
    .update(storyWrite(updates))
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return storyFromRow(data);
}

export async function deleteStory(id: string): Promise<void> {
  const { error } = await supabase
    .from("behavioral_stories")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}
