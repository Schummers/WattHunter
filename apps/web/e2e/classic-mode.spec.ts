import { test, expect } from "@playwright/test";

// Skipped until the test fixtures include a classic-mode league with at least
// 2 teams and a launched 3-round auction. This suite documents the expected
// production flow for the classic game mode. Unit/component tests already cover
// the per-component conditional rendering; this is the end-to-end happy path.

test.fixme("create a classic league: lobby shows only Lobby + Rules", async ({ page }) => {
  // await signInAsTestUser(page);
  await page.goto("/league/create");
  await page.getByRole("textbox", { name: /league name/i }).fill("Classic Test");
  // Pick the Classic mode in the segmented control
  await page.getByRole("button", { name: /Classic/i }).click();
  await page.getByRole("button", { name: /create/i }).click();

  // Lobby has no "Level & Pool" tab in classic
  await expect(page.getByText(/Level & Pool/i)).toHaveCount(0);
  await expect(page.getByText(/Rules/i)).toBeVisible();
});

test.fixme("classic auction: flat 1.5M budget, no sponsor/strategy cards, cap 8", async ({ page }) => {
  // await signInAsTestUser(page);
  await page.goto("/league/classic-test-id/auction");

  // Flat budget bar, no sponsor income / salary lines
  await expect(page.getByText(/Remaining/i)).toBeVisible();
  await expect(page.getByText(/Sponsor/i)).toHaveCount(0);
  await expect(page.getByText(/Strateg/i)).toHaveCount(0);

  // Draft 8 riders, the 9th bid is rejected by the slot cap
  // (drive the market UI to add 8 draft bids, attempt a 9th, assert error toast)
});

test.fixme("classic Race Team: 8 role slots, no Sponsors Goals, no Call the Bus", async ({ page }) => {
  // await signInAsTestUser(page);
  await page.goto("/league/classic-test-id/team/gt");

  await expect(page.getByText(/Sponsors Goals/i)).toHaveCount(0);
  await expect(page.getByText(/Call the Bus/i)).toHaveCount(0);
  // Team Composition still shows role slots (GC Leader, Sprinter, ...)
  await expect(page.getByText(/GC Leader/i)).toBeVisible();
});

test.fixme("classic Team section: only Race Team sub-tab, no Budget nav", async ({ page }) => {
  // await signInAsTestUser(page);
  await page.goto("/league/classic-test-id/team/gt");

  await expect(page.getByText(/My Team/i)).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Budget/i })).toHaveCount(0);
});

test.fixme("manager regression: a manager league is unchanged", async ({ page }) => {
  // await signInAsTestUser(page);
  await page.goto("/league/manager-test-id/team");

  // Manager keeps My Team + Budget sub-tabs and the sponsor/strategy surfaces
  await expect(page.getByText(/My Team/i)).toBeVisible();
  await expect(page.getByText(/Budget/i)).toBeVisible();
});
