import { create } from "zustand";
import { format } from "date-fns";
import * as ApplicationRepository from "@/src/modules/jobApplications/ApplicationRepository";
import * as CompanyRepository from "@/src/modules/jobApplications/CompanyRepository";
import * as InterviewRepository from "@/src/modules/jobApplications/InterviewRepository";
import { emit } from "@/src/lib/events";
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
import { postMortemLoggedAtFor } from "@/src/modules/jobApplications/interviewTimestamps";
import { funnelStats } from "@/src/modules/jobApplications/funnelStats";
import type { FunnelStats } from "@/src/modules/jobApplications/funnelStats";

// Published store contract for the Job Application CRM (myhub_plan.md Part A §A.2). One
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

  // Derived, not stored: computed from `applications` + `interviews` via
  // funnelStats.ts. Rates are null (never 0) before anything has been sent —
  // the UI must render that as "—", not "0%".
  funnel: () => FunnelStats;
}

const FAILURE_MESSAGE = "Something went wrong, please try again later.";

function toUserMessage(error: unknown) {
  console.error(error);
  return FAILURE_MESSAGE;
}

function updateCompanyLocally(
  company: Company,
  updates: Partial<UpsertCompanyInput>,
): Company {
  return { ...company, ...updates };
}

function updateApplicationLocally(
  application: Application,
  updates: Partial<UpdateApplicationInput>,
): Application {
  return {
    ...application,
    ...updates,
    lastUpdateDate: format(new Date(), "yyyy-MM-dd"),
  };
}

function updateInterviewLocally(
  interview: Interview,
  updates: Partial<UpdateInterviewInput>,
): Interview {
  return { ...interview, ...updates };
}

