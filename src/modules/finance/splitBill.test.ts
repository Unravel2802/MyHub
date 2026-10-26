import { describe, expect, it } from "vitest";
import {
  isSelfAlias,
  parseParticipants,
  planSplit,
  type SplitParticipant,
} from "@/src/modules/finance/splitBill";

const me = (name = "Hoang"): SplitParticipant => ({ name, isMe: true });
const them = (name: string): SplitParticipant => ({ name, isMe: false });

describe("planSplit", () => {
  it("splits $12 between me and two others into $4 each, excluding me", () => {
    const result = planSplit(1200, [me(), them("Alex"), them("Sam")]);
    expect(result).toEqual({
      ok: true,
      plan: {
        shares: [
          { name: "Alex", amountCents: 400 },
          { name: "Sam", amountCents: 400 },
        ],
        myShareCents: 400,
      },
    });
  });

  it("gives leftover cents to the others first, never to me", () => {
    // $10.00 / 3 = 333 r1 → Alex 334, Sam 333, me 333.
    const result = planSplit(1000, [me(), them("Alex"), them("Sam")]);
    expect(result.ok && result.plan.shares).toEqual([
      { name: "Alex", amountCents: 334 },
      { name: "Sam", amountCents: 333 },
    ]);
    expect(result.ok && result.plan.myShareCents).toBe(333);

    // 1000 / 4 = 250 r0; 1001 / 4 = 250 r1; 1003 / 4 = 250 r3 → all three
    // others get the extra cent, I keep the base.
    const four = planSplit(1003, [them("A"), me(), them("B"), them("C")]);
    expect(four.ok && four.plan.shares.map((s) => s.amountCents)).toEqual([
      251, 251, 251,
    ]);
    expect(four.ok && four.plan.myShareCents).toBe(250);
  });

  it("always accounts for every cent of the total", () => {
    for (let total = 3; total <= 500; total += 7) {
      for (let others = 1; others <= 5; others++) {
        for (const includeMe of [true, false]) {
          const people = Array.from({ length: others }, (_, i) =>
            them(`P${i}`),
          );
          if (includeMe) people.push(me());
          if (total < people.length) continue;
          const result = planSplit(total, people);
          if (!result.ok) throw new Error(result.error);
          const sum =
            result.plan.shares.reduce((acc, s) => acc + s.amountCents, 0) +
            result.plan.myShareCents;
          expect(sum).toBe(total);
          const amounts = result.plan.shares.map((s) => s.amountCents);
          expect(
            Math.max(...amounts) - Math.min(...amounts),
          ).toBeLessThanOrEqual(1);
          if (includeMe) {
            expect(result.plan.myShareCents).toBeLessThanOrEqual(
              Math.min(...amounts),
            );
          }
        }
      }
    }
  });

  it("splits among others only when I'm not part of it", () => {
    const result = planSplit(1200, [them("Alex"), them("Sam")]);
    expect(result.ok && result.plan).toEqual({
      shares: [
        { name: "Alex", amountCents: 600 },
        { name: "Sam", amountCents: 600 },
      ],
      myShareCents: 0,
    });
  });

  it("trims names", () => {
    const result = planSplit(200, [me(), them("  Alex  ")]);
    expect(result.ok && result.plan.shares[0].name).toBe("Alex");
  });

  it("rejects invalid input with a typed error", () => {
    expect(planSplit(0, [me(), them("Alex")])).toEqual({
      ok: false,
      error: "invalid_total",
    });
    expect(planSplit(-100, [them("Alex")])).toEqual({
      ok: false,
      error: "invalid_total",
    });
    expect(planSplit(12.5, [them("Alex")])).toEqual({
      ok: false,
      error: "invalid_total",
    });
    expect(planSplit(1200, [me()])).toEqual({
      ok: false,
      error: "no_one_else",
    });
    expect(planSplit(1200, [])).toEqual({ ok: false, error: "no_one_else" });
    expect(planSplit(1200, [me("A"), me("B"), them("C")])).toEqual({
      ok: false,
      error: "multiple_me",
    });
    expect(planSplit(1200, [me(), them("  ")])).toEqual({
      ok: false,
      error: "blank_name",
    });
    expect(planSplit(1200, [them("Alex"), them("alex ")])).toEqual({
      ok: false,
      error: "duplicate_name",
    });
    expect(planSplit(2, [me(), them("A"), them("B")])).toEqual({
      ok: false,
      error: "total_too_small",
    });
  });
});

describe("parseParticipants", () => {
  it("splits on commas and newlines, trims, and drops empties", () => {
    expect(parseParticipants(" Alex, Sam\n\nJo ,")).toEqual([
      them("Alex"),
      them("Sam"),
      them("Jo"),
    ]);
  });

  it("pre-marks self aliases as me", () => {
    expect(parseParticipants("Me, Alex")).toEqual([
      { name: "Me", isMe: true },
      them("Alex"),
    ]);
    expect(isSelfAlias(" MYSELF ")).toBe(true);
    expect(isSelfAlias("Hoang")).toBe(false);
  });
});
