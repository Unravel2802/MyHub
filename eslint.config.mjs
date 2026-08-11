import { readdirSync } from "node:fs";
import path from "node:path";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Every directory under src/modules is a module. Read from disk rather than
// hardcoded so a new module is governed by the boundary rules below the moment
// it exists — a hand-maintained list would silently exempt exactly the newest,
// least-reviewed code.
const MODULES = readdirSync(path.join(import.meta.dirname, "src/modules"), {
  withFileTypes: true,
})
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

const STORE_MESSAGE =
  "Architecture rule 1: don't import another module's Zustand store. Read its data through that module's *Repository (see useDashboardStore), or react to its Event Bus event (src/lib/events.ts). If the state is shell-owned and mounted globally, expose it from src/components/ instead — see src/components/momentumState.ts.";

const COMPONENT_MESSAGE =
  "Architecture rule 1: don't import another module's component. If it's genuinely shared and presentational, move it to src/components/ui/ — that's what was done with ActivityHeatmap.";

// One config block per module, each forbidding the OTHER modules' internals.
// A single global pattern can't work: `no-restricted-imports` matches the
// import path with no knowledge of which file is importing it, so
// "@/src/modules/*/use*Store" also flags a module importing its own store.
const moduleBoundaries = MODULES.map((owner) => {
  const siblings = MODULES.filter((name) => name !== owner);
  return {
    files: [`src/modules/${owner}/**/*.ts`, `src/modules/${owner}/**/*.tsx`],
    // A unit test of an internal is supposed to import that internal.
    ignores: [
      `src/modules/${owner}/**/*.test.ts`,
      `src/modules/${owner}/**/*.test.tsx`,
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: siblings.map((name) => `@/src/modules/${name}/use*Store`),
              message: STORE_MESSAGE,
            },
            {
              group: siblings.map(
                (name) => `@/src/modules/${name}/components/*`,
              ),
              message: COMPONENT_MESSAGE,
            },
          ],
        },
      ],
    },
  };
});

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".claude/**",
    ".codex/**",
    // A standalone Figma-export reference project kept for design comparison,
    // not app code — see tsconfig.json's matching exclude.
    "Redesign landing page (1)/**",
  ]),
  {
    rules: {
      // A leading underscore is an explicit "this is intentionally unused"
      // from the author, so it shouldn't be reported. It matters for the
      // contract-first split (CLAUDE.md): a published interface's stub keeps
      // its full parameter list — that list IS the contract Codex builds
      // against — while the body is still `not implemented`. Without this,
      // every published contract ships a wall of warnings that trains people
      // to ignore the lint output.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },

  // ─── Module boundaries (CLAUDE.md architecture rule 1) ────────────────────
  //
  // "Never import a module's internals directly into another module."
  //
  // That rule lived only in prose, and prose does not fail a build. By the
  // time it was first measured it had drifted in six places — two modules
  // importing a sibling's React component, four importing a sibling's Zustand
  // store — none of which any review caught, because per CLAUDE.md nobody is
  // reading diffs line by line. `moduleBoundaries` above is that rule as a
  // lint error.
  //
  // A module's PUBLIC SURFACE is exactly two things:
  //   • `types.ts`       — its domain types
  //   • `*Repository.ts` — its data access
  // Everything else (stores, components, selectors, internal logic) is private
  // to the module that owns it.
  //
  // Cross-module DATA reads therefore go through the other module's
  // repository, never its store — the pattern useDashboardStore and
  // useMomentumStore already document. Cross-module BEHAVIOUR goes through the
  // Event Bus (`src/lib/events.ts`).
  //
  // Not covered, deliberately:
  //   • `src/components/**` (the shell) MAY import from modules — AppShell
  //     mounts the momentum store and renders StreakIndicator. Shell -> module
  //     is a layer boundary, not a peer one. See src/components/momentumState.ts.
  //   • `app/**` routes may import a module's page component; that IS how a
  //     route is wired.
  //   • cross-module imports of a sibling's pure domain logic (prepScorecard,
  //     financeSelectors) are still allowed. They're the aggregators' current
  //     pattern and blocking them today would mean 13 more refactors; the two
  //     categories above are where the real coupling was.
  ...moduleBoundaries,
]);

export default eslintConfig;
