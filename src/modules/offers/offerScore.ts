// Offer evaluator (myhub_plan.md Part B, Phase 8; roadmap §12.1).
//
// The whole point of this module is the WEIGHTS. §12.1's argument is that
// total compensation is not the thing to optimize — learning rate is weighted
// equally with TC, and the three "how good is this job actually" factors
// (scope, team, depth) together outweigh either. Someone comparing two offers
// on salary alone is making the mistake this exists to prevent, which is why
// the UI carries "Don't choose on salary alone" as a footer.

export interface OfferFactor {
  key: string;
  label: string;
  // Out of 100 across all factors — see the assertion in the test.
  weight: number;
  hint: string;
}

export const OFFER_FACTORS = [
  {
    key: "learning_rate",
    label: "Learning rate",
    weight: 20,
    hint: "How fast will you get better here? Weighted equal to comp on purpose.",
  },
  {
    key: "tc",
    label: "Total compensation",
    weight: 20,
    hint: "Salary + bonus + equity value.",
  },
  {
    key: "equity_quality",
    label: "Equity quality",
    weight: 15,
    hint: "Is the equity actually worth something, or a lottery ticket?",
  },
  {
    key: "scope",
    label: "Scope",
    weight: 15,
    hint: "How much surface area do you own?",
  },
  {
    key: "team",
    label: "Team",
    weight: 10,
    hint: "Would you learn from the people around you?",
  },
  {
    key: "depth",
    label: "Technical depth",
    weight: 10,
    hint: "Real systems work, or glue code?",
  },
  {
    key: "brand",
    label: "Brand",
    weight: 10,
    hint: "What doors does the name open next?",
  },
] as const satisfies readonly OfferFactor[];

export type FactorKey = (typeof OFFER_FACTORS)[number]["key"];

export type OfferRatings = Record<FactorKey, number>;

export const RATING_MIN = 1;
export const RATING_MAX = 10;

// Weighted average of the seven 1-10 ratings, returned on the same 1-10 scale
// the inputs use rather than as a 0-100 percentage — so a score reads directly
// against the ratings that produced it ("this offer is a 7.4" means something
// next to a row of 7s and 8s; "74%" invites reading it as a grade).
//
// Weights sum to 100 (asserted in the tests), so this is a true weighted mean:
// rating every factor 8 gives exactly 8.
export function offerScore(ratings: OfferRatings): number {
  const total = OFFER_FACTORS.reduce(
    (sum, factor) => sum + clamp(ratings[factor.key]) * factor.weight,
    0,
  );

  return total / TOTAL_WEIGHT;
}

const TOTAL_WEIGHT = OFFER_FACTORS.reduce(
  (sum, factor) => sum + factor.weight,
  0,
);

// A rating outside 1-10 is a bug in the caller, but silently producing a
// nonsense score would hide it. Clamping keeps the output meaningful and
// bounded rather than propagating garbage into a number someone might make a
// life decision on.
function clamp(rating: number): number {
  if (Number.isNaN(rating)) return RATING_MIN;
  return Math.min(RATING_MAX, Math.max(RATING_MIN, rating));
}

// Which offer scored highest. Null on an empty list, and — deliberately — null
// on an exact tie: highlighting one of two identical offers as "the winner"
// would be inventing a preference the numbers don't support. A tie means the
// score has done its job and the decision is now yours.
export function bestOffer<T extends { ratings: OfferRatings }>(
  offers: T[],
): T | null {
  if (offers.length === 0) return null;

  const scored = offers.map((offer) => ({
    offer,
    score: offerScore(offer.ratings),
  }));
  const best = Math.max(...scored.map((entry) => entry.score));
  const winners = scored.filter((entry) => entry.score === best);

  return winners.length === 1 ? winners[0].offer : null;
}
