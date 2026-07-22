"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Dumbbell, SearchX } from "lucide-react";
import { AppShell } from "@/src/components/AppShell";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { PageHeader } from "@/src/components/ui/PageHeader";
import { hueFor } from "@/src/components/moduleHues";
import { register, unregister } from "@/src/lib/commandPalette";
import { registerShortcuts, unregisterShortcuts } from "@/src/lib/shortcuts";
import { DrillList } from "@/src/modules/designDrills/components/DrillList";
import { DrillDetail } from "@/src/modules/designDrills/components/DrillDetail";
import { DrillWorkspace } from "@/src/modules/designDrills/components/DrillWorkspace";
import { DrillProgressOverview } from "@/src/modules/designDrills/components/DrillProgressOverview";
import { useDesignDrillsStore } from "@/src/modules/designDrills/useDesignDrillsStore";

interface DesignDrillsPageProps {
  slug?: string;
}

export function DesignDrillsPage({ slug }: DesignDrillsPageProps) {
  const router = useRouter();
  const {
    drills,
    attempts,
    isLoading,
    isStarting,
    pendingIds,
    error,
    fetchDrills,
    fetchAttempts,
    fetchBookmarks,
    startAttempt,
    submitAttempt,
    saveAttemptNotes,
    toggleBookmark,
    isBookmarked,
    drillBySlug,
  } = useDesignDrillsStore();

  const [activeAttemptId, setActiveAttemptId] = useState<string | null>(null);
  const [startingDrillId, setStartingDrillId] = useState<string | null>(null);
  const [drillsLoaded, setDrillsLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    void Promise.all([
      fetchDrills(),
      fetchAttempts(),
      fetchBookmarks(),
    ]).finally(() => {
      if (active) setDrillsLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [fetchDrills, fetchAttempts, fetchBookmarks]);

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
  const focusedDrill = slug ? drillBySlug(slug) : undefined;

  async function handleStart(drillId: string) {
    setStartingDrillId(drillId);
    try {
      const attempt = await startAttempt(drillId);
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
              onClick={() =>
                void Promise.all([
                  fetchDrills(),
                  fetchAttempts(),
                  fetchBookmarks(),
                ])
              }
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
        ) : slug && !drillsLoaded ? (
          <EmptyState
            description="Loading the drill and your previous attempts."
            icon={Dumbbell}
            title="Loading drill…"
          />
        ) : slug && focusedDrill ? (
          <DrillDetail
            bookmarked={isBookmarked(focusedDrill.id)}
            bookmarkPending={pendingIds.includes(focusedDrill.id)}
            drill={focusedDrill}
            isStarting={isStarting && startingDrillId === focusedDrill.id}
            onBack={() => router.push("/design-drills")}
            onStart={() => void handleStart(focusedDrill.id)}
            onToggleBookmark={() => void toggleBookmark(focusedDrill.id)}
            pastAttempts={attempts.filter(
              (attempt) => attempt.drillId === focusedDrill.id,
            )}
          />
        ) : slug ? (
          <EmptyState
            action={
              <Link
                className="inline-flex h-10 items-center rounded-md border border-input bg-surface px-4 text-sm font-medium text-body hover:border-input-hover"
                href="/design-drills"
              >
                Browse all drills
              </Link>
            }
            description="This drill may have moved or the link may be incorrect."
            icon={SearchX}
            title="Drill not found"
          />
        ) : (
          <div className="grid gap-6">
            <DrillProgressOverview attempts={attempts} drills={drills} />
            <DrillList
              attempts={attempts}
              drills={drills}
              isBookmarked={isBookmarked}
              isStarting={isStarting}
              onStart={handleStart}
              onToggleBookmark={(drillId) => void toggleBookmark(drillId)}
              pendingIds={pendingIds}
              startingDrillId={startingDrillId}
            />
          </div>
        )}
      </section>
    </AppShell>
  );
}
