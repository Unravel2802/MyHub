import { create } from "zustand";
import type {
  CreateApplicationInput,
  UpdateApplicationInput,
} from "@/src/modules/jobApplications/ApplicationRepository";
import type { UpsertCompanyInput } from "@/src/modules/jobApplications/CompanyRepository";
import type {
  CreateInterviewInput,
  UpdateInterviewInput,
} from "@/src/modules/jobApplications/InterviewRepository";
import type {
  Application,
  Company,
  Interview,
} from "@/src/modules/jobApplications/types";

// Published store contract for the Job Application CRM (myhub_plan.md §2.3). One
// store, three entities — they share a pipeline view and don't need separate
// stores the way Task and Prep do. Action bodies are Codex's; the shape below is
// not. Flag it if the UI needs something this doesn't expose.
//
// Event-emission contract (the one piece of real logic in this module — read
// this before implementing updateApplicationStage / markInterviewCompleted):
//
//   - `application.stage_changed` fires ONLY when `stage` actually changes value,
//     not on every field update. The store already holds the previous Application
//     in `applications` before calling the repository — diff previousStage vs.
//     updated.stage after the write succeeds, exactly like useTaskStore's
//     applyStatusCascade diffs against get().tasks. Do not fire this from
//     `updateApplication` for a plain field edit (e.g. referralSource).
//   - `interview.completed` fires ONLY when `completed` flips false -> true, same
//     diff-against-previous-state pattern. Toggling it true -> true (a no-op
//     update) or true -> false must NOT re-fire it.
export interface ApplicationStore {
  companies: Company[];
  applications: Application[];
  interviews: Interview[];
  isLoading: boolean;
  error: string | null;
  isCreating: boolean;
  pendingIds: string[];

  fetchAll: () => Promise<void>;

  createCompany: (input: UpsertCompanyInput) => Promise<void>;
  updateCompany: (
    id: string,
    updates: Partial<UpsertCompanyInput>,
  ) => Promise<void>;
  deleteCompany: (id: string) => Promise<void>;

  createApplication: (input: CreateApplicationInput) => Promise<void>;
  // General field edits (role title, referral source, follow-up date, etc.).
  // Does NOT change `stage` — use updateApplicationStage for that, so the
  // stage-changed emission stays isolated to the one action that can trigger it.
  updateApplication: (
    id: string,
    updates: Omit<UpdateApplicationInput, "stage">,
  ) => Promise<void>;
  // The only path that changes `stage`. Emits `application.stage_changed` when
  // the new stage differs from the current one.
  updateApplicationStage: (
    id: string,
    stage: Application["stage"],
  ) => Promise<void>;
  deleteApplication: (id: string) => Promise<void>;

  createInterview: (input: CreateInterviewInput) => Promise<void>;
  // General field edits (round type, scheduled time, outcome text, notes).
  // Does NOT change `completed` — use markInterviewCompleted for that.
  updateInterview: (
    id: string,
    updates: Omit<UpdateInterviewInput, "completed">,
  ) => Promise<void>;
  // The only path that flips `completed`. Emits `interview.completed` when it
  // transitions false -> true; a redundant call (already true) is a no-op that
  // does not re-emit.
  markInterviewCompleted: (id: string) => Promise<void>;
  deleteInterview: (id: string) => Promise<void>;
}

const NOT_IMPLEMENTED = () => {
  throw new Error("not implemented");
};

export const useApplicationStore = create<ApplicationStore>(() => ({
  companies: [],
  applications: [],
  interviews: [],
  isLoading: false,
  error: null,
  isCreating: false,
  pendingIds: [],

  fetchAll: NOT_IMPLEMENTED,

  createCompany: NOT_IMPLEMENTED,
  updateCompany: NOT_IMPLEMENTED,
  deleteCompany: NOT_IMPLEMENTED,

  createApplication: NOT_IMPLEMENTED,
  updateApplication: NOT_IMPLEMENTED,
  updateApplicationStage: NOT_IMPLEMENTED,
  deleteApplication: NOT_IMPLEMENTED,

  createInterview: NOT_IMPLEMENTED,
  updateInterview: NOT_IMPLEMENTED,
  markInterviewCompleted: NOT_IMPLEMENTED,
  deleteInterview: NOT_IMPLEMENTED,
}));
