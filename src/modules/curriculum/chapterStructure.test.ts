import { describe, expect, it } from "vitest";
import {
  chapterOutline,
  slugifyHeading,
  splitTakeaways,
} from "@/src/modules/curriculum/chapterStructure";

describe("chapter structure", () => {
  it("splits the recap but ignores headings in fences", () => {
    const body =
      "Intro\n\n```text\n## not a heading\n```\n\n## A section\nBody\n\n## What to take away\n- One\n- Two";
    expect(splitTakeaways(body)).toEqual({
      main: "Intro\n\n```text\n## not a heading\n```\n\n## A section\nBody\n\n",
      takeaways: "- One\n- Two",
    });
    expect(chapterOutline(splitTakeaways(body).main)).toEqual([
      { id: "a-section", text: "A section", number: 1, line: 7 },
    ]);
  });

  it("strips inline markdown and disambiguates duplicate slugs", () => {
    const taken = new Set<string>();
    expect(slugifyHeading("**A** [worked](#x)", taken)).toBe("a-worked");
    expect(slugifyHeading("A worked", taken)).toBe("a-worked-2");
  });
});

import { enclosingSection } from "@/src/modules/curriculum/chapterStructure";

it("captions figures with the enclosing section rather than the last heading", () => {
  const outline = chapterOutline(
    "## The numbers to memorise\n\n```text\nTIME\n## not a heading\n```\n\n## Common mistakes\n\n```text\n✗ mistake\n```",
  );
  expect(enclosingSection(outline, 3)?.text).toBe("The numbers to memorise");
  expect(enclosingSection(outline, 10)?.text).toBe("Common mistakes");
  expect(enclosingSection(outline, 1)).toBeUndefined();
});

it("leaves the rest of the source unchanged when removing a recap", () => {
  const before = "\nIntro\r\n\r\n## First\r\nbody\r\n\r\n";
  const after = "## Appendix\r\nlast\r\n";
  expect(
    splitTakeaways(before + "## What to take away\r\n1. recap\r\n\r\n" + after)
      .main,
  ).toBe(before + after);
});
