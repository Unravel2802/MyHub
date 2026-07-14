"use client";

import { useId } from "react";
import type { ReactNode } from "react";

interface FormFieldProps {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  // Receives the wiring: id, and aria-describedby pointing at the hint/error.
  children: (props: {
    id: string;
    "aria-describedby": string | undefined;
    "aria-invalid": boolean | undefined;
  }) => ReactNode;
}

// Label + control + hint/error, with the accessibility wiring done ONCE rather
// than re-derived (or forgotten) at every call site. A hint that isn't announced
// might as well not exist for a screen reader.
export function FormField({ label, hint, error, children }: FormFieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy =
    [errorId, hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="grid gap-1.5">
      <label
        className="text-sm font-medium text-body"
        htmlFor={id}
      >
        {label}
      </label>
      {children({
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
      })}
      {error ? (
        <p className="text-xs text-danger" id={errorId}>
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs leading-relaxed text-muted" id={hintId}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
