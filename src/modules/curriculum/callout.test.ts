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
it.each(["KEY", "PITFALL", "INTERVIEW", "CHECK"])(
  "detects %s at the start of the first HAST paragraph",
  (kind) => {
    expect(calloutMarker(quote(`[!${kind}]\nContent`))).toEqual({
      kind,
      prefix: `[!${kind}]\n`,
    });
  },
);
it("leaves unknown kinds and markers later in the paragraph as plain quotes", () => {
  expect(calloutMarker(quote("[!UNKNOWN] content"))).toBeNull();
  expect(calloutMarker(quote("Content [!KEY]"))).toBeNull();
  expect(calloutMarker(quote("[!KEY]word"))).toBeNull();
});
