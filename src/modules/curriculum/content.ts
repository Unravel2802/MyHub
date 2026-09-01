import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  parseFrontmatter,
  parseMinutes,
  stripLeadingTitle,
} from "@/src/modules/curriculum/frontmatter";
import type {
  CurriculumIndex,
  Lesson,
  LessonId,
  LessonMeta,
  TopicId,
} from "@/src/modules/curriculum/types";

// SERVER ONLY. Reads the chapter files off disk and hands the page a metadata
// index; the prose itself is loaded one chapter at a time by the reader route.
//
// Importing this from a "use client" file will fail the build on `node:fs`,
// which is the intended guard rail — see docs/handoff/curriculum.md.
//
// Why the filesystem and not a table: a textbook is prose that changes via a
// commit, exactly like roadmapCatalog.ts's numbers, and it is large. Putting
// megabytes of markdown in Postgres would mean every chapter shows up in
// scripts/exportData.ts's backups, and putting it in a `.ts` array would ship
// every chapter to the browser to render a page that displays none of them.
// Files also make the authoring loop what it should be: drop a `.md` in, and
// the topic gains a chapter.

const CONTENT_ROOT = join(process.cwd(), "content", "curriculum");

// "03-cache-invalidation.md" -> order 3. The reading order of a textbook is
// part of its meaning, so it is carried by the filename rather than left to
// whatever order readdir happens to return (which is not sorted on every
// filesystem, and is not alphabetical past 9 without the zero padding).
const FILENAME = /^(\d+)[-_](.+)\.md$/;

// Built once per process in production. A page render reads ~163 directories;
// doing that on every request would be pointless work for content that cannot
// change without a redeploy. In dev the cache is skipped so a new chapter shows
// up on refresh instead of after a restart.
let cached: CurriculumIndex | null = null;

export function loadCurriculumIndex(): CurriculumIndex {
  if (cached && process.env.NODE_ENV === "production") return cached;

  const index: CurriculumIndex = {};
  for (const topicId of listDirectories(CONTENT_ROOT)) {
    const lessons = listLessons(topicId);
    // Absent, not empty-arrayed: "no material written yet" is a state the UI
    // shows deliberately (types.ts), and an empty array here would be
    // indistinguishable from a directory whose files all failed to parse.
    if (lessons.length > 0) index[topicId] = lessons;
  }

  cached = index;
  return index;
}

export function loadLesson(
  topicId: TopicId,
  lessonId: LessonId,
): Lesson | null {
  // The ids come out of a URL, so they are attacker-controlled in principle.
  // Both are matched against what is actually on disk rather than joined
  // straight onto a path — a `lessonId` of "../../.env" must not become a read.
  const lessons = loadCurriculumIndex()[topicId];
  const meta = lessons?.find((lesson) => lesson.id === lessonId);
  if (!meta) return null;

  const source = readFileSync(
    join(CONTENT_ROOT, topicId, `${lessonId}.md`),
    "utf8",
  );
  // The reader renders `meta.title` as the page H1, so a body that opens with
  // the same heading would render it twice — see stripLeadingTitle.
  return {
    meta,
    body: stripLeadingTitle(parseFrontmatter(source).body, meta.title),
  };
}

function listDirectories(path: string): string[] {
  try {
    return readdirSync(path).filter((entry) => {
      try {
        return statSync(join(path, entry)).isDirectory();
      } catch {
        return false;
      }
    });
  } catch {
    // No content directory yet. An empty curriculum renders as "no material
    // written yet" on every topic, which is the correct picture on day one.
    return [];
  }
}

function listLessons(topicId: TopicId): LessonMeta[] {
  const directory = join(CONTENT_ROOT, topicId);
  let entries: string[];
  try {
    entries = readdirSync(directory);
  } catch {
    return [];
  }

  const lessons: LessonMeta[] = [];
  for (const entry of entries) {
    const match = FILENAME.exec(entry);
    // Files that don't match are skipped in silence on purpose: a README.md or
    // a stray .DS_Store sitting beside the chapters is normal, and refusing to
    // render the page over one would be a bad trade.
    if (!match) continue;

    const { data } = parseFrontmatter(
      readFileSync(join(directory, entry), "utf8"),
    );
    const id = entry.slice(0, -3);
    lessons.push({
      id,
      topicId,
      // Falling back to the filename means a chapter whose author forgot the
      // frontmatter still appears, named something recognisable, instead of
      // showing up as an untitled row.
      title: data.title?.trim() || titleFromSlug(match[2]),
      minutes: parseMinutes(data.minutes),
      summary: data.summary?.trim() || null,
      order: Number.parseInt(match[1], 10),
    });
  }

  return lessons.sort(
    (left, right) =>
      left.order - right.order || left.id.localeCompare(right.id),
  );
}

function titleFromSlug(slug: string): string {
  return slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
