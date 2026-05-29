# Demo Mode — Sub-pages Extension Spec

> Date: 2026-05-30
> Status: Approved (decisions tranchées dans le /goal qui a déclenché ce travail)
> Parent: `docs/archive/specs/2026-05-29-demo-mode-implementation-spec.md`
> Goal: Make every `/league/demo/*` sub-page render in read-only mode for anonymous visitors, instead of redirecting to `/login`.

---

## 1. Scope

PR #41 (Chantier B) shipped the demo home (`/league/demo`) plus middleware + layout + RLS + refresh script. Every sub-page under `(game)/league/[leagueId]/**` still has its own `if (!user) redirect("/login")` (or equivalent membership check) and therefore breaks the demo when the visitor follows a nav link.

This spec covers extending the same `renderDemoXxx()` pattern (already used in `apps/web/app/(game)/league/[leagueId]/page.tsx` lines 21-23 + 315-341) to every gated sub-page.

Out of scope:
- `/league/demo/settings/*` — `settingsHref` is rewritten to demo home (see `demo-layout.tsx:58`).
- New RLS migrations — `20260529000004_*` already grants anon SELECT on everything sub-pages read.
- GT data — `refresh_demo_league.py` does NOT populate `gt_squad`, `gt_role_assignments`, `gt_tactic_activations`, `gt_emergency_bids`, `sponsor_goal_completions`. GT-only pages show an empty state.
- Mutation wiring — all call sites already wrapped in `useDemoSafeAction` (commit `f74c941`).

---

## 2. Pattern

Each gated page server component gets the same 3-line guard at the very top of the default export:

```ts
import { DEMO_LEAGUE_SLUG, DEMO_LEAGUE_ID, DEMO_VISITOR_TEAM_ID } from "@/lib/demo-constants";

const { leagueId } = await params;
if (leagueId === DEMO_LEAGUE_SLUG) return await renderDemoXxx(/* nested params */);

// ...existing auth + membership code, unchanged
```

`renderDemoXxx()` lives at the bottom of the same file, marked with a banner comment:

```ts
// ---------------------------------------------------------------------------
// Demo path — anonymous visitor, no auth required
// ---------------------------------------------------------------------------
async function renderDemoXxx(/* params */) {
  const supabase = await createClient();
  // Same queries as the auth path, but:
  //   league_id  → DEMO_LEAGUE_ID
  //   team_id    → DEMO_VISITOR_TEAM_ID
  //   skip auth.uid() / league_members lookups
  // Render the same client component with leagueId={DEMO_LEAGUE_SLUG}.
}
```

Rules:
- **No new server actions / RPCs.** Pure SELECTs against anon-readable tables.
- **No service_role** anywhere on the web side. `createClient()` uses the anon key already.
- **Client components reused verbatim.** Pass `leagueId={DEMO_LEAGUE_SLUG}` (so navigation stays under `/league/demo/*`) and `teamId={DEMO_VISITOR_TEAM_ID}` where required.
- **Empty data → empty state.** Pages that depend on GT data (`team/gt/*`) skip the fetch and return a short `<div>…</div>` saying "Demo league has no Grand Tour data yet." This is a constant — no fancy component required.
- **No cache directives.** The home page doesn't cache today either (the existing TODO at `page.tsx:306-309` stays parked for the project-wide Cache Components rollout). Refresh self-heals via the explicit Python POST.

---

## 3. Pages

19 pages total. `settings/page.tsx` is excluded. Root `page.tsx` already done.

