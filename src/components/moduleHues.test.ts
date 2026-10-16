import { describe, expect, it } from "vitest";
import { hueBorderVar } from "@/src/components/moduleHues";

describe("hueBorderVar", () => {
  it("maps brand and named hues to border tokens", () => {
    expect(hueBorderVar("accent")).toBe("var(--accent-border)");
    expect(hueBorderVar("teal")).toBe("var(--hue-teal-border)");
  });
});
