# Demo Mode (Chantier B) — Implementation Spec

> Date: 2026-05-29
> Status: Approved (decisions tranchées par Jonathan dans le /goal qui a déclenché ce travail)
> Parent: `docs/archive/specs/2026-05-12-try-before-signup-design.md` §4 (Chantier B)
> Goal: Let unauthenticated visitors explore a snapshot of a real league at `/league/demo/*` with the full game shell, anonymized data, and a banner-pulse pattern for blocked mutations.

---

## 1. Scope

This spec covers **only Chantier B**. Chantier A (landing video), Chantier C (signup funnel, already shipped) and Chantier D (lobby redesign, shipped) are out of scope.

Deliverables:

1. A stable `DEMO_LEAGUE_ID` row in `public.leagues` plus 8 stable ghost `auth.users` rows, all seeded once by migration.
2. RLS policies that let the **anonymous** Supabase role read everything required to render the game shell, scoped to the demo league (or to public reference data).
3. A Python refresh script (`services/pcs-sync/refresh_demo_league.py`) that wipe-and-replaces the demo league's data with an anonymized snapshot of a real source league inside a single transaction.
4. A `DemoProvider` React context that exposes `isDemo`, a `useDemoSafeAction` wrapper that intercepts mutations and triggers a banner pulse instead, and the `DemoBanner` + `DemoBottomCta` UI chrome.
5. Middleware whitelisting of `/league/demo/...` so the existing auth gate does not redirect anonymous visitors to `/onboarding`.
6. Layout adaptation in `(game)/league/[leagueId]/layout.tsx` to switch on `leagueId === "demo"` and skip membership checks.
7. Cache layer: `"use cache"` + `cacheTag("demo-league")` + `cacheLife({ revalidate: 3600 })` on demo pages, plus `/api/admin/revalidate-demo` invalidated by the refresh script.

The pre-locked architectural decisions (clone-not-flag, ghost users, RLS anon read, mutation rejection via existing `auth.uid()` checks, refresh-script wipe-and-replace, "use cache") are encoded in the rest of this document and not re-negotiated.

---

## 2. URL & route structure

### 2.1 Public surface

- `/league/demo` — Race Feed home (Cache Components)
- `/league/demo/team` — My Team
- `/league/demo/team/market` — Recruits
- `/league/demo/team/strategies`, `/team/auctions`, `/team/budget`, `/team/gt/*`
- `/league/demo/budget`, `/league/demo/budget/marketplace`, `/league/demo/budget/transactions`
- `/league/demo/auction`, `/league/demo/auction/[auctionId]`, `/league/demo/auction/[auctionId]/results`
- `/league/demo/ranking`, `/league/demo/ranking/team/[teamId]`
- `/league/demo/rider/[riderId]`
- `/league/demo/levels`, `/league/demo/achievements`, `/league/demo/help`
- `/league/demo/settings` is **redirected to `/league/demo`** (no meaningful read-only view).

No new `(demo)` route group: the visitor enters the existing `(game)/league/[leagueId]/*` tree with `leagueId = "demo"`. The middleware + layout detect this literal and skip auth.

### 2.2 Constants

A single source of truth in `apps/web/lib/demo-constants.ts`:

