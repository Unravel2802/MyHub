import type {
  Interview,
  InterviewRoundType,
} from "@/src/modules/jobApplications/types";
import { supabase } from "@/src/lib/supabaseClient";

interface InterviewRow {
  id: string;
  application_id: string;
  round_type: InterviewRoundType;
  scheduled_at: string;
  completed: boolean;
  outcome: string | null;
  post_mortem_notes: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

function fromRow(row: InterviewRow): Interview {
  return {
    id: row.id,
    applicationId: row.application_id,
    roundType: row.round_type,
    scheduledAt: row.scheduled_at,
    completed: row.completed,
    outcome: row.outcome,
    postMortemNotes: row.post_mortem_notes,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toRow(input: Partial<CreateInterviewInput & UpdateInterviewInput>) {
  return {
    ...(input.applicationId !== undefined && {
      application_id: input.applicationId,
    }),
    ...(input.roundType !== undefined && { round_type: input.roundType }),
    ...(input.scheduledAt !== undefined && {
      scheduled_at: input.scheduledAt,
    }),
    ...(input.completed !== undefined && { completed: input.completed }),
    ...(input.outcome !== undefined && { outcome: input.outcome }),
    ...(input.postMortemNotes !== undefined && {
      post_mortem_notes: input.postMortemNotes,
    }),
  };
}

// Published contract (myhub_plan.md Part A §A.2). Soft deletes only. Same event-emission
// note as ApplicationRepository: `interview.completed` is emitted by the STORE
// when it observes `completed` flip false -> true, not by this repository.
//
// Reminder from myhub_plan.md Part A §A.2: these are REAL interviews tied to a specific application.
// A mock/practice rep is a PrepEntries row (Prep Tracker, entry_type
// "mock_interview") in a different module entirely. Don't let this repository
// or its UI drift into practice-session territory.

export interface CreateInterviewInput {
  applicationId: string;
  roundType: InterviewRoundType;
  scheduledAt: string;
  outcome?: string | null;
  postMortemNotes?: string | null;
}

export interface UpdateInterviewInput {
  roundType?: InterviewRoundType;
  scheduledAt?: string;
  completed?: boolean;
  outcome?: string | null;
  postMortemNotes?: string | null;
}

export async function getInterviews(): Promise<Interview[]> {
  const { data, error } = await supabase
    .from("interviews")
    .select("*")
    .is("deleted_at", null)
    .order("scheduled_at", { ascending: false });
  if (error) throw error;
  return data.map(fromRow);
}

export async function getInterviewsForApplication(
  applicationId: string,
): Promise<Interview[]> {
  const { data, error } = await supabase
    .from("interviews")
    .select("*")
    .eq("application_id", applicationId)
    .is("deleted_at", null)
    .order("scheduled_at", { ascending: false });
  if (error) throw error;
  return data.map(fromRow);
}

export async function createInterview(
  input: CreateInterviewInput,
): Promise<Interview> {
  const { data, error } = await supabase
    .from("interviews")
    .insert(toRow(input))
    .select()
    .single();
  if (error) throw error;
  return fromRow(data);
}

export async function updateInterview(
  id: string,
  updates: UpdateInterviewInput,
): Promise<Interview> {
  const { data, error } = await supabase
    .from("interviews")
    .update(toRow(updates))
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return fromRow(data);
}

export async function deleteInterview(id: string): Promise<void> {
  const { error } = await supabase
    .from("interviews")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
