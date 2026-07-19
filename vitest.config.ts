import { configDefaults, defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // The DB integration suite (*.db.test.ts) needs a real database and runs via
    // `npm run test:db` (vitest.config.db.ts), not the fast unit loop.
    exclude: [...configDefaults.exclude, "**/*.db.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
});
