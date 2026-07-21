"use client";

import { useEffect, useMemo, useState } from "react";
import { Dumbbell } from "lucide-react";
import { AppShell } from "@/src/components/AppShell";
import { PageHeader } from "@/src/components/ui/PageHeader";
import { StatCard } from "@/src/components/ui/StatCard";
import { hueFor } from "@/src/components/moduleHues";
import { register, unregister } from "@/src/lib/commandPalette";
import { registerShortcuts, unregisterShortcuts } from "@/src/lib/shortcuts";
import { DrillList } from "@/src/modules/designDrills/components/DrillList";
import { DrillDetail } from "@/src/modules/designDrills/components/DrillDetail";
import { DrillWorkspace } from "@/src/modules/designDrills/components/DrillWorkspace";
import { useDesignDrillsStore } from "@/src/modules/designDrills/useDesignDrillsStore";

export function DesignDrillsPage() {
  const {
    drills,
    attempts,
    isLoading,
    isStarting,
    pendingIds,
    error,
    fetchDrills,
    fetchAttempts,
    startAttempt,
    submitAttempt,
    saveAttemptNotes,
  } = useDesignDrillsStore();

  const [activeAttemptId, setActiveAttemptId] = useState<string | null>(null);
  const [previewDrillId, setPreviewDrillId] = useState<string | null>(null);
  const [startingDrillId, setStartingDrillId] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([fetchDrills(), fetchAttempts()]);
  }, [fetchDrills, fetchAttempts]);

  useEffect(() => {
    register("design-drills", [
      {
        id: "refresh",
        label: "Refresh design drills",
        keywords: ["design", "drills", "refresh", "reload"],
        action: () => document.getElementById("drills-refresh")?.click(),
      },
    ]);
    // "r d" is Dashboard's refresh combo; "r g" stays free.
    registerShortcuts("design-drills", [
      {
        combo: "r g",
        commandId: "design-drills.refresh",
        description: "Refresh design drills",
      },
    ]);
    return () => {
      unregisterShortcuts("design-drills");
      unregister("design-drills");
    };
  }, []);

  const activeAttempt = useMemo(
    () => attempts.find((attempt) => attempt.id === activeAttemptId) ?? null,
    [attempts, activeAttemptId],
  );
  const activeDrill = useMemo(
    () =>
      activeAttempt
        ? (drills.find((drill) => drill.id === activeAttempt.drillId) ?? null)
        : null,
    [drills, activeAttempt],
  );
  const previewDrill = useMemo(
    () => drills.find((drill) => drill.id === previewDrillId) ?? null,
    [drills, previewDrillId],
  );

  const completedCount = useMemo(
    () => attempts.filter((attempt) => attempt.completedAt).length,
    [attempts],
  );
  const strongCount = useMemo(
    () => attempts.filter((attempt) => attempt.selfRating === "strong").length,
    [attempts],
  );

  async function handleStart(drillId: string) {
    setStartingDrillId(drillId);
    try {
      const attempt = await startAttempt(drillId);
      setPreviewDrillId(null);
      setActiveAttemptId(attempt.id);
    } catch {
      // store.error already holds the user-facing message; nothing else to do.
    } finally {
      setStartingDrillId(null);
    }
  }

  return (
    <AppShell activeHref="/design-drills" title="Design Drills">
      <section className="page-fade min-w-0 px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader
          actions={
            <button
              className="h-10 rounded-md border border-input bg-surface px-4 text-sm text-body hover:border-input-hover"
              disabled={isLoading}
              id="drills-refresh"
              onClick={() => void Promise.all([fetchDrills(), fetchAttempts()])}
              type="button"
            >
              Refresh
            </button>
          }
          bleed
          className="mb-6"
          eyebrow="Interview preparation"
          hue={hueFor("/design-drills")}
          icon={Dumbbell}
          title="Design Drills"
        />

        {error ? (
          <p
            aria-live="assertive"
            className="mb-5 rounded-md border border-danger-border bg-danger-surface px-3 py-2 text-sm text-danger"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        {activeDrill && activeAttempt ? (
          <DrillWorkspace
            attempt={activeAttempt}
            drill={activeDrill}
            onExit={() => setActiveAttemptId(null)}
            onSaveNotes={(notes) =>
              void saveAttemptNotes(activeAttempt.id, notes)
            }
            onSubmit={(input) => submitAttempt(activeAttempt.id, input)}
            pastAttempts={attempts.filter(
              (attempt) =>
                attempt.drillId === activeDrill.id &&
                attempt.id !== activeAttempt.id,
            )}
            pending={pendingIds.includes(activeAttempt.id)}
          />
        ) : previewDrill ? (
          <DrillDetail
            drill={previewDrill}
            isStarting={isStarting && startingDrillId === previewDrill.id}
            onBack={() => setPreviewDrillId(null)}
            onStart={() => void handleStart(previewDrill.id)}
            pastAttempts={attempts.filter(
              (attempt) => attempt.drillId === previewDrill.id,
            )}
          />
        ) : (
          <div className="grid gap-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <StatCard
                hint="Timed attempts you've submitted and self-graded"
                hue={hueFor("/design-drills")}
                label="Attempts completed"
                value={completedCount}
              />
              <StatCard
                hint='Self-rated "strong" — ready for an onsite'
                label="Strong reps"
                value={strongCount}
              />
            </div>
            <DrillList
              attempts={attempts}
              drills={drills}
              isStarting={isStarting}
              onOpen={setPreviewDrillId}
              onStart={handleStart}
              startingDrillId={startingDrillId}
            />
          </div>
        )}
      </section>
    </AppShell>
  );
}
