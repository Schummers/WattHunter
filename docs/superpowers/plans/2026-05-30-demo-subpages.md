# Demo Mode Sub-Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every `/league/demo/*` sub-page render in read-only mode for anonymous visitors by adding a `renderDemoXxx()` early branch to each gated server `page.tsx`, mirroring the pattern already shipped on the demo home.

**Architecture:** Per-page guard `if (leagueId === DEMO_LEAGUE_SLUG) return await renderDemoXxx(...)` at the top of each default export, with a co-located helper at the bottom of the same file that re-runs the same SELECTs against `DEMO_LEAGUE_ID` / `DEMO_VISITOR_TEAM_ID` and skips `auth.uid()` + `league_members` lookups. Client components are reused verbatim with `leagueId={DEMO_LEAGUE_SLUG}` to keep navigation inside the demo route tree.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase JS client (anon key), Tailwind v4 + design system tokens.

---

## Pre-flight

Read once before starting any task:

- `docs/archive/specs/2026-05-30-demo-subpages-spec.md` — this plan's spec
- `apps/web/lib/demo-constants.ts` — UUIDs + `isDemoLeague()` helper
- `apps/web/app/(game)/league/[leagueId]/page.tsx` (lines 21-23 + 315-341) — canonical `renderDemoHome()` reference
- `apps/web/app/(game)/league/[leagueId]/demo-layout.tsx` — confirms `unlockedTabs` already includes home/auction/team/budget/ranking/achievements

Conventions reused everywhere below:

```ts
import {
  DEMO_LEAGUE_SLUG,
  DEMO_LEAGUE_ID,
  DEMO_VISITOR_TEAM_ID,
} from "@/lib/demo-constants";

const { leagueId } = await params;
if (leagueId === DEMO_LEAGUE_SLUG) return await renderDemoXxx(/* sub-params */);
```

Empty-state markup (used by GT pages + commissioner-only auction/rounds):

```tsx
return (
  <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
    <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
      {message}
    </p>
  </div>
);
```

---

## File structure

19 page files modified, 1 lib helper extended. No new files.

```
apps/web/app/(game)/league/[leagueId]/
  ranking/page.tsx                                 — Task 1
  ranking/team/[teamId]/page.tsx                   — Task 2
  team/page.tsx                                    — Task 3
  team/strategies/page.tsx                         — Task 4
  team/budget/page.tsx                             — Task 5
  team/budget/marketplace/page.tsx                 — Task 5
  team/budget/transactions/page.tsx                — Task 5
  team/gt/page.tsx                                 — Task 6 (empty state)
  team/gt/rescue/page.tsx                          — Task 6 (empty state)
  auction/page.tsx                                 — Task 7
  auction/[auctionId]/page.tsx                     — Task 8
  auction/[auctionId]/results/page.tsx             — Task 8
  auction/status/page.tsx                          — Task 9
  auction/history/page.tsx                         — Task 9
  auction/market/page.tsx                          — Task 9
  auction/rounds/page.tsx                          — Task 9 (empty state)
  achievements/page.tsx                            — Task 10
  levels/page.tsx                                  — Task 10
  rider/[riderId]/page.tsx                         — Task 11
apps/web/lib/rider-detail-data.ts                  — Task 11
```

Per-task workflow for **every** task:

1. Read the target page in full so you understand which queries to mirror.
2. Add the 3-line guard + `import` line at the top.
3. Append the `renderDemoXxx()` helper at the bottom, under the banner comment block.
4. `pnpm typecheck --filter @watthunter/web` (or the repo equivalent) — must pass.
5. Smoke the page via the dev server (`pnpm dev`) at the listed `/league/demo/...` URL with no Supabase session cookie. The page must render without a redirect and without runtime errors visible in the browser console.
6. Commit with the listed message.

---

## Task 1: Ranking page

**Files:**
- Modify: `apps/web/app/(game)/league/[leagueId]/ranking/page.tsx`

- [ ] **Step 1: Read the existing default export end-to-end** so you can mirror the same queries (teams, contracts, rider_xp_daily, race_results, team_ranking_daily) without the `getUser()` / `league_members` lookups.

