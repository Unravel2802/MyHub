import { describe, expect, it } from "vitest";
import {
  parseFrontmatter,
  parseMinutes,
  stripLeadingTitle,
} from "@/src/modules/curriculum/frontmatter";

describe("parseFrontmatter", () => {
  it("reads keys and returns the body without the fence", () => {
    const { data, body } = parseFrontmatter(
      "---\ntitle: Why caching exists\nminutes: 25\n---\n# Heading\n\nText.",
    );
    expect(data).toEqual({ title: "Why caching exists", minutes: "25" });
    expect(body).toBe("# Heading\n\nText.");
  });

  it("treats a file with no fence as all body", () => {
    const { data, body } = parseFrontmatter("# Just markdown");
    expect(data).toEqual({});
    expect(body).toBe("# Just markdown");
  });

  it("keeps colons inside a quoted value", () => {
    const { data } = parseFrontmatter('---\ntitle: "Caching: why"\n---\nx');
    expect(data.title).toBe("Caching: why");
  });

  it("keeps colons inside an unquoted value too", () => {
    // Splitting on the FIRST colon, not every colon — a title written without
    // quotes is the common case and must not lose its second half.
    const { data } = parseFrontmatter("---\ntitle: Caching: why\n---\nx");
    expect(data.title).toBe("Caching: why");
  });

  it("survives CRLF line endings", () => {
    const { data, body } = parseFrontmatter(
      "---\r\ntitle: Windows\r\n---\r\nBody",
    );
    expect(data.title).toBe("Windows");
    expect(body).toBe("Body");
  });

  it("survives a leading BOM", () => {
    const { data } = parseFrontmatter("﻿---\ntitle: Bom\n---\nBody");
    expect(data.title).toBe("Bom");
  });

  it("skips blank lines and comments", () => {
    const { data } = parseFrontmatter(
      "---\n\n# a note\ntitle: Kept\n---\nBody",
    );
    expect(data).toEqual({ title: "Kept" });
  });

  it("ignores a line with no colon rather than throwing", () => {
    const { data } = parseFrontmatter("---\nnonsense\ntitle: Kept\n---\nBody");
    expect(data).toEqual({ title: "Kept" });
  });

  it("does not treat a --- inside the body as a second fence", () => {
    const { body } = parseFrontmatter("---\ntitle: T\n---\nOne\n\n---\n\nTwo");
    expect(body).toBe("One\n\n---\n\nTwo");
  });
});

describe("parseMinutes", () => {
  it("reads a positive integer", () => {
    expect(parseMinutes("25")).toBe(25);
  });

  it("returns null for missing, zero, negative and junk values", () => {
    expect(parseMinutes(undefined)).toBeNull();
    expect(parseMinutes("0")).toBeNull();
    expect(parseMinutes("-5")).toBeNull();
    expect(parseMinutes("soon")).toBeNull();
  });
});

describe("stripLeadingTitle", () => {
  it("removes an opening heading that repeats the title", () => {
    expect(stripLeadingTitle("# Hash tables\n\nBody.", "Hash tables")).toBe(
      "Body.",
    );
  });

  it("ignores case and extra whitespace", () => {
    expect(stripLeadingTitle("#   hash   tables\n\nBody.", "Hash tables")).toBe(
      "Body.",
    );
  });

  it("keeps a heading that says something different", () => {
    const body = "# Introduction\n\nBody.";
    expect(stripLeadingTitle(body, "Hash tables")).toBe(body);
  });

  it("keeps a later heading that happens to match", () => {
    // Only the FIRST block is considered; a section deep in the chapter that
    // shares the chapter's name is content, not a duplicated title.
    const body = "Intro paragraph.\n\n# Hash tables\n\nBody.";
    expect(stripLeadingTitle(body, "Hash tables")).toBe(body);
  });

  it("leaves a body with no heading alone", () => {
    expect(stripLeadingTitle("Just prose.", "Hash tables")).toBe("Just prose.");
  });

  it("does not strip an h2 that matches", () => {
    const body = "## Hash tables\n\nBody.";
    expect(stripLeadingTitle(body, "Hash tables")).toBe(body);
  });
});
