"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { hueVar, type HueName } from "@/src/components/moduleHues";
import { EmptyState } from "@/src/components/ui/EmptyState";
import type { Annotation } from "@/src/modules/reader/types";
import { HIGHLIGHT_HUES } from "@/src/modules/reader/highlightHues";

interface AnnotationSidebarProps {
  annotations: Annotation[];
  activeId: string | null;
  onJumpTo: (annotation: Annotation) => void;
  onUpdate: (
    id: string,
    updates: { comment?: string | null; hue?: HueName },
  ) => void;
  onDelete: (id: string) => void;
}

// Every highlight in the open document, in reading order. Doubles as the
// table of contents for your own attention — the reason to annotate at all is
// to find the passage again later.
export function AnnotationSidebar({
  annotations,
  activeId,
  onJumpTo,
  onUpdate,
  onDelete,
}: AnnotationSidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  if (annotations.length === 0)
    return (
      <EmptyState
        description="Select text in the document to highlight it. Your highlights collect here."
        title="No highlights yet"
      />
    );

  return (
    <ul className="grid gap-2">
      {annotations.map((annotation) => {
        const isActive = annotation.id === activeId;
        const isEditing = annotation.id === editingId;
        return (
          <li
            className="rounded-lg border bg-surface p-3 transition-colors"
            key={annotation.id}
            style={{
              borderColor: isActive
                ? `color-mix(in srgb, ${hueVar(annotation.hue)} 55%, transparent)`
                : "var(--border)",
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <button
                className="min-w-0 flex-1 text-left"
                onClick={() => onJumpTo(annotation)}
                type="button"
              >
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">
                  Page {annotation.pageNumber}
                </p>
                {/* The quoted passage, clamped: a highlight can be a
                    paragraph, and the sidebar is for finding it again, not
                    re-reading it here. */}
                <p
                  className="mt-1 line-clamp-3 border-l-2 pl-2 text-sm leading-snug text-body"
                  style={{ borderColor: hueVar(annotation.hue) }}
                >
                  {annotation.selectedText}
                </p>
              </button>
              <button
                aria-label="Delete highlight"
                className="shrink-0 rounded p-1 text-muted transition-colors hover:bg-surface-subtle hover:text-danger"
                onClick={() => onDelete(annotation.id)}
                type="button"
              >
                <Trash2 aria-hidden="true" className="size-3.5" />
              </button>
            </div>

            {isEditing ? (
              <div className="mt-2 grid gap-2">
                <textarea
                  aria-label="Note"
                  autoFocus
                  className="w-full rounded-md border border-input bg-surface-subtle px-2 py-1.5 text-sm text-foreground"
                  onChange={(event) => setDraft(event.target.value)}
                  rows={3}
                  value={draft}
                />
                <div className="flex gap-2">
                  <button
                    className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
                    onClick={() => {
                      onUpdate(annotation.id, {
                        comment: draft.trim() || null,
                      });
                      setEditingId(null);
                    }}
                    type="button"
                  >
                    Save
                  </button>
                  <button
                    className="rounded-md px-2.5 py-1 text-xs text-muted transition-colors hover:text-foreground"
                    onClick={() => setEditingId(null)}
                    type="button"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                {annotation.comment ? (
                  <p className="mt-2 text-sm leading-relaxed text-foreground">
                    {annotation.comment}
                  </p>
                ) : null}
                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="flex gap-1">
                    {HIGHLIGHT_HUES.map((hue) => (
                      <button
                        aria-label={`Recolour to ${hue}`}
                        className="size-4 rounded-full border transition-transform hover:scale-110"
                        key={hue}
                        onClick={() => onUpdate(annotation.id, { hue })}
                        style={{
                          background: `color-mix(in srgb, ${hueVar(hue)} 45%, transparent)`,
                          borderColor:
                            annotation.hue === hue
                              ? hueVar(hue)
                              : "transparent",
                        }}
                        type="button"
                      />
                    ))}
                  </div>
                  <button
                    className="text-xs font-medium text-accent-strong transition-opacity hover:opacity-80"
                    onClick={() => {
                      setEditingId(annotation.id);
                      setDraft(annotation.comment ?? "");
                    }}
                    type="button"
                  >
                    {annotation.comment ? "Edit note" : "Add note"}
                  </button>
                </div>
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}
