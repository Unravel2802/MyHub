"use client";

import { NotebookPen } from "lucide-react";
import { Badge } from "@/src/components/ui/Badge";
import { EmptyState } from "@/src/components/ui/EmptyState";
import type { Note } from "@/src/modules/knowledgeBase/types";

interface NotesListProps {
  notes: Note[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
}

// The note picker. Presentational — the page owns which note is selected and
// what happens when one is created.
export function NotesList({
  notes,
  selectedId,
  onSelect,
  onCreate,
}: NotesListProps) {
  return (
    <section aria-labelledby="notes-list-heading" className="panel p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold" id="notes-list-heading">
          Your notes
        </h2>
        <Badge tone="neutral">{notes.length}</Badge>
      </div>
      {notes.length === 0 ? (
        <EmptyState
          action={
            <button onClick={onCreate} type="button">
              Write your first note
            </button>
          }
          description="Capture one useful idea now, then link it to the next thing you learn."
          icon={NotebookPen}
          title="Start your knowledge base"
        />
      ) : (
        <ul className="mt-4 grid gap-2">
          {notes.map((note) => (
            <li key={note.id}>
              <button
                className={`w-full rounded-md border p-3 text-left transition-all duration-200 ease-in-out ${selectedId === note.id ? "border-hue-fuchsia-border bg-hue-fuchsia-surface" : "border-border bg-surface-subtle hover:border-input-hover"}`}
                onClick={() => onSelect(note.id)}
                type="button"
              >
                <p className="font-medium text-foreground">{note.title}</p>
                <p className="mt-1 line-clamp-2 text-sm text-muted">
                  {note.body || "No body yet"}
                </p>
                <p className="mt-2 text-xs text-muted">
                  Updated {new Date(note.updatedAt).toLocaleDateString()}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
