import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/ui",
  // `next dev` compiles each route ON FIRST HIT, and as the app has grown that
  // cold compile started losing a race with Playwright's 30s default. It showed
  // up as tests "failing" with hidden elements and 30s timeouts — but only the
  // ones unlucky enough to hit a route first, so it looked like a flake in
  // whichever spec drew the short straw rather than what it was. 90s is headroom
  // for a cold compile; a genuinely hung test still fails, just later.
  timeout: 90_000,
  expect: { timeout: 10_000 },
  webServer: {
    command: "next dev",
    reuseExistingServer: true,
    url: "http://localhost:3000",
    timeout: 120_000,
  },
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
