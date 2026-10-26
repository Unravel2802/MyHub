import { describe, expect, it } from "vitest";
import {
  planRentSplit,
  rentShareReason,
  type RentSplitMember,
  type UtilityItem,
} from "@/src/modules/finance/rentSplit";

const member = (
  name: string,
  rentCents: number,
  isMe = false,
): RentSplitMember => ({ name, rentCents, isMe });

const utilities: UtilityItem[] = [
  { label: "Electricity", totalCents: 9000 },
  { label: "Gas", totalCents: 3000 },
  { label: "Wifi", totalCents: 6000 },
];

describe("planRentSplit", () => {
  it("adds each room's rent to an even share of every utility", () => {
    const result = planRentSplit(
      [
        member("Hoang", 70000, true),
        member("Alex", 60000),
        member("Sam", 50000),
      ],
      utilities,
    );
    expect(result).toEqual({
      ok: true,
      shares: [
        {
          name: "Hoang",
          isMe: true,
          rentCents: 70000,
          utilityCents: [3000, 1000, 2000],
          totalCents: 76000,
        },
        {
          name: "Alex",
          isMe: false,
          rentCents: 60000,
          utilityCents: [3000, 1000, 2000],
          totalCents: 66000,
        },
        {
          name: "Sam",
          isMe: false,
          rentCents: 50000,
          utilityCents: [3000, 1000, 2000],
          totalCents: 56000,
        },
      ],
    });
  });

  it("gives leftover cents to the others, rotating across utilities", () => {
    // 100 / 3 = 33 r1 per utility. Others are Alex (1) and Sam (2); me never.
    const result = planRentSplit(
      [member("Hoang", 0, true), member("Alex", 0), member("Sam", 0)],
      [
        { label: "A", totalCents: 100 },
        { label: "B", totalCents: 100 },
        { label: "C", totalCents: 100 },
      ],
    );
    if (!result.ok) throw new Error(result.error);
    expect(result.shares.map((s) => s.utilityCents)).toEqual([
      [33, 33, 33],
      [34, 33, 34],
      [33, 34, 33],
    ]);
  });

  it("accounts for every cent of every utility", () => {
    const members = [
      member("A", 100),
      member("Me", 200, true),
      member("B", 300),
      member("C", 400),
    ];
    for (let total = 0; total <= 300; total += 7) {
      const items = [
        { label: "X", totalCents: total },
        { label: "Y", totalCents: total + 3 },
      ];
      const result = planRentSplit(members, items);
      if (!result.ok) throw new Error(result.error);
      items.forEach((item, i) => {
        const sum = result.shares.reduce(
          (acc, s) => acc + s.utilityCents[i],
          0,
        );
        expect(sum).toBe(item.totalCents);
      });
      const mine = result.shares.find((s) => s.isMe)!;
      for (const s of result.shares) {
        expect(s.utilityCents[0]).toBeGreaterThanOrEqual(mine.utilityCents[0]);
      }
    }
  });

  it("works with no utilities (rent only) and zero-value utilities", () => {
    const rentOnly = planRentSplit(
      [member("Me", 500, true), member("Alex", 400)],
      [],
    );
    expect(rentOnly.ok && rentOnly.shares[1].totalCents).toBe(400);
    const zero = planRentSplit(
      [member("Me", 500, true), member("Alex", 400)],
      [{ label: "Gas", totalCents: 0 }],
    );
    expect(zero.ok && zero.shares[1].utilityCents).toEqual([0]);
  });

  it("rejects invalid input with a typed error", () => {
    expect(planRentSplit([member("Me", 1, true)], utilities)).toEqual({
      ok: false,
      error: "no_one_else",
    });
    expect(
      planRentSplit(
        [member("A", 1, true), member("B", 1, true), member("C", 1)],
        [],
      ),
    ).toEqual({ ok: false, error: "multiple_me" });
    expect(planRentSplit([member(" ", 1)], [])).toEqual({
      ok: false,
      error: "blank_name",
    });
    expect(planRentSplit([member("Alex", 1), member("ALEX", 1)], [])).toEqual({
      ok: false,
      error: "duplicate_name",
    });
    expect(planRentSplit([member("Alex", -1)], [])).toEqual({
      ok: false,
      error: "invalid_rent",
    });
    expect(planRentSplit([member("Alex", 1.5)], [])).toEqual({
      ok: false,
      error: "invalid_rent",
    });
    expect(
      planRentSplit([member("Alex", 1)], [{ label: "Gas", totalCents: -5 }]),
    ).toEqual({ ok: false, error: "invalid_utility" });
    expect(
      planRentSplit([member("Alex", 1)], [{ label: " ", totalCents: 5 }]),
    ).toEqual({ ok: false, error: "invalid_utility" });
    expect(
      planRentSplit([member("Me", 500, true), member("Alex", 0)], []),
    ).toEqual({ ok: false, error: "nothing_owed" });
  });
});

describe("rentShareReason", () => {
  it("itemizes room rent and non-zero utilities", () => {
    const result = planRentSplit(
      [member("Me", 70000, true), member("Alex", 60000)],
      [...utilities, { label: "Water", totalCents: 0 }],
    );
    if (!result.ok) throw new Error(result.error);
    expect(
      rentShareReason("Rent Oct 2026", result.shares[1], [
        ...utilities,
        { label: "Water", totalCents: 0 },
      ]),
    ).toBe(
      "Rent Oct 2026: room $600.00, Electricity $45.00, Gas $15.00, Wifi $30.00",
    );
  });
});
