"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { searchCommands } from "@/src/lib/commandPalette";
import { useCommandPaletteStore } from "@/src/modules/commandPalette/useCommandPaletteStore";

export function CommandPalette() {
  const { isOpen, query, close, setQuery, toggle } = useCommandPaletteStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const commands = useMemo(() => searchCommands(query), [query]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        toggle();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggle]);

  useEffect(() => {
    if (!isOpen) return;
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [isOpen]);

  if (!isOpen) return null;

  function runSelected() {
    const command = commands[Math.min(selectedIndex, commands.length - 1)];
    if (!command) return;
    command.action();
    close();
  }

  return (
    <div
      aria-label="Command palette"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-start justify-center bg-canvas/70 px-4 pt-[12vh] backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
      role="dialog"
    >
      <div className="floating w-full max-w-xl overflow-hidden rounded-lg bg-surface">
        <input
          aria-label="Search commands"
          aria-controls="command-palette-results"
          autoComplete="off"
          className="h-14 w-full border-b border-border bg-surface px-5 text-base text-foreground outline-none placeholder:text-muted"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setSelectedIndex((current) =>
                commands.length === 0 ? 0 : (current + 1) % commands.length,
              );
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setSelectedIndex((current) =>
                commands.length === 0
                  ? 0
                  : (current - 1 + commands.length) % commands.length,
              );
            } else if (event.key === "Enter") {
              event.preventDefault();
              runSelected();
            } else if (event.key === "Escape") {
              event.preventDefault();
              close();
            }
          }}
          placeholder="Search commands..."
          ref={inputRef}
          value={query}
        />
        <div
          aria-label="Command results"
          className="max-h-80 overflow-y-auto p-2"
          id="command-palette-results"
          role="listbox"
        >
          {commands.length > 0 ? (
            commands.map((command, index) => (
              <button
                aria-selected={index === selectedIndex}
                className={`flex w-full items-center rounded-md px-3 py-2 text-left text-sm transition-all duration-200 ease-in-out ${index === selectedIndex ? "bg-accent-surface text-accent-strong" : "text-body hover:bg-surface-subtle hover:text-foreground"}`}
                key={command.id}
                onClick={() => {
                  command.action();
                  close();
                }}
                onMouseEnter={() => setSelectedIndex(index)}
                role="option"
                type="button"
              >
                {command.label}
              </button>
            ))
          ) : (
            <p className="px-3 py-5 text-center text-sm text-muted">
              No commands found.
            </p>
          )}
        </div>
        <p className="border-t border-border px-5 py-2 text-xs text-muted">
          Arrow keys to move · Enter to run · Esc to close
        </p>
      </div>
    </div>
  );
}