- [ ] **Step 2: Add the import + guard at the top of the default export**

```ts
import {
  DEMO_LEAGUE_SLUG,
  DEMO_LEAGUE_ID,
  DEMO_VISITOR_TEAM_ID,
} from "@/lib/demo-constants";

// ...inside default export, immediately after `const { leagueId } = await params;`
if (leagueId === DEMO_LEAGUE_SLUG) return await renderDemoRanking();
```

- [ ] **Step 3: Append `renderDemoRanking()` at the bottom of the file**

```ts
// ---------------------------------------------------------------------------
// Demo path — anonymous visitor, no auth required
// ---------------------------------------------------------------------------
async function renderDemoRanking() {
  const supabase = await createClient();
  // Mirror the queries from the auth path, but:
  //   - replace leagueId with DEMO_LEAGUE_ID
  //   - replace the league_members → myTeamId lookup with DEMO_VISITOR_TEAM_ID
  //   - skip auth.getUser()
  // Render <RankingClient leagueId={DEMO_LEAGUE_SLUG} myTeamId={DEMO_VISITOR_TEAM_ID} ... />
  // (or the equivalent prop names the client component already expects).
}
```

Re-run every SELECT from the auth path with `DEMO_LEAGUE_ID` swapped in, and pass `DEMO_VISITOR_TEAM_ID` wherever the auth path used `memberRow.team_id`.

- [ ] **Step 4: Verify**

```bash
pnpm --filter @watthunter/web typecheck
```

Then visit `/league/demo/ranking` in an incognito tab. The page renders the ranking table with the visitor's team highlighted (rank-2 by spec).

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/(game)/league/[leagueId]/ranking/page.tsx
git commit -m "feat(demo): render /league/demo/ranking for anonymous visitors"
```

---

## Task 2: Ranking team detail page

**Files:**
- Modify: `apps/web/app/(game)/league/[leagueId]/ranking/team/[teamId]/page.tsx`

- [ ] **Step 1: Read the existing page**

The path-param `teamId` is a UUID; the existing code already verifies `team.league_id === leagueId` via its first query. In the demo helper, do the same check against `DEMO_LEAGUE_ID`; if the team isn't in the demo league, render `<p className="text-[var(--text-mid)]">Team not found.</p>` (matching the existing not-found copy).

- [ ] **Step 2: Add the import + guard**

```ts
import {
  DEMO_LEAGUE_SLUG,
  DEMO_LEAGUE_ID,
} from "@/lib/demo-constants";

// inside default export:
const { leagueId, teamId } = await params;
if (leagueId === DEMO_LEAGUE_SLUG) return await renderDemoTeamRanking(teamId);
```

- [ ] **Step 3: Append `renderDemoTeamRanking(teamId)` at the bottom**

```ts
async function renderDemoTeamRanking(teamId: string) {
  const supabase = await createClient();
  // Mirror the auth path's queries:
  //   - teams (id, league_id, ...) where id = teamId AND league_id = DEMO_LEAGUE_ID
  //     If null → render "Team not found"
  //   - league_members owner display (skip the auth.uid() join, just look up display_name by user_id)
  //   - contracts (team_id = teamId)
  //   - rider_xp_daily (team_id = teamId)
  //   - league-wide teams / contracts / rider_xp_daily for league rank computations (filter by league_id = DEMO_LEAGUE_ID)
  //   - race_results scoped by the same race_slugs
  // Render the same JSX as the auth path; pass leagueId={DEMO_LEAGUE_SLUG} in any client links.
}
```

- [ ] **Step 4: Verify**

```bash
pnpm --filter @watthunter/web typecheck
```

From `/league/demo/ranking`, click any rival team row. Page renders without redirect.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/(game)/league/[leagueId]/ranking/team/[teamId]/page.tsx
git commit -m "feat(demo): render /league/demo/ranking/team/:teamId"
```

---

## Task 3: My Team page

**Files:**
- Modify: `apps/web/app/(game)/league/[leagueId]/team/page.tsx`

- [ ] **Step 1: Read the existing page**