export const useApplicationStore = create<ApplicationStore>((set, get) => {
  const addPending = (id: string) =>
    set({ pendingIds: [...get().pendingIds, id] });
  const removePending = (id: string) =>
    set({ pendingIds: get().pendingIds.filter((pending) => pending !== id) });

  return {
    companies: [],
    applications: [],
    interviews: [],
    isLoading: false,
    error: null,
    isCreating: false,
    pendingIds: [],

    fetchAll: async () => {
      set({ isLoading: true, error: null });
      try {
        const [companies, applications, interviews] = await Promise.all([
          CompanyRepository.getCompanies(),
          ApplicationRepository.getApplications(),
          InterviewRepository.getInterviews(),
        ]);
        set({ companies, applications, interviews, isLoading: false });
      } catch (error) {
        set({ isLoading: false, error: toUserMessage(error) });
      }
    },

    createCompany: async (input) => {
      const previous = get().companies;
      const now = new Date().toISOString();
      const optimistic: Company = {
        id: `optimistic-${crypto.randomUUID()}`,
        name: input.name,
        tier: input.tier,
        notes: input.notes ?? null,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      set({
        companies: [...previous, optimistic],
        isCreating: true,
        error: null,
      });
      try {
        const created = await CompanyRepository.createCompany(input);
        set({
          companies: get().companies.map((company) =>
            company.id === optimistic.id ? created : company,
          ),
        });
      } catch (error) {
        set({ companies: previous, error: toUserMessage(error) });
      } finally {
        set({ isCreating: false });
      }
    },

    updateCompany: async (id, updates) => {
      const previous = get().companies;
      set({
        companies: previous.map((company) =>
          company.id === id ? updateCompanyLocally(company, updates) : company,
        ),
        error: null,
      });
      addPending(id);
      try {
        const updated = await CompanyRepository.updateCompany(id, updates);
        set({
          companies: get().companies.map((company) =>
            company.id === id ? updated : company,
          ),
        });
      } catch (error) {
        set({ companies: previous, error: toUserMessage(error) });
      } finally {
        removePending(id);
      }
    },

    deleteCompany: async (id) => {
      const previous = get().companies;
      set({
        companies: previous.filter((company) => company.id !== id),
        error: null,
      });
      addPending(id);
      try {
        await CompanyRepository.deleteCompany(id);
      } catch (error) {
        set({ companies: previous, error: toUserMessage(error) });
      } finally {
        removePending(id);
      }
    },

    createApplication: async (input) => {
      const previous = get().applications;
      const now = new Date().toISOString();
      const optimistic: Application = {
        id: `optimistic-${crypto.randomUUID()}`,
        companyId: input.companyId,
        roleTitle: input.roleTitle,
        resumeVariant: input.resumeVariant,
        stage: input.stage ?? "researching",
        appliedDate: input.appliedDate ?? null,
        lastUpdateDate: format(new Date(), "yyyy-MM-dd"),
        referralSource: input.referralSource ?? null,
        notes: input.notes ?? null,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      set({
        applications: [optimistic, ...previous],
        isCreating: true,
        error: null,
      });
      try {
        const created = await ApplicationRepository.createApplication(input);
        set({
          applications: get().applications.map((application) =>
            application.id === optimistic.id ? created : application,
          ),
        });
      } catch (error) {
        set({ applications: previous, error: toUserMessage(error) });
      } finally {
        set({ isCreating: false });
      }
    },

    updateApplication: async (id, updates) => {
      const previous = get().applications;
      set({
        applications: previous.map((application) =>
          application.id === id
            ? updateApplicationLocally(application, updates)
            : application,
        ),
        error: null,
      });
      addPending(id);
      try {
        const updated = await ApplicationRepository.updateApplication(
          id,
          updates,
        );
        set({
          applications: get().applications.map((application) =>
            application.id === id ? updated : application,
          ),
        });
      } catch (error) {
        set({ applications: previous, error: toUserMessage(error) });
      } finally {
        removePending(id);
      }
    },

    updateApplicationStage: async (id, stage) => {
      const previous = get().applications;
      const current = previous.find((application) => application.id === id);
      if (current?.stage === stage) return;
      set({
        applications: previous.map((application) =>
          application.id === id
            ? updateApplicationLocally(application, { stage })
            : application,
        ),
        error: null,
      });
      addPending(id);
      try {
        const updated = await ApplicationRepository.updateApplication(id, {
          stage,
        });
        set({
          applications: get().applications.map((application) =>
            application.id === id ? updated : application,
          ),
        });
        if (current && current.stage !== updated.stage) {
          emit({
            type: "application.stage_changed",
            payload: {
              applicationId: id,
              fromStage: current.stage,
              toStage: updated.stage,
            },
            timestamp: Date.now(),
          });
        }
      } catch (error) {
        set({ applications: previous, error: toUserMessage(error) });
      } finally {
        removePending(id);
      }
    },

    deleteApplication: async (id) => {
      const previous = get().applications;
      set({
        applications: previous.filter((application) => application.id !== id),
        error: null,
      });
      addPending(id);
      try {
        await ApplicationRepository.deleteApplication(id);
      } catch (error) {
        set({ applications: previous, error: toUserMessage(error) });
      } finally {
        removePending(id);
      }
    },

    createInterview: async (input) => {
      const previous = get().interviews;
      const now = new Date().toISOString();
      const optimistic: Interview = {
        id: `optimistic-${crypto.randomUUID()}`,
        applicationId: input.applicationId,
        roundType: input.roundType,
        scheduledAt: input.scheduledAt,
        completed: false,
        outcome: input.outcome ?? null,
        postMortemNotes: input.postMortemNotes ?? null,
        completedAt: null,
        postMortemLoggedAt: null,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      set({
        interviews: [optimistic, ...previous],
        isCreating: true,
        error: null,
      });
      try {
        const created = await InterviewRepository.createInterview(input);
        set({
          interviews: get().interviews.map((interview) =>
            interview.id === optimistic.id ? created : interview,
          ),
        });
      } catch (error) {
        set({ interviews: previous, error: toUserMessage(error) });
      } finally {
        set({ isCreating: false });
      }
    },

    updateInterview: async (id, updates) => {
      const previous = get().interviews;
      const current = previous.find((interview) => interview.id === id);
      // Stamp the post-mortem's first write. Computed here, not in the
      // repository, which has no previous state to compare against.
      const postMortemLoggedAt = current
        ? postMortemLoggedAtFor(
            current,
            updates.postMortemNotes,
            new Date().toISOString(),
          )
        : undefined;
      const payload: UpdateInterviewInput = {
        ...updates,
        ...(postMortemLoggedAt !== undefined && { postMortemLoggedAt }),
      };
      set({
        interviews: previous.map((interview) =>
          interview.id === id
            ? updateInterviewLocally(interview, payload)
            : interview,
        ),
        error: null,
      });
      addPending(id);
      try {
        const updated = await InterviewRepository.updateInterview(id, payload);
        set({
          interviews: get().interviews.map((interview) =>
            interview.id === id ? updated : interview,
          ),
        });
      } catch (error) {
        set({ interviews: previous, error: toUserMessage(error) });
      } finally {
        removePending(id);
      }
    },

    markInterviewCompleted: async (id) => {
      const previous = get().interviews;
      const current = previous.find((interview) => interview.id === id);
      if (current?.completed) return;
      const completedAt = new Date().toISOString();
      set({
        interviews: previous.map((interview) =>
          interview.id === id
            ? { ...interview, completed: true, completedAt }
            : interview,
        ),
        error: null,
      });
      addPending(id);
      try {
        const updated = await InterviewRepository.updateInterview(id, {
          completed: true,
          completedAt,
        });
        set({
          interviews: get().interviews.map((interview) =>
            interview.id === id ? updated : interview,
          ),
        });
        if (current && !current.completed && updated.completed) {
          emit({
            type: "interview.completed",
            payload: { interviewId: id, applicationId: updated.applicationId },
            timestamp: Date.now(),
          });
        }
      } catch (error) {
        set({ interviews: previous, error: toUserMessage(error) });
      } finally {
        removePending(id);
      }
    },

    deleteInterview: async (id) => {
      const previous = get().interviews;
      set({
        interviews: previous.filter((interview) => interview.id !== id),
        error: null,
      });
      addPending(id);
      try {
        await InterviewRepository.deleteInterview(id);
      } catch (error) {
        set({ interviews: previous, error: toUserMessage(error) });
      } finally {
        removePending(id);
      }
    },

    funnel: () => funnelStats(get().applications, get().interviews),
  };
});
