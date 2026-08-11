import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

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
]);

export default eslintConfig;