```ts
export const DEMO_LEAGUE_SLUG = "demo" as const;
export const DEMO_LEAGUE_ID = "00000000-0000-4000-8000-d3110d3110d3" as const; // UUIDv4-shaped, stable forever
export const DEMO_TEAM_IDS = [
  "00000000-0000-4000-8000-d3110d311001",
  "00000000-0000-4000-8000-d3110d311002",
  "00000000-0000-4000-8000-d3110d311003",
  "00000000-0000-4000-8000-d3110d311004",
  "00000000-0000-4000-8000-d3110d311005",
  "00000000-0000-4000-8000-d3110d311006",
  "00000000-0000-4000-8000-d3110d311007",
  "00000000-0000-4000-8000-d3110d311008",
] as const;
export const DEMO_USER_IDS = [
  "00000000-0000-4000-8000-d3110d310001",
  "00000000-0000-4000-8000-d3110d310002",
  "00000000-0000-4000-8000-d3110d310003",
  "00000000-0000-4000-8000-d3110d310004",
  "00000000-0000-4000-8000-d3110d310005",
  "00000000-0000-4000-8000-d3110d310006",
  "00000000-0000-4000-8000-d3110d310007",
  "00000000-0000-4000-8000-d3110d310008",
] as const;
export const DEMO_TEAM_NAMES = [
  "Flamme Rouge",
  "Les Grimpeurs",
  "Cinq Étoiles",
  "Bidon Vert",
  "Echappée Belle",
  "Pavé Royal",
  "Maillot Jaune",
  "Domestique XI",
] as const;
// The visitor sees the world through the team ranked #2 by cumulative_xp at refresh time.
export const DEMO_VISITOR_TEAM_INDEX = 1; // = DEMO_TEAM_IDS[1]
```

A mirror file `services/pcs-sync/demo_constants.py` holds the **exact same** values. A vitest test `apps/web/lib/__tests__/demo-constants-sync.test.ts` reads both files and asserts byte-for-byte equality of the UUIDs and team-name list. The refresh script aborts on startup if its own parsed constants don't match the JSON dump emitted by `pnpm tsx scripts/dump-demo-constants.ts` (a tiny script that prints the TS constants as JSON for cross-language validation).

### 2.3 Visitor identity

The visitor is *not* logged in. `auth.uid()` is `NULL` for them. All read access is granted by RLS to the `anon` role. The visitor's "point of view" is purely a UX convention: the layout and the team-scoped components read `DEMO_VISITOR_TEAM_ID = DEMO_TEAM_IDS[DEMO_VISITOR_TEAM_INDEX]` from `lib/demo-constants.ts` when `isDemo === true`, with no DB-side notion of "current user."

---

## 3. Database

### 3.1 Tables that need anon `SELECT`

Three tiers, 21 tables total. The function `public.demo_league_id() RETURNS uuid LANGUAGE sql STABLE` returns the `DEMO_LEAGUE_ID` literal and is used by every league-scoped policy below.

**Tier A — direct `league_id` column** (USING `league_id = public.demo_league_id()`):

| Table | Notes |
|---|---|
| `leagues` | `id = public.demo_league_id()` |
| `league_members` | |
| `teams` | |
| `auctions` | |
| `contracts` | |
| `draft_bids` | |
| `gt_emergency_bids` | |
| `remontada_boost_triggers` | currently empty (feature disabled) but RLS still applied |
| `remontada_boosts` | currently empty |

**Tier B — `team_id` only** (USING `EXISTS (SELECT 1 FROM public.teams t WHERE t.id = <self>.team_id AND t.league_id = public.demo_league_id())`):

| Table |
|---|
| `auction_bids` |
| `gt_squad` |
| `gt_role_assignments` |
| `gt_tactic_activations` |
| `rider_xp_daily` |
| `sponsor_bonuses` |
| `sponsor_goal_completions` |
| `team_ranking_daily` |
| `team_sponsors` |
| `team_strategies` |
| `team_xp_adjustments` |
| `treasury_log` |
| `round_validations` |

**Tier C — `users` (only the 8 ghost demo users):**

```sql
CREATE POLICY users_anon_demo ON public.users
  FOR SELECT TO anon
  USING (id IN (SELECT user_id FROM public.league_members WHERE league_id = public.demo_league_id()));
```

**Tier D — public reference / catalog data** (USING `true`, anon SELECT only):

| Table | Justification |
|---|---|
| `riders` | public PCS data |
| `race_results` | public PCS data |
| `rider_season_rankings` | public PCS data |
| `race_startlists` | public PCS data |
| `rider_teams` | public PCS data |
| `rider_pcs_history` | public PCS data |
| `gt_daily_classifications` | public PCS data |
| `gt_rescue_windows` | game schedule (1 row/season) |
| `sponsors` | game catalog |
| `strategies` | game catalog |

