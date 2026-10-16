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
      main: "Intro\n\n```text\n## not a heading\n```\n\n## A section\nBody",
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
