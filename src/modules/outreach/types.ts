export type OutreachChannel =
  | "linkedin"
  | "email"
  | "alumni_network"
  | "professor_referral"
  | "other";

export interface OutreachEntry {
  id: string;
  contactName: string | null;
  // Nullable: a conversation doesn't always map to a specific target company
  // (myhub_plan.md §2.3).
  companyId: string | null;
  channel: OutreachChannel;
  // yyyy-MM-dd. The day the conversation happened, not the day it was logged.
  date: string;
  notes: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
