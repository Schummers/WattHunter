import { test, expect } from "@playwright/test";

/**
 * Smoke tests — verify the app boots and the public surface renders
 * without server errors. These tests use a fresh browser context (no
 * auth cookies) so they don't depend on any seeded user.
 */

test.describe("public surface", () => {
  test("home redirects to /onboarding when not authenticated", async ({ page }) => {
    const response = await page.goto("/");
    // Either a 200 after redirect, or 307 redirect status — both fine.
    expect(response?.status() ?? 0).toBeLessThan(400);
    await expect(page).toHaveURL(/\/onboarding/);
    // Ensure proxy.ts ran (auth refresh path) and the page actually rendered
    await expect(page).toHaveTitle(/WattHunter/);
  });

  test("/login renders the sign-in form", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL(/\/login/);
    // Form should expose an email field — minimum viable check.
    await expect(page.getByLabel(/email/i)).toBeVisible();
  });

  test("/signup renders the sign-up form", async ({ page }) => {
    await page.goto("/signup");
    await expect(page).toHaveURL(/\/signup/);
    await expect(page.getByLabel(/email/i)).toBeVisible();
  });

  test("game routes redirect unauthenticated user to /onboarding", async ({ page }) => {
    // Pick a route that requires auth. The exact redirect target is
    // controlled by lib/supabase/middleware.ts:38-41.
    const response = await page.goto("/league/00000000-0000-0000-0000-000000000000");
    expect(response?.status() ?? 0).toBeLessThan(500);
    await expect(page).toHaveURL(/\/onboarding/);
  });
});

test.describe("no console errors on public pages", () => {
  for (const path of ["/login", "/signup", "/onboarding"]) {
    test(`${path} loads without console errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
      });

      await page.goto(path);
      // Give the page a moment to settle; no API calls expected on
      // these screens, so this is a tight budget.
      await page.waitForLoadState("networkidle", { timeout: 5_000 });

      expect(errors, `Errors on ${path}:\n${errors.join("\n")}`).toEqual([]);
    });
  }
});
