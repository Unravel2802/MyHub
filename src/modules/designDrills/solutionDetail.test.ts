import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseSolutionDetail } from "@/src/modules/designDrills/solutionDetail";

// The parser is the one guard between an arbitrary jsonb blob and the UI, so its
// contract is: valid → typed DrillSolution; anything malformed → null (UI falls
// back to plain text) and it NEVER throws. console.error is silenced/asserted
// since graceful degradation is supposed to log the real reason.

function validBlob() {
  return {
    summary: "A **write-light** key-value lookup.",
    sections: [
      { id: "requirements", heading: "Requirements", body: "- functional" },
      { id: "api", heading: "API", body: "`POST /urls`" },
    ],
    estimates: [
      { label: "Writes", value: "~1.2K rps", note: "avg" },
      { label: "Reads", value: "~12K rps" },
    ],
    references: [{ label: "Base62", url: "https://example.com" }],
  };
}

let errorSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  errorSpy.mockRestore();
});

describe("parseSolutionDetail", () => {
  it("parses a well-formed blob into the typed shape", () => {
    const result = parseSolutionDetail(validBlob(), "url-shortener");
    expect(result).not.toBeNull();
    expect(result?.summary).toContain("write-light");
    expect(result?.sections).toHaveLength(2);
    expect(result?.sections[0]).toEqual({
      id: "requirements",
      heading: "Requirements",
      body: "- functional",
    });
    expect(result?.estimates).toHaveLength(2);
    expect(result?.references).toEqual([
      { label: "Base62", url: "https://example.com" },
    ]);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("returns null for a null/undefined blob without logging", () => {
    expect(parseSolutionDetail(null, "x")).toBeNull();
    expect(parseSolutionDetail(undefined, "x")).toBeNull();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("returns null (and logs) when a non-object is stored", () => {
    expect(parseSolutionDetail("just a string", "x")).toBeNull();
    expect(errorSpy).toHaveBeenCalled();
  });

  it("returns null when required top-level fields are missing or wrong-typed", () => {
    expect(
      parseSolutionDetail({ sections: [], estimates: [] }, "x"),
    ).toBeNull();
    expect(
      parseSolutionDetail({ summary: "s", sections: {}, estimates: [] }, "x"),
    ).toBeNull();
    expect(
      parseSolutionDetail({ summary: "s", sections: [], estimates: "no" }, "x"),
    ).toBeNull();
  });

  it("drops malformed sections and treats an all-invalid list as unauthored", () => {
    const partly = parseSolutionDetail(
      {
        summary: "s",
        sections: [
          { id: "ok", heading: "OK", body: "body" },
          { id: "bad", heading: "missing body" },
          "not even an object",
        ],
        estimates: [],
      },
      "x",
    );
    expect(partly?.sections).toHaveLength(1);
    expect(partly?.sections[0].id).toBe("ok");

    const none = parseSolutionDetail(
      { summary: "s", sections: [{ id: "bad" }], estimates: [] },
      "x",
    );
    expect(none).toBeNull();
  });

  it("keeps only well-formed estimates and omits an empty references array", () => {
    const result = parseSolutionDetail(
      {
        summary: "s",
        sections: [{ id: "a", heading: "A", body: "b" }],
        estimates: [
          { label: "Good", value: "1" },
          { label: "no value" },
          { value: "no label" },
        ],
        references: [{ label: "no url" }],
      },
      "x",
    );
    expect(result?.estimates).toEqual([{ label: "Good", value: "1" }]);
    expect(result?.references).toBeUndefined();
  });
});