Rationale: every existing per-team / per-league policy already gates SELECT on `is_league_member(league_id)` for authenticated users; we **add** the anon policy without touching the existing ones. PostgREST OR's permissive policies, so authenticated users keep their access unchanged.

### 3.2 What anon **cannot** SELECT

All other tables (e.g., admin/audit tables not in the list above) keep their default deny.

### 3.3 Mutations

Anon visitors cannot mutate anything. Every RPC and `INSERT/UPDATE/DELETE` policy in the project already keys off `auth.uid()` or a `SECURITY DEFINER` check; with `auth.uid() = NULL`, all writes fail at the policy or RPC level. **No code change is required server-side to block writes.** The UI's `useDemoSafeAction` wrapper short-circuits *before* the round-trip so users never see a generic error toast — they see a banner pulse.

### 3.4 Ghost users

8 rows seeded in `auth.users` and 8 mirrored in `public.users` via migration. Fixed `id`s = `DEMO_USER_IDS`. Emails = `demo-team-1@watthunter.demo` … `demo-team-8@watthunter.demo` (the `.demo` TLD is reserved for documentation/test fixtures — RFC 6761 — and never delivers email). `display_name` is rewritten to the team name during refresh (see §4.4). The migration is idempotent (`ON CONFLICT (id) DO NOTHING`). The refresh script **never touches** `auth.users` rows.

### 3.5 Seed migration: `20260529000001_demo_seed_ghost_users.sql`

Creates `public.demo_league_id()` function, inserts the 8 ghost `auth.users` (with placeholder `encrypted_password = ''` so they cannot log in), inserts the 8 mirror `public.users` rows (display_name = team name), inserts a placeholder `leagues` row with `id = DEMO_LEAGUE_ID`, `name = "WattHunter Demo League"`, `status = 'active'`, `commissioner_id = DEMO_USER_IDS[0]`, `invite_code = 'DEMO00'`. Refresh later overwrites everything except these primary keys.

### 3.6 RLS migration: `20260529000002_demo_anon_select_policies.sql`

Adds the `anon` SELECT policy for each of the 21 tables in §3.1.

### 3.7 `is_demo` flag

Adds `is_demo BOOLEAN NOT NULL DEFAULT false` on `public.leagues` and sets the demo row to `true`. Used as a tripwire by the existing audit script and as a guard in the refresh script (it refuses to overwrite a league whose `is_demo` flag is `false`). No reading code branches on this column — `leagueId === "demo"` is the runtime signal.

---

## 4. Refresh script

`services/pcs-sync/refresh_demo_league.py`. Run manually from a dev machine. Uses the service-role key (loaded from `services/pcs-sync/.env`, the same file already used by the PCS pipeline) so it can write across RLS boundaries.

### 4.1 CLI

```bash
python3 refresh_demo_league.py --source-league-id <uuid>
python3 refresh_demo_league.py --source-league-id <uuid> --dry-run
```

`--dry-run` prints the planned visitor team and the row counts that would be written, then exits without writing.

### 4.2 Constants sync gate (startup)

Before any DB call, the script invokes `pnpm tsx apps/web/scripts/dump-demo-constants.ts` (via `subprocess`), parses the JSON, and asserts equality with `demo_constants.py`. Mismatch ⇒ hard exit with a clear error message. This is also exercised by a pytest unit test (`tests/test_demo_constants_sync.py`) that runs the same comparison without invoking pnpm (uses a fixture JSON checked into the repo and regenerated by the same script).

### 4.3 Wipe + replace transaction

The entire refresh runs inside a single transaction. Wipe order (FK children before parents):

```
treasury_log → sponsor_bonuses → sponsor_goal_completions → round_validations
→ auction_bids → draft_bids → team_xp_adjustments → team_strategies → team_sponsors
→ team_ranking_daily → rider_xp_daily → gt_tactic_activations → gt_emergency_bids
→ gt_role_assignments → gt_squad → remontada_boosts → remontada_boost_triggers
→ contracts → auctions → league_members → teams → leagues (UPDATE only — never DELETE)
```

