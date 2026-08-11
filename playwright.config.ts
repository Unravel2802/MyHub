import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/ui",
  // The suite runs against a PRODUCTION BUILD, not `next dev`.
  //
  // `next dev` compiles each route on first hit. As the app grew to 17 routes
  // that cold compile became the dominant source of flakiness: whichever spec
  // happened to hit a route first paid the compile, and with four workers
  // competing it regularly blew past the per-assertion timeout. It read as a
  // flake in whatever spec drew the short straw — finance.spec.ts and
  // reader.spec.ts both failed this way, at different assertions each run,
  // while passing in isolation.
  //
  // The previous mitigation was a 90s per-test timeout, which treated the
  // symptom: the compile still happened, tests just waited longer. Building
  // first removes the variable entirely — every route is already compiled
  // before the first request, so timings are stable and comparable.
  //
  // It also means the suite tests what actually ships. That is not theoretical:
  // the Reader's `DOMMatrix` server-render crash existed only in a production
  // render path, and a dev-mode suite could not have caught it.
  //
  // Cost: ~16s for the build, against a suite that takes ~60s. Roughly a wash
  // versus the compile time it replaces, and deterministic instead of variable.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  webServer: {
    command: "npm run build && npm run start",
    // NOT reused. Reusing a running `next dev` would silently put local runs
    // back in dev mode — which is exactly the configuration this change exists
    // to stop testing against, and would make local and CI disagree.
    reuseExistingServer: false,
    url: "http://localhost:3000",
    timeout: 180_000,
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
