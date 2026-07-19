// Setup for the DB integration suite (vitest.config.db.ts). Runs BEFORE any
// repository module is imported, so it can point the app's Supabase client
// (src/lib/supabaseClient.ts, which reads env at module load) at the TEST
// database.
//
// A service-role key is used so writes bypass RLS but STILL go through PostgREST
// — the only path that reproduces the 42P10 ON CONFLICT bug class that shipped
// green three times (the Playwright mock accepts any POST, so unit + E2E can't
// see it). See docs/db-integration-tests.md.
//
// Deliberately NO fallback to the app's live Supabase vars: these tests write and
// delete rows, so they must target the local `supabase start` stack (or an
// explicit throwaway project), never production. If the test DB isn't configured,
// fail loudly instead of clobbering real data.

try {
  process.loadEnvFile(".env.local");
} catch {
  // CI sets SUPABASE_DB_TEST_* directly; no .env.local there.
}

const url = process.env.SUPABASE_DB_TEST_URL;
const key = process.env.SUPABASE_DB_TEST_KEY;

if (!url || !key) {
  throw new Error(
    "DB integration tests need SUPABASE_DB_TEST_URL and SUPABASE_DB_TEST_KEY.\n" +
      "Point them at the local stack (`supabase start`), NOT production.\n" +
      "See docs/db-integration-tests.md.",
  );
}

process.env.NEXT_PUBLIC_SUPABASE_URL = url;
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = key; // service role → bypass RLS