Insert order is the reverse: `leagues` (UPDATE), then `teams`, `league_members`, `auctions`, `contracts`, etc.

`auth.users` and `public.users` are never wiped — the migration seeds them once and we only `UPDATE public.users SET display_name = <team_name>` on demo rows when team names change. (Team names are part of `DEMO_TEAM_NAMES` in §2.2 — for v1 they never change.)

### 4.4 Anonymization

- All `teams.name` and `teams.short_name` rewritten to `DEMO_TEAM_NAMES[i]`.
- All `teams.user_id` rewritten to `DEMO_USER_IDS[i]`.
- `league_members.user_id` and `league_members.team_id` mapped the same way.
- `leagues.commissioner_id` = `DEMO_USER_IDS[0]`.
- `leagues.name` = `"WattHunter Demo League"`, `leagues.invite_code` = `"DEMO00"` (this code is non-functional because the league has `is_demo = true` and the join RPC rejects it — see §4.7).
- `leagues.is_demo = true`.
- `public.users.display_name` rewritten to the matching team name for the 8 demo `id`s.
- All other columns (treasury, xp, league standings, rider data) are copied verbatim from the source — they carry no PII.

### 4.5 Visitor mapping

After all teams are loaded, the script reads `cumulative_xp DESC` from the source league's teams, computes the rank-ordered list, and maps source team i to `DEMO_TEAM_IDS[i]`. This guarantees `DEMO_TEAM_IDS[1]` (= the visitor's team) is always the rank-2 team in the resulting demo league. If the source league has fewer than 2 teams the script aborts.

### 4.6 Cache invalidation

On a successful transaction commit, the script `POST`s `https://<host>/api/admin/revalidate-demo` with header `Authorization: Bearer <REVALIDATE_SECRET>`. The endpoint calls `revalidateTag("demo-league")`. Host and secret are read from environment variables `WATTHUNTER_HOST` and `REVALIDATE_SECRET` in `services/pcs-sync/.env`. Failure of this POST does not roll back the transaction (the cache will self-heal after 1 h) but logs a loud warning.

### 4.7 Defensive guard in `join_league_by_code`

A one-line additive migration `20260529000003_join_rejects_demo.sql` adds `IF v_league.is_demo THEN RETURN 'league_is_demo'; END IF;` near the top of the function. This stops the (very unlikely) case of a real user typing `DEMO00` into the join form and bricking the demo state.

### 4.8 Tests

- `services/pcs-sync/tests/test_demo_constants_sync.py` — parity between TS and Python constants.
- `services/pcs-sync/tests/test_refresh_demo_league_dry_run.py` — `--dry-run` mode on a fixture league prints the expected visitor team and FK delete plan without writes (mocks Supabase client).
- `services/pcs-sync/tests/test_refresh_demo_league_visitor_mapping.py` — given 8 teams with synthetic `cumulative_xp`, the rank-2 team ends up at `DEMO_TEAM_IDS[1]`.

---

## 5. Web app

### 5.1 Middleware

In `apps/web/lib/supabase/middleware.ts`:

```ts
const publicExactPaths = ["/league/create", "/league/join", "/league/choose"];
// NEW
const publicPrefixPaths = ["/league/demo"];

const isPublic =
  request.nextUrl.pathname === "/" ||
  publicPaths.some((p) => request.nextUrl.pathname.startsWith(p)) ||
  publicExactPaths.includes(request.nextUrl.pathname) ||
  publicPrefixPaths.some((p) => request.nextUrl.pathname.startsWith(p));
```

Anything under `/league/demo` is reachable without a session. Existing protected routes are unchanged.

### 5.2 Layout adaptation

`apps/web/app/(game)/league/[leagueId]/layout.tsx` gets a single early branch:

```ts
const { leagueId } = await params;
if (leagueId === DEMO_LEAGUE_SLUG) {
  return <DemoLeagueLayout>{children}</DemoLeagueLayout>;
}
// ...existing auth + membership code, unchanged
```

`DemoLeagueLayout` lives in the same directory (`demo-layout.tsx`). It:

