import { CurriculumPage } from "@/src/modules/curriculum/components/CurriculumPage";
import { loadCurriculumIndex } from "@/src/modules/curriculum/content";

// A SERVER component that hands the chapter index down to the client page.
//
// The index has to be read here rather than in CurriculumPage, because
// content.ts touches `node:fs` and the page is "use client". That split is the
// whole point: the server reads 163 directories and sends ~a few KB of chapter
// TITLES, and the prose stays on disk until a reader route asks for one file.
export default function Curriculum() {
  return <CurriculumPage index={loadCurriculumIndex()} />;
}
