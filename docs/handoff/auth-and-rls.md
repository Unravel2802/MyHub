# Handoff — Auth + RLS (Claude Code → Codex)

Published contract. Wave 2, Phase 7 (`myhub_plan.md` Part B). **Do this LAST, after Phases 4-6
UI is merged** — it touches every spec file, and rebasing it over other in-flight work is
painful.

## What's already landed

| File | State |
|---|---|
| `supabase/migrations/0012_enable_rls.sql` | Done — RLS enabled + `for all to authenticated using (true) with check (true)` on all nine tables |
| `src/lib/auth.ts` | Done — `getSession`, `signIn`, `signOut`, `onAuthChange`, `SignInError` |

## The security model, so you don't accidentally weaken it

MyHub is **single-user**. There are no `user_id` columns and no per-row ownership, because
there's exactly one person's data here. The policy is therefore not "you may see your own rows"
but **"you must be signed in at all"** — `to authenticated` is the entire gate, and the anon role
is granted nothing. That's the right model for the actual threat (a stranger finding the
deployed URL), not a watered-down multi-tenant one.

`signIn` throws a `SignInError` with a generic message on purpose. **Never surface Supabase's raw
auth error** — it distinguishes "wrong password" from "no such user", which hands an attacker
free account enumeration. Rule 6, but with teeth here.

## Your work

### 1. Login

`app/login/page.tsx` + `LoginForm`. **Not inside AppShell** — a login page shouldn't render the
nav for an app you can't yet access. Generic error message on failure (catch `SignInError`).
Redirect to `/dashboard` on success.

### 2. `AuthGate.tsx`, mounted inside AppShell

`getSession()` on mount → no session → `router.replace("/login")`. Render children only once a
session exists. Subscribe via `onAuthChange` so a sign-out (in this tab or another) redirects.
Sign-out button goes in the rail slot Phase 1 reserved (`{/* Phase 5: StreakIndicator; Phase 7:
sign-out */}`).

### 3. E2E — **same commit as AuthGate**, or you'll land a red main

Every existing spec will start failing the moment AuthGate exists, because none of them have a
session. Extend `tests/ui/fixtures.ts` (built in Phase 5) with a `mockAuth` that:

- Seeds `localStorage["sb-<project-ref>-auth-token"]` with a fake, non-expired session.
  **Derive `<project-ref>` from `NEXT_PUBLIC_SUPABASE_URL`, don't hardcode it** — hardcoding
  silently breaks the day the project moves.
- Routes `**/auth/v1/**` to return that session, so a token-refresh attempt never hits the
  network and never flakes.

Apply it automatically in the fixture's before-each, so every already-migrated spec keeps passing
with no per-file change.

New `tests/ui/auth.spec.ts`:
- No session → redirected to `/login`.
- Failed login → the generic message (assert it does *not* leak Supabase's wording).
- `getSession()` resolves against the seeded storage. This one exists to **pin the storage-key
  shape**: if a supabase-js upgrade changes it, this test fails loudly instead of every other
  spec failing mysteriously.

### 4. Scripts

`scripts/exportData.ts` and the seed scripts must build their client with
`SUPABASE_SERVICE_ROLE_KEY` when present — with RLS on, the anon key can no longer read anything
unauthenticated and these scripts will silently return zero rows. Fall back to anon with a
printed RLS warning rather than failing opaquely. Document the new env var in the README.

Optional but nice: `scripts/createUser.ts` using service-role `auth.admin.createUser`, so
creating the single account is one command rather than a click-path through the dashboard.

**Never commit `SUPABASE_SERVICE_ROLE_KEY`** — it bypasses RLS entirely. `.env.local` only.

## Not yours

- `0012_enable_rls.sql` and `src/lib/auth.ts`. If the policy looks wrong, flag it — a mistake in
  this file is the one bug in this project that could actually expose data.
