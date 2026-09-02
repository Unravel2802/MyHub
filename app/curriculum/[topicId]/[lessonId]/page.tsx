import { notFound } from "next/navigation";
import { AppShell } from "@/src/components/AppShell";
import { topicById } from "@/src/modules/curriculum/curriculumCatalog";
import {
  loadCurriculumIndex,
  loadLesson,
} from "@/src/modules/curriculum/content";
import { siblingLessons } from "@/src/modules/curriculum/curriculumProgress";
import { LessonReader } from "@/src/modules/curriculum/components/LessonReader";

interface LessonRouteProps {
  params: Promise<{ topicId: string; lessonId: string }>;
}

// One chapter, read off disk per request.
//
// Not PageTemplate: that template is built around a hero metric and a stats
// row, and a page whose entire job is to be READ wants neither above the prose.
// It still renders inside AppShell, so the nav, the palette and the auth gate
// are the same as everywhere else.
export default async function LessonRoute({ params }: LessonRouteProps) {
  const { topicId, lessonId } = await params;

  const topic = topicById(topicId);
  const lesson = topic ? loadLesson(topicId, lessonId) : null;
  // Covers three cases with one branch: an unknown topic, a chapter that was
  // never written, and a path that isn't a chapter at all — loadLesson matches
  // against what is actually on disk rather than joining the id onto a path.
  if (!topic || !lesson) notFound();

  const { previous, next } = siblingLessons(
    topicId,
    lessonId,
    loadCurriculumIndex(),
  );

  return (
    <AppShell activeHref="/curriculum" title="Curriculum">
      {/* `min-w-0`, matching PageTemplateBody's own section. AppShell's
          children slot is a GRID ITEM, and a grid item's default
          `min-width: auto` lets it grow to its content's max-content width —
          so a wide code block inside a chapter widens the whole page instead of
          scrolling inside its own `overflow-x-auto`. */}
      <div className="min-w-0 px-4 py-6 sm:px-6 lg:px-8">
        <LessonReader
          lesson={lesson}
          next={next}
          previous={previous}
          topic={topic}
        />
      </div>
    </AppShell>
  );
}
