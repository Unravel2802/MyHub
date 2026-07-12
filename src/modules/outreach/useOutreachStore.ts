import { create } from "zustand";
import type { CreateOutreachEntryInput } from "@/src/modules/outreach/OutreachRepository";
import type { OutreachEntry } from "@/src/modules/outreach/types";

// Published store contract for the Outreach Log. Own tiny store, not folded
// into useApplicationStore — a conversation can exist with no application, so
// it isn't a Job CRM concern even though it's related (myhub_plan.md §2.3).
// Action bodies are Codex's; the shape below is not.
export interface OutreachStore {
  entries: OutreachEntry[];
  isLoading: boolean;
  error: string | null;
  isCreating: boolean;
  pendingIds: string[];

  fetchEntries: () => Promise<void>;
  createEntry: (input: CreateOutreachEntryInput) => Promise<void>;
  updateEntry: (
    id: string,
    updates: Partial<CreateOutreachEntryInput>,
  ) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
}

const NOT_IMPLEMENTED = () => {
  throw new Error("not implemented");
};

export const useOutreachStore = create<OutreachStore>(() => ({
  entries: [],
  isLoading: false,
  error: null,
  isCreating: false,
  pendingIds: [],

  fetchEntries: NOT_IMPLEMENTED,
  createEntry: NOT_IMPLEMENTED,
  updateEntry: NOT_IMPLEMENTED,
  deleteEntry: NOT_IMPLEMENTED,
}));