| # | Page | Demo helper | Notes |
|---|---|---|---|
| 1 | `ranking/page.tsx` | `renderDemoRanking` | Queries teams + league_members + contracts + rider_xp_daily + race_results + team_ranking_daily, all scoped by `league_id`. Replace `user_id` join used to derive `myTeamId` with `DEMO_VISITOR_TEAM_ID`. |
| 2 | `ranking/team/[teamId]/page.tsx` | `renderDemoTeamRanking(teamId)` | `teamId` is a UUID from the URL — accept any UUID; the page itself already verifies the team belongs to the league via the first query. Skip the `getUser()` call, no league_members lookup. |
| 3 | `team/page.tsx` | `renderDemoTeam` | Skip `getUser()`; resolve team via `DEMO_VISITOR_TEAM_ID` instead of `league_members(user_id, league_id)`. Same client render. |
| 4 | `team/strategies/page.tsx` | `renderDemoTeamStrategies` | Same swap. `StrategiesClient` props unchanged. |
| 5 | `team/budget/page.tsx` | `renderDemoTeamBudget` | Treasury + sponsors + treasury_log all `team_id`-scoped — direct swap. |
| 6 | `team/budget/marketplace/page.tsx` | `renderDemoTeamMarketplace` | Sponsors catalog + current `team_sponsors` + `getNextPhase()` (pure lib, no auth). Direct swap. |
| 7 | `team/budget/transactions/page.tsx` | `renderDemoTeamTransactions` | Treasury_log scoped by `team_id` — direct swap. |
| 8 | `team/gt/page.tsx` | `renderDemoTeamGt` | GT data not populated. Return a centered `<EmptyState>` (inline `<div>` with `text-[var(--text-mid)]`) saying "Demo league has no Grand Tour data yet." No fetch. |
| 9 | `team/gt/rescue/page.tsx` | `renderDemoTeamGtRescue` | Same empty-state pattern. No fetch. |
| 10 | `auction/page.tsx` | `renderDemoAuction` | Queries: auctions (3 rounds), contracts, draft_bids, team_strategies, team_sponsors, rider_xp_daily, auction_bids, sponsors. All `league_id` / `team_id` scoped. `isCommissioner = false` for the visitor (no commissioner perks in demo). |
| 11 | `auction/[auctionId]/page.tsx` | `renderDemoAuctionDetail(auctionId)` | UUID param. Auctions/riders/bids/contracts/team_sponsors — direct swap. |
| 12 | `auction/[auctionId]/results/page.tsx` | `renderDemoAuctionResults(auctionId)` | No auth gate today (uses `getUser()` only to highlight own wins). For demo, pass `userTeamId = DEMO_VISITOR_TEAM_ID` so the visitor's team is highlighted. |
| 13 | `auction/status/page.tsx` | `renderDemoAuctionStatus` | Auctions + teams + round_validations + draft_bids + contracts + team_sponsors — direct swap, `league_id`-scoped. |
| 14 | `auction/history/page.tsx` | `renderDemoAuctionHistory` | Closed auctions + auction_bids + teams. `gt_emergency_bids` is empty in demo → naturally no GT section. |
| 15 | `auction/market/page.tsx` | `renderDemoAuctionMarket` | Riders + teams + contracts + race_startlists + auctions + draft_bids + team_sponsors. Direct swap. |
| 16 | `auction/rounds/page.tsx` | `renderDemoAuctionRounds` | Commissioner-only page. Demo visitor isn't commissioner → return empty state "This page is for league commissioners." No fetch. |
| 17 | `achievements/page.tsx` | `renderDemoAchievements` | Skip league_members lookup. Same monument/giro/dynamic queries — all `team_id`/`league_id` scoped. |
| 18 | `levels/page.tsx` | `renderDemoLevels` | Single `teams` row by `DEMO_VISITOR_TEAM_ID`. |
| 19 | `rider/[riderId]/page.tsx` | `renderDemoRider(riderId, from)` | Delegates to `fetchRiderDetailData()` helper. The helper currently takes `(supabase, leagueId, riderId, userId)`. **Modify** the helper to accept an optional `overrideTeamId?: string` (null = "use league_members lookup"); when in demo, pass `DEMO_VISITOR_TEAM_ID`. Single helper edit covers the page. |
| — | `help/page.tsx` | n/a | Already accessible — static client component, no fetch, no auth. Skip. |

---

## 4. Implementation notes per cluster

### 4.1 `rider/[riderId]/page.tsx`

The rider detail helper (`apps/web/lib/get-rider-detail-data.ts` — verify exact path during impl) is the single piece of shared logic that crosses pages. Touching it has the biggest blast radius. Approach:

1. Add an optional 4th positional arg `visitorTeamId?: string | null` (default `null`).
2. Inside, when `visitorTeamId` is provided, skip the `auth.uid()` + `league_members(user_id, league_id)` lookup and use `visitorTeamId` directly.
3. When `visitorTeamId` is null and there is no user, keep today's behavior (redirect / null).

This avoids forking the helper. If the call surface is too tangled to extend cleanly, write a `renderDemoRider` that inlines the queries (the rider detail page is the highest-effort one on this list — budget extra time).

### 4.2 Empty states (GT pages + rounds)

A single inline render — no new component:

```tsx
return (
  <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
    <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
      {message}
    </p>
  </div>
);
```

Messages:
- `team/gt/page.tsx`: "Demo league has no Grand Tour data yet."
- `team/gt/rescue/page.tsx`: "Demo league has no Grand Tour data yet."
- `auction/rounds/page.tsx`: "This page is for league commissioners."

