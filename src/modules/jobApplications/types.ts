export type CompanyTier = "reach" | "match" | "safety";

export type ResumeVariant = "swe_backend" | "mle_ml_infra";

export type ApplicationStage =
  | "researching"
  | "applied"
  | "oa"
  | "phone_screen"
  | "onsite"
  | "offer"
  | "rejected"
  | "withdrawn";

export type InterviewRoundType =
  "coding" | "system_design" | "ml_system_design" | "behavioral" | "other";

export interface Company {
  id: string;
  name: string;
  tier: CompanyTier;
  notes: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Application {
  id: string;
  companyId: string;
  roleTitle: string;
  resumeVariant: ResumeVariant;
  stage: ApplicationStage;
  appliedDate: string | null;
  // Defaults to creation time in the DB, so this is never null in practice — but
  // typed nullable since a partial update payload could theoretically omit it.
  lastUpdateDate: string;
  referralSource: string | null;
  // Free-form. Also where §11.2's rejection takeaway lands — the UI nudges for
  // one when an application moves to `rejected` and this is still empty.
  notes: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Interview {
  id: string;
  applicationId: string;
  roundType: InterviewRoundType;
  scheduledAt: string;
  completed: boolean;
  outcome: string | null;
  postMortemNotes: string | null;
  // Set when `completed` flips false -> true. There is no un-complete path in
  // the store contract, so in practice this is write-once.
  completedAt: string | null;
  // Set the first time `postMortemNotes` goes empty -> non-empty, and NEVER
  // overwritten afterwards: it records when you first wrote the post-mortem,
  // not when you last edited it. Phase 5's "post-mortem within 24h" achievement
  // measures this against `scheduledAt`, so a later typo fix must not
  // retroactively cost you the unlock.
  //
  // Both timestamps are computed in useApplicationStore, not the repository —
  // only the store knows the previous state to diff against.
  postMortemLoggedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
