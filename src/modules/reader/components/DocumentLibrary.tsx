"use client";

import { FileText, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { EmptyState } from "@/src/components/ui/EmptyState";
import type { ReaderDocument } from "@/src/modules/reader/types";

interface DocumentLibraryProps {
  documents: ReaderDocument[];
  openDocumentId: string | null;
  isUploading: boolean;
  onOpen: (id: string) => void;
  onUpload: (input: { title: string; file: File }) => void;
  onDelete: (id: string) => void;
}

function formatSize(bytes: number): string {
  const mb = bytes / 1_048_576;
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

// Title defaults to the filename minus its extension — the overwhelmingly
// common case is that the filename IS the title, and making the user retype it
// before every upload would be friction for nothing. Renaming can come later.
function titleFromFile(file: File): string {
  return file.name.replace(/\.pdf$/i, "").trim() || file.name;
}

export function DocumentLibrary({
  documents,
  openDocumentId,
  isUploading,
  onOpen,
  onUpload,
  onDelete,
}: DocumentLibraryProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  function accept(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    onUpload({ file, title: titleFromFile(file) });
  }

  return (
    <div className="grid gap-4">
      {/* The drop zone is also a button, so upload works by drag, by click,
          and by keyboard — a drop-only target is unusable without a mouse. */}
      <div
        className={`rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
          isDragging
            ? "border-accent bg-accent-surface"
            : "border-border bg-surface-subtle"
        }`}
        onDragLeave={() => setIsDragging(false)}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          accept(event.dataTransfer.files);
        }}
      >
        <input
          accept="application/pdf"
          className="sr-only"
          onChange={(event) => {
            accept(event.target.files);
            // Reset so re-picking the same file fires change again.
            event.target.value = "";
          }}
          ref={inputRef}
          type="file"
        />
        <button
          className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-60"
          disabled={isUploading}
          onClick={() => inputRef.current?.click()}
          type="button"
        >
          <Upload aria-hidden="true" className="size-4" />
          {isUploading ? "Uploading…" : "Add a PDF"}
        </button>
        <p className="mt-2 text-xs text-muted">
          or drop one here · PDF only, up to 50MB
        </p>
      </div>

      {documents.length === 0 ? (
        <EmptyState
          description="Add a PDF to start reading and highlighting."
          title="Nothing to read yet"
        />
      ) : (
        <ul className="grid gap-2">
          {documents.map((doc) => {
            const isOpen = doc.id === openDocumentId;
            return (
              <li key={doc.id}>
                <div
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                    isOpen
                      ? "border-accent-border bg-accent-surface"
                      : "border-border bg-surface hover:border-input-hover"
                  }`}
                >
                  <button
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    onClick={() => onOpen(doc.id)}
                    type="button"
                  >
                    <FileText
                      aria-hidden="true"
                      className="size-4 shrink-0 text-accent-strong"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {doc.title}
                      </span>
                      <span className="block text-xs text-muted">
                        {formatSize(doc.sizeBytes)}
                        {doc.pageCount
                          ? ` · ${doc.pageCount} pages · on page ${doc.lastPageRead}`
                          : ""}
                      </span>
                    </span>
                  </button>
                  <button
                    aria-label={`Remove ${doc.title}`}
                    className="shrink-0 rounded p-1 text-muted transition-colors hover:bg-surface-subtle hover:text-danger"
                    onClick={() => onDelete(doc.id)}
                    type="button"
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
