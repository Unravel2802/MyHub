import {
  TOPICS,
  TRACKS,
  topicsInTrack,
} from "@/src/modules/curriculum/curriculumCatalog";
import {
  lessonKey,
  type CurriculumIndex,
  type LessonMeta,
  type Tier,
  type Topic,
  type TopicId,
  type TopicState,
  type TrackState,
} from "@/src/modules/curriculum/types";

// Rolling ticks up into the numbers the page shows. Pure functions over
// (catalog, content index, completed set) — no store, no fetch — so the whole
// scoring model is unit-testable and the components stay dumb.

export function topicState(
  topic: Topic,
  index: CurriculumIndex,
  completed: ReadonlySet<string>,
): TopicState {
  const lessons = index[topic.id] ?? [];
  const doneCount = lessons.filter((lesson) =>
    completed.has(lessonKey(topic.id, lesson.id)),
  ).length;

  return {
    topic,
    lessons,
    doneCount,
    totalCount: lessons.length,
    // Zero when there is nothing written yet. The arithmetic wants to say 0/0
    // is complete; a topic with no material is 0% learned, and a graph full of
    // full bars for chapters that don't exist would be a lie the whole page
    // rests on.
    progress: lessons.length === 0 ? 0 : doneCount / lessons.length,
    status: statusOf(lessons, doneCount),
    available: isAvailable(topic, index, completed),
  };
}

function statusOf(
  lessons: LessonMeta[],
  doneCount: number,
): TopicState["status"] {
  if (lessons.length === 0) return "empty";
  if (doneCount === 0) return "not_started";
  return doneCount === lessons.length ? "done" : "in_progress";
}

// "You have cleared the way to this one." Not a lock — see types.ts.
//
// A prereq that has NO material yet counts as cleared. Otherwise the whole
// graph downstream of an unwritten topic would be permanently unavailable, and
// on day one — when nothing is written — the page would recommend nothing at
// all, which is the opposite of what a "start here" marker is for.
function isAvailable(
  topic: Topic,
  index: CurriculumIndex,
  completed: ReadonlySet<string>,
): boolean {
  return topic.prereqs.every((prereqId) => {
    const lessons = index[prereqId];
    if (!lessons || lessons.length === 0) return true;
    return lessons.every((lesson) =>
      completed.has(lessonKey(prereqId, lesson.id)),
    );
  });
}

export function trackState(
  trackId: string,
  index: CurriculumIndex,
  completed: ReadonlySet<string>,
): TrackState {
  const track = TRACKS.find((entry) => entry.id === trackId)!;
  const topics = topicsInTrack(trackId).map((topic) =>
    topicState(topic, index, completed),
  );
  const doneCount = sum(topics.map((state) => state.doneCount));
  const totalCount = sum(topics.map((state) => state.totalCount));

  return {
    track,
    topics,
    doneCount,
    totalCount,
    progress: totalCount === 0 ? 0 : doneCount / totalCount,
  };
}

export interface TierCount {
  tier: Tier;
  done: number;
  total: number;
}

// The right-rail breakdown, counted in CHAPTERS rather than topics — it sits
// beside a "N of M read" ring, and two numbers on one panel that count
// different things is how a stats panel stops being read.
export function tierCounts(
  topics: readonly Topic[],
  index: CurriculumIndex,
  completed: ReadonlySet<string>,
): TierCount[] {
  const order: Tier[] = ["foundational", "core", "advanced"];
  return order.map((tier) => {
    const inTier = topics.filter((topic) => topic.tier === tier);
    const states = inTier.map((topic) => topicState(topic, index, completed));
    return {
      tier,
      done: sum(states.map((state) => state.doneCount)),
      total: sum(states.map((state) => state.totalCount)),
    };
  });
}

export interface OverallProgress {
  done: number;
  total: number;
  progress: number;
  topicsDone: number;
  topicsWithMaterial: number;
  minutesRemaining: number;
}

export function overallProgress(
  index: CurriculumIndex,
  completed: ReadonlySet<string>,
): OverallProgress {
  const states = TOPICS.map((topic) => topicState(topic, index, completed));
  const done = sum(states.map((state) => state.doneCount));
  const total = sum(states.map((state) => state.totalCount));

  return {
    done,
    total,
    progress: total === 0 ? 0 : done / total,
    topicsDone: states.filter((state) => state.status === "done").length,
    // Counted against topics that HAVE material, not all 163: "12 of 163
    // topics" would read as a failure on day one when 151 of them simply
    // haven't been written yet.
    topicsWithMaterial: states.filter((state) => state.totalCount > 0).length,
    minutesRemaining: sum(
      states.flatMap((state) =>
        state.lessons
          .filter(
            (lesson) => !completed.has(lessonKey(state.topic.id, lesson.id)),
          )
          .map((lesson) => lesson.minutes ?? 0),
      ),
    ),
  };
}

// What to read next: the earliest unfinished chapter in the earliest available,
// unfinished topic — catalog order, which is the order a reader should meet
// them. Null when everything with material is finished.
export interface NextUp {
  topic: Topic;
  lesson: LessonMeta;
}

export function nextUp(
  index: CurriculumIndex,
  completed: ReadonlySet<string>,
  trackId?: string,
): NextUp | null {
  const pool = trackId ? topicsInTrack(trackId) : TOPICS;
  const states = pool.map((topic) => topicState(topic, index, completed));

  // Two passes, in this order: finish what you started before opening something
  // new. A "next up" that keeps pointing at fresh topics while three sit
  // half-read is how a reading plan turns into a pile of half-read topics.
  const started = states.find((state) => state.status === "in_progress");
  const fresh = states.find(
    (state) => state.status === "not_started" && state.available,
  );
  const target =
    started ??
    fresh ??
    // Nothing available and unstarted — fall back to any unfinished topic, so
    // the page still points somewhere rather than going blank.
    states.find((state) => state.status === "not_started");
  if (!target) return null;

  const lesson = target.lessons.find(
    (entry) => !completed.has(lessonKey(target.topic.id, entry.id)),
  );
  return lesson ? { topic: target.topic, lesson } : null;
}

// Previous/next chapter within a topic, for the reader's footer navigation.
export function siblingLessons(
  topicId: TopicId,
  lessonId: string,
  index: CurriculumIndex,
): { previous: LessonMeta | null; next: LessonMeta | null } {
  const lessons = index[topicId] ?? [];
  const at = lessons.findIndex((lesson) => lesson.id === lessonId);
  if (at === -1) return { previous: null, next: null };
  return {
    previous: lessons[at - 1] ?? null,
    next: lessons[at + 1] ?? null,
  };
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
