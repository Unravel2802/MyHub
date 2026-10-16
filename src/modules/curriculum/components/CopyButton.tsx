"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { Copy } from "lucide-react";

export function CopyButton({
  raw,
  contentRef,
}: {
  raw: string;
  contentRef: RefObject<HTMLElement | null>;
}) {
  const [label, setLabel] = useState("Copy");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  async function copy() {
    try {
      await navigator.clipboard.writeText(raw);
      setLabel("Copied");
    } catch {
      const selection = window.getSelection();
      if (contentRef.current && selection) {
        const range = document.createRange();
        range.selectNodeContents(contentRef.current);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      setLabel("Text selected");
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setLabel("Copy"), 1500);
  }
  return (
    <button
      className="inline-flex items-center gap-1 font-sans text-xs text-muted hover:text-foreground"
      onClick={() => void copy()}
      type="button"
    >
      <Copy aria-hidden className="size-3" />
      <span aria-live="polite">{label}</span>
    </button>
  );
}
