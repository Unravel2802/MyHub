import { describe, expect, it } from "vitest";
import {
  nextUp,
  overallProgress,
  siblingLessons,
  tierCounts,
  topicState,
  trackState,
} from "@/src/modules/curriculum/curriculumProgress";
import { topicById } from "@/src/modules/curriculum/curriculumCatalog";
import type {
  CurriculumIndex,
  LessonMeta,
  Topic,
} from "@/src/modules/curriculum/types";

function lesson(topicId: string, order: number): LessonMeta {
  return {
    id: `0${order}-lesson-${order}`,
    topicId,
    title: `Lesson ${order}`,
    minutes: 10,
    summary: null,
    order,
  };
}

function indexFor(spec: Record<string, number>): CurriculumIndex {
  return Object.fromEntries(
    Object.entries(spec).map(([topicId, count]) => [
      topicId,
      Array.from({ length: count }, (_, i) => lesson(topicId, i + 1)),
    ]),
  );
}

const HTTP = topicById("backend.http")!;
const REST = topicById("backend.rest")!;

describe("topicState", () => {
  it("counts read chapters against the topic's own chapters", () => {
    const index = indexFor({ "backend.http": 4 });
    const state = topicState(
      HTTP,
      index,
      new Set(["backend.http/01-lesson-1", "backend.http/02-lesson-2"]),
    );
    expect(state.doneCount).toBe(2);
    expect(state.totalCount).toBe(4);
    expect(state.progress).toBe(0.5);
    expect(state.status).toBe("in_progress");
  });

  it("does not count a chapter ticked under a different topic", () => {
    // The key is "<topicId>/<lessonId>" precisely so two topics can both have
    // an "01-intro" without one ticking the other.
    const index = indexFor({ "backend.http": 1 });
    const state = topicState(
      HTTP,
      index,
      new Set(["backend.rest/01-lesson-1"]),
    );
    expect(state.doneCount).toBe(0);
  });

  it("reports a topic with no material as empty and 0%, not complete", () => {
    const state = topicState(HTTP, {}, new Set());
    expect(state.status).toBe("empty");
    expect(state.progress).toBe(0);
  });

  it("marks a topic done only when every chapter is read", () => {
    const index = indexFor({ "backend.http": 2 });
    expect(
      topicState(HTTP, index, new Set(["backend.http/01-lesson-1"])).status,
    ).toBe("in_progress");
    expect(
      topicState(
        HTTP,
        index,
        new Set(["backend.http/01-lesson-1", "backend.http/02-lesson-2"]),
      ).status,
    ).toBe("done");
  });
});

describe("availability", () => {
  it("is false while a prerequisite with material is unfinished", () => {
    const index = indexFor({ "backend.http": 2, "backend.rest": 1 });
    expect(topicState(REST, index, new Set()).available).toBe(false);
  });

  it("becomes true once the prerequisite is finished", () => {
    const index = indexFor({ "backend.http": 2, "backend.rest": 1 });
    const completed = new Set([
      "backend.http/01-lesson-1",
      "backend.http/02-lesson-2",
    ]);
    expect(topicState(REST, index, completed).available).toBe(true);
  });

  it("treats an unwritten prerequisite as cleared", () => {
    // Otherwise everything downstream of an unwritten topic is unreachable, and
    // on day one — nothing written — the page would recommend nothing at all.
    const index = indexFor({ "backend.rest": 1 });
    expect(topicState(REST, index, new Set()).available).toBe(true);
  });
});

describe("trackState", () => {
  it("sums chapters across the whole track", () => {
    const index = indexFor({ "backend.http": 2, "backend.rest": 2 });
    const state = trackState(
      "backend",
      index,
      new Set(["backend.http/01-lesson-1"]),
    );
    expect(state.doneCount).toBe(1);
    expect(state.totalCount).toBe(4);
    expect(state.progress).toBe(0.25);
  });

  it("is 0%, not NaN, for a track with no material", () => {
    const state = trackState("security", {}, new Set());
    expect(state.progress).toBe(0);
    expect(state.totalCount).toBe(0);
  });
});

describe("tierCounts", () => {
  it("buckets chapters by their topic's tier", () => {
    const topics: Topic[] = [HTTP, REST]; // both foundational
    const index = indexFor({ "backend.http": 2, "backend.rest": 2 });
    const counts = tierCounts(
      topics,
      index,
      new Set(["backend.http/01-lesson-1"]),
    );
    const foundational = counts.find((entry) => entry.tier === "foundational")!;
    expect(foundational).toEqual({ tier: "foundational", done: 1, total: 4 });
    // Always three buckets, even when empty — a breakdown that grows and
    // shrinks rows as you read is unreadable.
    expect(counts).toHaveLength(3);
  });
});

describe("overallProgress", () => {
  it("counts topics against those that HAVE material", () => {
    const index = indexFor({ "backend.http": 2, "backend.rest": 1 });
    const result = overallProgress(
      index,
      new Set(["backend.http/01-lesson-1", "backend.http/02-lesson-2"]),
    );
    expect(result.done).toBe(2);
    expect(result.total).toBe(3);
    expect(result.topicsDone).toBe(1);
    expect(result.topicsWithMaterial).toBe(2);
  });

  it("sums remaining minutes over unread chapters only", () => {
    const index = indexFor({ "backend.http": 3 });
    const result = overallProgress(
      index,
      new Set(["backend.http/01-lesson-1"]),
    );
    expect(result.minutesRemaining).toBe(20);
  });

  it("is 0%, not NaN, on an empty curriculum", () => {
    expect(overallProgress({}, new Set()).progress).toBe(0);
  });
});

describe("nextUp", () => {
  it("finishes a started topic before opening a fresh one", () => {
    const index = indexFor({ "backend.http": 2, "backend.sql": 2 });
    const result = nextUp(
      index,
      new Set(["backend.http/01-lesson-1"]),
      "backend",
    );
    expect(result?.topic.id).toBe("backend.http");
    expect(result?.lesson.id).toBe("02-lesson-2");
  });

  it("prefers an available topic over a blocked one", () => {
    // backend.rest is blocked by an unfinished backend.http, so a fresh start
    // should land on http, which has no in-track prereqs.
    const index = indexFor({ "backend.http": 1, "backend.rest": 1 });
    expect(nextUp(index, new Set(), "backend")?.topic.id).toBe("backend.http");
  });

  it("returns null once everything with material is read", () => {
    const index = indexFor({ "backend.http": 1 });
    expect(
      nextUp(index, new Set(["backend.http/01-lesson-1"]), "backend"),
    ).toBeNull();
  });

  it("returns null for a curriculum with no material at all", () => {
    expect(nextUp({}, new Set())).toBeNull();
  });
});

describe("siblingLessons", () => {
  it("returns the neighbours in reading order", () => {
    const index = indexFor({ "backend.http": 3 });
    const { previous, next } = siblingLessons(
      "backend.http",
      "02-lesson-2",
      index,
    );
    expect(previous?.id).toBe("01-lesson-1");
    expect(next?.id).toBe("03-lesson-3");
  });

  it("returns nulls at the ends and for an unknown lesson", () => {
    const index = indexFor({ "backend.http": 2 });
    expect(
      siblingLessons("backend.http", "01-lesson-1", index).previous,
    ).toBeNull();
    expect(
      siblingLessons("backend.http", "02-lesson-2", index).next,
    ).toBeNull();
    expect(siblingLessons("backend.http", "nope", index)).toEqual({
      previous: null,
      next: null,
    });
  });
});
