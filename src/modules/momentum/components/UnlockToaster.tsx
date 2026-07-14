"use client";

import { useEffect } from "react";
import { ACHIEVEMENTS_BY_KEY } from "@/src/modules/momentum/achievementCatalog";
import { useMomentumStore } from "@/src/modules/momentum/useMomentumStore";

export function UnlockToaster() {
  const pendingToasts = useMomentumStore((state) => state.pendingToasts);
  const dismissToast = useMomentumStore((state) => state.dismissToast);

  useEffect(() => {
    if (pendingToasts.length === 0) return;
    const timers = pendingToasts.map((key) =>
      window.setTimeout(() => dismissToast(key), 6000),
    );
    return () => timers.forEach(window.clearTimeout);
  }, [dismissToast, pendingToasts]);

  if (pendingToasts.length === 0) return null;
  return (
    <div
      aria-live="polite"
      aria-label="Achievement unlocks"
      className="fixed bottom-4 right-4 z-50 grid w-80 gap-2"
    >
      {[...new Set(pendingToasts)].map((key) => {
        const achievement = ACHIEVEMENTS_BY_KEY[key];
        if (!achievement) return null;
        return (
          <div
            className="momentum-toast-in rounded-lg border border-accent-border bg-surface/90 p-4 shadow-xl shadow-black/50 backdrop-blur-md"
            key={key}
            role="status"
          >
            <p className="text-xs font-semibold uppercase text-accent-strong">
              Achievement unlocked
            </p>
            <p className="mt-1 font-semibold text-foreground">
              {achievement.title}
            </p>
            <p className="mt-1 text-sm text-muted">{achievement.description}</p>
            <button
              className="mt-2 text-xs text-muted"
              onClick={() => dismissToast(key)}
              type="button"
            >
              Dismiss
            </button>
          </div>
        );
      })}
    </div>
  );
}
