import { create } from "zustand";
import { format } from "date-fns";
import * as OutreachRepository from "@/src/modules/outreach/OutreachRepository";
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

const FAILURE_MESSAGE = "Something went wrong, please try again later.";

function toUserMessage(error: unknown): string {
  console.error(error);
  return FAILURE_MESSAGE;
}

export const useOutreachStore = create<OutreachStore>((set, get) => {
  const addPending = (id: string) =>
    set({ pendingIds: [...get().pendingIds, id] });
  const removePending = (id: string) =>
    set({ pendingIds: get().pendingIds.filter((pending) => pending !== id) });

  return {
    entries: [],
    isLoading: false,
    error: null,
    isCreating: false,
    pendingIds: [],

    fetchEntries: async () => {
      set({ isLoading: true, error: null });
      try {
        const entries = await OutreachRepository.getEntries();
        set({ entries, isLoading: false });
      } catch (error) {
        set({ isLoading: false, error: toUserMessage(error) });
      }
    },

    createEntry: async (input) => {
      const previousEntries = get().entries;
      const now = new Date().toISOString();
      const optimistic: OutreachEntry = {
        id: `optimistic-${crypto.randomUUID()}`,
        contactName: input.contactName ?? null,
        companyId: input.companyId ?? null,
        channel: input.channel,
        date: input.date ?? format(new Date(), "yyyy-MM-dd"),
        notes: input.notes ?? null,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      };

      set({
        entries: [optimistic, ...previousEntries],
        isCreating: true,
        error: null,
      });

      try {
        const created = await OutreachRepository.createEntry(input);
        set({
          entries: get().entries.map((entry) =>
            entry.id === optimistic.id ? created : entry,
          ),
        });
      } catch (error) {
        set({ entries: previousEntries, error: toUserMessage(error) });
      } finally {
        set({ isCreating: false });
      }
    },

    updateEntry: async (id, updates) => {
      const previousEntries = get().entries;
      set({
        entries: previousEntries.map((entry) =>
          entry.id === id
            ? {
                ...entry,
                ...(updates.contactName !== undefined && {
                  contactName: updates.contactName,
                }),
                ...(updates.companyId !== undefined && {
                  companyId: updates.companyId,
                }),
                ...(updates.channel !== undefined && {
                  channel: updates.channel,
                }),
                ...(updates.date !== undefined && { date: updates.date }),
                ...(updates.notes !== undefined && { notes: updates.notes }),
              }
            : entry,
        ),
        error: null,
      });
      addPending(id);

      try {
        const updated = await OutreachRepository.updateEntry(id, updates);
        set({
          entries: get().entries.map((entry) =>
            entry.id === id ? updated : entry,
          ),
        });
      } catch (error) {
        set({ entries: previousEntries, error: toUserMessage(error) });
      } finally {
        removePending(id);
      }
    },

    deleteEntry: async (id) => {
      const previousEntries = get().entries;
      set({
        entries: previousEntries.filter((entry) => entry.id !== id),
        error: null,
      });
      addPending(id);

      try {
        await OutreachRepository.deleteEntry(id);
      } catch (error) {
        set({ entries: previousEntries, error: toUserMessage(error) });
      } finally {
        removePending(id);
      }
    },
  };
});
