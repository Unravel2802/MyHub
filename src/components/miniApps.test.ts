import { describe, expect, it } from "vitest";
import { NAV_ITEMS } from "@/src/components/appNav";
import {
  CORE_TOOL_HREFS,
  MINI_APPS,
  MINI_APP_HREFS,
  miniAppFor,
} from "@/src/components/miniApps";
import { hueFor } from "@/src/components/moduleHues";

describe("mini-app membership", () => {
  // The whole point of keeping membership in one file is that it can drift out
  // of sync with the nav. This is the gate that makes drift a red test rather
  // than a nav entry silently rendering as an uncategorised core tool.
  it("classifies every nav entry as either a mini-app member or a core tool", () => {
    const unclassified = NAV_ITEMS.filter(
      (item) =>
        miniAppFor(item.href) === undefined &&
        !CORE_TOOL_HREFS.includes(item.href),
    ).map((item) => item.href);

    expect(unclassified).toEqual([]);
  });

  it("does not list an href in more than one mini-app", () => {
    const all = MINI_APPS.flatMap((app) => MINI_APP_HREFS[app.key]);
    expect(all).toHaveLength(new Set(all).size);
  });

  it("does not classify a core tool as a mini-app member too", () => {
    const overlap = CORE_TOOL_HREFS.filter(
      (href) => miniAppFor(href) !== undefined,
    );
    expect(overlap).toEqual([]);
  });

  it("points every mini-app's own href at something in the nav", () => {
    const navHrefs = new Set(NAV_ITEMS.map((item) => item.href));
    for (const app of MINI_APPS) {
      expect(navHrefs.has(app.href)).toBe(true);
    }
  });
});

describe("hueFor fallback chain", () => {
  it("keeps every module's own hue ahead of its mini-app's", () => {
    // Regression guard for the whole point of the chain: Career's members must
    // NOT collapse onto violet just because the mini-app owns it.
    expect(hueFor("/prep")).toBe("cyan");
    expect(hueFor("/applications")).toBe("blue");
    expect(hueFor("/offers")).toBe("emerald");
    expect(hueFor("/finance")).toBe("lime");
  });

  it("falls back to the mini-app hue for a member with no hue of its own", () => {
    // /design-drills is a Career member that never claimed a hue — before the
    // chain it resolved to generic `accent`.
    expect(hueFor("/design-drills")).toBe("violet");
  });

  it("falls back to accent for an href in no mini-app", () => {
    expect(hueFor("/definitely-not-a-route")).toBe("accent");
  });
});
