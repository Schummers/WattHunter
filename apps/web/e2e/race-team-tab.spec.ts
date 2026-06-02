import { test, expect } from "@playwright/test";

// FIXME: enable once a deterministic seed for the demo league exposes:
//   - an active GT phase OR an active 1-week race campaign
//   - one stage_profiles row per upcoming stage of that race
test.fixme("Race Team tab shows dynamic label + scoring encart", async ({ page }) => {
  await page.goto("/league/demo/team/gt");

  // (1) The page or sub-tab shows the dynamic Race Team label.
  // Either "Tour de France Team" / "Giro Team" / etc. or, off-season, "Race Team".
  await expect(
    page.getByRole("heading", { name: /Team$/ }),
  ).toBeVisible();

  // (2) The scoring encart is present and expandable.
  const summary = page.getByText("How scoring works");
  await expect(summary).toBeVisible();
  await summary.click();
  await expect(page.getByText("Daily classifications")).toBeVisible();
  await expect(page.getByText("Final classifications")).toBeVisible();
  await expect(page.getByText("Nemesis (tactic)")).toBeVisible();
});

test.fixme("Nemesis modal disables stages with wrong profile", async ({ page }) => {
  await page.goto("/league/demo/team/gt");
  // Open the Nemesis Sprint modal (Tactics section → Nemesis Sprint card).
  await page.getByRole("button", { name: /Nemesis Sprint/i }).click();
  // ... rival pick ...
  await page.getByRole("button", { name: /Next/i }).click();
  // A mountain stage (p5) should be disabled with the "Wrong profile" tag.
  const wrongRow = page.getByTestId(
    "profile-mismatch-race/tour-de-france/2026/stage-12",
  );
  await expect(wrongRow).toBeVisible();
});
