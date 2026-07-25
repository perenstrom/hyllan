import { defineConfig, devices } from "@playwright/test";

if (!process.env.CI) {
  process.loadEnvFile(".env");
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  // Single browser (Chromium) — per PER-222's testing decisions, a full
  // cross-browser matrix isn't proportionate at this scale.
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Run against a production build (Next.js's own guidance for E2E, and
    // PER-222's testing decision) rather than the dev server.
    command: "npm run build && npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
