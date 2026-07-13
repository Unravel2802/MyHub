import { describe, expect, it } from "vitest";
import {
  bestOffer,
  OFFER_FACTORS,
  offerScore,
  RATING_MAX,
  RATING_MIN,
} from "@/src/modules/offers/offerScore";
import type { FactorKey, OfferRatings } from "@/src/modules/offers/offerScore";

function ratings(overrides: Partial<OfferRatings> = {}): OfferRatings {
  return {
    learning_rate: 5,
    tc: 5,
    equity_quality: 5,
    scope: 5,
    team: 5,
    depth: 5,
    brand: 5,
    ...overrides,
  };
}

describe("OFFER_FACTORS", () => {
  it("has weights summing to exactly 100", () => {
    // If this ever fails, offerScore's weighted mean silently stops being a
    // mean and every score shifts. Guard it here rather than discovering it in
    // a decision someone actually made.
    const total = OFFER_FACTORS.reduce((sum, f) => sum + f.weight, 0);
    expect(total).toBe(100);
  });

  it("weights learning rate equally with total compensation (§12.1)", () => {
    const learning = OFFER_FACTORS.find((f) => f.key === "learning_rate")!;
    const tc = OFFER_FACTORS.find((f) => f.key === "tc")!;

    expect(learning.weight).toBe(tc.weight);
  });

  it("weights the job-quality factors above any single money factor", () => {
    const jobQuality = (["scope", "team", "depth"] as FactorKey[])
      .map((key) => OFFER_FACTORS.find((f) => f.key === key)!.weight)
      .reduce((a, b) => a + b, 0);
    const tc = OFFER_FACTORS.find((f) => f.key === "tc")!.weight;

    expect(jobQuality).toBeGreaterThan(tc);
  });

  it("has no duplicate keys", () => {
    const keys = OFFER_FACTORS.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("offerScore", () => {
  it("returns the rating itself when every factor is rated the same", () => {
    // The defining property of a true weighted mean over weights summing to 100.
    expect(offerScore(ratings({}))).toBe(5);
    expect(
      offerScore(
        Object.fromEntries(
          OFFER_FACTORS.map((f) => [f.key, 8]),
        ) as OfferRatings,
      ),
    ).toBe(8);
  });

  it("hits the scale's endpoints", () => {
    const all = (value: number) =>
      Object.fromEntries(
        OFFER_FACTORS.map((f) => [f.key, value]),
      ) as OfferRatings;

    expect(offerScore(all(RATING_MIN))).toBe(1);
    expect(offerScore(all(RATING_MAX))).toBe(10);
  });

  it("weights a high-weight factor more than a low-weight one", () => {
    // learning_rate (20) vs. brand (10): the same bump should move the score
    // twice as much.
    const base = offerScore(ratings());
    const betterLearning = offerScore(ratings({ learning_rate: 10 }));
    const betterBrand = offerScore(ratings({ brand: 10 }));

    expect(betterLearning - base).toBeCloseTo((betterBrand - base) * 2);
  });

  it("clamps out-of-range ratings rather than producing a nonsense score", () => {
    expect(offerScore(ratings({ tc: 99 }))).toBe(offerScore(ratings({ tc: 10 })));
    expect(offerScore(ratings({ tc: -5 }))).toBe(offerScore(ratings({ tc: 1 })));
    expect(offerScore(ratings({ tc: NaN }))).toBe(offerScore(ratings({ tc: 1 })));
  });
});

describe("bestOffer", () => {
  it("picks the highest-scoring offer", () => {
    const good = { name: "good", ratings: ratings({ learning_rate: 9 }) };
    const worse = { name: "worse", ratings: ratings() };

    expect(bestOffer([worse, good])?.name).toBe("good");
  });

  it("returns null on an exact tie rather than inventing a winner", () => {
    const a = { name: "a", ratings: ratings() };
    const b = { name: "b", ratings: ratings() };

    expect(bestOffer([a, b])).toBeNull();
  });

  it("returns null for no offers", () => {
    expect(bestOffer([])).toBeNull();
  });

  it("is not fooled by a high salary alone", () => {
    // The §12.1 scenario the whole module exists for: a big-money offer that's
    // mediocre everywhere else should NOT beat a well-rounded one.
    const bigMoney = {
      name: "big-money",
      ratings: ratings({ tc: 10, equity_quality: 10, learning_rate: 3, scope: 3, depth: 3 }),
    };
    const wellRounded = {
      name: "well-rounded",
      ratings: ratings({ learning_rate: 9, scope: 9, depth: 9, team: 9, tc: 6 }),
    };

    expect(bestOffer([bigMoney, wellRounded])?.name).toBe("well-rounded");
  });
});
