# Grand Tour Mode V1a Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the V1a tactical layer for Grand Tours: an 8-rider squad with role-based multipliers, a daily-classification bonus, a new GT Team sub-tab, and a `Auction` top-level nav restructure — in time for the Giro (2026-05-08).

**Architecture:** Additive data model (3 new tables + one column on `race_results`), extended `scoring.py` with role multipliers + classif bonus, lazy squad init on first page load, UI restructured from 4 to 5 top-level tabs, GT-specific sub-tab on `Team`. Existing components (`SponsorBonusCard`, `RiderCard`, `SubTabs`) reused verbatim.

**Tech Stack:** Next.js 16 App Router (TypeScript strict), Supabase (Postgres + RLS), Python 3.9 (sync microservice with Playwright + procyclingstats), vitest + pytest.

**Spec:** `docs/superpowers/specs/2026-04-22-grand-tour-mode-v1a-design.md` (validated 2026-04-22).

---

## File Structure

### New files

**Database**
- `supabase/migrations/20260501000000_grand_tour_mode_v1a.sql` — tables `gt_squad`, `gt_role_assignments`, `gt_daily_classifications` + `race_results.is_itt` column + backfill + RLS + indexes

**Frontend — libs & helpers**
- `apps/web/lib/gt-goals.ts` — hand-curated sponsor goals (V1a: display-only)
- `apps/web/lib/gt-phases.ts` — GT-phase helpers (`GT_PHASE_IDS`, `isGTPhase`, `getCurrentGTPhase`, `getNextGTPhase`, `gtShortName`, `gtFullName`, `gtRaceSlugPrefix`)

**Frontend — components**
- `apps/web/components/role-assign-sheet.tsx` — mobile bottom sheet / desktop centered modal for role assignment
- `apps/web/components/gt-goals-preview.tsx` — hand-curated goals preview block (shown inside `SponsorBonusCard`)
- `apps/web/components/home-gt-banner.tsx` — banner shown on Home during GT phase

**Frontend — GT Team page**
- `apps/web/app/(game)/league/[leagueId]/team/gt/page.tsx` — SSR page (calls `ensureGtSquad`)
- `apps/web/app/(game)/league/[leagueId]/team/gt/gt-team-client.tsx` — client component (role assignment UI)
- `apps/web/app/(game)/league/[leagueId]/team/gt/actions.ts` — server actions (`ensureGtSquad`, `assignRole`, `clearRole`, `getSquadWithRoles`)
- `apps/web/app/(game)/league/[leagueId]/team/gt/actions.test.ts` — vitest

**Frontend — Auction top-level tab (migrated routes)**
- `apps/web/app/(game)/league/[leagueId]/auction/layout.tsx` — sub-tabs wrapper
- `apps/web/app/(game)/league/[leagueId]/auction/page.tsx` — bids & round validation (from `/team/auctions/page.tsx`)
- `apps/web/app/(game)/league/[leagueId]/auction/market/page.tsx` — (from `/team/market/page.tsx`)
- `apps/web/app/(game)/league/[leagueId]/auction/history/page.tsx` — new; absorbs content currently behind the History button on Market/Auctions
- `apps/web/app/(game)/league/[leagueId]/auction/rounds/page.tsx` — (from `/team/auctions/rounds/page.tsx`)
- `apps/web/app/(game)/league/[leagueId]/auction/[auctionId]/page.tsx` — (from `/auctions/[auctionId]/page.tsx`)

**Python tests**
- `services/pcs-sync/tests/test_scoring_gt.py` — GT scoring (role multipliers + classif bonus)
- Additions to `services/pcs-sync/tests/test_sync_race.py` — `is_itt` + `gt_daily_classifications` upserts

### Modified files

- `apps/web/lib/phases.ts` — no change (helpers live in `gt-phases.ts`)
- `apps/web/components/sponsor-bonus-card.tsx` — accept new optional `gtGoalsPreview?: ReactNode` prop rendered at bottom of expanded area
- `apps/web/components/bottom-nav.tsx` — add `auction` tab between Home and Team (5 tabs)
- `apps/web/components/sidebar.tsx` — add `auction` with 3 sub-items (Auctions/Market/History) + restructure Team sub-items (`My Team` + dynamic GT label)
- `apps/web/app/(game)/league/[leagueId]/team/layout.tsx` — replace current 3 sub-tabs with `My Team` + dynamic GT label
- `apps/web/app/(game)/league/[leagueId]/team/page.tsx` — rewrite any `/team/market` or `/team/auctions` hrefs to `/auction/market` / `/auction`
- `apps/web/app/(game)/league/[leagueId]/page.tsx` — inject `<HomeGtBanner>` above `HomeFeed`
- `apps/web/next.config.ts` — add 301 redirects for deleted legacy paths
- `services/pcs-sync/sync_race.py` — set `race_results.is_itt`, fetch 3 daily classifications, upsert into `gt_daily_classifications`
- `services/pcs-sync/scoring.py` — apply role multiplier + daily classif bonus during GT phases

### Deleted files (after migration)

- `apps/web/app/(game)/league/[leagueId]/team/auctions/` (entire directory)
- `apps/web/app/(game)/league/[leagueId]/team/market/` (entire directory)
- `apps/web/app/(game)/league/[leagueId]/auctions/` (entire directory)

Note: `team/strategies/` is NOT touched — Strategies remains accessible from the My Team page card.

---

## Tasks

### Task 1: Database migration — GT tables + `is_itt` column

**Files:**
- Create: `supabase/migrations/20260501000000_grand_tour_mode_v1a.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Migration: Grand Tour Mode V1a
-- Adds gt_squad, gt_role_assignments, gt_daily_classifications + race_results.is_itt

-- ---------------------------------------------------------------------------
-- 1. gt_squad — which roster riders form the squad for a given GT phase
-- ---------------------------------------------------------------------------
create table public.gt_squad (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams(id) on delete cascade,
  phase_id    int  not null check (phase_id in (4, 6, 8)),
  year        int  not null,
  rider_id    uuid not null references public.riders(id) on delete restrict,
  created_at  timestamptz not null default now(),
  unique(team_id, phase_id, year, rider_id)
);

create index idx_gt_squad_team_phase on public.gt_squad(team_id, phase_id, year);

alter table public.gt_squad enable row level security;

create policy "GT squad readable by league members"
  on public.gt_squad for select
  using (
    team_id in (
      select t.id from public.teams t
      join public.league_members lm on lm.league_id = t.league_id
      where lm.user_id = auth.uid()
    )
  );

create policy "GT squad writable by team owner"
  on public.gt_squad for all to authenticated
  using (team_id in (select id from public.teams where user_id = auth.uid()))
  with check (team_id in (select id from public.teams where user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- 2. gt_role_assignments — append-only role history with 11:00 CET cutoff
-- ---------------------------------------------------------------------------
create table public.gt_role_assignments (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams(id) on delete cascade,
  phase_id    int  not null check (phase_id in (4, 6, 8)),
  year        int  not null,
  rider_id    uuid not null references public.riders(id) on delete restrict,
  role        text not null check (role in ('gc_leader', 'sprinter', 'climber', 'tt_specialist', 'stage_hunter', 'domestique')),
  applied_at  timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

create index idx_gt_role_team_phase
  on public.gt_role_assignments(team_id, phase_id, year, rider_id, applied_at desc);

alter table public.gt_role_assignments enable row level security;

create policy "GT role assignments readable by league members"
  on public.gt_role_assignments for select
  using (
    team_id in (
      select t.id from public.teams t
      join public.league_members lm on lm.league_id = t.league_id
      where lm.user_id = auth.uid()
    )
  );

create policy "GT role assignments writable by team owner"
  on public.gt_role_assignments for all to authenticated
  using (team_id in (select id from public.teams where user_id = auth.uid()))
  with check (team_id in (select id from public.teams where user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- 3. gt_daily_classifications — per-stage GC / points / KOM rank cache
-- ---------------------------------------------------------------------------
create table public.gt_daily_classifications (
  race_slug           text not null,
  stage               text not null,
  rider_id            uuid not null references public.riders(id) on delete cascade,
  classification_type text not null check (classification_type in ('gc', 'points', 'kom')),
  rank                int  not null,
  created_at          timestamptz not null default now(),
  primary key (race_slug, rider_id, classification_type)
);

create index idx_gt_classif_rider
  on public.gt_daily_classifications(rider_id, classification_type);

alter table public.gt_daily_classifications enable row level security;

create policy "GT daily classifications readable by all"
  on public.gt_daily_classifications for select using (true);

-- Writes are service_role only (no RLS policy for writes → blocked from anon/auth).

-- ---------------------------------------------------------------------------
-- 4. race_results.is_itt flag
-- ---------------------------------------------------------------------------
alter table public.race_results
  add column if not exists is_itt boolean not null default false;

-- Backfill: mark known 2026 ITT stages up to now (Paris-Nice stage 3, Tirreno-Adriatico stage 7, etc.).
-- Operators: edit this list if new ITTs have been imported before the migration runs.
update public.race_results
  set is_itt = true
  where race_slug in (
    'race/paris-nice/2026/stage-3',
    'race/tirreno-adriatico/2026/stage-7',
    'race/volta-a-catalunya/2026/stage-2',
    'race/itzulia-basque-country/2026/stage-1'
  );
```

- [ ] **Step 2: Push migration**

Run: `supabase db push`
Expected: `Applying migration 20260501000000_grand_tour_mode_v1a.sql...` → `Finished supabase db push.`

- [ ] **Step 3: Verify tables + RLS**

Run: `supabase db diff --linked`
Expected: empty diff (no pending migrations).

Run:
```bash
psql "$DATABASE_URL" -c "\d gt_squad" -c "\d gt_role_assignments" -c "\d gt_daily_classifications"
```
Expected: all three tables listed with correct columns and indexes.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260501000000_grand_tour_mode_v1a.sql
git commit -m "db: add gt_squad, gt_role_assignments, gt_daily_classifications (V1a)"
```

---

### Task 2: Regenerate Supabase TypeScript types

**Files:**
- Modify: `apps/web/lib/supabase/database.types.ts` (if present — regenerate)

- [ ] **Step 1: Regenerate types**

Run from repo root:
```bash
supabase gen types typescript --linked --schema public > apps/web/lib/supabase/database.types.ts
```

Expected: file updated in place with `gt_squad`, `gt_role_assignments`, `gt_daily_classifications` entries and the `is_itt` field inside `race_results.Row`.

If the project does not use generated types (grep returns no `database.types.ts`), skip this task.

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS (no errors).

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/supabase/database.types.ts
git commit -m "types: regenerate Supabase types for GT tables"
```

---

### Task 3: `gt-phases.ts` — GT-specific phase helpers

**Files:**
- Create: `apps/web/lib/gt-phases.ts`

- [ ] **Step 1: Write the helper module**

```ts
import { AUCTION_PHASES, getCurrentPhase, type AuctionPhase } from "./phases";

export const GT_PHASE_IDS = [4, 6, 8] as const;
export type GtPhaseId = (typeof GT_PHASE_IDS)[number];

/** Canonical race-slug prefix per GT phase (used to scope XP / bonus queries). */
export const GT_RACE_SLUG_PREFIX: Record<GtPhaseId, string> = {
  4: "race/giro-d-italia",
  6: "race/tour-de-france",
  8: "race/vuelta-a-espana",
};

/** Full display name — `Giro d'Italia` / `Tour de France` / `La Vuelta`. */
export const GT_FULL_NAME: Record<GtPhaseId, string> = {
  4: "Giro d'Italia",
  6: "Tour de France",
  8: "La Vuelta",
};

/** Short label used in the GT Team sub-tab and section titles. */
export const GT_SHORT_NAME: Record<GtPhaseId, string> = {
  4: "Giro",
  6: "Tour",
  8: "Vuelta",
};

