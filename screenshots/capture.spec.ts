// Screenshot capture tool (PER-262). Iterates the scenario catalog
// (scenarios.ts) and, for each one, seeds a dedicated account (seed.ts),
// authenticates a browser context by injecting a directly-minted session
// cookie (src/lib/testing/mock-session.ts — no browser walkthrough of
// /signup or /login, no live network call to GoTrue for the minting
// itself), and captures a screenshot at each viewport.
//
// Full catalog: `npm run screenshots` (used by CI).
// Single scenario: `npm run screenshots -- --grep <scenario-name>`.
import fs from "node:fs";
import path from "node:path";

import { test } from "@playwright/test";
import postgres from "postgres";

import { buildMockSessionCookie } from "@/lib/testing/mock-session";
import { SCENARIOS } from "./scenarios";
import { seedScenario, type SeededContext } from "./seed";

const OUTPUT_DIR = path.join(process.cwd(), "screenshots", "output");
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 375, height: 667 },
] as const;

// Must match playwright.screenshots.config.ts's `use.baseURL` — context
// cookies are scoped by URL, so this can't be left implicit.
const APP_URL = "http://localhost:3000";

for (const scenario of SCENARIOS) {
  test.describe(scenario.name, () => {
    let ctx: SeededContext | null = null;
    let cookie: { name: string; value: string } | null = null;
    let sql: postgres.Sql | null = null;

    test.beforeAll(async () => {
      if (!scenario.seed) {
        return;
      }

      sql = postgres(process.env.DATABASE_URL!);
      ctx = await seedScenario(sql, scenario.name, scenario.seed);
      cookie = buildMockSessionCookie({
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
        jwtSecret: process.env.GOTRUE_JWT_SECRET!,
        user: { id: ctx.userId, email: ctx.email },
      });
    });

    test.afterAll(async () => {
      await sql?.end();
    });

    for (const viewport of VIEWPORTS) {
      test(viewport.name, async ({ browser }) => {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
        });

        if (cookie) {
          await context.addCookies([
            { name: cookie.name, value: cookie.value, url: APP_URL },
          ]);
        }

        const page = await context.newPage();
        const route =
          typeof scenario.route === "function"
            ? scenario.route(ctx!)
            : scenario.route;
        await page.goto(route);
        await scenario.interactions?.(page);

        await page.screenshot({
          path: path.join(
            OUTPUT_DIR,
            `${scenario.name}-${viewport.name}.png`,
          ),
          // Several scenarios (the pantry list, add/edit forms) overflow a
          // mobile viewport — a viewport-only screenshot would silently
          // crop the state the tool exists to show a reviewer.
          fullPage: true,
        });

        await context.close();
      });
    }
  });
}