The auth path resolves `teamId` via `league_members(user_id = auth.uid(), league_id = leagueId)`. The demo path skips this and uses `DEMO_VISITOR_TEAM_ID` directly.

- [ ] **Step 2: Add the import + guard**

```ts
import {
  DEMO_LEAGUE_SLUG,
  DEMO_LEAGUE_ID,
  DEMO_VISITOR_TEAM_ID,
} from "@/lib/demo-constants";

// inside default export, after `const { leagueId } = await params;`:
if (leagueId === DEMO_LEAGUE_SLUG) return await renderDemoTeam();
```

- [ ] **Step 3: Append `renderDemoTeam()` at the bottom**

```ts
async function renderDemoTeam() {
  const supabase = await createClient();
  const teamId = DEMO_VISITOR_TEAM_ID;
  const leagueId = DEMO_LEAGUE_ID;
  // Mirror the auth path's queries:
  //   - contracts (team_id = teamId), join riders
  //   - teams (count above + total in league, filter by league_id = leagueId)
  //   - team_strategies (team_id = teamId), join strategies
  //   - rider_xp_daily (team_id = teamId)
  // Render the same JSX (BrandCard, RiderCard, ...) with leagueId={DEMO_LEAGUE_SLUG} in links.
}
```

- [ ] **Step 4: Verify**

```bash
pnpm --filter @watthunter/web typecheck
```

Visit `/league/demo/team`. Roster renders; sponsor badge renders.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/(game)/league/[leagueId]/team/page.tsx
git commit -m "feat(demo): render /league/demo/team"
```

---

## Task 4: Team strategies page

**Files:**
- Modify: `apps/web/app/(game)/league/[leagueId]/team/strategies/page.tsx`

- [ ] **Step 1: Read the existing page**

Auth path queries `league_members` (gate), `strategies`, `team_strategies`, `riders` (nationality + real_team distinct), `contracts`. All `team_id` / `league_id` scoped.

- [ ] **Step 2: Add the import + guard**

```ts
import {
  DEMO_LEAGUE_SLUG,
  DEMO_LEAGUE_ID,
  DEMO_VISITOR_TEAM_ID,
} from "@/lib/demo-constants";

if (leagueId === DEMO_LEAGUE_SLUG) return await renderDemoTeamStrategies();
```

- [ ] **Step 3: Append `renderDemoTeamStrategies()`**

```ts
async function renderDemoTeamStrategies() {
  const supabase = await createClient();
  const teamId = DEMO_VISITOR_TEAM_ID;
  const leagueId = DEMO_LEAGUE_ID;
  // Mirror queries: strategies catalog (USING true), team_strategies (team_id), riders (for nationalities + teams),
  // contracts (team_id) to compute rosterRiders. Compute level from teams row.
  // Render <StrategiesClient teamId={teamId} leagueId={DEMO_LEAGUE_SLUG} ... />
}
```

`isInAuctionWindow` and `nextPhaseName` come from pure lib helpers — call them the same way.

- [ ] **Step 4: Verify**

```bash
pnpm --filter @watthunter/web typecheck
```

Visit `/league/demo/team/strategies`. Strategy cards render with the visitor's level / unlocks.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/(game)/league/[leagueId]/team/strategies/page.tsx
git commit -m "feat(demo): render /league/demo/team/strategies"
```

---

## Task 5: Budget cluster (page + marketplace + transactions)

**Files:**
- Modify: `apps/web/app/(game)/league/[leagueId]/team/budget/page.tsx`
- Modify: `apps/web/app/(game)/league/[leagueId]/team/budget/marketplace/page.tsx`
- Modify: `apps/web/app/(game)/league/[leagueId]/team/budget/transactions/page.tsx`

All three follow the identical pattern (resolve team via `DEMO_VISITOR_TEAM_ID`, run the same SELECTs).

- [ ] **Step 1: Read all three files**

- [ ] **Step 2: `team/budget/page.tsx` — add guard + helper**

