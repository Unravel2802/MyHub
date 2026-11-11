import { expect, it } from "vitest";
import { calloutMarker } from "./callout";
import type { ExtraProps } from "react-markdown";

function quote(text: string): NonNullable<ExtraProps["node"]> {
  return {
    type: "element",
    tagName: "blockquote",
    properties: {},
    children: [
      { type: "text", value: "\n" },
      {
        type: "element",
        tagName: "p",
        properties: {},
        children: [{ type: "text", value: text }],
      },
    ],
  };
}
it.each(["KEY", "PITFALL", "INTERVIEW", "CHECK", "WHY", "GOALS"])(
  "detects %s at the start of the first HAST paragraph",
  (kind) => {
    expect(calloutMarker(quote(`[!${kind}]\nContent`))).toEqual({
      kind,
      prefix: `[!${kind}]\n`,
    });
  },
);
it.each(["recall", "apply", "stretch"] as const)(
  "returns the %s exercise level",
  (level) => {
    expect(calloutMarker(quote(`[!EXERCISE ${level}] Prompt`))).toEqual({
      kind: "EXERCISE",
      prefix: `[!EXERCISE ${level}] `,
      level,
    });
  },
);
it.each(["[!EXERCISE] Prompt", "[!EXERCISE unknown] Prompt"])(
  "rejects an exercise marker without a recognized level: %s",
  (source) => expect(calloutMarker(quote(source))).toBeNull(),
);
it("leaves unknown kinds and markers later in the paragraph as plain quotes", () => {
  expect(calloutMarker(quote("[!UNKNOWN] content"))).toBeNull();
  expect(calloutMarker(quote("Content [!KEY]"))).toBeNull();
  expect(calloutMarker(quote("[!KEY]word"))).toEqual({
    kind: "KEY",
    prefix: "[!KEY]",
  });
  expect(calloutMarker(quote("[!WHY extra] content"))).toBeNull();
});