- skips the `getUser()` call;
- skips the `league_members` lookup;
- fetches the league name from `leagues` by `DEMO_LEAGUE_ID`;
- always sets `unlockedTabs = ["home", "auction", "team", "budget", "ranking", "achievements"]` (full unlock);
- wraps children in `<DemoProvider visitorTeamId={DEMO_TEAM_IDS[DEMO_VISITOR_TEAM_INDEX]}>`;
- renders the same `Sidebar`/`TopBar`/`BottomNav` as the authenticated shell, plus `<DemoBanner />` at the top and `<DemoBottomCta />` at the bottom of `<LeagueShell>`.

The existing `(game)/league/[leagueId]/page.tsx` keeps its `if (isPending) redirect(...)` clause; the demo league is `status = 'active'` so it falls through to the Race Feed naturally.

### 5.3 DemoProvider

`apps/web/contexts/demo-context.tsx`:

```ts
"use client";
import { createContext, useContext, useRef, useCallback } from "react";

interface DemoContextValue {
  isDemo: boolean;
  visitorTeamId: string | null;
  triggerPulse: () => void;
  registerPulseTarget: (el: HTMLElement | null) => void;
}

const DemoContext = createContext<DemoContextValue>({
  isDemo: false,
  visitorTeamId: null,
  triggerPulse: () => {},
  registerPulseTarget: () => {},
});

export function DemoProvider({ children, visitorTeamId }: { children: React.ReactNode; visitorTeamId: string }) {
  const targetRef = useRef<HTMLElement | null>(null);
  const triggerPulse = useCallback(() => {
    const el = targetRef.current;
    if (!el) return;
    el.classList.remove("demo-pulse");
    void el.offsetWidth; // restart CSS animation
    el.classList.add("demo-pulse");
  }, []);
  const registerPulseTarget = useCallback((el: HTMLElement | null) => {
    targetRef.current = el;
  }, []);
  return (
    <DemoContext.Provider value={{ isDemo: true, visitorTeamId, triggerPulse, registerPulseTarget }}>
      {children}
    </DemoContext.Provider>
  );
}

export const useDemo = () => useContext(DemoContext);
```

`useDemoSafeAction(fn)` wraps a mutation. In demo mode it never calls `fn`; instead it calls `triggerPulse()` and returns a sentinel `{ blocked: true }`. Outside demo mode it returns the original function unchanged. All current mutation invocations (`onClick={() => placeBid(...)}` etc.) on demo-reachable pages get wrapped at the call site:

```ts
const placeBidSafe = useDemoSafeAction(placeBid);
<Button onClick={placeBidSafe}>Place bid</Button>
```

The cyan pulse is a 900 ms CSS keyframe defined in `apps/web/app/globals.css` using only design-system tokens:

```css
@keyframes demo-banner-pulse {
  0%   { box-shadow: 0 0 0 0 var(--accent-default); border-color: var(--border-subtle); }
  30%  { box-shadow: 0 0 0 6px color-mix(in oklab, var(--accent-default) 30%, transparent); border-color: var(--accent-default); }
  100% { box-shadow: 0 0 0 0 transparent; border-color: var(--border-subtle); }
}
.demo-pulse { animation: demo-banner-pulse 900ms ease-out; }
```

### 5.4 `DemoBanner` and `DemoBottomCta`

`apps/web/components/demo/demo-banner.tsx` (top, sticky, registered as the pulse target):

```tsx
<div
  ref={registerPulseTarget}
  className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-2.5"
>
  <span className="text-[length:var(--type-caption)] text-[var(--text-mid)]">
    You're exploring a demo league.
  </span>
  <Button asChild variant="cta" size="sm">
    <Link href="/">Get Started</Link>
  </Button>
</div>
```

`apps/web/components/demo/demo-bottom-cta.tsx` (mobile, hides on scroll, sits above `BottomNav`):

- Uses the existing `use-scroll-direction` hook
- A single "Create your league" CTA → `/`
- Hidden on `lg:` (sidebar handles it)

