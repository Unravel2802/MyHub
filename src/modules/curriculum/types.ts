import type { HueName } from "@/src/components/moduleHues";

// The Curriculum module: a software-engineering textbook you read end to end,
// laid out as a prerequisite graph per track (docs/handoff/curriculum.md).
//
// Three things live in three different places, on purpose:
//
//   the GRAPH    curriculumCatalog.ts   — code, changes via a commit
//   the PROSE    content/curriculum/**  — markdown files, change via a commit
//   the PROGRESS curriculum_progress    — a table, changes via a click
//
// Same rule as the Roadmap module: only the part that is about *you* is data.
// The reason the prose is files rather than a `lessons` array in the catalog is
// size — a textbook is megabytes, and a `.ts` array of it would ship every
// chapter to the browser to render a page that shows none of them.

export type TopicId = string; // "backend.caching"
export type TrackId = string; // "backend"
export type LessonId = string; // "01-why-caching-exists"

// How hard the topic is, not how long it takes. Drives the right-rail
// breakdown the way NeetCode's Easy/Medium/Hard does — three buckets, because
// a scale with more resolution than you can honestly assign is a scale you
// stop trusting.
export type Tier = "foundational" | "core" | "advanced";

export interface Track {
  id: TrackId;
  label: string;
  // One sentence on what you can do once you've finished the track. Rendered
  // under the track picker, so it earns its place by being concrete.
  blurb: string;
  hue: HueName;
}

export interface Topic {
  id: TopicId;
  trackId: TrackId;
  label: string;
  summary: string;
  tier: Tier;
  // Topic ids that should come first. Same-track prereqs are drawn as EDGES in
  // the graph; cross-track ones are listed as text on the topic page instead —
  // drawing them would turn thirteen readable DAGs into one hairball, and the
  // information ("you'll want Linear Algebra before Transformers") survives
  // either way.
  prereqs: readonly TopicId[];
}

// --- content (read off disk, see content.ts) ---------------------------------

export interface LessonMeta {
  id: LessonId;
  topicId: TopicId;
  title: string;
  // Reading time in minutes, from the file's frontmatter. Null when the author
  // didn't declare one — shown as blank rather than guessed, because a made-up
  // estimate is worse than no estimate for planning a study session.
  minutes: number | null;
  summary: string | null;
  // Numeric prefix of the filename ("03-cache-invalidation.md" -> 3). The
  // reading ORDER of a textbook is part of its meaning, so it's carried by the
  // filename rather than left to whatever order readdir happens to return.
  order: number;
}

export interface Lesson {
  meta: LessonMeta;
  // Raw markdown, rendered through the shared Markdown wrapper.
  body: string;
}

// topicId -> that topic's chapters, already sorted by `order`. Topics with no
// chapters yet are absent, not empty-arrayed: "no material written yet" is a
// state the UI shows deliberately, and an empty array would be indistinguishable
// from a topic whose files failed to parse.
export type CurriculumIndex = Record<TopicId, LessonMeta[]>;

// --- progress ----------------------------------------------------------------

// "<topicId>/<lessonId>" — matches curriculum_progress.item_key.
export type LessonKey = string;

export function lessonKey(topicId: TopicId, lessonId: LessonId): LessonKey {
  return `${topicId}/${lessonId}`;
}

export interface LessonProgress {
  key: LessonKey;
  completedAt: string | null;
  starred: boolean;
}

// --- computed state (never stored) -------------------------------------------

// A topic's standing once its chapters and your ticks are put together.
//
// `available` is NOT a lock. Nothing in this app stops you reading ahead —
// gating a textbook you own would be theatre. It marks the topics whose
// prereqs you've finished, so the graph can point at where to go next instead
// of leaving you to work it out from the edges.
export interface TopicState {
  topic: Topic;
  lessons: LessonMeta[];
  doneCount: number;
  totalCount: number;
  // 0-1. Zero when the topic has no chapters yet — an unwritten topic is 0%
  // done, not 100%, however tempting the "0 of 0" arithmetic is.
  progress: number;
  status: "empty" | "not_started" | "in_progress" | "done";
  available: boolean;
}

export interface TrackState {
  track: Track;
  topics: TopicState[];
  doneCount: number;
  totalCount: number;
  progress: number;
}