```ts
import {
  DEMO_LEAGUE_SLUG,
  DEMO_LEAGUE_ID,
  DEMO_VISITOR_TEAM_ID,
} from "@/lib/demo-constants";

// inside default export:
if (leagueId === DEMO_LEAGUE_SLUG) return await renderDemoTeamBudget();

// at bottom:
async function renderDemoTeamBudget() {
  const supabase = await createClient();
  const teamId = DEMO_VISITOR_TEAM_ID;
  // Mirror: teams (treasury, level, name), team_sponsors join sponsors, treasury_log phase-scoped,
  // treasury_log totals. Render <BudgetClient leagueId={DEMO_LEAGUE_SLUG} ... />
}
```

- [ ] **Step 3: `team/budget/marketplace/page.tsx` — same shape**

```ts
if (leagueId === DEMO_LEAGUE_SLUG) return await renderDemoTeamMarketplace();

async function renderDemoTeamMarketplace() {
  const supabase = await createClient();
  const teamId = DEMO_VISITOR_TEAM_ID;
  // Mirror: teams (level), sponsors catalog, team_sponsors current, getNextPhase()/getOpenAuction()/isLeagueFirstCycle() called with DEMO_LEAGUE_ID.
  // Render <MarketplaceClient leagueId={DEMO_LEAGUE_SLUG} teamId={teamId} ... />
}
```

- [ ] **Step 4: `team/budget/transactions/page.tsx` — same shape**

```ts
if (leagueId === DEMO_LEAGUE_SLUG) return await renderDemoTeamTransactions();

async function renderDemoTeamTransactions() {
  const supabase = await createClient();
  const teamId = DEMO_VISITOR_TEAM_ID;
  // Mirror: teams (resolve name), treasury_log (team_id, join riders).
  // Render <TransactionsClient transactions={...} />
}
```

- [ ] **Step 5: Verify**

```bash
pnpm --filter @watthunter/web typecheck
```

Visit each URL in incognito:
- `/league/demo/team/budget`
- `/league/demo/team/budget/marketplace`
- `/league/demo/team/budget/transactions`

All three render.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/\(game\)/league/\[leagueId\]/team/budget
git commit -m "feat(demo): render budget cluster (/team/budget, /marketplace, /transactions)"
```

---

## Task 6: GT pages (empty states)

**Files:**
- Modify: `apps/web/app/(game)/league/[leagueId]/team/gt/page.tsx`
- Modify: `apps/web/app/(game)/league/[leagueId]/team/gt/rescue/page.tsx`

GT data isn't in the refresh script. Both pages short-circuit with an empty state.

- [ ] **Step 1: `team/gt/page.tsx` — guard + helper**

```ts
import { DEMO_LEAGUE_SLUG } from "@/lib/demo-constants";

if (leagueId === DEMO_LEAGUE_SLUG) return renderDemoTeamGt();

function renderDemoTeamGt() {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
        Demo league has no Grand Tour data yet.
      </p>
    </div>
  );
}
```

Note: the helper is sync (no fetch). Drop the `await` in the guard.

- [ ] **Step 2: `team/gt/rescue/page.tsx` — same**

```ts
if (leagueId === DEMO_LEAGUE_SLUG) return renderDemoTeamGtRescue();

