"use client";

import { useSyncExternalStore } from "react";
import {
  getServerTheme,
  getTheme,
  setTheme,
  subscribeTheme,
  THEMES,
  type Theme,
} from "@/src/lib/theme";

const LABELS: Record<Theme, string> = {
  light: "Light",
  dark: "Dark",
};

export function ThemeToggle() {
  // The inline script in layout.tsx already applied the stored theme to <html>
  // before paint; this only reflects which option is active.
  const theme = useSyncExternalStore(subscribeTheme, getTheme, getServerTheme);

  return (
    <div
      aria-label="Theme"
      className="flex gap-1 rounded-md border border-border bg-surface-subtle p-1"
      role="group"
    >
      {THEMES.map((option) => (
        <button
          key={option}
          aria-pressed={theme === option}
          className={`h-7 flex-1 rounded px-2 text-xs font-medium transition-colors ${
            theme === option
              ? "bg-primary text-primary-foreground"
              : "text-muted hover:text-foreground"
          }`}
          onClick={() => setTheme(option)}
          type="button"
        >
          {LABELS[option]}
        </button>
      ))}
    </div>
  );
}
