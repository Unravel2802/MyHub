import type {
  Application,
  ApplicationStage,
  ResumeVariant,
} from "@/src/modules/jobApplications/types";
import { format } from "date-fns";
import { supabase } from "@/src/lib/supabaseClient";

interface ApplicationRow {
  id: string;
  company_id: string;
  role_title: string;
  resume_variant: ResumeVariant;
  stage: ApplicationStage;
  applied_date: string | null;
  last_update_date: string;
  referral_source: string | null;
  follow_up_date: string | null;
  notes: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

function fromRow(row: ApplicationRow): Application {
  return {
    id: row.id,
    companyId: row.company_id,
    roleTitle: row.role_title,
    resumeVariant: row.resume_variant,
    stage: row.stage,
    appliedDate: row.applied_date,
    lastUpdateDate: row.last_update_date,
    referralSource: row.referral_source,
    followUpDate: row.follow_up_date,
    notes: row.notes,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toRow(input: Partial<CreateApplicationInput>) {
  return {
    ...(input.companyId !== undefined && { company_id: input.companyId }),
    ...(input.roleTitle !== undefined && { role_title: input.roleTitle }),
    ...(input.resumeVariant !== undefined && {
      resume_variant: input.resumeVariant,
    }),
    ...(input.stage !== undefined && { stage: input.stage }),
    ...(input.appliedDate !== undefined && { applied_date: input.appliedDate }),
    ...(input.referralSource !== undefined && {
      referral_source: input.referralSource,
    }),
    ...(input.followUpDate !== undefined && {
      follow_up_date: input.followUpDate,
    }),
    ...(input.notes !== undefined && { notes: input.notes }),
  };
}

// Published contract (myhub_plan.md Part A §A.2). Soft deletes only. See
// docs/handoff/job-application-crm.md for the wiring brief — in particular, note
// that `application.stage_changed` is emitted by the STORE (which knows the
// previous stage from its own state, same pattern as Task's status cascades),
// not by this repository. `updateApplication` just persists and returns the row.

export interface CreateApplicationInput {
  companyId: string;
  roleTitle: string;
  resumeVariant: ResumeVariant;
  stage?: ApplicationStage;
  appliedDate?: string | null;
  referralSource?: string | null;
  followUpDate?: string | null;
  notes?: string | null;
}

export interface UpdateApplicationInput {
  roleTitle?: string;
  resumeVariant?: ResumeVariant;
  stage?: ApplicationStage;
  appliedDate?: string | null;
  referralSource?: string | null;
  followUpDate?: string | null;
  notes?: string | null;
}

export async function getApplications(): Promise<Application[]> {
  const { data, error } = await supabase
    .from("applications")
    .select("*")
    .is("deleted_at", null)
    .order("last_update_date", { ascending: false });
  if (error) throw error;
  return data.map(fromRow);
}

export async function createApplication(
  input: CreateApplicationInput,
): Promise<Application> {
  const { data, error } = await supabase
    .from("applications")
    .insert(toRow(input))
    .select()
    .single();
  if (error) throw error;
  return fromRow(data);
}

// Every update — stage change or not — must bump `last_update_date` to today.
// The Dashboard's "no update in >7 days" panel (myhub_plan.md Part A §A.2) reads that column, and a
// stale value there would hide an application that's actually being worked.
export async function updateApplication(
  id: string,
  updates: UpdateApplicationInput,
): Promise<Application> {
  const { data, error } = await supabase
    .from("applications")
    .update({
      ...toRow(updates),
      last_update_date: format(new Date(), "yyyy-MM-dd"),
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return fromRow(data);
}

export async function deleteApplication(id: string): Promise<void> {
  const { error } = await supabase
    .from("applications")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