function renderDemoTeamGtRescue() {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
        Demo league has no Grand Tour data yet.
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Verify**

```bash
pnpm --filter @watthunter/web typecheck
```

Visit `/league/demo/team/gt` and `/league/demo/team/gt/rescue`. Empty state renders, no console errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(game\)/league/\[leagueId\]/team/gt
git commit -m "feat(demo): GT pages show empty state in demo league"
```

---

## Task 7: Auction landing page

**Files:**
- Modify: `apps/web/app/(game)/league/[leagueId]/auction/page.tsx`

- [ ] **Step 1: Read the existing page**

Lots of moving parts: leagues (commissioner check), auctions (3 most recent), open/scheduled auctions, contracts, draft_bids, team_strategies, team_sponsors, rider_xp_daily, auction_bids, sponsors (pending sponsor). All `league_id` / `team_id` scoped.

- [ ] **Step 2: Add guard + import**

```ts
import {
  DEMO_LEAGUE_SLUG,
  DEMO_LEAGUE_ID,
  DEMO_VISITOR_TEAM_ID,
} from "@/lib/demo-constants";

if (leagueId === DEMO_LEAGUE_SLUG) return await renderDemoAuction();
```

- [ ] **Step 3: Append `renderDemoAuction()`**

```ts
async function renderDemoAuction() {
  const supabase = await createClient();
  const teamId = DEMO_VISITOR_TEAM_ID;
  const leagueId = DEMO_LEAGUE_ID;
  // Mirror queries:
  //   - leagues (commissioner_id) → hardcode isCommissioner = false
  //   - auctions (3 most recent, league_id)
  //   - open/scheduled auction (league_id, status in ('scheduled','open'))
  //   - contracts (team_id, status='active')
  //   - draft_bids (team_id)
  //   - team_strategies (team_id), join strategies
  //   - team_sponsors (team_id), join sponsors
  //   - rider_xp_daily (team_id)
  //   - auction_bids (team_id, auction_id in {round ids})
  //   - sponsors (pending sponsor lookup if applicable)
  // Render <AuctionsClient leagueId={DEMO_LEAGUE_SLUG} isCommissioner={false} ... />
}
```

- [ ] **Step 4: Verify**

```bash
pnpm --filter @watthunter/web typecheck
```

Visit `/league/demo/auction`. Page renders; rounds list visible.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(game\)/league/\[leagueId\]/auction/page.tsx
git commit -m "feat(demo): render /league/demo/auction"
```

---

## Task 8: Auction detail + results

**Files:**
- Modify: `apps/web/app/(game)/league/[leagueId]/auction/[auctionId]/page.tsx`
- Modify: `apps/web/app/(game)/league/[leagueId]/auction/[auctionId]/results/page.tsx`

- [ ] **Step 1: Read both files**

- [ ] **Step 2: `auction/[auctionId]/page.tsx` — guard + helper**

```ts
import {
  DEMO_LEAGUE_SLUG,
  DEMO_LEAGUE_ID,
  DEMO_VISITOR_TEAM_ID,
} from "@/lib/demo-constants";

// inside default export:
const { leagueId, auctionId } = await params;
if (leagueId === DEMO_LEAGUE_SLUG) return await renderDemoAuctionDetail(auctionId);

// at bottom:
async function renderDemoAuctionDetail(auctionId: string) {
  const supabase = await createClient();
  const teamId = DEMO_VISITOR_TEAM_ID;
  // Mirror queries:
  //   - teams (level, treasury for visitor)
  //   - auctions (id = auctionId)
  //   - riders pool (auction's level filter)
  //   - auction_bids (auction_id = auctionId)
  //   - contracts (team_id, status='active')
  //   - contracts (team_id, status='released' for cooldown)
  //   - contracts (team_id, status='active' for activeSalaries)
  //   - team_sponsors (team_id)
  // Render <AuctionClient ... auctionId={auctionId} />
}
```

- [ ] **Step 3: `auction/[auctionId]/results/page.tsx` — guard + helper**

```ts
import {
  DEMO_LEAGUE_SLUG,
  DEMO_VISITOR_TEAM_ID,
} from "@/lib/demo-constants";

if (leagueId === DEMO_LEAGUE_SLUG) return await renderDemoAuctionResults(auctionId);

async function renderDemoAuctionResults(auctionId: string) {
  const supabase = await createClient();
  // Mirror: auctions (id = auctionId), auction_bids (join riders + teams, status in ('won','outbid')).
  // Pass userTeamId = DEMO_VISITOR_TEAM_ID to highlight the visitor's wins.
}
```

- [ ] **Step 4: Verify**

```bash
pnpm --filter @watthunter/web typecheck
```

From `/league/demo/auction`, click any closed round → `/league/demo/auction/<uuid>/results` renders. Click any open/scheduled round → `/league/demo/auction/<uuid>` renders. Visitor's rows highlighted on the results table.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(game\)/league/\[leagueId\]/auction/\[auctionId\]
git commit -m "feat(demo): render auction detail + results pages"
```

---

## Task 9: Auction satellites (status, history, market, rounds)

**Files:**
- Modify: `apps/web/app/(game)/league/[leagueId]/auction/status/page.tsx`
- Modify: `apps/web/app/(game)/league/[leagueId]/auction/history/page.tsx`
- Modify: `apps/web/app/(game)/league/[leagueId]/auction/market/page.tsx`
- Modify: `apps/web/app/(game)/league/[leagueId]/auction/rounds/page.tsx`

- [ ] **Step 1: Read all four files**

- [ ] **Step 2: `auction/status/page.tsx` — guard + helper**

```ts
if (leagueId === DEMO_LEAGUE_SLUG) return await renderDemoAuctionStatus();

async function renderDemoAuctionStatus() {
  const supabase = await createClient();
  const leagueId = DEMO_LEAGUE_ID;
  // Mirror: auctions (open + 3 recent), teams (league_id), round_validations, draft_bids count per team,
  // contracts active per team, team_sponsors. Compute unvalidatedTeams.
  // Render <StatusClient leagueId={DEMO_LEAGUE_SLUG} unvalidatedTeams={...} />
}
```

- [ ] **Step 3: `auction/history/page.tsx` — guard + helper**

```ts
if (leagueId === DEMO_LEAGUE_SLUG) return await renderDemoAuctionHistory();

async function renderDemoAuctionHistory() {
  const supabase = await createClient();
  const leagueId = DEMO_LEAGUE_ID;
  const teamId = DEMO_VISITOR_TEAM_ID;
  // Mirror: auctions (closed, league_id), auction_bids (join riders + teams), teams (for highlighting).
  // gt_emergency_bids will return empty (table not seeded in demo) → GT section naturally hidden.
  // Inline render (same JSX as the auth path).
}
```

- [ ] **Step 4: `auction/market/page.tsx` — guard + helper**

```ts
if (leagueId === DEMO_LEAGUE_SLUG) return await renderDemoAuctionMarket();

async function renderDemoAuctionMarket() {
  const supabase = await createClient();
  const teamId = DEMO_VISITOR_TEAM_ID;
  const leagueId = DEMO_LEAGUE_ID;
  // Mirror: riders pool (level filter from visitor team), teams (level), contracts (league-wide),
  // race_startlists (giro 2026), auctions (active/scheduled in league), draft_bids (team_id), team_sponsors.
  // Render <MarketClient leagueId={DEMO_LEAGUE_SLUG} ... />
}
```

- [ ] **Step 5: `auction/rounds/page.tsx` — empty state**

This page is commissioner-only. Demo visitor never qualifies.

```ts
import { DEMO_LEAGUE_SLUG } from "@/lib/demo-constants";

if (leagueId === DEMO_LEAGUE_SLUG) return renderDemoAuctionRounds();

function renderDemoAuctionRounds() {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
        This page is for league commissioners.
      </p>
    </div>
  );
}
```

- [ ] **Step 6: Verify**

```bash
pnpm --filter @watthunter/web typecheck
```

Visit each URL:
- `/league/demo/auction/status`
- `/league/demo/auction/history`
- `/league/demo/auction/market`
- `/league/demo/auction/rounds`

All render.

- [ ] **Step 7: Commit**

```bash
git add apps/web/app/\(game\)/league/\[leagueId\]/auction/status apps/web/app/\(game\)/league/\[leagueId\]/auction/history apps/web/app/\(game\)/league/\[leagueId\]/auction/market apps/web/app/\(game\)/league/\[leagueId\]/auction/rounds
git commit -m "feat(demo): render auction satellites (status, history, market, rounds)"
```

---

## Task 10: Achievements + Levels

**Files:**
- Modify: `apps/web/app/(game)/league/[leagueId]/achievements/page.tsx`
- Modify: `apps/web/app/(game)/league/[leagueId]/levels/page.tsx`

- [ ] **Step 1: Read both files**

- [ ] **Step 2: `achievements/page.tsx` — guard + helper**

```ts
import {
  DEMO_LEAGUE_SLUG,
  DEMO_LEAGUE_ID,
  DEMO_VISITOR_TEAM_ID,
} from "@/lib/demo-constants";

