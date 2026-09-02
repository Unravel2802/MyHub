import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const nextConfig: NextConfig = {
  turbopack: {
    root: dirname(fileURLToPath(import.meta.url)),
  },
  // The curriculum's chapter files are read off disk at REQUEST time by
  // /curriculum/[topicId]/[lessonId] (see src/modules/curriculum/content.ts).
  // Next traces a route's dependencies by following imports, and a
  // `readFileSync(join(process.cwd(), ...))` with a path built at runtime is
  // invisible to that analysis — the deployed function would ship without the
  // markdown and every chapter would 404 in production while working perfectly
  // in dev. Naming the directory here is what puts the files in the bundle.
  outputFileTracingIncludes: {
    "/curriculum/[topicId]/[lessonId]": ["./content/curriculum/**/*.md"],
    "/curriculum": ["./content/curriculum/**/*.md"],
  },
};

export default nextConfig;
