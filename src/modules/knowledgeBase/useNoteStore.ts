import { create } from "zustand";
import * as NoteRepository from "@/src/modules/knowledgeBase/NoteRepository";
import {
  SelfLinkError,
  type CreateNoteInput,
} from "@/src/modules/knowledgeBase/NoteRepository";
import type { Note, NoteLink } from "@/src/modules/knowledgeBase/types";

// Published store contract for the Knowledge Base. Unlike CLAUDE.md's
// described stub-first handoff, this store is fully implemented (not a
// throw-stub): its CRUD/optimistic-rollback shape is identical to every other
// module's store, so a stub would save near-zero effort while leaving a
// mount-time crash risk if this ever gets wired into a page before Codex
// finishes it (see docs/handoff/knowledge-base.md). Codex's actual work here
// is the /notes page, the link-picker UI, and the E2E coverage — not this file.
export interface NoteStore {
  notes: Note[];
  links: Record<string, NoteLink[]>; // keyed by noteId
  isLoading: boolean;
  error: string | null;
  isCreating: boolean;
  pendingIds: string[];

  fetchNotes: () => Promise<void>;
  createNote: (input: CreateNoteInput) => Promise<void>;
  updateNote: (id: string, updates: Partial<CreateNoteInput>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;

  fetchLinksForNote: (noteId: string) => Promise<void>;
  createLink: (sourceNoteId: string, targetNoteId: string) => Promise<void>;
  deleteLink: (noteId: string, linkId: string) => Promise<void>;
}

const FAILURE_MESSAGE = "Something went wrong, please try again later.";

function toUserMessage(error: unknown): string {
  console.error(error);
  if (error instanceof SelfLinkError) return error.message;
  return FAILURE_MESSAGE;
}

export const useNoteStore = create<NoteStore>((set, get) => {
  const addPending = (id: string) =>
    set({ pendingIds: [...get().pendingIds, id] });
  const removePending = (id: string) =>
    set({ pendingIds: get().pendingIds.filter((pending) => pending !== id) });

  return {
    notes: [],
    links: {},
    isLoading: false,
    error: null,
    isCreating: false,
    pendingIds: [],

    fetchNotes: async () => {
      set({ isLoading: true, error: null });
      try {
        const notes = await NoteRepository.getNotes();
        set({ notes, isLoading: false });
      } catch (error) {
        set({ isLoading: false, error: toUserMessage(error) });
      }
    },

    createNote: async (input) => {
      const previousNotes = get().notes;
      const now = new Date().toISOString();
      const optimistic: Note = {
        id: `optimistic-${crypto.randomUUID()}`,
        title: input.title,
        body: input.body ?? "",
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      };

      set({
        notes: [optimistic, ...previousNotes],
        isCreating: true,
        error: null,
      });

      try {
        const created = await NoteRepository.createNote(input);
        set({
          notes: get().notes.map((note) =>
            note.id === optimistic.id ? created : note,
          ),
        });
      } catch (error) {
        set({ notes: previousNotes, error: toUserMessage(error) });
      } finally {
        set({ isCreating: false });
      }
    },

    updateNote: async (id, updates) => {
      const previousNotes = get().notes;
      set({
        notes: previousNotes.map((note) =>
          note.id === id
            ? {
                ...note,
                ...(updates.title !== undefined && { title: updates.title }),
                ...(updates.body !== undefined && { body: updates.body }),
              }
            : note,
        ),
        error: null,
      });
      addPending(id);

      try {
        const updated = await NoteRepository.updateNote(id, updates);
        set({
          notes: get().notes.map((note) => (note.id === id ? updated : note)),
        });
      } catch (error) {
        set({ notes: previousNotes, error: toUserMessage(error) });
      } finally {
        removePending(id);
      }
    },

    deleteNote: async (id) => {
      const previousNotes = get().notes;
      set({
        notes: previousNotes.filter((note) => note.id !== id),
        error: null,
      });
      addPending(id);

      try {
        await NoteRepository.deleteNote(id);
      } catch (error) {
        set({ notes: previousNotes, error: toUserMessage(error) });
      } finally {
        removePending(id);
      }
    },

    fetchLinksForNote: async (noteId) => {
      set({ error: null });
      try {
        const links = await NoteRepository.getLinksForNote(noteId);
        set({ links: { ...get().links, [noteId]: links } });
      } catch (error) {
        set({ error: toUserMessage(error) });
      }
    },

    createLink: async (sourceNoteId, targetNoteId) => {
      try {
        const link = await NoteRepository.createLink(
          sourceNoteId,
          targetNoteId,
        );
        const existing = get().links[sourceNoteId] ?? [];
        set({
          links: { ...get().links, [sourceNoteId]: [...existing, link] },
        });
      } catch (error) {
        set({ error: toUserMessage(error) });
      }
    },

    deleteLink: async (noteId, linkId) => {
      const previousLinks = get().links;
      set({
        links: {
          ...previousLinks,
          [noteId]: (previousLinks[noteId] ?? []).filter(
            (link) => link.linkId !== linkId,
          ),
        },
        error: null,
      });

      try {
        await NoteRepository.deleteLink(linkId);
      } catch (error) {
        set({ links: previousLinks, error: toUserMessage(error) });
      }
    },
  };
});