if (leagueId === DEMO_LEAGUE_SLUG) return await renderDemoAchievements();

async function renderDemoAchievements() {
  const supabase = await createClient();
  const teamId = DEMO_VISITOR_TEAM_ID;
  const leagueId = DEMO_LEAGUE_ID;
  // Mirror queries: rider_xp_daily (monuments) team-scoped, race_results monuments,
  // rider_xp_daily (giro stages), race_results giro gc,
  // gt_daily_classifications giro kom/points (table is empty in demo → ranks default to 0/null),
  // rider_xp_daily (all monuments league-wide), rider_xp_daily (all one-day WT league-wide),
  // league_members (all teams) for dynamic ranks.
  // Render <AchievementsClient leagueId={DEMO_LEAGUE_SLUG} ... />
}
```

- [ ] **Step 3: `levels/page.tsx` — guard + helper**

```ts
if (leagueId === DEMO_LEAGUE_SLUG) return await renderDemoLevels();

async function renderDemoLevels() {
  const supabase = await createClient();
  const teamId = DEMO_VISITOR_TEAM_ID;
  // teams row by id = teamId → level + cumulative_xp.
  // Render <LevelsTimeline currentLevel={...} currentXp={...} progressPct={...} nextLevelXp={...} />
}
```

- [ ] **Step 4: Verify**

```bash
pnpm --filter @watthunter/web typecheck
```

Visit `/league/demo/achievements` and `/league/demo/levels`. Both render.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(game\)/league/\[leagueId\]/achievements/page.tsx apps/web/app/\(game\)/league/\[leagueId\]/levels/page.tsx
git commit -m "feat(demo): render achievements + levels in demo league"
```

