import type {
  Application,
  ApplicationStage,
  ResumeVariant,
} from "@/src/modules/jobApplications/types";

// Published contract (myhub_plan.md §2.3). Soft deletes only. See
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
}

export interface UpdateApplicationInput {
  roleTitle?: string;
  resumeVariant?: ResumeVariant;
  stage?: ApplicationStage;
  appliedDate?: string | null;
  referralSource?: string | null;
  followUpDate?: string | null;
}

export async function getApplications(): Promise<Application[]> {
  throw new Error("not implemented");
}

export async function createApplication(
  input: CreateApplicationInput,
): Promise<Application> {
  void input;
  throw new Error("not implemented");
}

// Every update — stage change or not — must bump `last_update_date` to today.
// The Dashboard's "no update in >7 days" panel (§2.3) reads that column, and a
// stale value there would hide an application that's actually being worked.
export async function updateApplication(
  id: string,
  updates: UpdateApplicationInput,
): Promise<Application> {
  void id;
  void updates;
  throw new Error("not implemented");
}

export async function deleteApplication(id: string): Promise<void> {
  void id;
  throw new Error("not implemented");
}