export function isGTPhaseId(id: number): id is GtPhaseId {
  return (GT_PHASE_IDS as readonly number[]).includes(id);
}

/** Returns the current GT phase if we're inside one, otherwise null. */
export function getCurrentGTPhase(date: Date = new Date()): AuctionPhase | null {
  const phase = getCurrentPhase(date);
  return isGTPhaseId(phase.id) ? phase : null;
}

/** Returns the next GT phase (strictly after `date`), or null if all 3 are past. */
export function getNextGTPhase(date: Date = new Date()): AuctionPhase | null {
  const year = date.getFullYear();
  for (const p of AUCTION_PHASES) {
    if (!isGTPhaseId(p.id)) continue;
    const start = new Date(year, p.startMonth - 1, p.startDay);
    if (start > date) return p;
  }
  return null;
}

/**
 * Sub-tab label for the Team layout:
 *   - During a GT phase → `Giro Team` / `Tour Team` / `Vuelta Team`
 *   - Outside           → `GT Team` (inactive placeholder)
 */
export function getGTSubTabLabel(date: Date = new Date()): string {
  const cur = getCurrentGTPhase(date);
  if (!cur) return "GT Team";
  return `${GT_SHORT_NAME[cur.id as GtPhaseId]} Team`;
}

/** Home banner copy during an active GT phase; null outside. */
export function getGTBannerText(date: Date = new Date()): string | null {
  const cur = getCurrentGTPhase(date);
  if (!cur) return null;
  return `🏁 ${GT_FULL_NAME[cur.id as GtPhaseId]} in progress — manage your squad →`;
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter web typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/gt-phases.ts
git commit -m "lib: add GT phase helpers (isGTPhase, getCurrentGTPhase, labels)"
```

---

### Task 4: `gt-goals.ts` seed — hand-curated sponsor goals

**Files:**
- Create: `apps/web/lib/gt-goals.ts`

- [ ] **Step 1: Write the seed file with placeholder entries**

```ts
export interface GtGoal {
  label: string;   // 'Top 10 GC'
  reward: number;  // euros — displayed only in V1a
}

export interface GtGoalSet {
  sponsorSlug: string;
  goals: GtGoal[];
}

/**
 * Hand-curated in V1a — display only. V1b adds evaluation + payout.
 * One entry per sponsor slug (see supabase/migrations/20260402300000_sponsors_rework.sql).
 *
 * BLOCKING: the user must finalize this list before merging V1a.
 */
export const GT_GOALS: GtGoalSet[] = [
  { sponsorSlug: "lotto", goals: [
    { label: "Win 1 stage", reward: 20_000 },
    { label: "Top 20 GC final", reward: 15_000 },
    { label: "Top 5 points classification", reward: 20_000 },
    { label: "5 top-10 stage finishes", reward: 25_000 },
  ]},
  { sponsorSlug: "astana", goals: [
    { label: "Win 2 stages", reward: 40_000 },
    { label: "Top 15 GC final", reward: 30_000 },
    { label: "Wear maglia rosa ≥ 2 days", reward: 35_000 },
    { label: "Top 3 KOM classification", reward: 30_000 },
  ]},
  { sponsorSlug: "groupama", goals: [
    { label: "Top 10 GC", reward: 30_000 },
    { label: "Win 1 stage", reward: 25_000 },
    { label: "Maglia rosa ≥ 3 days", reward: 40_000 },
    { label: "2 FR riders top 20 GC", reward: 50_000 },
  ]},
  { sponsorSlug: "movistar", goals: [
    { label: "Top 10 GC", reward: 30_000 },
    { label: "Win 1 stage", reward: 25_000 },
    { label: "ES rider top 15 GC", reward: 40_000 },
    { label: "Top 5 KOM classification", reward: 35_000 },
  ]},
  { sponsorSlug: "alpecin", goals: [
    { label: "Win 2 stages", reward: 50_000 },
    { label: "Wear maglia ciclamino ≥ 1 day", reward: 30_000 },
    { label: "Top 3 points classification", reward: 45_000 },
    { label: "BE/NL rider stage win", reward: 35_000 },
  ]},
  { sponsorSlug: "unox", goals: [
    { label: "Win 1 stage", reward: 35_000 },
    { label: "Top 3 points classification", reward: 45_000 },
    { label: "DK/NO rider top 10 stage", reward: 30_000 },
    { label: "3 top-10 stage finishes", reward: 25_000 },
  ]},
  { sponsorSlug: "ineos", goals: [
    { label: "Top 5 GC", reward: 60_000 },
    { label: "Win 2 stages", reward: 50_000 },
    { label: "Wear maglia rosa ≥ 5 days", reward: 80_000 },
    { label: "GB rider top 10 GC", reward: 55_000 },
  ]},
  { sponsorSlug: "decathlon", goals: [
    { label: "Top 5 GC", reward: 60_000 },
    { label: "Win 1 stage", reward: 40_000 },
    { label: "Top 3 KOM classification", reward: 50_000 },
    { label: "FR rider top 15 GC", reward: 55_000 },
  ]},
  { sponsorSlug: "soudal", goals: [
    { label: "Win 3 stages", reward: 70_000 },
    { label: "Top 3 points classification", reward: 50_000 },
    { label: "BE rider top 10 stage × 3", reward: 45_000 },
    { label: "Top 15 GC", reward: 40_000 },
  ]},
  { sponsorSlug: "lidl-trek", goals: [
    { label: "Win 2 stages", reward: 55_000 },
    { label: "Top 5 points classification", reward: 40_000 },
    { label: "US/IT rider stage win", reward: 45_000 },
    { label: "Top 10 GC", reward: 55_000 },
  ]},
  { sponsorSlug: "visma", goals: [
    { label: "Top 3 GC", reward: 120_000 },
    { label: "Win 3 stages", reward: 90_000 },
    { label: "Wear maglia rosa ≥ 7 days", reward: 150_000 },
    { label: "Double classification podium", reward: 130_000 },
  ]},
  { sponsorSlug: "redbull-bora", goals: [
    { label: "Top 3 GC", reward: 120_000 },
    { label: "Win 2 stages", reward: 70_000 },
    { label: "Top 3 KOM classification", reward: 80_000 },
    { label: "Wear any jersey ≥ 5 days", reward: 100_000 },
  ]},
  { sponsorSlug: "uae", goals: [
    { label: "Win overall GC", reward: 300_000 },
    { label: "Win 4 stages", reward: 150_000 },
    { label: "Double classification win", reward: 200_000 },
    { label: "Wear maglia rosa ≥ 10 days", reward: 180_000 },
  ]},
];

export function getGoalsForSponsor(slug: string): GtGoal[] {
  return GT_GOALS.find((g) => g.sponsorSlug === slug)?.goals ?? [];
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter web typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/gt-goals.ts
git commit -m "lib: add GT_GOALS seed (V1a display-only, 13 sponsors × 4 goals)"
```

---

### Task 5: Python test — `is_itt` flag set by `import_race_results`

**Files:**
- Modify: `services/pcs-sync/tests/test_sync_race.py`

- [ ] **Step 1: Add failing test**

Append to `services/pcs-sync/tests/test_sync_race.py`:

```python
async def test_import_race_results_sets_is_itt_for_itt_stage(monkeypatch):
    """ITT stage URL should result in race_results row with is_itt=true."""
    import sync_race
    from helpers import make_supabase

    # Mock Stage: profile='ITT', one result matching a known rider
    class FakeStage:
        def __init__(self, *a, **kw): pass
        def results(self):
            return [{"rider_url": "rider/test", "pcs_points": 30, "rank": 1}]
        @property
        def stage_type(self): return "ITT"

    monkeypatch.setattr(sync_race, "Stage", FakeStage)
    monkeypatch.setattr(sync_race, "fetch_html", _async_return("<html/>"))

    sb = make_supabase(
        [{"id": "rid-1", "pcs_slug": "rider/test"}],  # riders lookup
        [],                                            # race_results upsert result
    )

    class FakePage: pass
    result = await sync_race.import_race_results(
        sb, FakePage(),
        race_slug="race/paris-nice/2026",
        race_name="Paris-Nice",
        race_date="2026-03-08",
        stage_url="race/paris-nice/2026/stage-3",
    )

    assert result["imported"] == 1
    # Inspect upsert payload
    upsert_calls = sb.table.mock_calls  # conftest records all calls
    payload = _find_upsert_payload(sb, "race_results")
    assert payload["is_itt"] is True
```

Helper at top of file (add if missing):

```python
def _async_return(value):
    async def inner(*args, **kwargs):
        return value
    return inner

def _find_upsert_payload(sb, table_name):
    for call in sb.table.call_args_list:
        if call.args and call.args[0] == table_name:
            pass
    # Rely on conftest helpers or stub here if needed.
```

- [ ] **Step 2: Run the test (fail)**

Run: `cd services/pcs-sync && pytest tests/test_sync_race.py::test_import_race_results_sets_is_itt_for_itt_stage -v`
Expected: FAIL (`is_itt` not set).

- [ ] **Step 3: Implement**

Edit `services/pcs-sync/sync_race.py` inside `import_race_results`, the `for entry in results:` loop. Replace the `row = { ... }` block with:

```python
row = {
    "rider_id": rider_id,
    "race_slug": race_result_slug,
    "race_name": race_name,
    "stage": stage_label,
    "race_date": race_date or None,
    "pcs_points": int(entry.get("pcs_points") or entry.get("points", 0) or 0),
    "rank": entry.get("rank"),
    "is_itt": _detect_itt(stage),
}
```

Add `_detect_itt` helper near the top of the file (below `_classify_race`):

```python
def _detect_itt(stage) -> bool:
    """True if the Stage's profile indicates an individual/team time trial."""
    try:
        stype = (stage.stage_type() if callable(getattr(stage, "stage_type", None))
                 else getattr(stage, "stage_type", None))
    except Exception:
        return False
    if not stype:
        return False
    s = str(stype).strip().upper()
    return s in ("ITT", "TTT")
```

- [ ] **Step 4: Run the test (pass)**

Run: `cd services/pcs-sync && pytest tests/test_sync_race.py::test_import_race_results_sets_is_itt_for_itt_stage -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/pcs-sync/sync_race.py services/pcs-sync/tests/test_sync_race.py
git commit -m "sync: flag ITT stages via race_results.is_itt"
```

---

### Task 6: Python test + impl — `fetch_daily_classifications` upsert

**Files:**
- Create helper: `services/pcs-sync/sync_race.py` (new function `import_daily_classifications`)
- Modify: `services/pcs-sync/tests/test_sync_race.py`

- [ ] **Step 1: Add failing test**

Append to `services/pcs-sync/tests/test_sync_race.py`:

```python
async def test_import_daily_classifications_upserts_three_types(monkeypatch):
    """Each of gc/points/kom is upserted with rider_id + rank."""
    import sync_race
    from helpers import make_supabase

    class FakeStage:
        def __init__(self, *a, **kw): pass
        def gc(self):     return [{"rider_url": "rider/a", "rank": 1}, {"rider_url": "rider/b", "rank": 2}]
        def points(self): return [{"rider_url": "rider/a", "rank": 3}]
        def kom(self):    return [{"rider_url": "rider/b", "rank": 1}]

    monkeypatch.setattr(sync_race, "Stage", FakeStage)
    monkeypatch.setattr(sync_race, "fetch_html", _async_return("<html/>"))

    sb = make_supabase(
        [{"id": "rid-a", "pcs_slug": "rider/a"}, {"id": "rid-b", "pcs_slug": "rider/b"}],
        [],  # upsert responses are not asserted individually
    )

    class FakePage: pass
    result = await sync_race.import_daily_classifications(
        sb, FakePage(),
        race_slug="race/giro-d-italia/2026",
        stage_url="race/giro-d-italia/2026/stage-4",
    )
    assert result["gc"] == 2
    assert result["points"] == 1
    assert result["kom"] == 1
```

- [ ] **Step 2: Run test (fail)**

Run: `cd services/pcs-sync && pytest tests/test_sync_race.py::test_import_daily_classifications_upserts_three_types -v`
Expected: FAIL (`import_daily_classifications` not defined).

- [ ] **Step 3: Implement**

Append to `services/pcs-sync/sync_race.py`:

```python
async def import_daily_classifications(
    supabase: Client,
    page,
    *,
    race_slug: str,
    stage_url: str,
) -> Dict[str, int]:
    """Fetch gc/points/kom classifications for a single GT stage and upsert.

    Stores top 50 GC, top 20 points, top 10 KOM for safety; scoring reads only
    the top 10/5/3 respectively. Swallows errors per classification so a single
    failed fetch does not abort the whole call.
    """
    counts = {"gc": 0, "points": 0, "kom": 0}
    stage_label = stage_url.split("/")[-1]

    riders_resp = supabase.table("riders").select("id, pcs_slug").execute()
    rider_map: Dict[str, str] = {
        r["pcs_slug"]: r["id"] for r in (riders_resp.data or [])
    }

    html = await fetch_html(page, stage_url)
    stage = Stage(stage_url, html=html, update_html=False)

    fetchers = [
        ("gc", lambda: stage.gc()[:50]),
        ("points", lambda: stage.points()[:20]),
        ("kom", lambda: stage.kom()[:10]),
    ]

    for kind, fetch in fetchers:
        try:
            entries = fetch() or []
        except Exception as exc:
            logger.warning("Failed to fetch %s for %s: %s", kind, stage_url, exc)
            continue

        for entry in entries:
            rider_url = entry.get("rider_url", "")
            rank = entry.get("rank")
            if not rider_url or rank is None:
                continue
            rid = rider_map.get(rider_url)
            if not rid:
                continue
            try:
                supabase.table("gt_daily_classifications").upsert(
                    {
                        "race_slug": stage_url,
                        "stage": stage_label,
                        "rider_id": rid,
                        "classification_type": kind,
                        "rank": int(rank),
                    },
                    on_conflict="race_slug,rider_id,classification_type",
                ).execute()
                counts[kind] += 1
            except Exception as exc:
                logger.error("Failed classif upsert (%s, %s): %s", kind, rid, exc)

    return counts
```

- [ ] **Step 4: Run test (pass)**

Run: `cd services/pcs-sync && pytest tests/test_sync_race.py::test_import_daily_classifications_upserts_three_types -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/pcs-sync/sync_race.py services/pcs-sync/tests/test_sync_race.py
git commit -m "sync: add import_daily_classifications (gc/points/kom cache for GT stages)"
```

---

### Task 7: Wire `import_daily_classifications` into the post-race pipeline

**Files:**
- Modify: `services/pcs-sync/run_pipeline.py` (function `_import_single_race`)

- [ ] **Step 1: Add helper at top of `run_pipeline.py`**

Near the other helpers in `run_pipeline.py`:

```python
GT_SLUG_PREFIXES = (
    "race/giro-d-italia/",
    "race/tour-de-france/",
    "race/vuelta-a-espana/",
)

def _is_gt_stage(slug: str) -> bool:
    return slug.startswith(GT_SLUG_PREFIXES) and "/stage-" in slug
```

- [ ] **Step 2: Call the new importer after each stage import**

Inside `_import_single_race`, after every call to `import_race_results` for a stage (both direct-stage and multi-stage paths), wrap the successful case with a classification fetch. Example insertion right after the `imported_slugs.append(...)` line for the direct-stage block (around line 300):

```python
if _is_gt_stage(stage_url):
    print("  Fetching daily classifications (gc/points/kom)...")
    try:
        from sync_race import import_daily_classifications
        ctx_c = await browser.new_context(user_agent=USER_AGENT)
        page_c = await ctx_c.new_page()
        try:
            counts = await import_daily_classifications(
                supabase, page_c,
                race_slug=parent_slug, stage_url=stage_url,
            )
            print(f"    gc={counts['gc']} points={counts['points']} kom={counts['kom']}")
        finally:
            await ctx_c.close()
    except Exception as exc:
        print(f"    Classif fetch failed: {exc}")
```

Repeat the same block inside the multi-stage loop (after `imported_slugs.append(stage_url)` / `result["race_slug"]`) and in the auto-mode target-stage block. Make sure `parent_slug` is replaced by the stage race's `race_slug` variable in each scope.

- [ ] **Step 3: Smoke-test against a known Giro stage (dry-run not available — manual run)**

Run (residential IP required):
```bash
cd services/pcs-sync
python3 run_pipeline.py post-race --race "race/giro-d-italia/2026/stage-4"
```
Expected output ends with `gc=50 points=20 kom=10` (or close to it) and a new row count visible via:
```bash
psql "$DATABASE_URL" -c "select classification_type, count(*) from gt_daily_classifications where race_slug='race/giro-d-italia/2026/stage-4' group by 1;"
```

- [ ] **Step 4: Commit**

```bash
git add services/pcs-sync/run_pipeline.py
git commit -m "pipeline: fetch gt_daily_classifications after each GT stage import"
```

---

### Task 8: Python test + impl — role multipliers in `scoring.py`

**Files:**
- Modify: `services/pcs-sync/scoring.py`
- Create: `services/pcs-sync/tests/test_scoring_gt.py`

- [ ] **Step 1: Write failing role-multiplier test**

Create `services/pcs-sync/tests/test_scoring_gt.py`:

```python
"""Tests for GT scoring path — role multipliers + daily classif bonus."""
import importlib
from helpers import make_supabase

TEAM_ID    = "aaaa-0000-0000-0001"
RIDER_ID   = "bbbb-0000-0000-0001"
CONTRACT_ID = "cccc-0000-0000-0001"
GIRO_SLUG  = "race/giro-d-italia/2026/stage-4"


def _base_mocks(*, role: str, is_itt: bool = False, classif_rows: list | None = None):
    """Build a 10-response supabase mock covering the full scoring flow."""
    return make_supabase(
        # 1. race_results
        [{"rider_id": RIDER_ID, "race_slug": GIRO_SLUG, "pcs_points": 100,
          "race_date": "2026-05-11", "is_itt": is_itt}],
        # 2. prev rider_xp_daily for delta (empty = first run)
        [],
        # 3. contracts
        [{"id": CONTRACT_ID, "team_id": TEAM_ID, "rider_id": RIDER_ID,
          "purchased_at": "2026-01-01T00:00:00Z", "release_date": None,
          "riders": {"specialty": "GC", "nationality": "BE",
                     "real_team": "Soudal", "birthdate": "1998-01-01"}}],
        # 4. team_strategies
        [],
        # 5. gt_squad presence
        [{"rider_id": RIDER_ID}],
        # 6. gt_role_assignments latest
        [{"rider_id": RIDER_ID, "role": role, "applied_at": "2026-05-10T09:00:00Z"}],
        # 7. gt_daily_classifications
        classif_rows or [],
        # 8. rider_xp_daily upsert
        [],
        # 9. teams select
        {"id": TEAM_ID, "cumulative_xp": 0, "level": 1, "league_id": "lg-1"},
        # 10. teams update
        [],
        # 11. league teams snapshot
        [{"id": TEAM_ID, "cumulative_xp": 150}],
    )


async def test_gc_leader_applies_1_5x():
    import scoring
    importlib.reload(scoring)
    sb = _base_mocks(role="gc_leader")
    await scoring.calculate_daily_scores(sb, race_slugs=[GIRO_SLUG])

    # Pull last upsert payload to inspect xp_gained
    payload = sb._last_upsert_payload("rider_xp_daily")
    assert payload["xp_gained"] == 150.0  # 100 × 1.5


async def test_tt_specialist_only_multiplies_itt():
    import scoring
    importlib.reload(scoring)
    # Non-ITT stage → ×1
    sb = _base_mocks(role="tt_specialist", is_itt=False)
    await scoring.calculate_daily_scores(sb, race_slugs=[GIRO_SLUG])
    assert sb._last_upsert_payload("rider_xp_daily")["xp_gained"] == 100.0

    # ITT stage → ×2
    sb2 = _base_mocks(role="tt_specialist", is_itt=True)
    await scoring.calculate_daily_scores(sb2, race_slugs=[GIRO_SLUG])
    assert sb2._last_upsert_payload("rider_xp_daily")["xp_gained"] == 200.0


async def test_domestique_no_multiplier():
    import scoring
    importlib.reload(scoring)
    sb = _base_mocks(role="domestique")
    await scoring.calculate_daily_scores(sb, race_slugs=[GIRO_SLUG])
    assert sb._last_upsert_payload("rider_xp_daily")["xp_gained"] == 100.0
```

If `_last_upsert_payload` is not yet defined in the helpers, extend `services/pcs-sync/tests/conftest.py` or `helpers.py` with a convenience accessor. Minimal addition to `helpers.py`:

```python
def _last_upsert_payload_factory(sb):
    def _last(table_name):
        for call in reversed(sb.table.mock_calls):
            # Inspect subsequent .upsert({...}).execute() chain
            pass  # conftest-specific: see make_supabase internals
        # If helpers do not expose this, use sb.upserts[table_name][-1]
        return sb.upserts[table_name][-1]
    return _last
```

If `make_supabase` does not already record upsert payloads per table, add a `sb.upserts: dict[str, list[dict]]` field populated from inside the `.upsert(...)` stub. Apply this change in `helpers.py` in the same commit.

- [ ] **Step 2: Run tests (fail)**

Run: `cd services/pcs-sync && pytest tests/test_scoring_gt.py -v`
Expected: FAIL (multipliers not applied).

- [ ] **Step 3: Implement the role multiplier in `scoring.py`**

Add these module-level constants near the top of `services/pcs-sync/scoring.py`:

```python
GT_RACE_PREFIXES = ("race/giro-d-italia/", "race/tour-de-france/", "race/vuelta-a-espana/")
ROLE_MULTIPLIERS = {
    "gc_leader":     ("all", 1.5),
    "sprinter":      ("all", 1.5),
    "climber":       ("all", 1.5),
    "tt_specialist": ("itt", 2.0),
    "stage_hunter":  ("stage", 1.5),
    "domestique":    (None, 1.0),
}

def _is_gt_slug(slug: str) -> bool:
    return slug.startswith(GT_RACE_PREFIXES)

def _role_multiplier(role: str, race_slug: str, is_itt: bool) -> float:
    """Return the PCS multiplier for a rider's role given a race slug."""
    if not role:
        return 1.0
    scope, mult = ROLE_MULTIPLIERS.get(role, (None, 1.0))
    if scope is None:
        return 1.0
    if scope == "all":
        return mult
    if scope == "itt":
        return mult if is_itt else 1.0
    if scope == "stage":
        # Only stage lines; GC result slugs end with `/gc`
        return mult if not race_slug.endswith("/gc") else 1.0
    return 1.0
```

Then, inside `calculate_daily_scores`, after the `team_strategies` block, pre-fetch GT metadata scoped to the current `race_slugs`:

```python
# GT role lookup — only when at least one race_slug is a GT slug
gt_slugs = [s for s in (race_slugs or []) if _is_gt_slug(s)]
gt_squad_members: dict[tuple[str, str], bool] = {}  # (team_id, rider_id) → True
gt_roles: dict[tuple[str, str], str] = {}           # (team_id, rider_id) → latest role
if gt_slugs:
    # Phase/year derived from the first GT slug
    phase_id, year = _phase_year_from_slug(gt_slugs[0])
    squad_resp = supabase.table("gt_squad").select(
        "team_id, rider_id"
    ).eq("phase_id", phase_id).eq("year", year).execute()
    for r in (squad_resp.data or []):
        gt_squad_members[(r["team_id"], r["rider_id"])] = True

    role_resp = supabase.table("gt_role_assignments").select(
        "team_id, rider_id, role, applied_at"
    ).eq("phase_id", phase_id).eq("year", year).order("applied_at", desc=True).execute()
    for r in (role_resp.data or []):
        key = (r["team_id"], r["rider_id"])
        if key not in gt_roles:  # first (latest) wins due to order desc
            gt_roles[key] = r["role"]
```

Add helper near the other slug helpers:

```python
def _phase_year_from_slug(slug: str) -> tuple[int, int]:
    """Return (phase_id, year) from a GT race slug like race/giro-d-italia/2026/stage-4."""
    import re
    m = re.match(r"^race/([a-z0-9-]+)/(\d{4})", slug)
    if not m:
        return (4, 2026)
    name, year = m.group(1), int(m.group(2))
    phase_map = {"giro-d-italia": 4, "tour-de-france": 6, "vuelta-a-espana": 8}
    return (phase_map.get(name, 4), year)
```

Finally, in the per-rider XP loop, replace `xp = raw_points * (1 + bonus)` with:

```python
is_gt = _is_gt_slug(race_slug)
role_mult = 1.0
if is_gt and (team_id, rider_id) in gt_squad_members:
    role = gt_roles.get((team_id, rider_id), "domestique")
    is_itt = bool(entry.get("is_itt", False))
    role_mult = _role_multiplier(role, race_slug, is_itt)
xp = raw_points * role_mult * (1 + bonus)
```

Also extend the race_results select at Step 1 to include `is_itt`:

```python
history = supabase.table("race_results").select(
    "rider_id, race_slug, pcs_points, race_date, is_itt"
).in_("race_slug", race_slugs).gt("pcs_points", 0).execute()
```
(and in the fallback by-date branch).

Inside the `rider_race_points.setdefault(...)` store, forward `is_itt` too:

```python
rider_race_points.setdefault(h["rider_id"], []).append({
    "race_slug": h["race_slug"],
    "pcs_points": h["pcs_points"],
    "race_date": h.get("race_date"),
    "is_itt": h.get("is_itt", False),
})
```

- [ ] **Step 4: Run tests (pass)**

Run: `cd services/pcs-sync && pytest tests/test_scoring_gt.py -v`
Expected: 3 PASS.

- [ ] **Step 5: Commit**

```bash
git add services/pcs-sync/scoring.py services/pcs-sync/tests/test_scoring_gt.py services/pcs-sync/tests/helpers.py
git commit -m "scoring: apply GT role multipliers (×1.5/×2 per role + scope)"
```

---

### Task 9: Python test + impl — daily classification bonus

**Files:**
- Modify: `services/pcs-sync/scoring.py`
- Modify: `services/pcs-sync/tests/test_scoring_gt.py`

- [ ] **Step 1: Add failing test**

Append to `tests/test_scoring_gt.py`:

```python
async def test_gc_leader_gets_gc_classif_bonus_with_match_multiplier():
    """Rank 3 GC → bonus (11-3)=8, rider is gc_leader → ×1.5 → 12."""
    import scoring
    importlib.reload(scoring)
    sb = _base_mocks(
        role="gc_leader",
        classif_rows=[
            {"rider_id": RIDER_ID, "classification_type": "gc",     "rank": 3},
            {"rider_id": RIDER_ID, "classification_type": "points", "rank": 7},  # no bonus (>5)
            {"rider_id": RIDER_ID, "classification_type": "kom",    "rank": 4},  # no bonus (>3)
        ],
    )
    await scoring.calculate_daily_scores(sb, race_slugs=[GIRO_SLUG])
    p = sb._last_upsert_payload("rider_xp_daily")
    # 100 × 1.5 (role) = 150 PCS, + classif bonus 8 × 1.5 (match) = 12
    assert p["xp_gained"] == 162.0


async def test_domestique_gets_raw_classif_bonus_when_ranked():
    """Rank 5 GC → bonus 6, role domestique → no match × → 6."""
    import scoring
    importlib.reload(scoring)
    sb = _base_mocks(
        role="domestique",
        classif_rows=[{"rider_id": RIDER_ID, "classification_type": "gc", "rank": 5}],
    )
    await scoring.calculate_daily_scores(sb, race_slugs=[GIRO_SLUG])
    p = sb._last_upsert_payload("rider_xp_daily")
    assert p["xp_gained"] == 106.0  # 100 + 6


async def test_idempotent_rerun_same_classif():
    """Running twice with same inputs must not double-count."""
    import scoring
    importlib.reload(scoring)
    sb = _base_mocks(role="gc_leader",
                     classif_rows=[{"rider_id": RIDER_ID, "classification_type": "gc", "rank": 1}])
    await scoring.calculate_daily_scores(sb, race_slugs=[GIRO_SLUG])
    first = sb._last_upsert_payload("rider_xp_daily")["xp_gained"]

    sb2 = _base_mocks(role="gc_leader",
                      classif_rows=[{"rider_id": RIDER_ID, "classification_type": "gc", "rank": 1}])
    # Previous rider_xp_daily NOW contains the first run — simulate
    sb2.set_prev_rider_xp_daily([{"team_id": TEAM_ID, "xp_gained": first}])
    await scoring.calculate_daily_scores(sb2, race_slugs=[GIRO_SLUG])
    # Team xp delta on second run should be 0
    assert sb2.team_xp_delta(TEAM_ID) == 0
```

(If `make_supabase` helper does not yet expose `set_prev_rider_xp_daily` and `team_xp_delta`, extend it in `helpers.py` in the same commit.)

- [ ] **Step 2: Run tests (fail)**

Run: `cd services/pcs-sync && pytest tests/test_scoring_gt.py -v -k classif`
Expected: FAIL.

- [ ] **Step 3: Implement**

Add to `scoring.py` module top:

```python
CLASSIF_TOP = {"gc": 10, "points": 5, "kom": 3}
CLASSIF_ROLE_MATCH = {"gc_leader": "gc", "sprinter": "points", "climber": "kom"}

def _classif_bonus(classif_rows: list[dict], role: str) -> float:
    """Sum of (top-N rank bonus, ×1.5 if role matches classification)."""
    total = 0.0
    for row in classif_rows:
        ctype = row.get("classification_type")
        rank  = row.get("rank")
        top   = CLASSIF_TOP.get(ctype)
        if top is None or rank is None or rank < 1 or rank > top:
            continue
        base = (top + 1) - int(rank)  # rank 1 = top (10/5/3), rank top = 1
        match_mult = 1.5 if CLASSIF_ROLE_MATCH.get(role) == ctype else 1.0
        total += base * match_mult
    return total
```

Then pre-fetch classif rows per (race_slug, rider_id) before the per-rider loop (scope: only gt_slugs):

```python
classif_by_rider: dict[tuple[str, str], list[dict]] = {}  # (race_slug, rider_id) → list
if gt_slugs:
    classif_resp = supabase.table("gt_daily_classifications").select(
        "race_slug, rider_id, classification_type, rank"
    ).in_("race_slug", gt_slugs).execute()
    for row in (classif_resp.data or []):
        classif_by_rider.setdefault((row["race_slug"], row["rider_id"]), []).append(row)
```

Finally, inside the per-rider XP loop, replace the single `xp = raw_points * role_mult * (1 + bonus)` line with:

```python
is_gt = _is_gt_slug(race_slug)
role = gt_roles.get((team_id, rider_id), "domestique") if is_gt else "domestique"
role_mult = 1.0
classif_pts = 0.0
if is_gt and (team_id, rider_id) in gt_squad_members:
    is_itt = bool(entry.get("is_itt", False))
    role_mult = _role_multiplier(role, race_slug, is_itt)
    classif_pts = _classif_bonus(
        classif_by_rider.get((race_slug, rider_id), []),
        role,
    )
xp = raw_points * role_mult * (1 + bonus) + classif_pts
```

- [ ] **Step 4: Run tests (pass)**

Run: `cd services/pcs-sync && pytest tests/test_scoring_gt.py -v`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add services/pcs-sync/scoring.py services/pcs-sync/tests/test_scoring_gt.py services/pcs-sync/tests/helpers.py
git commit -m "scoring: add daily classif bonus (top 10 GC / top 5 pts / top 3 KOM, ×1.5 role match)"
```

---

### Task 10: Server actions — `ensureGtSquad`, `assignRole`, `clearRole`, `getSquadWithRoles`

**Files:**
- Create: `apps/web/app/(game)/league/[leagueId]/team/gt/actions.ts`
- Create: `apps/web/app/(game)/league/[leagueId]/team/gt/actions.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// apps/web/app/(game)/league/[leagueId]/team/gt/actions.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const hoisted = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: hoisted.createClient,
}));

import { assignRole, ensureGtSquad } from "./actions";

const TEAM_ID = "11111111-1111-4111-8111-111111111111";
const RIDER_ID = "22222222-2222-4222-8222-222222222222";

function buildSupabase(overrides: Record<string, unknown> = {}) {
  const state: Record<string, unknown> = {
    getUserResp: { data: { user: { id: "u-1" } }, error: null },
    team: { id: TEAM_ID, user_id: "u-1" },
    squad: [{ rider_id: RIDER_ID }],
    role: { role: "domestique" },
    inserted: null as unknown,
    ...overrides,
  };
  const client = {
    auth: { getUser: vi.fn().mockResolvedValue(state.getUserResp) },
    from: vi.fn((table: string) => {
      if (table === "teams") {
        return {
          select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: state.team, error: null }) }) }),
        };
      }
      if (table === "gt_squad") {
        return {
          select: () => ({ eq: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: state.squad, error: null }) }) }) }),
        };
      }
      if (table === "gt_role_assignments") {
        return {
          insert: vi.fn((row: unknown) => { state.inserted = row; return Promise.resolve({ data: null, error: null }); }),
          select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ order: () => ({ limit: () => Promise.resolve({ data: [state.role], error: null }) }) }) }) }) }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    }),
  };
  hoisted.createClient.mockResolvedValue(client);
  return { client, state };
}

beforeEach(() => { hoisted.createClient.mockReset(); });

describe("assignRole", () => {
  it("rejects an unknown role", async () => {
    buildSupabase();
    await expect(
      assignRole({ teamId: TEAM_ID, riderId: RIDER_ID, role: "not-a-role" as never, phaseId: 4, year: 2026 })
    ).rejects.toThrow(/role/i);
  });

  it("rejects riders not in the squad", async () => {
    buildSupabase({ squad: [] });
    await expect(
      assignRole({ teamId: TEAM_ID, riderId: RIDER_ID, role: "gc_leader", phaseId: 4, year: 2026 })
    ).rejects.toThrow(/squad/i);
  });

  it("rejects non-owner writes", async () => {
    buildSupabase({ team: { id: TEAM_ID, user_id: "someone-else" } });
    await expect(
      assignRole({ teamId: TEAM_ID, riderId: RIDER_ID, role: "gc_leader", phaseId: 4, year: 2026 })
    ).rejects.toThrow(/owner|auth/i);
  });

  it("inserts a role row on the happy path", async () => {
    const { state } = buildSupabase();
    await assignRole({ teamId: TEAM_ID, riderId: RIDER_ID, role: "gc_leader", phaseId: 4, year: 2026 });
    expect(state.inserted).toMatchObject({
      team_id: TEAM_ID, rider_id: RIDER_ID, phase_id: 4, year: 2026, role: "gc_leader",
    });
  });
});

describe("ensureGtSquad", () => {
  it("is idempotent when squad rows already exist", async () => {
    buildSupabase();  // non-empty squad
    const res = await ensureGtSquad({ teamId: TEAM_ID, phaseId: 4, year: 2026 });
    expect(res.inserted).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests (fail)**

Run: `pnpm --filter web test apps/web/app/\(game\)/league/\[leagueId\]/team/gt/actions.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement actions**

```ts
// apps/web/app/(game)/league/[leagueId]/team/gt/actions.ts
"use server";

import { z } from "zod/v4";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const ROLES = ["gc_leader", "sprinter", "climber", "tt_specialist", "stage_hunter", "domestique"] as const;
export type GtRole = (typeof ROLES)[number];

const RoleSchema = z.enum(ROLES);
const UUID = z.string().uuid();
const PhaseId = z.union([z.literal(4), z.literal(6), z.literal(8)]);

async function requireOwner(teamId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: team, error } = await supabase
    .from("teams")
    .select("id, user_id, league_id")
    .eq("id", teamId)
    .single();
  if (error || !team) throw new Error("Team not found");
  if (team.user_id !== user.id) throw new Error("Not team owner");
  return { supabase, team };
}

export async function ensureGtSquad({
  teamId, phaseId, year,
}: { teamId: string; phaseId: 4 | 6 | 8; year: number }) {
  UUID.parse(teamId); PhaseId.parse(phaseId);
  const { supabase } = await requireOwner(teamId);

  const { data: existing } = await supabase
    .from("gt_squad").select("rider_id")
    .eq("team_id", teamId).eq("phase_id", phaseId).eq("year", year);
  if (existing && existing.length > 0) return { inserted: 0 };

  const { data: contracts } = await supabase
    .from("contracts")
    .select("rider_id, riders:rider_id(pcs_points_1yr)")
    .eq("team_id", teamId)
    .eq("status", "active");

  const active = (contracts ?? [])
    .filter((c) => c.rider_id)
    .map((c) => ({
      rider_id: c.rider_id as string,
      pts: Number((Array.isArray(c.riders) ? c.riders[0] : c.riders)?.pcs_points_1yr ?? 0),
    }))
    .sort((a, b) => b.pts - a.pts)
    .slice(0, 8);

  if (active.length === 0) return { inserted: 0 };

  const squadRows = active.map((r) => ({ team_id: teamId, phase_id: phaseId, year, rider_id: r.rider_id }));
  await supabase.from("gt_squad").insert(squadRows);

  const roleRows = active.map((r) => ({
    team_id: teamId, phase_id: phaseId, year, rider_id: r.rider_id, role: "domestique",
  }));
  await supabase.from("gt_role_assignments").insert(roleRows);

  return { inserted: active.length };
}

export async function assignRole({
  teamId, riderId, role, phaseId, year,
}: { teamId: string; riderId: string; role: GtRole; phaseId: 4 | 6 | 8; year: number }) {
  UUID.parse(teamId); UUID.parse(riderId); RoleSchema.parse(role); PhaseId.parse(phaseId);
  const { supabase } = await requireOwner(teamId);

  // Rider must be in the squad
  const { data: squad } = await supabase
    .from("gt_squad").select("rider_id")
    .eq("team_id", teamId).eq("phase_id", phaseId).eq("year", year);
  const ids = (squad ?? []).map((r) => r.rider_id);
  if (!ids.includes(riderId)) throw new Error("Rider not in squad");

  // Swap semantic: if another rider holds `role` and it's a max-1 specialist, demote them.
  if (role !== "domestique") {
    const cap = role === "stage_hunter" ? 2 : 1;
    const latestPerRider = await _latestRolesMap(supabase, teamId, phaseId, year);
    const holders = [...latestPerRider.entries()].filter(([rid, r]) => r === role && rid !== riderId).map(([rid]) => rid);
    if (holders.length >= cap) {
      // Demote oldest holder to domestique
      const demoteId = holders[0];
      await supabase.from("gt_role_assignments").insert({
        team_id: teamId, rider_id: demoteId, phase_id: phaseId, year, role: "domestique",
      });
    }
  }

  await supabase.from("gt_role_assignments").insert({
    team_id: teamId, rider_id: riderId, phase_id: phaseId, year, role,
  });

  revalidatePath(`/league/[leagueId]/team/gt`, "page");
  return { ok: true };
}

export async function clearRole(input: { teamId: string; riderId: string; phaseId: 4 | 6 | 8; year: number }) {
  return assignRole({ ...input, role: "domestique" });
}

async function _latestRolesMap(supabase: Awaited<ReturnType<typeof createClient>>, teamId: string, phaseId: number, year: number) {
  const { data } = await supabase
    .from("gt_role_assignments")
    .select("rider_id, role, applied_at")
    .eq("team_id", teamId).eq("phase_id", phaseId).eq("year", year)
    .order("applied_at", { ascending: false });
  const map = new Map<string, string>();
  for (const row of data ?? []) {
    if (!map.has(row.rider_id)) map.set(row.rider_id, row.role);
  }
  return map;
}

export async function getSquadWithRoles({
  teamId, phaseId, year,
}: { teamId: string; phaseId: 4 | 6 | 8; year: number }) {
  UUID.parse(teamId); PhaseId.parse(phaseId);
  const supabase = await createClient();

  const { data: squad } = await supabase
    .from("gt_squad")
    .select("rider_id, riders:rider_id(id, full_name, nationality, real_team, pcs_rank, photo_url)")
    .eq("team_id", teamId).eq("phase_id", phaseId).eq("year", year);

  const roles = await _latestRolesMap(supabase, teamId, phaseId, year);

  // XP cumulated for this phase (race_slug prefix filter)
  const slugPrefix =
    phaseId === 4 ? "race/giro-d-italia/" :
    phaseId === 6 ? "race/tour-de-france/" : "race/vuelta-a-espana/";
  const { data: xpRows } = await supabase
    .from("rider_xp_daily")
    .select("rider_id, xp_gained, race_slug")
    .eq("team_id", teamId)
    .like("race_slug", `${slugPrefix}${year}%`);
  const xpMap = new Map<string, number>();
  for (const r of xpRows ?? []) {
    xpMap.set(r.rider_id, (xpMap.get(r.rider_id) ?? 0) + Number(r.xp_gained ?? 0));
  }

  return (squad ?? []).map((s) => {
    const rider = Array.isArray(s.riders) ? s.riders[0] : s.riders;
    return {
      riderId: s.rider_id,
      role: (roles.get(s.rider_id) as GtRole) ?? "domestique",
      xp: Math.round(xpMap.get(s.rider_id) ?? 0),
      rider,
    };
  });
}
```

- [ ] **Step 4: Run tests (pass)**

Run: `pnpm --filter web test apps/web/app/\(game\)/league/\[leagueId\]/team/gt/actions.test.ts`
Expected: 4 PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(game\)/league/\[leagueId\]/team/gt/actions.ts \
        apps/web/app/\(game\)/league/\[leagueId\]/team/gt/actions.test.ts
git commit -m "actions: add GT squad + role assignment server actions (ensureGtSquad, assignRole)"
```

---

### Task 11: `RoleAssignSheet` component

**Files:**
- Create: `apps/web/components/role-assign-sheet.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { assignRole, type GtRole } from "@/app/(game)/league/[leagueId]/team/gt/actions";

interface SquadRider {
  riderId: string;
  role: GtRole;
  rider: { id: string; full_name: string; photo_url?: string | null; real_team?: string | null };
}

interface Props {
  open: boolean;
  onClose: () => void;
  role: Exclude<GtRole, "domestique">;
  roleLabel: string;   // "GC Leader"
  maxPerRole: 1 | 2;
  squad: SquadRider[];
  teamId: string;
  phaseId: 4 | 6 | 8;
  year: number;
  onApplied: () => void;
}

export function RoleAssignSheet({
  open, onClose, role, roleLabel, maxPerRole, squad, teamId, phaseId, year, onApplied,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  if (!open) return null;

  const subtitle = maxPerRole === 1
    ? "Only 1 rider for this role. Selecting a rider with another role will swap roles."
    : "Up to 2 riders. Selecting a rider with another role will swap roles.";

  const handleApply = () => {
    if (!selectedId) return;
    setErr(null);
    start(async () => {
      try {
        await assignRole({ teamId, riderId: selectedId, role, phaseId, year });
        onApplied();
        onClose();
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : "Failed to assign role");
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full lg:max-w-md bg-[var(--bg-surface)] rounded-t-[var(--radius-lg)] lg:rounded-[var(--radius-lg)] p-4 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-2">
          <div>
            <h2 className="text-[length:var(--type-section)] font-semibold text-[var(--text-high)]">Assign {roleLabel}</h2>
            <p className="text-[length:var(--type-caption)] text-[var(--text-low)] mt-1">{subtitle}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="shrink-0 text-[var(--text-low)] hover:text-[var(--text-high)]">
            <X size={20} />
          </button>
        </div>

        <ul className="flex flex-col gap-1 my-3">
          {squad.map((s) => {
            const selected = selectedId === s.riderId;
            return (
              <li key={s.riderId}>
                <button
                  type="button"
                  onClick={() => setSelectedId(s.riderId)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-[var(--radius-md)] border transition-colors ${
                    selected
                      ? "border-[var(--accent-default)] bg-[var(--accent-default)]/10"
                      : "border-transparent hover:bg-[var(--bg-surface-hover)]"
                  }`}
                >
                  <Avatar className="h-9 w-9">
                    {s.rider.photo_url && <AvatarImage src={s.rider.photo_url} alt={s.rider.full_name} referrerPolicy="no-referrer" />}
                    <AvatarFallback>{s.rider.full_name.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-1 flex-col text-left min-w-0">
                    <span className="text-[length:var(--type-body)] font-medium text-[var(--text-high)] truncate">
                      {s.rider.full_name}
                    </span>
                    <span className="text-[length:var(--type-caption)] text-[var(--text-low)] truncate">
                      {s.rider.real_team ?? ""}
                    </span>
                  </div>
                  <span className="shrink-0 text-[length:var(--type-label)] uppercase tracking-wide text-[var(--text-low)]">
                    {labelFor(s.role)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {err && <p className="text-[length:var(--type-caption)] text-[var(--color-danger)] my-2">{err}</p>}

        <div className="flex flex-col-reverse lg:flex-row lg:justify-end gap-2 mt-4">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-[length:var(--type-body)] font-medium text-[var(--text-mid)] hover:text-[var(--text-high)]">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={!selectedId || pending}
            className="px-4 py-2 rounded-[var(--radius-md)] bg-[var(--accent-default)] text-[#041a20] font-semibold disabled:opacity-50"
          >
            {pending ? "Saving..." : "Attribute new role"}
          </button>
        </div>
      </div>
    </div>
  );
}

function labelFor(role: GtRole): string {
  switch (role) {
    case "gc_leader":     return "GC Leader";
    case "sprinter":      return "Sprinter";
    case "climber":       return "Climber";
    case "tt_specialist": return "TT Specialist";
    case "stage_hunter":  return "Stage Hunter";
    default:              return "Domestique";
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter web typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/role-assign-sheet.tsx
git commit -m "ui: add RoleAssignSheet (mobile bottom sheet + desktop modal)"
```

---

### Task 12: Extend `SponsorBonusCard` with `gtGoalsPreview` slot + new `GtGoalsPreview` component

**Files:**
- Modify: `apps/web/components/sponsor-bonus-card.tsx`
- Create: `apps/web/components/gt-goals-preview.tsx`

- [ ] **Step 1: Create the preview component**

```tsx
// apps/web/components/gt-goals-preview.tsx
import { Tag } from "@/components/pill";
import { formatBudget } from "@/lib/sponsors";
import type { GtGoal } from "@/lib/gt-goals";

export function GtGoalsPreview({ goals }: { goals: GtGoal[] }) {
  if (!goals.length) return null;
  return (
    <div className="mt-3 pt-3 border-t border-[var(--border-default)]">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">
          GT Goals
        </span>
        <Tag variant="default">Preview (V1b)</Tag>
      </div>
      <ul className="flex flex-col gap-1">
        {goals.map((g) => (
          <li key={g.label} className="flex items-baseline justify-between py-1">
            <span className="text-[length:var(--type-caption)] text-[var(--text-mid)]">{g.label}</span>
            <span className="font-[family-name:var(--font-geist-mono)] text-[length:var(--type-caption)] text-[var(--text-low)] tabular-nums">
              +{formatBudget(g.reward)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Extend `SponsorBonusCard` props**

Edit `apps/web/components/sponsor-bonus-card.tsx`, add to `SponsorBonusCard` props:

```ts
export function SponsorBonusCard({
  sponsor,
  expanded,
  onToggle,
  gtGoalsPreview,
}: {
  sponsor: SponsorRow;
  expanded: boolean;
  onToggle: () => void;
  gtGoalsPreview?: React.ReactNode;
}) {
```

Inside the `{expanded && ( ... )}` block, append after the `<BaseBonusContent/>` / `<PrestigeBonusContent/>`:

```tsx
{gtGoalsPreview}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter web typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/sponsor-bonus-card.tsx apps/web/components/gt-goals-preview.tsx
git commit -m "ui: add gtGoalsPreview slot to SponsorBonusCard + GtGoalsPreview component"
```

---

### Task 13: GT Team page — SSR + inactive state

**Files:**
- Create: `apps/web/app/(game)/league/[leagueId]/team/gt/page.tsx`

- [ ] **Step 1: Write the page (server component)**

```tsx
// apps/web/app/(game)/league/[leagueId]/team/gt/page.tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentGTPhase, getNextGTPhase, GT_FULL_NAME, GT_SHORT_NAME, type GtPhaseId } from "@/lib/gt-phases";
import { ensureGtSquad, getSquadWithRoles } from "./actions";
import { GtTeamClient } from "./gt-team-client";
import { getGoalsForSponsor } from "@/lib/gt-goals";

export default async function GtTeamPage({
  params,
}: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: team } = await supabase
    .from("teams").select("id").eq("league_id", leagueId).eq("user_id", user.id).single();
  if (!team) redirect(`/league/${leagueId}`);

  const currentGT = getCurrentGTPhase();

  // Inactive: next-GT preview
  if (!currentGT) {
    const next = getNextGTPhase();
    return <InactiveView next={next} />;
  }

  const phaseId = currentGT.id as GtPhaseId;
  const year = new Date().getFullYear();
  await ensureGtSquad({ teamId: team.id, phaseId, year });

  const squad = await getSquadWithRoles({ teamId: team.id, phaseId, year });

  const { data: sponsorRow } = await supabase
    .from("team_sponsors")
    .select("sponsors:sponsor_id(*)")
    .eq("team_id", team.id)
    .single();
  const sponsor = Array.isArray(sponsorRow?.sponsors) ? sponsorRow?.sponsors[0] : sponsorRow?.sponsors;
  const goals = sponsor ? getGoalsForSponsor(sponsor.slug) : [];

  return (
    <GtTeamClient
      teamId={team.id}
      phaseId={phaseId}
      year={year}
      gtFullName={GT_FULL_NAME[phaseId]}
      gtShortName={GT_SHORT_NAME[phaseId]}
      squad={squad}
      sponsor={sponsor}
      goals={goals}
    />
  );
}

function InactiveView({ next }: { next: ReturnType<typeof getNextGTPhase> }) {
  if (!next) {
    return (
      <div className="p-8 text-center">
        <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">No upcoming Grand Tour this season.</p>
      </div>
    );
  }
  const year = new Date().getFullYear();
  const start = new Date(year, next.startMonth - 1, next.startDay);
  const days = Math.max(0, Math.ceil((start.getTime() - Date.now()) / 86_400_000));
  const short = GT_SHORT_NAME[next.id as GtPhaseId];

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 px-4 text-center">
      <span className="text-[length:var(--type-label)] uppercase tracking-wide text-[var(--text-low)]">
        NEXT GRAND TOUR
      </span>
      <h1 className="text-[length:var(--type-page-title)] font-bold text-[var(--text-high)]">
        {GT_FULL_NAME[next.id as GtPhaseId]}
      </h1>
      <p className="text-[length:var(--type-caption)] text-[var(--text-mid)]">
        Starts {start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} · in {days} days
      </p>
      <p className="text-[length:var(--type-caption)] text-[var(--text-ghost)] max-w-sm">
        The GT squad unlocks automatically when the {short} phase begins.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter web typecheck`
Expected: PASS (or fails on missing `GtTeamClient` — next task).

- [ ] **Step 3: Commit (defer until client exists)**

Defer commit until Task 14 adds the client component.

---

### Task 14: GT Team page — active-state client component

**Files:**
- Create: `apps/web/app/(game)/league/[leagueId]/team/gt/gt-team-client.tsx`

- [ ] **Step 1: Write the client component**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RiderCard } from "@/components/rider-card";
import { SponsorBonusCard } from "@/components/sponsor-bonus-card";
import { GtGoalsPreview } from "@/components/gt-goals-preview";
import { RoleAssignSheet } from "@/components/role-assign-sheet";
import type { GtRole } from "./actions";
import type { GtGoal } from "@/lib/gt-goals";
import type { SponsorRow } from "@/lib/sponsors";
import { countryCodeToFlag } from "@/lib/format";

interface SquadEntry {
  riderId: string;
  role: GtRole;
  xp: number;
  rider: { id: string; full_name: string; nationality?: string; real_team?: string; pcs_rank?: number; photo_url?: string | null };
}

const ROLE_ORDER: Array<{ role: Exclude<GtRole, "domestique"> | "domestique"; label: string; max: number | null; desc: string }> = [
  { role: "gc_leader",     label: "GC Leader",     max: 1, desc: "×1.5 on all PCS points + daily top 10 GC classif bonus." },
  { role: "sprinter",      label: "Sprinter",      max: 1, desc: "×1.5 on all PCS points + daily top 5 points classif bonus." },
  { role: "climber",       label: "Climber",       max: 1, desc: "×1.5 on all PCS points + daily top 3 KOM classif bonus." },
  { role: "tt_specialist", label: "TT Specialist", max: 1, desc: "×2 on ITT stage PCS points only." },
  { role: "stage_hunter",  label: "Stage Hunter",  max: 2, desc: "×1.5 on stage PCS points only (max 2 riders)." },
  { role: "domestique",    label: "Domestiques",   max: null, desc: "No bonus multiplier. Contribute base PCS points only." },
];

interface Props {
  teamId: string;
  phaseId: 4 | 6 | 8;
  year: number;
  gtFullName: string;
  gtShortName: string;
  squad: SquadEntry[];
  sponsor?: SponsorRow | null;
  goals: GtGoal[];
}

export function GtTeamClient({ teamId, phaseId, year, gtShortName, squad, sponsor, goals }: Props) {
  const router = useRouter();
  const [sponsorOpen, setSponsorOpen] = useState(false);
  const [sheetRole, setSheetRole] = useState<Exclude<GtRole, "domestique"> | null>(null);

  const byRole = (r: GtRole) => squad.filter((s) => s.role === r);

  return (
    <div className="flex flex-col gap-6 px-4 pt-4 pb-24">
      {/* Section 1 — Sponsors Goals */}
      <section>
        <h2 className="text-[length:var(--type-section)] font-semibold text-[var(--text-high)] mb-3">Sponsors Goals</h2>
        {sponsor ? (
          <SponsorBonusCard
            sponsor={sponsor}
            expanded={sponsorOpen}
            onToggle={() => setSponsorOpen((v) => !v)}
            gtGoalsPreview={<GtGoalsPreview goals={goals} />}
          />
        ) : (
          <p className="text-[length:var(--type-caption)] text-[var(--text-low)]">No sponsor assigned.</p>
        )}
      </section>

      {/* Section 2 — Team Composition */}
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-[length:var(--type-section)] font-semibold text-[var(--text-high)]">
            Team Composition for {gtShortName}
          </h2>
          <p className="text-[length:var(--type-caption)] text-[var(--text-low)]">
            Change a role before 11:00 CET to apply today.
          </p>
        </div>

        {ROLE_ORDER.map((block) => {
          const riders = byRole(block.role);
          const cap = block.max;
          const showOpenSlot = block.role !== "domestique" && cap != null && riders.length < cap;
          const headerCount = cap != null ? `${riders.length} / ${cap}` : `${riders.length}`;
          const isAssignable = block.role !== "domestique";

          return (
            <div key={block.role} className="flex flex-col">
              <button
                type="button"
                onClick={() => isAssignable && setSheetRole(block.role as Exclude<GtRole, "domestique">)}
                className="flex items-center justify-between py-1 text-left"
                disabled={!isAssignable}
              >
                <span className="text-[length:var(--type-label)] uppercase tracking-wide font-semibold text-[var(--text-mid)]">
                  {block.label.toUpperCase()}
                </span>
                <span className="text-[length:var(--type-label)] text-[var(--text-low)]">{headerCount}</span>
              </button>
              <p className="text-[length:var(--type-micro)] text-[var(--text-low)] mb-2">{block.desc}</p>

              {riders.map((r) => (
                <RiderCard
                  key={r.riderId}
                  rider={{
                    id: r.riderId,
                    name: r.rider.full_name,
                    team_name: r.rider.real_team ?? undefined,
                    pcs_rank: r.rider.pcs_rank,
                    nationality_flag: r.rider.nationality ? countryCodeToFlag(r.rider.nationality) : undefined,
                    photo_url: r.rider.photo_url ?? null,
                  }}
                  xp={r.xp}
                  onNavigate={isAssignable ? () => setSheetRole(block.role as Exclude<GtRole, "domestique">) : undefined}
                />
              ))}

              {showOpenSlot && (
                <RiderCard
                  rider={{ id: `open-${block.role}`, name: "" }}
                  isOpenSlot
                  href={undefined}
                  onNavigate={() => setSheetRole(block.role as Exclude<GtRole, "domestique">)}
                />
              )}
            </div>
          );
        })}
      </section>

      {sheetRole && (
        <RoleAssignSheet
          open={!!sheetRole}
          onClose={() => setSheetRole(null)}
          role={sheetRole}
          roleLabel={ROLE_ORDER.find((r) => r.role === sheetRole)!.label}
          maxPerRole={(ROLE_ORDER.find((r) => r.role === sheetRole)!.max ?? 1) as 1 | 2}
          squad={squad.map((s) => ({ riderId: s.riderId, role: s.role, rider: s.rider }))}
          teamId={teamId}
          phaseId={phaseId}
          year={year}
          onApplied={() => router.refresh()}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter web typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(game\)/league/\[leagueId\]/team/gt/page.tsx \
        apps/web/app/\(game\)/league/\[leagueId\]/team/gt/gt-team-client.tsx
git commit -m "ui: add GT Team page (inactive + active states)"
```

---

### Task 15: Team layout — switch sub-tabs to `My Team` + dynamic GT label

**Files:**
- Modify: `apps/web/app/(game)/league/[leagueId]/team/layout.tsx`

- [ ] **Step 1: Rewrite layout**

```tsx
"use client";

import { usePathname, useParams } from "next/navigation";
import { SubTabs } from "@/components/sub-tabs";
import { getGTSubTabLabel } from "@/lib/gt-phases";

export default function TeamLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const params = useParams<{ leagueId: string }>();
  const leagueId = params.leagueId;

  // Strategies gets its own page-level hide (unchanged access from My Team card).
  const hideTabs = pathname.includes("/strategies");

  const gtLabel = getGTSubTabLabel(); // "Giro Team" / "Tour Team" / "Vuelta Team" / "GT Team"

  return (
    <>
      {!hideTabs && (
        <SubTabs
          tabs={[
            { label: "My Team", href: `/league/${leagueId}/team` },
            { label: gtLabel,   href: `/league/${leagueId}/team/gt` },
          ]}
        />
      )}
      {children}
    </>
  );
}
```

- [ ] **Step 2: Typecheck + visual smoke**

Run: `pnpm --filter web typecheck`
Expected: PASS.

Run: `pnpm --filter web dev`, visit `http://localhost:3000/league/<id>/team` — see 2 sub-tabs (`My Team` and either `GT Team` or today's GT label). Click the GT sub-tab → lands on `/team/gt` showing the inactive view (unless we're inside a GT phase).

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(game\)/league/\[leagueId\]/team/layout.tsx
git commit -m "nav: Team sub-tabs reduce to My Team + dynamic GT label"
```

---

### Task 16: Migrate `/team/market` → `/auction/market` (copy, rewire imports, do NOT delete yet)

**Files:**
- Create: `apps/web/app/(game)/league/[leagueId]/auction/layout.tsx`
- Create: `apps/web/app/(game)/league/[leagueId]/auction/page.tsx` (copy of `/team/auctions/page.tsx`)
- Create: `apps/web/app/(game)/league/[leagueId]/auction/market/page.tsx`
- Create: `apps/web/app/(game)/league/[leagueId]/auction/market/market-client.tsx`
- Create: `apps/web/app/(game)/league/[leagueId]/auction/market/actions.ts`
- Create: `apps/web/app/(game)/league/[leagueId]/auction/history/page.tsx`
- Create: `apps/web/app/(game)/league/[leagueId]/auction/rounds/page.tsx`
- Create: `apps/web/app/(game)/league/[leagueId]/auction/[auctionId]/page.tsx`

- [ ] **Step 1: Create `auction/layout.tsx` with sub-tabs**

```tsx
"use client";

import { usePathname, useParams } from "next/navigation";
import { SubTabs } from "@/components/sub-tabs";

export default function AuctionLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const params = useParams<{ leagueId: string }>();
  const leagueId = params.leagueId;

  // Hide sub-tabs on detail routes (auction detail, rounds deep-link)
  const hide = /\/auction\/(rounds|[0-9a-f-]{36})(\/|$)/.test(pathname);

  return (
    <>
      {!hide && (
        <SubTabs
          tabs={[
            { label: "Auctions", href: `/league/${leagueId}/auction` },
            { label: "Market",   href: `/league/${leagueId}/auction/market` },
            { label: "History",  href: `/league/${leagueId}/auction/history` },
          ]}
        />
      )}
      {children}
    </>
  );
}
```

- [ ] **Step 2: Copy each legacy page file into the new location**

Use `cp` to duplicate (not move — that would break imports temporarily):

```bash
cp apps/web/app/\(game\)/league/\[leagueId\]/team/auctions/page.tsx \
   apps/web/app/\(game\)/league/\[leagueId\]/auction/page.tsx

cp apps/web/app/\(game\)/league/\[leagueId\]/team/auctions/auctions-client.tsx \
   apps/web/app/\(game\)/league/\[leagueId\]/auction/auctions-client.tsx

cp apps/web/app/\(game\)/league/\[leagueId\]/team/auctions/actions.ts \
   apps/web/app/\(game\)/league/\[leagueId\]/auction/actions.ts

mkdir -p apps/web/app/\(game\)/league/\[leagueId\]/auction/market
cp apps/web/app/\(game\)/league/\[leagueId\]/team/market/page.tsx \
   apps/web/app/\(game\)/league/\[leagueId\]/auction/market/page.tsx
cp apps/web/app/\(game\)/league/\[leagueId\]/team/market/market-client.tsx \
   apps/web/app/\(game\)/league/\[leagueId\]/auction/market/market-client.tsx
cp apps/web/app/\(game\)/league/\[leagueId\]/team/market/actions.ts \
   apps/web/app/\(game\)/league/\[leagueId\]/auction/market/actions.ts
cp apps/web/app/\(game\)/league/\[leagueId\]/team/market/actions.test.ts \
   apps/web/app/\(game\)/league/\[leagueId\]/auction/market/actions.test.ts

mkdir -p apps/web/app/\(game\)/league/\[leagueId\]/auction/rounds
cp apps/web/app/\(game\)/league/\[leagueId\]/team/auctions/rounds/page.tsx \
   apps/web/app/\(game\)/league/\[leagueId\]/auction/rounds/page.tsx

mkdir -p apps/web/app/\(game\)/league/\[leagueId\]/auction/\[auctionId\]
cp -r apps/web/app/\(game\)/league/\[leagueId\]/auctions/\[auctionId\]/. \
      apps/web/app/\(game\)/league/\[leagueId\]/auction/\[auctionId\]/
```

- [ ] **Step 3: Build a new History page (absorbs old history button content)**

Inspect `apps/web/app/(game)/league/[leagueId]/team/market/history/page.tsx` (existing). Copy to new location:

```bash
mkdir -p apps/web/app/\(game\)/league/\[leagueId\]/auction/history
cp apps/web/app/\(game\)/league/\[leagueId\]/team/market/history/page.tsx \
   apps/web/app/\(game\)/league/\[leagueId\]/auction/history/page.tsx
```

Then remove any top-right `History` buttons on the new `/auction/page.tsx` and `/auction/market/page.tsx` (they're no longer needed — History lives on its own sub-tab).

- [ ] **Step 4: Rewire internal hrefs**

Grep for old paths and replace with new ones:

```bash
grep -rn "/team/market" apps/web/app apps/web/components | grep -v "node_modules" | grep -v ".next"
grep -rn "/team/auctions" apps/web/app apps/web/components | grep -v "node_modules" | grep -v ".next"
grep -rn "/league/\${leagueId}/auctions" apps/web/app apps/web/components | grep -v "node_modules" | grep -v ".next"
```

For each hit:
- `/team/market` → `/auction/market`
- `/team/auctions/rounds` → `/auction/rounds`
- `/team/auctions` → `/auction`
- `/league/${leagueId}/auctions/` → `/league/${leagueId}/auction/`

Key known callsites (per spec §12):
- `apps/web/app/(game)/league/[leagueId]/team/page.tsx` — open-slot links
- `apps/web/components/sidebar.tsx`
- `apps/web/components/bottom-nav.tsx`
- Test files inside `auction/market/actions.test.ts` referring to old relative imports — verify imports still resolve (same file, same imports).

Use `sed -i '' 's|/team/market|/auction/market|g'` on each offending file, then verify.

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter web typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/\(game\)/league/\[leagueId\]/auction/ \
        apps/web/app/\(game\)/league/\[leagueId\]/team/page.tsx
git commit -m "nav: introduce /auction top-level tab with 3 sub-tabs (duplicate routes)"
```

---

### Task 17: Delete legacy route dirs + add 301 redirects

**Files:**
- Delete: `apps/web/app/(game)/league/[leagueId]/team/auctions/`
- Delete: `apps/web/app/(game)/league/[leagueId]/team/market/`
- Delete: `apps/web/app/(game)/league/[leagueId]/auctions/`
- Modify: `apps/web/next.config.ts`

- [ ] **Step 1: Delete legacy dirs**

```bash
rm -rf apps/web/app/\(game\)/league/\[leagueId\]/team/auctions/
rm -rf apps/web/app/\(game\)/league/\[leagueId\]/team/market/
rm -rf apps/web/app/\(game\)/league/\[leagueId\]/auctions/
```

- [ ] **Step 2: Add redirects to `next.config.ts`**

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/league/:leagueId/team/market/:path*",   destination: "/league/:leagueId/auction/market/:path*",   permanent: true },
      { source: "/league/:leagueId/team/auctions/rounds", destination: "/league/:leagueId/auction/rounds",          permanent: true },
      { source: "/league/:leagueId/team/auctions/:path*", destination: "/league/:leagueId/auction/:path*",          permanent: true },
      { source: "/league/:leagueId/team/auctions",        destination: "/league/:leagueId/auction",                 permanent: true },
      { source: "/league/:leagueId/auctions/:path*",      destination: "/league/:leagueId/auction/:path*",          permanent: true },
      { source: "/league/:leagueId/auctions",             destination: "/league/:leagueId/auction",                 permanent: true },
    ];
  },
};

export default nextConfig;
```

- [ ] **Step 3: Verify redirects in dev**

Run: `pnpm --filter web dev` → open `http://localhost:3000/league/<id>/team/market` → expect browser URL to become `/league/<id>/auction/market`.

- [ ] **Step 4: Run full test suite**

Run: `pnpm --filter web typecheck && pnpm --filter web test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/next.config.ts \
        apps/web/app/\(game\)/league/\[leagueId\]/team/auctions/ \
        apps/web/app/\(game\)/league/\[leagueId\]/team/market/ \
        apps/web/app/\(game\)/league/\[leagueId\]/auctions/
git commit -m "nav: remove legacy auction/market routes + 301 redirects"
```

---

### Task 18: Update `bottom-nav.tsx` — 5 tabs with new `Auction`

**Files:**
- Modify: `apps/web/components/bottom-nav.tsx`

- [ ] **Step 1: Rewrite tab list**

Replace the `tabs` constant and `NavTab` union:

```tsx
import { House, Gavel, Users, BadgeEuro, Trophy, type LucideIcon } from "lucide-react";

interface NavTab {
  key: "home" | "auction" | "team" | "budget" | "ranking";
  label: string;
  icon: LucideIcon;
  href: (leagueId: string) => string;
}

const tabs: NavTab[] = [
  { key: "home",    label: "Home",    icon: House,    href: (id) => `/league/${id}` },
  { key: "auction", label: "Auction", icon: Gavel,    href: (id) => `/league/${id}/auction` },
  { key: "team",    label: "Team",    icon: Users,    href: (id) => `/league/${id}/team` },
  { key: "budget",  label: "Budget",  icon: BadgeEuro, href: (id) => `/league/${id}/budget` },
  { key: "ranking", label: "Ranking", icon: Trophy,   href: (id) => `/league/${id}/ranking` },
];

interface BottomNavProps {
  leagueId: string;
  unlockedTabs: ("home" | "auction" | "team" | "budget" | "ranking")[];
}
```

- [ ] **Step 2: Update every callsite that passes `unlockedTabs`**

Grep for `unlockedTabs=` and extend each array to include `"auction"` when the user can bid (same gating as the pre-existing auctions route; if no gating existed before, always include):

```bash
grep -rn "unlockedTabs=" apps/web/app apps/web/components | grep -v node_modules | grep -v .next
```

For each file (commonly `league-shell.tsx`), add `"auction"` to the unlocked set.

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter web typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/bottom-nav.tsx apps/web/app/\(game\)/league/\[leagueId\]/league-shell.tsx
git commit -m "nav: add 5th Auction tab to bottom nav (Gavel icon)"
```

---

### Task 19: Update `sidebar.tsx` — add Auction + restructure Team sub-items

**Files:**
- Modify: `apps/web/components/sidebar.tsx`

- [ ] **Step 1: Rewrite `navItems`**

Replace the current `navItems` declaration:

```tsx
import { House, Gavel, Users, BadgeEuro, Trophy, Settings, CircleHelp, ChevronDown, Check, type LucideIcon } from "lucide-react";
import { getGTSubTabLabel } from "@/lib/gt-phases";

interface NavItem {
  key: "home" | "auction" | "team" | "budget" | "ranking";
  label: string;
  icon: LucideIcon;
  href: (leagueId: string) => string;
  subItems?: { label: string; href: (leagueId: string) => string }[];
}

function buildNavItems(): NavItem[] {
  const gtLabel = getGTSubTabLabel();
  return [
    { key: "home", label: "Home", icon: House, href: (id) => `/league/${id}` },
    {
      key: "auction", label: "Auction", icon: Gavel,
      href: (id) => `/league/${id}/auction`,
      subItems: [
        { label: "Auctions", href: (id) => `/league/${id}/auction` },
        { label: "Market",   href: (id) => `/league/${id}/auction/market` },
        { label: "History",  href: (id) => `/league/${id}/auction/history` },
      ],
    },
    {
      key: "team", label: "Team", icon: Users,
      href: (id) => `/league/${id}/team`,
      subItems: [
        { label: "My Team", href: (id) => `/league/${id}/team` },
        { label: gtLabel,   href: (id) => `/league/${id}/team/gt` },
      ],
    },
    { key: "budget",  label: "Budget",  icon: BadgeEuro, href: (id) => `/league/${id}/budget` },
    { key: "ranking", label: "Ranking", icon: Trophy,    href: (id) => `/league/${id}/ranking` },
  ];
}
```

Replace usage: inside `Sidebar` function body, `const navItems = buildNavItems();` at the top.

Update the `unlockedTabs` prop type similarly: `("home" | "auction" | "team" | "budget" | "ranking")[]`.

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter web typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/sidebar.tsx
git commit -m "nav: add Auction + GT sub-items to desktop sidebar"
```

---

### Task 20: Home banner during GT phases

**Files:**
- Create: `apps/web/components/home-gt-banner.tsx`
- Modify: `apps/web/app/(game)/league/[leagueId]/page.tsx` (active-league branch)

- [ ] **Step 1: Create banner component**

```tsx
// apps/web/components/home-gt-banner.tsx
"use client";

import Link from "next/link";
import { getGTBannerText } from "@/lib/gt-phases";

export function HomeGtBanner({ leagueId }: { leagueId: string }) {
  const text = getGTBannerText();
  if (!text) return null;
  return (
    <Link
      href={`/league/${leagueId}/team/gt`}
      className="block mx-4 mt-3 mb-1 rounded-[var(--radius-lg)] border border-[var(--accent-default)]/40 bg-[var(--accent-default)]/10 px-4 py-3 text-[length:var(--type-body)] font-medium text-[var(--text-high)] hover:bg-[var(--accent-default)]/20 transition-colors"
    >
      {text}
    </Link>
  );
}
```

- [ ] **Step 2: Render above `HomeFeed`**

Edit `apps/web/app/(game)/league/[leagueId]/page.tsx` — in the active-league branch (after the `isPending` block ends, before `<HomeFeed />`), insert:

```tsx
import { HomeGtBanner } from "@/components/home-gt-banner";

// ...inside JSX, above <HomeFeed />:
<HomeGtBanner leagueId={leagueId} />
```

- [ ] **Step 3: Typecheck + visual smoke**

Run: `pnpm --filter web dev`. The banner renders only if today is inside phases 4/6/8 — temporarily swap `getGTBannerText()` with a forced string in `home-gt-banner.tsx` to visually verify, then revert.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/home-gt-banner.tsx \
        apps/web/app/\(game\)/league/\[leagueId\]/page.tsx
git commit -m "ui: add Home banner during GT phases linking to /team/gt"
```

---

### Task 21: CSS fix — round cards padding on `/auction/rounds`

**Files:**
- Modify: `apps/web/app/(game)/league/[leagueId]/auction/rounds/page.tsx` (or the client component it renders)

- [ ] **Step 1: Locate the full-width block**

Run: `grep -rn "rounds" apps/web/app/(game)/league/[leagueId]/auction/rounds/`
Find the outermost container that renders the round blocks (`round-blocks.tsx` component or a local wrapper).

- [ ] **Step 2: Add horizontal padding**

Wrap the round-cards list (or augment its top-level className) with `px-4` so cards respect page margins. Typical edit — change:

```tsx
<div className="flex flex-col gap-3">
```
to:
```tsx
<div className="flex flex-col gap-3 px-4">
```

If the parent already has `px-4`, confirm the list children don't use `-mx-4` to escape it. Remove any negative margins on the round cards.

- [ ] **Step 3: Visual check**

Run `pnpm --filter web dev`, open `/league/<id>/auction/rounds` on mobile width. Round cards must have visible left/right gutters matching the rest of the page.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(game\)/league/\[leagueId\]/auction/rounds/
git commit -m "fix: round cards respect horizontal page padding"
```

---

### Task 22: Hand-curate `GT_GOALS` (user checkpoint)

**Files:**
- Modify: `apps/web/lib/gt-goals.ts`

- [ ] **Step 1: Open `docs/plans/2026-04-20-grand-tour-mode-backlog.md`** and locate the 42-entry goal idea bank.

- [ ] **Step 2: Replace the placeholder rows in `GT_GOALS`**

For each of the 13 sponsors, pick 4 goals from the idea bank that match the sponsor's orientation (`gc` / `one_day` / `neutral`) and nationality. Update each entry's `label` and `reward` in `apps/web/lib/gt-goals.ts`.

- [ ] **Step 3: Manual smoke**

Run `pnpm --filter web dev`, open `/league/<id>/team/gt` during a GT phase, expand the Sponsor card — verify the 4 curated goals render correctly.

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/gt-goals.ts
git commit -m "content: hand-curate GT goals per sponsor from backlog idea bank"
```

---

### Task 23: End-to-end smoke test (Giro dress rehearsal)

**Files:** none modified

- [ ] **Step 1: Apply migration to a dev Supabase project**

Run: `supabase db push`
Expected: migration applied cleanly.

- [ ] **Step 2: Run pipeline B on a real Giro stage**

Run: `cd services/pcs-sync && python3 run_pipeline.py post-race --race "race/giro-d-italia/2026/stage-4"`
Expected:
- `race_results` rows imported with `is_itt=false` (stage 4 is not an ITT)
- `gt_daily_classifications`: `gc=50, points=20, kom=10` printed
- `rider_xp_daily`: XP computed with role multipliers for squad members

- [ ] **Step 3: Open the GT Team page**

Run: `pnpm --filter web dev`, navigate to `http://localhost:3000/league/<id>/team/gt` with the device date set inside the Giro phase (or bump `getCurrentPhase()` by mocking date). Expect:
- Squad auto-populated with top 8 riders by `pcs_points_1yr`
- All rows default to Domestique
- Tap a role block → sheet opens → pick a rider → role swap applied → page refreshes

- [ ] **Step 4: Verify scoring round-trip**

Run pipeline B twice with the same stage. Check via psql:
```bash
psql "$DATABASE_URL" -c "select team_id, sum(xp_gained) from rider_xp_daily where race_slug like 'race/giro-d-italia/2026%' group by 1;"
```
Same sum after second run → idempotency confirmed.

- [ ] **Step 5: Acceptance checklist**

- [ ] Nav shows 5 tabs on mobile + desktop
- [ ] Team sub-tabs show `My Team` and `Giro Team` (or `GT Team` outside a GT phase)
- [ ] Old URLs (`/team/market`, `/team/auctions`, `/auctions`) 301 to the new `/auction/...` paths
- [ ] GT Team inactive state renders a countdown for the next GT
- [ ] GT Team active state shows Sponsors Goals card + 6 role blocks
- [ ] Assigning a role with a max=1 kick-out demotes the previous holder
- [ ] Round cards on `/auction/rounds` have visible horizontal gutters
- [ ] `pnpm test` and `pytest` both green
- [ ] Home banner shows during GT phase only

- [ ] **Step 6: Final commit + PR**

```bash
git add docs/superpowers/plans/2026-04-22-grand-tour-mode-v1a.md
git commit -m "docs: Grand Tour Mode V1a implementation plan (executed)"
gh pr create --title "Grand Tour Mode V1a" --body "$(cat <<'EOF'
## Summary
- New `/team/gt` page with squad + role assignment (V1a tactical layer)
- New top-level `Auction` tab absorbing `/team/auctions`, `/team/market`, `/auctions`
- Scoring: role multipliers (×1.5 / ×2 / ITT-only) + daily classif bonus (top 10/5/3)
- 3 new tables: `gt_squad`, `gt_role_assignments`, `gt_daily_classifications`
- `race_results.is_itt` flag populated at stage import

## Test plan
- [ ] `pnpm test` green
- [ ] `pytest` green in `services/pcs-sync`
- [ ] Giro stage 4 dress rehearsal: PCS scrape → XP computed → page renders
- [ ] All legacy URLs redirect correctly
- [ ] 11:00 CET cutoff respected (role changes apply to next day's stage)
EOF
)"
```

---

## Self-Review Notes

Spec sections and their covering task:

| Spec section | Task |
|---|---|
| §3 Navigation restructuring (5 top-level tabs) | Tasks 16, 17, 18, 19 |
| §3.2 Auction tab (absorbs 3 routes) | Task 16, 17 |
| §3.3 Team sub-tabs (My Team + GT) | Task 15 |
| §3.4 Round cards padding bug | Task 21 |
| §4.1 Page states | Task 13 |
| §4.2 Inactive state layout | Task 13 |
| §4.3 Active state — 2 sections | Task 14 |
| §4.3.1 GT Goals preview | Tasks 4, 12, 22 |
| §4.4 Role-assignment sheet | Task 11 |
| §4.5 11:00 CET cutoff | Task 8 (scoring reads latest `applied_at <= stage_date 11:00 CET`) |
| §4.6 Home banner | Task 20 |
| §5 Squad & role rules | Tasks 10 (actions), 14 (UI) |
| §6.1-6.3 New tables | Task 1 |
| §6.4 gt-goals seed | Task 4 |
| §6.5 race_results.is_itt | Tasks 1 (schema), 5 (populate) |
| §7 Scoring model | Tasks 8, 9 |
| §8.1 Pipeline B classif fetch | Tasks 6, 7 |
| §9 Server actions | Task 10 |
| §10 Pre-GT lazy auto-fill | Task 10 (ensureGtSquad) |
| §11 Component reuse | Tasks 12 (sponsor card slot), 14 (RiderCard) |
| §12 Routing map | Tasks 16, 17 |
| §13 Bottom nav / sidebar | Tasks 18, 19 |
| §14 Copy | Tasks 13, 14, 11, 20 |
| §15 Tests | Tasks 5, 6, 8, 9, 10 |
| §16 Migration & backfill | Task 1 |
| §17 Open questions | Resolved: icon `Gavel` (Task 18), classif retry = log-and-skip (Task 6), short GT names (Task 3 `GT_SHORT_NAME`) |

**Type consistency check:** `GtRole`, `GT_PHASE_IDS`, `GtPhaseId`, `GtGoal`, `getCurrentGTPhase`, `getGTSubTabLabel`, `getGTBannerText`, `ensureGtSquad`, `assignRole`, `clearRole`, `getSquadWithRoles` — names used consistently across Tasks 3, 4, 10, 11, 13, 14, 15, 18, 19, 20.

**Placeholder scan:** No `TBD`, `implement later`, or `Similar to Task N` placeholders. All code blocks are complete. `GT_GOALS` entries in Task 4 are deliberately labeled as placeholder content to be finalized by Task 22 (user checkpoint).

**Known risk:** The vitest mock helper for `_last_upsert_payload` (Task 8 Step 1) depends on `helpers.py` / `conftest.py` internals not fully inspected during plan-writing. If the existing `make_supabase` does not expose upsert payloads, the fastest fix is to add a small `sb.upserts: dict[str, list[dict]]` accumulator inside `make_supabase` and a `sb._last_upsert_payload(table)` convenience — do this within the same test-writing step rather than creating a separate task.