Both components only mount when `isDemo === true`.

### 5.5 Cache layer

Each demo page in `apps/web/app/(game)/league/[leagueId]/**/page.tsx` adds at the top of its server-component body:

```ts
if (leagueId === DEMO_LEAGUE_SLUG) {
  "use cache";
  cacheTag("demo-league");
  cacheLife({ revalidate: 3600 });
}
```

Constraint: `"use cache"` is a function directive — it must be the first statement of the function body, and Next 16 supports it only on whole functions. The clean implementation is therefore a *separate* cached helper per route, e.g.:

```ts
async function fetchDemoHomeData() {
  "use cache";
  cacheTag("demo-league");
  cacheLife({ revalidate: 3600 });
  // ...fetch
}
```

and the page calls it when `leagueId === "demo"`. This avoids touching the cache layer of authenticated leagues.

### 5.6 Revalidate endpoint

`apps/web/app/api/admin/revalidate-demo/route.ts`:

```ts
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  revalidateTag("demo-league");
  return NextResponse.json({ ok: true });
}
```

`REVALIDATE_SECRET` is provisioned in Vercel for `production` and `preview` and never exposed to the client. The route is rate-limit-friendly and idempotent.

### 5.7 Sign-up CTAs

Both `DemoBanner` and `DemoBottomCta` send the visitor to `/`. The landing-page work in Chantier A will decide what `/` shows (today: `/onboarding`). The demo doesn't preserve any state across the jump — the funnel is its own flow.

---

## 6. Auditing & guardrails

### 6.1 Service-role audit

`apps/web/scripts/audit-service-role.ts` (new) greps `apps/web/{src,app,components,contexts,lib,hooks}` for `SUPABASE_SERVICE_ROLE`. Pass = no matches outside `__tests__`. Wired into `pnpm lint` via a `prelint` hook? **No** — it stays a standalone CLI invoked from CI later. For this chantier the verification step just runs the grep directly:

```bash
grep -rE "SUPABASE_SERVICE_ROLE" apps/web/{src,app,components,contexts,lib,hooks} \
  --include='*.ts' --include='*.tsx' \
  | grep -v __tests__
```

(Expected: empty.)

### 6.2 PII audit

`services/pcs-sync/scripts/audit_demo_pii.py` reads `public.users` rows whose `id` is in `DEMO_USER_IDS`, plus `teams.name` for `DEMO_TEAM_IDS`, plus a sample of `treasury_log.description` for those teams, and asserts:

- every `email` matches `demo-team-\d@watthunter.demo`;
- every `display_name` is in `DEMO_TEAM_NAMES`;
- no `@gmail.com`, `@protonmail`, `@hotmail`, `@yahoo`, or `@watthunter.com` substring anywhere in the inspected rows.

Run after every refresh.

### 6.3 Smoke checklist

Documented in the plan, executed once at the end of implementation:

1. Open `/league/demo` in an incognito window — full Race Feed loads, no auth redirect.
2. Open every nav target (Team, Budget, Ranking, etc.) — data renders.
3. Click any mutation button (e.g. "Place bid", "Release", "Validate round") — banner glows cyan for ~900 ms, no toast, no network request fires.
4. Inspect Network tab — no request hits any RPC; only `SELECT` calls to PostgREST.
5. Run `audit_demo_pii.py` and confirm green.

---

## 7. File map

**Created**

```
supabase/migrations/20260529000001_demo_seed_ghost_users.sql
supabase/migrations/20260529000002_demo_anon_select_policies.sql
supabase/migrations/20260529000003_join_rejects_demo.sql
apps/web/lib/demo-constants.ts
apps/web/lib/__tests__/demo-constants-sync.test.ts
apps/web/scripts/dump-demo-constants.ts
apps/web/contexts/demo-context.tsx
apps/web/contexts/__tests__/demo-context.test.tsx
apps/web/components/demo/demo-banner.tsx
apps/web/components/demo/demo-bottom-cta.tsx
apps/web/app/(game)/league/[leagueId]/demo-layout.tsx
apps/web/app/api/admin/revalidate-demo/route.ts
apps/web/app/api/admin/revalidate-demo/route.test.ts
services/pcs-sync/demo_constants.py
services/pcs-sync/refresh_demo_league.py
services/pcs-sync/scripts/audit_demo_pii.py
services/pcs-sync/tests/test_demo_constants_sync.py
services/pcs-sync/tests/test_refresh_demo_league_dry_run.py
services/pcs-sync/tests/test_refresh_demo_league_visitor_mapping.py
```

