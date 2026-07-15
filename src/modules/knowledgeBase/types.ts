export interface Note {
  id: string;
  title: string;
  body: string;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// A link as seen from one particular note's point of view: `linkId` identifies
// the row (for deleteLink), `noteId` is "the other side" regardless of
// whether this note was the row's source or target (myhub_plan.md Part A
// §A.2 — directional at the row level, bi-directional at the query level).
export interface NoteLink {
  linkId: string;
  noteId: string;
}
