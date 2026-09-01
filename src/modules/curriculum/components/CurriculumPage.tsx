"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { PageTemplate } from "@/src/components/ui/PageTemplate";
import { Panel } from "@/src/components/ui/Panel";
import { ProgressBar } from "@/src/components/ui/ProgressBar";
import { StatCard } from "@/src/components/ui/StatCard";
import { hueFor } from "@/src/components/moduleHues";
import { register, unregister } from "@/src/lib/commandPalette";
import { registerShortcuts, unregisterShortcuts } from "@/src/lib/shortcuts";
import {
  TRACKS,
  topicsInTrack,
} from "@/src/modules/curriculum/curriculumCatalog";
import {
  nextUp,
  overallProgress,
  tierCounts,
  topicState,
  trackState,
} from "@/src/modules/curriculum/curriculumProgress";
import { TopicGraph } from "@/src/modules/curriculum/components/TopicGraph";
import { TopicChapters } from "@/src/modules/curriculum/components/TopicChapters";
import { useCurriculumStore } from "@/src/modules/curriculum/useCurriculumStore";
import type { CurriculumIndex, TopicId } from "@/src/modules/curriculum/types";

const HREF = "/curriculum";

interface CurriculumPageProps {
  // Read off disk by the server component that renders this — see content.ts.
  // Metadata only: the chapter PROSE is fetched one file at a time by the
  // reader route, so opening the map doesn't ship the textbook.
  index: CurriculumIndex;
}

const TIER_LABEL = {
  foundational: "Foundational",
  core: "Core",
  advanced: "Advanced",
} as const;

