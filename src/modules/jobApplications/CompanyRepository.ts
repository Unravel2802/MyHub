import type { Company, CompanyTier } from "@/src/modules/jobApplications/types";
import { supabase } from "@/src/lib/supabaseClient";

interface CompanyRow {
  id: string;
  name: string;
  tier: CompanyTier;
  notes: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

function fromRow(row: CompanyRow): Company {
  return {
    id: row.id,
    name: row.name,
    tier: row.tier,
    notes: row.notes,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toRow(input: Partial<UpsertCompanyInput>) {
  return {
    ...(input.name !== undefined && { name: input.name }),
    ...(input.tier !== undefined && { tier: input.tier }),
    ...(input.notes !== undefined && { notes: input.notes }),
  };
}

// Published contract (myhub_plan.md Part A §A.2). Soft deletes only — `deleted_at`,
// never a SQL DELETE. See docs/handoff/job-application-crm.md for the wiring
// brief.

export interface UpsertCompanyInput {
  name: string;
  tier: CompanyTier;
  notes?: string | null;
}

export async function getCompanies(): Promise<Company[]> {
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .is("deleted_at", null)
    .order("name", { ascending: true });
  if (error) throw error;
  return data.map(fromRow);
}

export async function createCompany(
  input: UpsertCompanyInput,
): Promise<Company> {
  const { data, error } = await supabase
    .from("companies")
    .insert(toRow(input))
    .select()
    .single();
  if (error) throw error;
  return fromRow(data);
}

export async function updateCompany(
  id: string,
  updates: Partial<UpsertCompanyInput>,
): Promise<Company> {
  const { data, error } = await supabase
    .from("companies")
    .update(toRow(updates))
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return fromRow(data);
}

// Soft-deleting a company does NOT cascade to its applications (unlike Task's
// parent/child cascade) — an application is a historical record of a real
// process you ran, and losing it because you tidied up a company row would
// destroy data the roadmap's funnel tracking (§11) depends on. If the UI needs
// to prevent deleting a company with active applications, that's a UI-level
// check, not a repository-level cascade.
export async function deleteCompany(id: string): Promise<void> {
  const { error } = await supabase
    .from("companies")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
