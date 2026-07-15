import { supabase } from "@/src/lib/supabaseClient";
import type { Note, NoteLink } from "@/src/modules/knowledgeBase/types";

// Published contract for the Knowledge Base (myhub_plan.md Part A §A.2). Soft
// deletes only. See docs/handoff/knowledge-base.md for what's left for Codex.
//
// No Event Bus type for this module: Momentum's streaks/achievements are keyed
// to a hardcoded 4-field ActivitySnapshot with no roadmap-traceable number for
// knowledge-base activity (see streaks.ts). Adding an event here would be
// wiring a hook nothing consumes — an intentional non-goal, not an oversight.

interface NoteRow {
  id: string;
  title: string;
  body: string;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

interface NoteLinkRow {
  id: string;
  source_note_id: string;
  target_note_id: string;
  deleted_at: string | null;
  created_at: string;
}

function fromRow(row: NoteRow): Note {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// The row's "other side" relative to `noteId` — a link row doesn't know or
// care which end the caller is looking from, so this is where directional
// storage becomes the bi-directional view the app actually wants.
function toLink(row: NoteLinkRow, noteId: string): NoteLink {
  return {
    linkId: row.id,
    noteId:
      row.source_note_id === noteId ? row.target_note_id : row.source_note_id,
  };
}

export interface CreateNoteInput {
  title: string;
  body?: string;
}

// Thrown before any Supabase call when source === target, so the Store can
// give a specific message instead of relying on the DB's
// note_links_no_self_link CHECK constraint (which exists too, as the backstop
// for anything that bypasses this repository).
export class SelfLinkError extends Error {
  constructor() {
    super("A note can't link to itself.");
    this.name = "SelfLinkError";
  }
}

export async function getNotes(): Promise<Note[]> {
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data.map(fromRow);
}

export async function createNote(input: CreateNoteInput): Promise<Note> {
  const { data, error } = await supabase
    .from("notes")
    .insert({ title: input.title, body: input.body ?? "" })
    .select()
    .single();
  if (error) throw error;
  return fromRow(data);
}

export async function updateNote(
  id: string,
  updates: Partial<CreateNoteInput>,
): Promise<Note> {
  const { data, error } = await supabase
    .from("notes")
    .update({
      ...(updates.title !== undefined && { title: updates.title }),
      ...(updates.body !== undefined && { body: updates.body }),
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return fromRow(data);
}

export async function deleteNote(id: string): Promise<void> {
  const { error } = await supabase
    .from("notes")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function getLinksForNote(noteId: string): Promise<NoteLink[]> {
  const { data, error } = await supabase
    .from("note_links")
    .select("*")
    .or(`source_note_id.eq.${noteId},target_note_id.eq.${noteId}`)
    .is("deleted_at", null);
  if (error) throw error;
  return data.map((row: NoteLinkRow) => toLink(row, noteId));
}

export async function createLink(
  sourceNoteId: string,
  targetNoteId: string,
): Promise<NoteLink> {
  if (sourceNoteId === targetNoteId) throw new SelfLinkError();

  const { data, error } = await supabase
    .from("note_links")
    .insert({ source_note_id: sourceNoteId, target_note_id: targetNoteId })
    .select()
    .single();
  if (error) throw error;
  return toLink(data, sourceNoteId);
}

export async function deleteLink(id: string): Promise<void> {
  const { error } = await supabase
    .from("note_links")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
