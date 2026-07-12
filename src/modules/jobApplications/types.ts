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
  | "coding"
  | "system_design"
  | "ml_system_design"
  | "behavioral"
  | "other";

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
  followUpDate: string | null;
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
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
