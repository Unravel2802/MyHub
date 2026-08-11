"use client";

import { Link2, Plus } from "lucide-react";
import { EmptyState } from "@/src/components/ui/EmptyState";
import type { Note, NoteLink } from "@/src/modules/knowledgeBase/types";

interface NoteLinksPanelProps {
  links: NoteLink[];
  notes: Note[];
  onSelectNote: (id: string) => void;
  onUnlink: (linkId: string, noteId: string) => void;
  onOpenPicker: () => void;
}

// Backlinks for the selected note. Links are stored directionally but read
// bi-directionally (see NoteRepository), so a link shown here may have been
// created from either end — which is why the label falls back to "Deleted
// note" rather than assuming the other side still exists.
export function NoteLinksPanel({
  links,
  notes,
  onSelectNote,
  onUnlink,
  onOpenPicker,
}: NoteLinksPanelProps) {
  return (
    <section aria-labelledby="note-links-heading" className="panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold" id="note-links-heading">
            Backlinks &amp; connections
          </h2>
          <p className="mt-1 text-sm text-muted">
            Links are visible from both connected notes.
          </p>
        </div>
        <button
          className="inline-flex h-9 items-center gap-2 rounded-md border border-input bg-surface px-3 text-sm font-medium hover:bg-surface-subtle"
          onClick={() => onOpenPicker()}
          type="button"
        >
          <Plus aria-hidden="true" className="size-4" />
          Link note
        </button>
      </div>
      {links.length > 0 ? (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {links.map((link) => {
            const other = notes.find((note) => note.id === link.noteId);
            return (
              <li
                className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface-subtle px-3 py-2"
                key={link.linkId}
              >
                <button
                  className="truncate text-left text-sm font-medium text-hue-fuchsia hover:underline"
                  onClick={() => onSelectNote(link.noteId)}
                  type="button"
                >
                  {other?.title ?? "Deleted note"}
                </button>
                <button
                  className="shrink-0 text-xs text-danger hover:underline"
                  onClick={() => onUnlink(link.linkId, link.noteId)}
                  type="button"
                >
                  Unlink
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          action={
            <button onClick={() => onOpenPicker()} type="button">
              Link another note
            </button>
          }
          description="Connect this note to another idea to build context in both directions."
          icon={Link2}
          title="No backlinks yet"
        />
      )}
    </section>
  );
}