### 4.3 Client component prop guarantees

`leagueId` is the URL slug in every call (`DEMO_LEAGUE_SLUG = "demo"`). Internal navigation in client components uses `/league/${leagueId}/...` — passing the slug keeps the visitor inside the demo route tree on every click.

`teamId` is always the UUID (`DEMO_VISITOR_TEAM_ID`), because client components forward it to mutation server actions that look up DB rows by UUID. (Mutations are short-circuited by `useDemoSafeAction` anyway — the UUID just keeps types honest.)

### 4.4 No new tests required

vitest coverage on these pages is sparse; the spec doesn't add unit tests because the demo helpers are I/O-only and mirror existing logic. The smoke checklist below catches integration regressions.

---

## 5. Smoke checklist

In incognito Chrome with no Supabase session cookie:

1. `/league/demo` → race feed renders (already shipped).
2. Click every entry in Sidebar / BottomNav: Team, Ranking, Budget (via Team), Auction, Achievements. None redirect.
3. From Ranking, click a rival team → `/league/demo/ranking/team/<uuid>` renders.
4. From Team, click a rider → `/league/demo/rider/<uuid>` renders.
5. From Auction, click an open round → `/league/demo/auction/<uuid>` renders. Click "View results" on a closed round → results render with the visitor's team highlighted.
6. From Team, click "Grand Tour" → "Demo league has no Grand Tour data yet." empty state.
7. From Auction, click any mutation (place bid, validate round) → cyan banner pulse, no network call.
8. Network tab: no `4xx`, no calls to `/api/rpc/*`. Only `rest/v1/*` SELECTs.

---

## 6. File map

**Modified** (default export gets a 3-line guard + a `renderDemoXxx` helper appended):

```
apps/web/app/(game)/league/[leagueId]/ranking/page.tsx
apps/web/app/(game)/league/[leagueId]/ranking/team/[teamId]/page.tsx
apps/web/app/(game)/league/[leagueId]/team/page.tsx
apps/web/app/(game)/league/[leagueId]/team/strategies/page.tsx
apps/web/app/(game)/league/[leagueId]/team/budget/page.tsx
apps/web/app/(game)/league/[leagueId]/team/budget/marketplace/page.tsx
apps/web/app/(game)/league/[leagueId]/team/budget/transactions/page.tsx
apps/web/app/(game)/league/[leagueId]/team/gt/page.tsx
apps/web/app/(game)/league/[leagueId]/team/gt/rescue/page.tsx
apps/web/app/(game)/league/[leagueId]/auction/page.tsx
apps/web/app/(game)/league/[leagueId]/auction/[auctionId]/page.tsx
apps/web/app/(game)/league/[leagueId]/auction/[auctionId]/results/page.tsx
apps/web/app/(game)/league/[leagueId]/auction/status/page.tsx
apps/web/app/(game)/league/[leagueId]/auction/history/page.tsx
apps/web/app/(game)/league/[leagueId]/auction/market/page.tsx
apps/web/app/(game)/league/[leagueId]/auction/rounds/page.tsx
apps/web/app/(game)/league/[leagueId]/achievements/page.tsx
apps/web/app/(game)/league/[leagueId]/levels/page.tsx
apps/web/app/(game)/league/[leagueId]/rider/[riderId]/page.tsx
apps/web/lib/get-rider-detail-data.ts   # add optional visitorTeamId arg
```

**Created**: none.

---

## 7. Risks & mitigations

| Risk | Mitigation |
|---|---|
| One page secretly depends on `auth.uid()` server-side (e.g., an action invoked during render) | Each branch task reads the file before edit, confirms the entire body is a pure SELECT pipeline, and notes any side-effect in the commit. |
| `fetchRiderDetailData` refactor leaks into authenticated flow | Add the new arg as optional + default-null; the auth-path call sites pass nothing and behavior is preserved. Add an inline comment explaining the demo case. |
| Visitor lands on a UUID-based URL (`/ranking/team/<uuid>`, `/rider/<uuid>`, `/auction/<uuid>`) that doesn't belong to the demo league | Existing queries already 404 / return null when the row isn't in the demo league; the page's "not found" rendering shows up naturally. |
| Commissioner-only pages confuse the visitor | `auction/rounds` shows the empty-state message instead of bouncing to `/login`. Acceptable. |

---

## 8. Out of scope

- Demo-specific analytics.
- Caching / `"use cache"` rollout (parked in root home).
- New unit tests (smoke covers integration).
- Settings/* pages.
- Lobby/* (demo league is `status = 'active'`, never enters lobby).
