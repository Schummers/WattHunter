import { test, expect } from "@playwright/test";

// Skipped until the test fixtures include a league with at least 2 teams
// and seeded GT-phase squad data. The wireframe at /dev/gt-tactics-preview
// (now removed) covered the visual happy path during development; this
// suite documents the expected production flow.

test.fixme("user can place an Unleash tactic on a stage", async ({ page }) => {
  // Sign in as test user
  // await signInAsTestUser(page);
  await page.goto("/league/test-league-id/team/gt");

  // Open the Unleash card
  await page.getByRole("button", { name: /Unleash/i }).click();
  await expect(page.getByText(/Domestiques/)).toBeVisible();

  // Pick the next upcoming stage
  await page.getByRole("button", { name: /Stage \d+/ }).first().click();
  await page.getByRole("button", { name: /Activate/i }).click();

  // Card now shows decremented counter
  await expect(page.getByText(/1\s*\/\s*2/).first()).toBeVisible();
});

test.fixme("Nemesis flow — pick rival, pick stage, declare", async ({ page }) => {
  // await signInAsTestUser(page);
  await page.goto("/league/test-league-id/team/gt");

  await page.getByRole("button", { name: /Nemesis GC/i }).click();
  // Step 1
  await expect(page.getByText(/duel, not a guarantee/i)).toBeVisible();
  await page.getByRole("button", { name: /Team \w+/ }).first().click();
  await page.getByRole("button", { name: /Next/i }).click();
  // Step 2
  await expect(page.getByText(/Step 2 of 2/)).toBeVisible();
  await page.getByRole("button", { name: /Stage \d+/ }).first().click();
  await page.getByRole("button", { name: /Declare Nemesis/i }).click();
  // Counter at 0/1
  await expect(page.getByText(/0\s*\/\s*1/).first()).toBeVisible();
});
