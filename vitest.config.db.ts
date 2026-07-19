import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// The DB integration suite: real repository calls against a real PostgREST +
// Postgres (a local `supabase start` stack), NOT mocks. Separate from the unit
// config because it needs a database up and runs serially against shared tables.
// Run with `npm run test:db`. See docs/db-integration-tests.md.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.db.test.ts"],
    setupFiles: ["./vitest.db.setup.ts"],
    // One database, shared tables — run files serially so cleanup can't race.
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
});
