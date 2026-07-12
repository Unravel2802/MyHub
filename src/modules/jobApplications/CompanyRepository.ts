import type { Company, CompanyTier } from "@/src/modules/jobApplications/types";

// Published contract (myhub_plan.md §2.3). Soft deletes only — `deleted_at`,
// never a SQL DELETE. See docs/handoff/job-application-crm.md for the wiring
// brief.

export interface UpsertCompanyInput {
  name: string;
  tier: CompanyTier;
  notes?: string | null;
}

export async function getCompanies(): Promise<Company[]> {
  throw new Error("not implemented");
}

export async function createCompany(
  input: UpsertCompanyInput,
): Promise<Company> {
  void input;
  throw new Error("not implemented");
}

export async function updateCompany(
  id: string,
  updates: Partial<UpsertCompanyInput>,
): Promise<Company> {
  void id;
  void updates;
  throw new Error("not implemented");
}

// Soft-deleting a company does NOT cascade to its applications (unlike Task's
// parent/child cascade) — an application is a historical record of a real
// process you ran, and losing it because you tidied up a company row would
// destroy data the roadmap's funnel tracking (§11) depends on. If the UI needs
// to prevent deleting a company with active applications, that's a UI-level
// check, not a repository-level cascade.
export async function deleteCompany(id: string): Promise<void> {
  void id;
  throw new Error("not implemented");
}
