import { describe, expect, it } from "vitest";
import {
  IRON_RULES,
  PRE_TRADE_CHECKLIST,
  SYSTEM_RULES,
  checklistCompletion,
  isChecklistComplete,
  isLiveChecklistKey,
} from "@/src/modules/trading/tradingRulesCatalog";

const ALL_KEYS = PRE_TRADE_CHECKLIST.map((rule) => rule.key);

describe("catalog integrity", () => {
  it("keeps every key unique across the three lists", () => {
    // A collision would make a stored checklist key ambiguous.
    const keys = [...SYSTEM_RULES, ...IRON_RULES, ...PRE_TRADE_CHECKLIST].map(
      (rule) => rule.key,
    );
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("carries the source's eight system rules and seven iron rules", () => {
    expect(SYSTEM_RULES).toHaveLength(8);
    expect(IRON_RULES).toHaveLength(7);
    expect(SYSTEM_RULES.map((rule) => rule.key)).toEqual([
      "R1",
      "R2",
      "R3",
      "R4",
      "R5",
      "R6",
      "R7",
      "R8",
    ]);
  });

  // These keys are PERSISTED in trading_checklist_runs.checked_keys. Renaming
  // one silently orphans every historical tick of that item, so pin them.
  it("pins the persisted checklist keys", () => {
    expect(ALL_KEYS).toEqual([
      "ran_signal_check",
      "checked_econ_calendar",
      "signal_is_objective",
      "stop_known_before_entry",
      "risking_two_percent_max",
      "not_emotional",
      "will_not_override",
    ]);
  });

  it("gives every rule a title and a detail", () => {
    for (const rule of [
      ...SYSTEM_RULES,
      ...IRON_RULES,
      ...PRE_TRADE_CHECKLIST,
    ]) {
      expect(rule.title.trim()).not.toBe("");
      expect(rule.detail.trim()).not.toBe("");
    }
  });
});

describe("isLiveChecklistKey", () => {
  it("recognises a current item", () => {
    expect(isLiveChecklistKey("not_emotional")).toBe(true);
  });

  it("rejects a key that is no longer in the catalog", () => {
    // Stored rows outlive the catalog: a retired item's key stays in old rows
    // forever and must be skipped, not rendered blank or thrown on.
    expect(isLiveChecklistKey("retired_item")).toBe(false);
  });
});

describe("checklistCompletion", () => {
  it("is the share of live items ticked", () => {
    expect(checklistCompletion([])).toBe(0);
    expect(checklistCompletion(ALL_KEYS)).toBe(1);
    expect(checklistCompletion(ALL_KEYS.slice(0, 3))).toBeCloseTo(3 / 7);
  });

  it("ignores keys that are no longer live rather than inflating the score", () => {
    // Without the filter, a day carrying three retired keys would read as
    // 100% complete having ticked only four real items.
    expect(
      checklistCompletion([...ALL_KEYS.slice(0, 4), "retired_a", "retired_b"]),
    ).toBeCloseTo(4 / 7);
  });

  it("does not let a duplicated key count twice", () => {
    expect(checklistCompletion(["not_emotional", "not_emotional"])).toBeCloseTo(
      1 / 7,
    );
  });
});

describe("isChecklistComplete", () => {
  it("is true only when every live item is ticked", () => {
    expect(isChecklistComplete(ALL_KEYS)).toBe(true);
    // 6 of 7 is a no — completing the ritual is a yes/no question.
    expect(isChecklistComplete(ALL_KEYS.slice(0, 6))).toBe(false);
  });

  it("is not fooled by padding with retired keys", () => {
    expect(isChecklistComplete([...ALL_KEYS.slice(0, 6), "retired_a"])).toBe(
      false,
    );
  });
});
