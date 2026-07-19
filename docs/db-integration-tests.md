# DB Integration Tests

## Why this exists

The unit suite mocks the repository, and the Playwright E2E mock **accepts any
POST**. So a bug that lives in the actual database — a schema mismatch, a bad
`ON CONFLICT`, an RLS policy — is invisible to both. This is not hypothetical:
the **42P10 partial-index-vs-`ON CONFLICT` bug shipped green three times** this
project (roadmap, achievements, weekly reviews), because a partial unique index
can't be an `ON CONFLICT` target and PostgREST emits a bare `ON CONFLICT (col)`.
Every write silently rolled back while 300+ unit and 60+ E2E tests stayed green.

These tests close that gap: they call the **real repository functions** against a
**real PostgREST + Postgres**, so that class of bug goes red. Going through
PostgREST is the point — a raw `pg` client would NOT reproduce 42P10, because the
bug is in how PostgREST generates SQL, not in Postgres.

## How it works

- `*.db.test.ts` files (e.g. `src/modules/finance/FinanceRepository.db.test.ts`)
  are a separate suite, run via `npm run test:db` (config: `vitest.config.db.ts`).
  They're **excluded** from the fast `npm test` unit loop.
- `vitest.db.setup.ts` points the app's Supabase client at the **test** database
  using a **service-role** key (bypasses RLS but still goes through PostgREST).
  It reads `SUPABASE_DB_TEST_URL` + `SUPABASE_DB_TEST_KEY` and refuses to run
  without them — deliberately no fallback to the app's live vars, so these
  write/delete tests can never target production.
- Each test namespaces its rows (`__dbtest_*`) and cleans up; shared single-row
  state (finance_settings) is snapshot-and-restored.

## Running it

**CI** — `.github/workflows/db-tests.yml` runs on every push/PR: it does
`supabase start` (which applies every migration in `supabase/migrations/` to a
clean local db) and runs `npm run test:db` against it. This is the real gate.

**Locally** — you need the Supabase CLI + Docker:

```bash
supabase start                      # boots Postgres+PostgREST, applies migrations
SUPABASE_DB_TEST_URL=http://127.0.0.1:54321 \
SUPABASE_DB_TEST_KEY="$(supabase status -o json | jq -r '.SERVICE_ROLE_KEY')" \
  npm run test:db
supabase stop
```

Never point `SUPABASE_DB_TEST_URL` at production — the tests write and delete.

## What's covered (and what's next)

**Slice 1 (now)** — the finance upsert / conversion paths, the newest 42P10-class
code: `upsertBudget` (ON CONFLICT category), `updateSavings` (single-row upsert),
and the `markReceivablePaid` receivable → income conversion.

**Next slices** — the same pattern for the already-fixed legacy tables, as
regression protection (these are the exact writes that broke before):

- `MomentumRepository.insertUnlocks` (achievements — migration 0017 fix)
- `ReviewRepository.upsertReview` (weekly_reviews — migration 0018 fix)
- `RoadmapRepository.tickCriterion` (roadmap_progress — migration 0015 fix)
- `regenerateWeeklyInstances` / `regenerateMonthlyBillInstances` idempotency
  (call twice → no duplicates)
- A couple of RLS assertions with the **anon** key (unauthenticated reads 0 rows)
