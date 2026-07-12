import type {
  Interview,
  InterviewRoundType,
} from "@/src/modules/jobApplications/types";

// Published contract (myhub_plan.md §2.3). Soft deletes only. Same event-emission
// note as ApplicationRepository: `interview.completed` is emitted by the STORE
// when it observes `completed` flip false -> true, not by this repository.
//
// Reminder from §2.3: these are REAL interviews tied to a specific application.
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
  throw new Error("not implemented");
}

export async function getInterviewsForApplication(
  applicationId: string,
): Promise<Interview[]> {
  void applicationId;
  throw new Error("not implemented");
}

export async function createInterview(
  input: CreateInterviewInput,
): Promise<Interview> {
  void input;
  throw new Error("not implemented");
}

export async function updateInterview(
  id: string,
  updates: UpdateInterviewInput,
): Promise<Interview> {
  void id;
  void updates;
  throw new Error("not implemented");
}

export async function deleteInterview(id: string): Promise<void> {
  void id;
  throw new Error("not implemented");
}
