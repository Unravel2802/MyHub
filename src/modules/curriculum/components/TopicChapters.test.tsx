import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { topicById } from "@/src/modules/curriculum/curriculumCatalog";
import { topicState } from "@/src/modules/curriculum/curriculumProgress";
import type { CurriculumIndex } from "@/src/modules/curriculum/types";
import type { CurriculumStore } from "@/src/modules/curriculum/useCurriculumStore";

// TopicChapters reads the curriculum store, which is backed by Supabase —
// this test only cares about the empty-vs-populated rendering branch, not
// the store, so the store is stubbed rather than pulling in a real Supabase
// client (which needs env vars this unit run doesn't set).
const fakeState: CurriculumStore = {
  completed: {},
  starred: {},
  isLoading: false,
  error: null,
  pendingKeys: [],
  fetchProgress: vi.fn(),
  setCompleted: vi.fn(),
  setStarred: vi.fn(),
};

vi.mock("@/src/modules/curriculum/useCurriculumStore", () => ({
  useCurriculumStore: (selector: (state: CurriculumStore) => unknown) =>
    selector(fakeState),
}));

const { TopicChapters } = await import(
  "@/src/modules/curriculum/components/TopicChapters"
);

// The empty state used to be pinned by an E2E test pointed at whichever
// track hadn't been written yet — a real, unwritten topic on the live map.
// That was inherently temporary: it had to be repointed every time a track
// finished (Algorithms, then Security Foundations, then Analytical Data
// Modeling, then Engineering Practice), and once the whole 228-topic map
// was written, there was no unwritten topic left to point it at.
//
// The empty state is pure UI logic — EmptyState renders when
// `state.lessons.length === 0` — so it never actually needed a real,
// unwritten topic or a browser. A synthetic index proves it directly and
// stays correct forever, independent of how much of the curriculum is
// written.

describe("TopicChapters empty state", () => {
  it("shows the no-material state when the index has no lessons for this topic", () => {
    const topic = topicById("foundations.programming")!;
    const emptyIndex: CurriculumIndex = {};
    const state = topicState(topic, emptyIndex, new Set());

    const html = renderToStaticMarkup(
      <TopicChapters hue="cyan" state={state} />,
    );

    expect(html).toContain("Nothing to read here yet");
  });

  it("does not show the empty state once the index has at least one lesson", () => {
    const topic = topicById("foundations.programming")!;
    const index: CurriculumIndex = {
      "foundations.programming": [
        {
          id: "01-intro",
          topicId: "foundations.programming",
          title: "Intro",
          minutes: 10,
          summary: null,
          order: 1,
        },
      ],
    };
    const state = topicState(topic, index, new Set());

    const html = renderToStaticMarkup(
      <TopicChapters hue="cyan" state={state} />,
    );

    expect(html).not.toContain("Nothing to read here yet");
  });
});
