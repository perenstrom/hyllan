import { defineConfig, devices } from "@playwright/test";

if (!process.env.CI) {
  process.loadEnvFile(".env");
}

// Separate from playwright.config.ts (whose testDir is ./e2e and whose job
// is functional coverage) — this config drives the screenshot capture tool
// (PER-262): a full-catalog sweep in CI, or a single scenario via
// `npm run screenshots -- --grep <scenario-name>` for an agent that only
// wants to see what it just changed.
export default defineConfig({
  testDir: "./screenshots",
  // Not fullyParallel: each scenario's two viewport tests share one seeded
  // account/household (seeded once in a describe-scoped beforeAll — see
  // capture.spec.ts). fullyParallel can split tests from the same describe
  // across workers, which would re-run that beforeAll concurrently in each
  // one and race GoTrue's /signup call for the same account. Keeping this
  // single spec file on one worker (the default without fullyParallel)
  // avoids that; the catalog is small enough that this isn't a speed
  // problem.
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
  },
  // Single browser, same rationale as playwright.config.ts (PER-222): a
  // cross-browser matrix isn't proportionate at this scale, and these are
  // for human/agent review, not compatibility testing.
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Production build, same as playwright.config.ts and for the same
    // reason (Next.js's own E2E guidance) — a screenshot should show what
    // actually ships.
    command: "npm run build && npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
