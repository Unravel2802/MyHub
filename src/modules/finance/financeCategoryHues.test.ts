import { describe, expect, it } from "vitest";
import { FINANCE_CATEGORIES } from "@/src/modules/finance/financeCategories";
import { FINANCE_CATEGORY_HUES } from "@/src/modules/finance/financeCategoryHues";

describe("FINANCE_CATEGORY_HUES", () => {
  it("covers every published finance category exactly once", () => {
    expect(Object.keys(FINANCE_CATEGORY_HUES).sort()).toEqual(
      FINANCE_CATEGORIES.map((category) => category.key).sort(),
    );
  });
});
