import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for WattHunter end-to-end tests.
 *
 * Tests live in `apps/web/e2e/`. They run against a dev server.
 *
 * Local dev: start `pnpm dev` in one terminal, then `pnpm test:e2e` in
 * another. The config does not auto-start a dev server because the app
 * relies on `.env.local` (Supabase URL, anon key) being present at boot
 * — letting Playwright spawn it would surprise contributors with broken
 * env state. CI should set the env explicitly and use `webServer`.
 */
export default defineConfig({
  testDir: "./e2e",
  // Reasonable defaults. Bump if a test consistently flakes.
  timeout: 30_000,
  expect: { timeout: 5_000 },

  // Sequential by default — Supabase shares state and parallel tests
  // would step on each other without per-worker tenants.
  fullyParallel: false,
  workers: 1,

  reporter: [["list"]],

  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  // WattHunter is mobile-first: BottomNav, single-column layouts, Sidebar
  // only at lg:. We prioritise mobile in tests; add desktop as a secondary
  // project later if a feature needs it specifically.
  projects: [
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"] },
    },
  ],
});
