import { describe, expect, it } from "vitest";
import {
  normalizePostingUrl,
  POSTING_URL_MAX_LENGTH,
} from "@/src/modules/jobApplications/postingUrl";

describe("normalizePostingUrl", () => {
  it("treats empty or whitespace-only input as clearing the link", () => {
    expect(normalizePostingUrl("")).toEqual({ ok: true, value: null });
    expect(normalizePostingUrl("   ")).toEqual({ ok: true, value: null });
  });

  it("keeps http(s) URLs and trims surrounding whitespace", () => {
    expect(
      normalizePostingUrl("  https://jobs.example.com/123?ref=x "),
    ).toEqual({ ok: true, value: "https://jobs.example.com/123?ref=x" });
    expect(normalizePostingUrl("HTTP://example.com/a")).toEqual({
      ok: true,
      value: "http://example.com/a",
    });
  });

  it("adds https:// to a pasted bare host, including one with a port", () => {
    expect(normalizePostingUrl("linkedin.com/jobs/view/42")).toEqual({
      ok: true,
      value: "https://linkedin.com/jobs/view/42",
    });
    expect(normalizePostingUrl("example.com:8080/x")).toEqual({
      ok: true,
      value: "https://example.com:8080/x",
    });
  });

  it("refuses script-capable and non-web schemes in any case", () => {
    for (const raw of [
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "vbscript:msgbox",
      "mailto:recruiter@example.com",
      "ftp://example.com/file",
    ]) {
      expect(normalizePostingUrl(raw)).toEqual({ ok: false });
    }
  });

  it("refuses embedded whitespace and hosts without a dot", () => {
    expect(normalizePostingUrl("java\tscript:alert(1)")).toEqual({ ok: false });
    expect(normalizePostingUrl("example .com/x")).toEqual({ ok: false });
    expect(normalizePostingUrl("linkedin")).toEqual({ ok: false });
  });

  it("refuses URLs longer than the column allows", () => {
    const long = `https://example.com/${"a".repeat(POSTING_URL_MAX_LENGTH)}`;
    expect(normalizePostingUrl(long)).toEqual({ ok: false });
  });

  it("only ever returns values the migration 0048 constraint accepts", () => {
    const constraint = /^https?:\/\/\S+$/i;
    for (const raw of [
      "linkedin.com/jobs/view/42",
      "https://example.com/a%20b",
      "https://exämple.com/ü",
    ]) {
      const result = normalizePostingUrl(raw);
      expect(result.ok).toBe(true);
      if (result.ok && result.value) {
        expect(result.value).toMatch(constraint);
      }
    }
  });
});