---

## Task 11: Rider detail page (helper extension)

**Files:**
- Modify: `apps/web/lib/rider-detail-data.ts`
- Modify: `apps/web/app/(game)/league/[leagueId]/rider/[riderId]/page.tsx`

The helper `fetchRiderDetailData(supabase, leagueId, riderId, from?)` currently calls `supabase.auth.getUser()` internally to derive the visitor's team context. We extend it with an optional 5th argument `visitorTeamId?: string | null` (default `null`). When provided, the helper uses it directly and skips the `auth.uid()` lookup.

- [ ] **Step 1: Read `apps/web/lib/rider-detail-data.ts` in full** to find every place `user` (from `supabase.auth.getUser()`) is consumed downstream.

- [ ] **Step 2: Extend the signature**

```ts
export async function fetchRiderDetailData(
  supabase: SupabaseClient<Database>,
  leagueId: string,
  riderId: string,
  from?: string,
  visitorTeamId?: string | null,
): Promise<RiderDetailData | null> {
  // ...
  const { data: { user } } = visitorTeamId
    ? { data: { user: null } }
    : await supabase.auth.getUser();
  // ...
}
```

Then, every downstream usage that today does `await supabase.from("league_members").select("team_id").eq("user_id", user.id).eq("league_id", leagueId)` (or similar derivation of "the viewer's team") becomes:

```ts
const viewerTeamId = visitorTeamId
  ?? (user ? <existing lookup> : null);
```

Apply the same fallback wherever `user?.id` is used to scope a query that should be scoped to the viewer team (e.g., currentBid lookups, owner info, budget info). If `visitorTeamId` is provided, treat the viewer as authenticated for the purpose of these fetches but never call any mutation.

- [ ] **Step 3: Update the page**

```ts
// apps/web/app/(game)/league/[leagueId]/rider/[riderId]/page.tsx
import {
  DEMO_LEAGUE_SLUG,
  DEMO_LEAGUE_ID,
  DEMO_VISITOR_TEAM_ID,
} from "@/lib/demo-constants";

// inside default export:
const { leagueId, riderId } = await params;
const fromParam = /* existing from search-param logic */;

if (leagueId === DEMO_LEAGUE_SLUG) {
  const supabase = await createClient();
  const data = await fetchRiderDetailData(
    supabase,
    DEMO_LEAGUE_ID,
    riderId,
    fromParam,
    DEMO_VISITOR_TEAM_ID,
  );
  if (!data) {
    return <p className="text-[var(--text-mid)]">Rider not found.</p>;
  }
  return <RiderDetailClient leagueId={DEMO_LEAGUE_SLUG} data={data} />;
}

// ...existing auth path unchanged
```