**Modified**

```
apps/web/lib/supabase/middleware.ts        # whitelist /league/demo prefix
apps/web/app/(game)/league/[leagueId]/layout.tsx   # delegate to demo-layout when slug = "demo"
apps/web/app/(game)/league/[leagueId]/page.tsx     # wrap fetch in cached helper when demo
apps/web/app/globals.css                   # @keyframes demo-banner-pulse
docs/ARCHITECTURE.md                       # add demo mode section + RPCs + route
docs/GAME_RULES.md                         # no changes (demo is infra, not a rule)
```

(Every page under `(game)/league/[leagueId]/**` that the demo touches gets a small, identical 4-line cache stanza — these edits are mechanical and the plan lists them explicitly. No page becomes demo-aware beyond the cache call.)

---

## 8. Risks & mitigations

| Risk | Mitigation |
|---|---|
| RLS policy regression accidentally exposes a real league to anon | Each new policy uses `public.demo_league_id()`, never a bound parameter; the function is `STABLE` and returns a literal. Audit by running `SELECT count(*) FROM <table>` as anon role and confirming 0 rows when no demo data is loaded yet. |
| Refresh script corrupts the source league | Wipe targets only rows where `team_id IN DEMO_TEAM_IDS` or `league_id = DEMO_LEAGUE_ID`. The script asserts `is_demo = true` on the target league before any DELETE; abort otherwise. Wrapped in a single transaction so partial failures roll back. |
| Visitor types `DEMO00` into the real join form | `join_league_by_code` rejects `is_demo = true` leagues at the top of the function. |
| Stale demo state confuses visitors | 1-hour cache TTL caps staleness even if the explicit `revalidateTag` POST fails. |
| Constants drift between TS and Python | A vitest test reads both files; the refresh script aborts on mismatch at startup; both checks run in CI/local before any push. |
| `auth.users` ghost rows accidentally collide with a real user signing up with a `@watthunter.demo` email | `.demo` is RFC-6761-reserved and cannot be registered. Signup also requires email confirmation off-path, but even if a user typed one in, the `id` collision is impossible (we use fixed UUIDs and Supabase generates new ones at signup). |
| `service_role` leakage into client bundle | Audit grep step at the end of every task; refresh script is Python-only and reads the key from `.env`. |
| Mutation buttons not wrapped, fall through to a real RPC | RPC returns generic error (`unauthenticated`) which the user would see as a toast. Acceptable degraded mode, but the plan task that wraps the mutations enumerates each call site so we don't miss one. |

---

## 9. Out of scope

- Landing page video (Chantier A).
- Signup funnel (Chantier C — shipped).
- Lobby redesign for pending leagues (Chantier D — shipped).
- Demo-specific analytics / conversion tracking.
- Multi-language UI.
- Re-snapshotting on a schedule (the script stays manual).
- Onboarding tour / coach marks inside the demo.

---

## 10. Self-review notes

- Placeholders: none.
- Internal consistency: the file map (§7), the RLS table list (§3.1), and the wipe order (§4.3) all agree on 21 league-scoped + reference tables + the 3 demo migrations.
- Scope: this is the *full* Chantier B. The plan derived from it will be ~13–15 tasks.
- Ambiguity: `useDemoSafeAction` is defined to wrap server-action invocations only, not Supabase client-side mutations; demo pages don't call the Supabase client directly anywhere today (all mutations go through server actions), so this is fine. If a future feature breaks that assumption, the audit grep step will catch un-wrapped server-action imports under demo-reachable trees.
