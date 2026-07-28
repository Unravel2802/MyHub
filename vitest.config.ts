import { configDefaults, defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    // `.test.tsx` renders components with `react-dom/server`, which needs no
    // jsdom — the node environment stays as-is for the whole suite.
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["./vitest.setup.ts"],
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
