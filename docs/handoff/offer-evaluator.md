# Handoff — Offer evaluator (Claude Code → Codex)

Published contract. Wave 2, Phase 8 (`myhub_plan.md` Part B; roadmap §12.1). The smallest phase —
no migration, no table, no store.

## What's already landed

| File | State |
|---|---|
| `src/modules/offers/offerScore.ts` | Done + tested — `OFFER_FACTORS`, `offerScore(ratings)`, `bestOffer(offers)`, `RATING_MIN`/`RATING_MAX` |

Seven factors, weights summing to 100: learning_rate 20, tc 20, equity_quality 15, scope 15,
team 10, depth 10, brand 10. `offerScore` returns a weighted mean on the same 1-10 scale as the
inputs (rate everything 8 → score 8).

## The point of this feature

§12.1's argument is that **total compensation is not the thing to optimize**. Learning rate is
weighted equally with TC, and scope + team + depth together (40) outweigh either. The module
exists to stop someone comparing two offers on salary alone — so the UI has to actually
communicate that, not just print a number.

`bestOffer` returns `null` on an exact tie, deliberately: highlighting one of two identical
offers as "the winner" would invent a preference the numbers don't support. Render a tie as a
tie.

## Your work

`OfferEvaluator` page + `app/offers/page.tsx` + a `NAV_ITEMS` entry:

- 2-3 offer columns, each with a name field and seven 1-10 `<select>`s (one per `OFFER_FACTORS`
  entry — map over it, don't hand-write seven; each factor carries a `label` and a `hint` worth
  surfacing as helper text).
- Live score per column, recomputed as ratings change.
- The highest-scoring column highlighted with an accent `Badge` (the Phase 1 primitive). On a
  tie (`bestOffer` returns `null`), highlight neither.
- **"Don't choose on salary alone"** as a muted footer. That line is the feature.
- localStorage persistence is optional — nice if cheap, skip it if it fights you.

## Tests

`offerScore.test.ts` already covers the math (weights sum to 100, boundaries, clamping, the
big-money-vs-well-rounded scenario). You just need the page to render and update; a light E2E
asserting the score changes when a select changes, and that the highlight follows the leader, is
enough. No new unit tests needed for the domain logic.

## Not yours

- The weights. Every one of them traces to §12.1; changing one is a spec decision, not an
  implementation detail. Flag it if it looks wrong.