The auth path call site continues to pass only 4 args — backwards compatible.

- [ ] **Step 4: Verify**

```bash
pnpm --filter @watthunter/web typecheck
pnpm --filter @watthunter/web test --run rider-detail
```

(Only run the rider-detail tests if any exist. If not, skip.)

Visit `/league/demo/rider/<some-rider-uuid>` (use any rider id visible from `/league/demo/team`). Page renders.

Also verify an authenticated league still works: log in, visit `/league/<real-league>/rider/<riderId>` — page identical to before.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/rider-detail-data.ts apps/web/app/\(game\)/league/\[leagueId\]/rider/\[riderId\]/page.tsx
git commit -m "feat(demo): render rider detail page (extend fetchRiderDetailData with visitorTeamId)"
```

---

## Task 12: Final verification + push + PR

- [ ] **Step 1: Full typecheck + lint + test**

```bash
pnpm typecheck
pnpm lint
pnpm test
```

All three green. If `pnpm test` discovers a page-snapshot test affected by the demo branch, update it minimally (no behavior change for the auth path is expected).

- [ ] **Step 2: Smoke test the demo end-to-end**

Open an incognito Chromium window (no Supabase session). Walk through the smoke checklist from spec §5:

1. `/league/demo` — race feed renders.
2. Sidebar/BottomNav links to Team, Ranking, Budget (via Team), Auction, Achievements all render without redirect.
3. From Ranking, click a rival team → renders.
4. From Team, click a rider → `/league/demo/rider/<uuid>` renders.
5. From Auction, click open round (detail page) + closed round (results page).
6. `/league/demo/team/gt` → empty state.
7. Click a mutation button (Place bid, Release, Validate round) → cyan banner pulse, no network call.
8. Network tab: no `4xx`, no `/rpc/*` POSTs.

If any page redirects to `/login` or throws a runtime error, treat it as a blocker and revisit the relevant task before pushing.

- [ ] **Step 3: Push and open the PR**

```bash
git push -u origin feature/demo-subpages

gh pr create \
  --base feature/try-before-signup \
  --head feature/demo-subpages \
  --title "feat(demo): extend demo mode to all sub-pages" \
  --body "$(cat <<'EOF'
## Summary

Extends the demo mode shipped in #41 to every gated sub-page under `/league/demo/*`. Each page.tsx now early-branches into a `renderDemoXxx()` helper that mirrors the auth-path SELECTs against `DEMO_LEAGUE_ID` / `DEMO_VISITOR_TEAM_ID`, so an anonymous visitor can browse Team / Ranking / Budget / Auction / Achievements / Levels / Rider without bouncing to `/login`.

GT-only pages (`team/gt`, `team/gt/rescue`) and the commissioner-only `auction/rounds` render a short empty-state message because the refresh script does not populate that data.

## Test plan

- [ ] `pnpm typecheck && pnpm lint && pnpm test` green
- [ ] Incognito smoke: every sub-page under `/league/demo/*` renders without redirecting to `/login`
- [ ] Mutation buttons trigger the cyan banner pulse (no network call)
- [ ] Authenticated league pages unchanged (regression check on `fetchRiderDetailData` extension)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: STOP**

Do not merge. Report the PR URL.

---

## Self-review

- **Spec coverage:** every page listed in spec §3 has a task. `help/page.tsx` excluded as agreed (open already). `settings/*` excluded as agreed. Root `page.tsx` already shipped.
- **Placeholder scan:** every task has concrete file paths, code shape, and verification commands. The `renderDemoXxx` helpers describe the query list to mirror rather than copy-pasting full SQL because the existing code is the source of truth; each task instructs the engineer to read the existing file first so this is intentional, not a placeholder.
- **Type consistency:** `renderDemoXxx()` is the consistent naming convention; `DEMO_LEAGUE_SLUG` / `DEMO_LEAGUE_ID` / `DEMO_VISITOR_TEAM_ID` are the three constants imported everywhere.
- **Scope:** single chantier (sub-page demo coverage). No tangential refactors.