export function CurriculumPage({ index }: CurriculumPageProps) {
  const router = useRouter();
  const hue = hueFor(HREF);
  const completedMap = useCurriculumStore((store) => store.completed);
  const starred = useCurriculumStore((store) => store.starred);
  const error = useCurriculumStore((store) => store.error);
  const fetchProgress = useCurriculumStore((store) => store.fetchProgress);

  const [trackId, setTrackId] = useState(TRACKS[0].id);
  const [selectedId, setSelectedId] = useState<TopicId | null>(null);

  useEffect(() => {
    void fetchProgress();
  }, [fetchProgress]);

  useEffect(() => {
    register("curriculum", [
      {
        id: "go-to-page",
        label: "Go to Curriculum",
        keywords: ["curriculum", "textbook", "learn", "study", "syllabus"],
        action: () => router.push(HREF),
      },
      {
        id: "resume",
        label: "Resume the curriculum",
        keywords: ["curriculum", "resume", "continue", "next chapter"],
        action: () => router.push(HREF),
      },
    ]);
    registerShortcuts("curriculum", [
      {
        combo: "g c",
        commandId: "curriculum.go-to-page",
        description: "Open the curriculum",
      },
    ]);
    return () => {
      unregisterShortcuts("curriculum");
      unregister("curriculum");
    };
  }, [router]);

  // One Set for the whole page: every number below is a pure function of it,
  // recomputed rather than mirrored into the store where it could drift.
  const completed = useMemo(
    () => new Set(Object.keys(completedMap)),
    [completedMap],
  );

  const overall = useMemo(
    () => overallProgress(index, completed),
    [index, completed],
  );
  const track = useMemo(
    () => trackState(trackId, index, completed),
    [trackId, index, completed],
  );
  const tiers = useMemo(
    () => tierCounts(topicsInTrack(trackId), index, completed),
    [trackId, index, completed],
  );
  const upNext = useMemo(
    () => nextUp(index, completed, trackId),
    [index, completed, trackId],
  );

  // Derived, not an effect: the selection defaults to the track's own next-up
  // topic, so switching tracks lands on something to read rather than on a
  // stale node from the track you just left.
  const activeTopicId =
    selectedId &&
    topicsInTrack(trackId).some((topic) => topic.id === selectedId)
      ? selectedId
      : (upNext?.topic.id ?? topicsInTrack(trackId)[0].id);

  const activeState = useMemo(() => {
    const topic = topicsInTrack(trackId).find(
      (entry) => entry.id === activeTopicId,
    )!;
    return topicState(topic, index, completed);
  }, [trackId, activeTopicId, index, completed]);

  const starredCount = Object.keys(starred).length;

  return (
    <PageTemplate
      description="Everything from data structures to frontier models, as one prerequisite graph. Pick a track, follow the arrows, read the chapters."
      error={error}
      eyebrow="Curriculum"
      hero={
        <StatCard
          hint={
            overall.total === 0
              ? "No chapters written yet — see docs/curriculum-authoring-prompt.md"
              : `${overall.topicsDone} of ${overall.topicsWithMaterial} topics complete · ${formatHours(overall.minutesRemaining)} left`
          }
          hue={hue}
          label="Chapters read"
          size="hero"
          value={
            overall.total === 0 ? null : `${overall.done} / ${overall.total}`
          }
          whenAbsent="Start with CS Foundations"
        />
      }
      href={HREF}
      icon={GraduationCap}
      stats={[
        <StatCard
          hue={hue}
          hint={track.track.label}
          key="track"
          label="This track"
          value={
            track.totalCount === 0
              ? null
              : `${track.doneCount} / ${track.totalCount}`
          }
        />,
        <StatCard
          key="topics"
          label="Topics on the map"
          value={`${overall.topicsWithMaterial} / 163`}
          hint="with material written"
        />,
        <StatCard
          key="remaining"
          label="Reading left"
          value={
            overall.minutesRemaining === 0
              ? null
              : formatHours(overall.minutesRemaining)
          }
          hint="across every track"
        />,
        <StatCard
          key="starred"
          label="Flagged to revisit"
          value={starredCount}
          hint="chapters starred"
        />,
      ]}
      title="Learn the whole stack, in order"
    >
      <Panel
        // `min-w-0`: the graph's inner canvas has an explicit pixel width, and
        // a grid item's default `min-width: auto` would let that width push the
        // whole page wider instead of scrolling inside the graph's own
        // `overflow-x-auto`.
        className="min-w-0"
        aside={
          upNext ? (
            <Link
              className="text-sm font-medium text-accent-strong hover:text-accent"
              href={`/curriculum/${upNext.topic.id}/${upNext.lesson.id}`}
            >
              Next up: {upNext.lesson.title} →
            </Link>
          ) : null
        }
        description={track.track.blurb}
        overline="Track"
        title={track.track.label}
      >
        <div className="mb-5 flex flex-wrap gap-2">
          {TRACKS.map((entry) => {
            const state = trackState(entry.id, index, completed);
            const active = entry.id === trackId;
            return (
              <button
                aria-current={active ? "true" : undefined}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? "border-accent-border bg-accent-surface text-accent-strong"
                    : "border-border bg-surface text-muted hover:border-accent-border hover:text-foreground"
                }`}
                key={entry.id}
                onClick={() => {
                  setTrackId(entry.id);
                  setSelectedId(null);
                }}
                type="button"
              >
                {entry.label}
                <span className="ml-2 tabular-nums text-subtle">
                  {state.totalCount === 0
                    ? "—"
                    : `${state.doneCount}/${state.totalCount}`}
                </span>
              </button>
            );
          })}
        </div>

        <TopicGraph
          hue={track.track.hue}
          onSelect={(topic) => setSelectedId(topic.id)}
          selectedId={activeTopicId}
          states={track.topics}
        />

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {tiers.map((tier) => (
            <div key={tier.tier}>
              <div className="mb-1.5 flex items-baseline justify-between text-xs">
                <span className="font-medium text-muted">
                  {TIER_LABEL[tier.tier]}
                </span>
                <span className="tabular-nums text-subtle">
                  {tier.done} / {tier.total}
                </span>
              </div>
              <ProgressBar
                hue={track.track.hue}
                progress={tier.total === 0 ? 0 : tier.done / tier.total}
              />
            </div>
          ))}
        </div>
      </Panel>

      <TopicChapters hue={track.track.hue} state={activeState} />
    </PageTemplate>
  );
}

// "6h 40m", not "400 minutes". Past an hour or so, minutes stop being a
// quantity anyone can picture, and this number's whole job is to be pictured.
function formatHours(minutes: number): string {
  if (minutes === 0) return "0m";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}
