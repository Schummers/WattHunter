# Grand Tour Mode V1a — Design Spec

**Date:** 2026-04-22
**Status:** Validated (brainstorming complete, ready for implementation plan)
**Target event:** Giro d'Italia 2026 (2026-05-08 → 2026-05-31)
**Related docs:**
- `docs/plans/2026-04-20-grand-tour-mode-backlog.md` — idea backlog, V1b direction, V1c+ parking
- `docs/watthunter-design-system-v3.md` — typography & component tokens

---

## 1. Scope & Intent

Add a **tactical layer** on top of the existing season-long systems (roster, strategies, sponsor) that activates only during Grand Tour phases. V1a delivers the core mechanic: a squad of up to 8 riders, optional specialist roles, per-role XP multipliers, and a new daily classification bonus scored off the GT's live GC / points / KOM standings.

V1a **does not** include sponsor GT goals with cash rewards — those live in V1b (post-Giro). V1a only previews the goals in read-only mode inside the new GT Team page.

## 2. Non-goals (explicit)

- Sponsor base-bonus rework (deferred to V1b).
- 4-5 fixed sponsor GT goals with completion/cash rewards (V1b).
- Substitutes / rest-day swaps (V1c+).
- Consumable powers, nemesis, probability data integration (V1c+).
- T5 / T6 sponsor rework (V1c+).
- Historical drill-down per past GT (not wanted — cleaned up each phase transition).
- Stage-profile-based distinction (flat / hilly / mountain). Role attribution is role-based, not profile-based. Only exception: ITT stages need an explicit flag for the TT Specialist bonus.

## 3. Navigation Restructuring

**Current top-level nav** (mobile bottom + desktop sidebar): `Home · Team · Budget · Ranking`.
**New top-level nav**: `Home · Auction · Team · Budget · Ranking` (5 tabs, fixed).

### 3.1 `Home` tab — unchanged in structure
One addition during an active GT phase: a persistent banner at the top of the Home page linking to the GT Team sub-tab.

**Banner copy (English):** `🏁 Giro in progress — manage your squad →`
Uses the current GT phase's label (`Giro d'Italia` / `Tour de France` / `La Vuelta`).

### 3.2 `Auction` tab — NEW top-level tab
Absorbs three existing routes that were scattered:
- `/league/[id]/auctions` (top-level auction calendar)
- `/league/[id]/team/auctions` (your bids & round validation)
- `/league/[id]/team/market` (browse riders)

**Sub-tabs (in order):**
1. **Auctions** (default) — current content of `/team/auctions`: your bids, round validation, upcoming rounds, commissioner edit-round-date. This becomes `/league/[id]/auction`.
2. **Market** — current content of `/team/market`. Becomes `/league/[id]/auction/market`.
3. **History** — current auction history (currently buried behind a top-right button on Market and Auctions pages). Becomes `/league/[id]/auction/history`.

**Side effects:**
- The top-right "History" button is **removed** from both Market and Auctions pages (content migrates to the History sub-tab).
- The commissioner's "Edit round date" button takes the now-freed top-right slot on the Auctions sub-tab, aligned with the "Rounds" section heading.
- No dedicated calendar sub-tab; upcoming rounds already surface the next 3 phase dates inside Auctions.
- Old routes `/league/[id]/auctions`, `/league/[id]/team/auctions`, `/league/[id]/team/market` are removed (hard redirects to the new sub-tab paths if any stale links exist).

### 3.3 `Team` tab — restructured sub-tabs
**Current Team sub-tabs:** `My Team · Market · Auctions` (with Strategies accessible from a rail).
**New Team sub-tabs:** `My Team · [GT-dependent label]`.

- **`My Team` (default)** — mostly unchanged content: roster + level card at top + strategies card. Since Strategies is no longer accessible from the Team sub-tab layer, the existing access from the My Team page (card / link to `/league/[id]/team/strategies`) remains as-is.
- **GT sub-tab label — dynamic:**
  - During Giro phase (phase `id=4`): label = `Giro Team`.
  - During Tour de France phase (phase `id=6`): label = `Tour Team`.
  - During Vuelta phase (phase `id=8`): label = `Vuelta Team`.
  - Outside those 3 phases: label = `GT Team` (inactive state).

### 3.4 Bug fix piggy-backed
On the current `/team/auctions/rounds` page, round cards touch the left and right edges of the screen. Fix during V1a implementation: cards must respect page horizontal padding and adjust dynamically. Trivial CSS touch-up.

## 4. GT Team Page — UI Spec

Route: `/league/[id]/team/gt` (single page; the sub-tab label is computed, but the path is stable).

### 4.1 Page states

Driven by the existing `AUCTION_PHASES` in `apps/web/lib/phases.ts`. Three phases qualify as GT phases: `Giro d'Italia` (id 4), `Tour de France` (id 6), `La Vuelta` (id 8).

| State | Trigger | UI |
|---|---|---|
| **Inactive** | Current date is NOT inside a GT phase | Empty/locked view with next-GT hint |
| **Active** | Current date IS inside a GT phase | Full squad management UI |
| **Transition** (covered by auto-reset at phase boundary) | Phase ends → next phase begins | All squad + role assignments cleared on phase start |

Auto-transition on GT phase start:
- Creates a fresh squad = roster's top N riders by PCS points, where `N = min(8, roster_size)`.
- All squad riders default to role `Domestique`.
- Player is free to assign specialist roles anytime during the phase.

Auto-reset on GT phase end (next phase starts):
- Clears `gt_squad` entries for that team.
- Clears all role assignments.
- The GT Team sub-tab label reverts to `GT Team` (inactive state).

### 4.2 Inactive state — layout

Centered content, minimal.

```
[TOPBAR · TABS (My Team | GT Team)]
[page body]
   [label, --type-label, --text-low]
     NEXT GRAND TOUR
   [name, --type-page-title or custom large, --text-high]
     Giro d'Italia
   [when, --type-caption, --text-mid]
     Starts May 2 · in 10 days
   [hint, --type-caption, --text-ghost]
     The GT squad unlocks automatically when the Giro phase begins.
```

Countdown text computed from next GT phase's `startDay/startMonth`.

### 4.3 Active state — layout

Two sections, stacked vertically, using the **same row-based pattern as the current `/team` (My Team) page** — no card-style role containers.

#### Section 1: `Sponsors Goals`
- Section title: `--type-section` 16/600 (`Sponsors Goals`).
- Renders the existing `SponsorBonusCard` component (from `apps/web/components/sponsor-bonus-card.tsx`) in **read-only** mode.
  - Current sponsor's name, tier, nationality, monthly budget
  - Base-bonus lines (GC / Stage / One-Day / Monument)
  - **Appended block (V1a preview)**: title `GT Goals Preview (V1b)`, followed by the 4-5 goals hand-defined for this sponsor (see §4.3.1 below). No checkboxes, no rewards-earned state, no action to pick — pure visualization.
- Collapsible (tap the card to expand/collapse, same as the existing pattern on the Budget page).
- The goals data source is defined in §6.4.

##### 4.3.1 GT Goals Preview content (V1a)

**BLOCKING V1A PRE-IMPL**: the user must hand-curate the 4-5 goals per sponsor (8 sponsors total) from the backlog's 42-entry idea bank before implementation starts.

In V1a the goals list is hard-coded per sponsor in a seed file (`apps/web/lib/gt-goals.ts` — new file). Each entry:

```ts
{
  sponsorSlug: 'groupama',
  goals: [
    { label: 'Top 10 GC', reward: 30_000 },
    { label: 'Win 1 stage', reward: 25_000 },
    { label: 'Maglia rosa ≥ 3 days', reward: 40_000 },
    { label: '2 FR riders top 20 GC', reward: 50_000 },
  ],
}
```

In V1a: no evaluation logic, no cash reward on completion. Goals are purely displayed.
In V1b: goal evaluation + completion tracking + cash payout will be added.

The user will hand-curate the full goals list per sponsor from the 42-entry idea bank in the backlog before V1a ships.

#### Section 2: `Team Composition for [GT Name]`
- Section title: `--type-section` (`Team Composition for Giro`, dynamic).
- Subtitle directly under title: `--type-caption`, `--text-low` — static rule text: `Change a role before 11:00 CET to apply today.`
- Below: 6 role blocks, in the fixed order:
  1. `GC LEADER` — max 1
  2. `SPRINTER` — max 1
  3. `CLIMBER` — max 1
  4. `TT SPECIALIST` — max 1
  5. `STAGE HUNTER` — max 2
  6. `DOMESTIQUES` — no max, fills remaining squad

Each role block:
```
[role name row: --type-label, UPPERCASE + tracking, --text-mid]   [--type-label, --text-low]
   GC LEADER                                                       1 / 1
[description: smallest available type, --text-low]
   ×1.5 on all PCS points + daily top 10 GC classif bonus.
[rider rows — reuse RiderCard component, no card container, `after:` separators]
   [photo] R. Evenepoel   Soudal Quick-Step                        [xp] 127 XP
```

- **Rider rows reuse the existing `RiderCard` component**. No per-rider multiplier badge — the multiplier is already described in the role block's subtitle, so showing it on every row is redundant.
- `xp` prop shows the rider's cumulative XP earned during the current GT (computed from `rider_xp_daily` filtered by `race_slug LIKE 'race/giro-d-italia/2026%'`).
- Empty slots use the existing `RiderCard` `isOpenSlot` variant with text `Open slot` — tapping opens the assignment modal (desktop) or bottom sheet (mobile) — see §4.4.
- Role description uses `--type-micro` (already defined in the design system and used by the rider-card badge text).

Role bonus descriptions (final copy):

| Role | Description |
|---|---|
| GC Leader | ×1.5 on all PCS points + daily top 10 GC classif bonus. |
| Sprinter | ×1.5 on all PCS points + daily top 5 points classif bonus. |
| Climber | ×1.5 on all PCS points + daily top 3 KOM classif bonus. |
| TT Specialist | ×2 on ITT stage PCS points only. |
| Stage Hunter | ×1.5 on stage PCS points only (max 2 riders). |
| Domestiques | No bonus multiplier. Contribute base PCS points only. |

### 4.4 Role-assignment modal / bottom sheet

Triggered by tapping any role row or an Open slot.

**Structure:**
- Header: `Assign [ROLE NAME]` (e.g. `Assign Climber`).
- Close `×` button top-right (no swipe-to-dismiss — this is a web app, not native mobile).
- Subtitle: contextual rule.
  - If max=1: `Only 1 rider for this role. Selecting a rider with another role will swap roles.`
  - If max=2 (Stage Hunter): `Up to 2 riders. Selecting a rider with another role will swap roles.`
  - Domestique: not assignable from modal (auto-default for anyone not holding a specialist role) — no modal needed.
- List of all squad riders, each row showing: photo, name, current-role badge (UPPERCASE, `--type-label`).
- Tap a row → selected (cyan highlight).
- Actions at the bottom:
  - **Mobile (bottom sheet):** vertically stacked
    - Primary button full-width: `Attribute new role` (accent cyan, `bg-[var(--accent-default)]`, `text-[#041a20]`)
    - Ghost / tertiary button below: `Cancel`
  - **Desktop (centered modal):** side-by-side, right-aligned
    - Left: `Cancel` (ghost)
    - Right: `Attribute new role` (primary)
- On confirm:
  - If the tapped rider already holds another specialist role → swap: the newly-assigned role replaces the old one for this rider. The rider currently holding the target role (if any) is kicked back to Domestique.
  - If the tapped rider is a Domestique → the target role is assigned, kicking the previous holder to Domestique.

### 4.5 Cutoff behaviour

- Role changes are always persistable.
- At **11:00 Europe/Paris** each day, the role snapshot of each team is frozen for that day's stage scoring.
  - Changes before 11:00 → apply to that day's stage.
  - Changes after 11:00 → apply from the next stage onward.
- Implementation: scoring reads from `gt_role_assignments` rows whose `applied_at <= 11:00 CET` of the stage's date. See §6.3.
- No countdown UI in V1a (per user: the static rule text suffices).

### 4.6 Home banner (during GT phases only)
- Inserted at the top of `/league/[id]` (Lobby / Home feed).
- Copy: `🏁 [GT Name] in progress — manage your squad →`
- Click / tap → navigate to `/league/[id]/team/gt`.
- Hidden whenever `getCurrentPhase()` is NOT one of the 3 GT phases.

## 5. Squad & Role Rules (consolidated)

- **Squad size**: `min(8, active_contract_count)`. Counts only `contracts.status = 'active'` — notice/released contracts are excluded.
- **Auto-fill**: lazy, on first page load during a GT phase. Top-N active-contract riders by `riders.pcs_points_1yr` (highest first). All tagged `Domestique`. See §10.
- **Max per specialist role**: Leader 1, Sprinter 1, Climber 1, TT Specialist 1, Stage Hunter 2.
- **Domestique has no max** — fills remainder.
- **Specialist roles are optional**: a team can stay all-Domestiques and still participate (scoring at ×1).
- **Swap semantic**: assigning a rider to a specialist role removes their prior specialist role; the rider previously holding the target role goes back to Domestique. No two riders can hold the same specialist role simultaneously except for Stage Hunter.
- **Role editing window**: anytime during the GT phase. No 24-hour snapshot or other delay — the 11:00 CET cutoff per stage is the only time gate.

## 6. Data Model

### 6.1 New table — `gt_squad`
Tracks which roster riders are in the GT squad for a given team × GT phase.

```sql
CREATE TABLE public.gt_squad (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  phase_id    INT NOT NULL,       -- matches AUCTION_PHASES.id (4, 6, or 8)
  year        INT NOT NULL,       -- e.g. 2026
  rider_id    UUID NOT NULL REFERENCES public.riders(id) ON DELETE RESTRICT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(team_id, phase_id, year, rider_id)
);

CREATE INDEX idx_gt_squad_team_phase ON public.gt_squad(team_id, phase_id, year);
```

RLS: read = any league member; write = team owner only.

### 6.2 New table — `gt_role_assignments`
Tracks role assignments within a GT squad, with versioning for the 11:00 CET cutoff.

```sql
CREATE TABLE public.gt_role_assignments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  phase_id    INT NOT NULL,
  year        INT NOT NULL,
  rider_id    UUID NOT NULL REFERENCES public.riders(id) ON DELETE RESTRICT,
  role        TEXT NOT NULL CHECK (role IN ('gc_leader', 'sprinter', 'climber', 'tt_specialist', 'stage_hunter', 'domestique')),
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT now(),  -- timestamp of THIS assignment
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_gt_role_team_phase ON public.gt_role_assignments(team_id, phase_id, year, rider_id, applied_at DESC);
```

Design decisions:
- Append-only table → historical record of role changes (without showing it in UI).
- On scoring for stage `S` dated `D`, use the latest row per `(team_id, phase_id, year, rider_id)` where `applied_at <= D 11:00 Europe/Paris`.
- Rows auto-populated with `role='domestique'` at phase start for every `gt_squad` rider.

RLS: read = any league member; write = team owner only.

### 6.3 New table — `gt_daily_classifications`
Cached daily classification rank per rider per stage per classification type (GC / points / KOM). Used to score daily classification bonuses.

```sql
CREATE TABLE public.gt_daily_classifications (
  race_slug           TEXT NOT NULL,       -- 'race/giro-d-italia/2026/stage-4'
  stage               TEXT NOT NULL,       -- 'stage-4'
  rider_id            UUID NOT NULL REFERENCES public.riders(id) ON DELETE CASCADE,
  classification_type TEXT NOT NULL CHECK (classification_type IN ('gc', 'points', 'kom')),
  rank                INT NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (race_slug, rider_id, classification_type)
);

CREATE INDEX idx_gt_classif_rider ON public.gt_daily_classifications(rider_id, classification_type);
```

RLS: read = all; write = service_role only (pipeline).

### 6.4 New file — `apps/web/lib/gt-goals.ts`
Seed of the 4-5 hand-curated goals per sponsor (V1a: display-only).

```ts
export interface GtGoal {
  label: string;       // 'Top 10 GC'
  reward: number;      // in euros, for V1b display; not yet paid out in V1a
}

export interface GtGoalSet {
  sponsorSlug: string;
  goals: GtGoal[];
}

export const GT_GOALS: GtGoalSet[] = [
  // 8 sponsor entries, 4-5 goals each — hand-curated from the backlog idea bank
];
```

### 6.5 Augmented — `race_results`
Add a boolean flag to distinguish ITT stages for the TT Specialist multiplier.

```sql
ALTER TABLE public.race_results
  ADD COLUMN is_itt BOOLEAN NOT NULL DEFAULT false;
```

Populated at stage-import time by `sync_race.py` (heuristic: stage profile from `procyclingstats` Stage API is `ITT` or `TTT`). Backfill existing Giro stages manually via a one-off SQL update at migration time.

### 6.6 Unchanged
- `riders`, `contracts`, `teams`, `team_sponsors`, `sponsors` — no schema changes.
- `rider_xp_daily` — no schema changes. XP calculation is updated (see §7) to factor in role multipliers + classification bonuses.

## 7. Scoring Model (updates `scoring.py`)

Current logic (`services/pcs-sync/scoring.py`):
- For each contracted rider with a race result during the window, XP = `pcs_points * (1 + Σ strategy_bonuses)`.

### 7.1 New logic during GT phases

When computing XP for a stage of a GT race:

1. **Fetch role for rider** (via `gt_role_assignments` latest row where `applied_at <= stage_date 11:00 Europe/Paris`). Default to `domestique` if no row.
2. **Apply role multiplier on PCS points**:
   - `gc_leader` / `sprinter` / `climber` → PCS points × 1.5 (applies to ALL race results of this rider during the GT — stages AND final classifications).
   - `tt_specialist` → ×2 applied ONLY when `race_results.is_itt = true`. Otherwise ×1.
   - `stage_hunter` → ×1.5 applied only to stage results (`stage IS NOT NULL`). Final classifications → ×1.
   - `domestique` → ×1.
3. **Apply strategy bonus** (unchanged) on top of the role-multiplied PCS points: `final = role_multiplied_pcs * (1 + Σ strategy_bonuses)`.
4. **Add daily classification bonus** (NEW):
   - Fetch `gt_daily_classifications` rows for this stage's `race_slug`, this rider, all three classification types.
   - GC rank ≤ 10 → bonus points = `11 - rank` (so rank 1 = 10, rank 10 = 1).
   - Points classif rank ≤ 5 → bonus = `6 - rank`.
   - KOM rank ≤ 3 → bonus = `4 - rank`.
   - Multiply each bonus by 1.5 if the rider's role matches the classification (`gc_leader` for GC, `sprinter` for points, `climber` for KOM). Otherwise ×1.
   - Sum the three classif bonuses; add to the XP total above.

### 7.2 Logic gating
- Role multipliers and daily classif bonus apply ONLY for riders in a squad (`gt_squad` entry exists for this team × phase × year) AND for race results belonging to that GT (`race_slug LIKE 'race/giro-d-italia/2026%'` etc.).
- Outside of GTs, scoring is unchanged.

### 7.3 Idempotency
- Existing idempotency logic on `rider_xp_daily` upserts remains. Re-running scoring for a GT stage recomputes the delta; no double-counting.

## 8. Pipeline Changes

### 8.1 `Pipeline B` (post-race) extension
In `services/pcs-sync/sync_race.py`, after importing a stage's results (`import_race_results`):

1. If the stage belongs to a GT (`race_slug` matches one of the 3 GT slugs), additionally fetch the 3 daily classifications via the `procyclingstats` library:
   - `stage.gc()` → top 10 (we store top 50 for safety, but only top 10 used in scoring)
   - `stage.points()` → top 5 (store top 20)
   - `stage.kom()` → top 3 (store top 10)
2. Upsert into `gt_daily_classifications` keyed by `(race_slug, rider_id, classification_type)`.
3. Set `race_results.is_itt = true` if the stage profile is `ITT` or `TTT`.

Wrapped in try/except so a failure to fetch classifications doesn't block the main result import.

### 8.2 No new pipeline endpoint
No new CLI command; extension lives inside the existing `post-race` pipeline.

## 9. Server Actions (new file: `apps/web/app/(game)/league/[leagueId]/team/gt/actions.ts`)

- `assignRole(riderId, role)` — validates: rider in squad, role max not exceeded (unless it's a swap), role is a valid enum. Inserts a new `gt_role_assignments` row with `applied_at = now()`. Auth: team owner.
- `clearRole(riderId)` — inserts a `gt_role_assignments` row with `role='domestique'`.
- `getSquadWithRoles(teamId, phaseId, year)` — helper returning `{ rider, currentRole, xp }` for each squad member. Used by the page SSR.

## 10. Pre-GT Auto-fill — lazy init

**Chosen approach: on-demand lazy init.** No cron, no DB function.

First time a player loads the GT Team page during a GT phase, a server action `ensureGtSquad(teamId, phaseId, year)` checks if `gt_squad` has rows for `(team_id, phase_id, year)`. If not:
1. Fetch `contracts` with `status = 'active'` for this team, joined to `riders`, ordered by `riders.pcs_points_1yr DESC`.
2. Take the top `min(8, active_contract_count)` and insert into `gt_squad`.
3. For each inserted squad rider, insert a `gt_role_assignments` row with `role = 'domestique'` and `applied_at = now()`.

The action is idempotent: if `gt_squad` already has rows, it's a no-op. Runs inside the page's server component; guaranteed called before first render.

Notice-status contracts (riders being released) are NOT squad-eligible.

## 11. UI Component Reuse

| New concern | Existing component | Notes |
|---|---|---|
| Sub-tabs | `components/sub-tabs.tsx` | Add the new GT sub-tab to the Team layout. |
| Rider row | `components/rider-card.tsx` | Reused verbatim (incl. `isOpenSlot` variant). No per-row multiplier badge. |
| Sponsor card | `components/sponsor-bonus-card.tsx` | Reused in read-only mode; extended with a `gtGoalsPreview` prop. |
| Modal/bottom sheet | No shared component today | New component: `components/role-assign-sheet.tsx`. Mobile = slide-up bottom sheet; desktop = centered modal. Handled by a size-aware wrapper. |
| Level card (at top of My Team) | `components/team-level-card.tsx` | Unchanged — Strategies access card unchanged. |

## 12. Routing Map (new / changed)

- `/league/[id]/team/gt` — GT Team sub-tab (NEW).
- `/league/[id]/auction` — Auction tab root (NEW top-level). Default sub-tab: Auctions.
- `/league/[id]/auction/market` — Market sub-tab (migrated from `/team/market`).
- `/league/[id]/auction/history` — History sub-tab (NEW, absorbs content buried behind the current history button).
- `/league/[id]/team/auctions/*` — DELETED.
- `/league/[id]/team/market/*` — DELETED.
- `/league/[id]/auctions/*` — DELETED (move to `/auction`).

Handle with 301 redirects for any bookmarked URLs.

**Internal link audit**: any `href` or `RailLink` currently pointing to `/team/market`, `/team/auctions`, or `/auctions` must be rewritten. Known callsites:
- `apps/web/app/(game)/league/[leagueId]/team/page.tsx` — open-slot links to `/team/market` (update to `/auction/market`).
- `apps/web/components/sidebar.tsx` — `subItems` for Team (remove Market from Team's submenu).
- `apps/web/components/bottom-nav.tsx` — add Auction tab.
Implementation plan should run a grep audit before cutover.

## 13. Bottom Nav / Sidebar updates

- `components/bottom-nav.tsx`: add 5th tab `Auction` between Home and Team. Icon: `ShoppingCart` or `Gavel` (pick one — reco `Gavel`). Keep `unlockedTabs` gating pattern for progressive disclosure.
- `components/sidebar.tsx`: same addition. Sub-items for Auction expanded when active: Auctions / Market / History.
- Team sub-items when Team is active: `My Team` / `[GT label]`.
- Nothing else changes.

## 14. Content / Copy (English, final)

| Element | Copy |
|---|---|
| Inactive state, label line | `NEXT GRAND TOUR` |
| Inactive state, hint | `The GT squad unlocks automatically when the [GT Name] phase begins.` |
| Active state, section 1 title | `Sponsors Goals` |
| Active state, GT goals preview tag | `Preview (V1b)` |
| Active state, section 2 title | `Team Composition for [GT Short Name]` — e.g. `Team Composition for Giro` |
| Active state, cutoff subtitle | `Change a role before 11:00 CET to apply today.` |
| Empty slot copy | `Open slot` (uses existing component variant) |
| Modal header | `Assign [Role Name]` |
| Modal subtitle (max 1) | `Only 1 rider for this role. Selecting a rider with another role will swap roles.` |
| Modal subtitle (max 2) | `Up to 2 riders. Selecting a rider with another role will swap roles.` |
| Modal primary CTA | `Attribute new role` |
| Modal secondary CTA | `Cancel` |
| Home banner | `🏁 [GT Name] in progress — manage your squad →` |

## 15. Testing Plan

- Python unit tests in `services/pcs-sync/tests/test_scoring_gt.py`:
  - Role multiplier application per role (×1, ×1.5, ×2) with and without ITT flag.
  - Daily classification bonus calculation (top 10 GC, top 5 points, top 3 KOM) with and without role match.
  - Swap semantic (assigning role X to rider A who already has role Y → rider A = X, previous holder of X = domestique).
  - Idempotent re-runs don't double-count.
- Vitest unit tests for server actions in `apps/web/app/(game)/league/[leagueId]/team/gt/actions.test.ts`:
  - `assignRole` rejects non-squad riders, unknown roles.
  - `assignRole` enforces max per role (Leader 1, Stage Hunter 2, etc.).
  - Auth rejects non-owner writes.
- Integration: one manual Giro dress-rehearsal against real PCS data before May 8.

## 16. Migration & Rollout

- Single migration timestamp: `supabase/migrations/20260501000000_grand_tour_mode_v1a.sql`.
- Contents: `gt_squad`, `gt_role_assignments`, `gt_daily_classifications` tables + RLS + indexes + `race_results.is_itt` column addition.
- No backfill needed for `gt_squad`/`gt_role_assignments` (populated on Giro phase start via Option B lazy init).
- Backfill `race_results.is_itt` for existing ITT results of the 2026 season (Paris-Nice ITT if any, Tirreno-Adriatico, etc.) via a one-off SQL update in the migration.

## 17. Open Questions (to resolve during planning)

- **Icon for the new `Auction` tab** — `Gavel` vs `ShoppingCart` vs something else. Reco: `Gavel` (from Lucide).
- **Daily classif scrape** — inline with stage import (reuses the PCS session already open). Confirmed direction; minor: define retry on PCS classification fetch failure (defer or log-and-skip).
- **Short GT names in section titles** — "Team Composition for Giro" / "Tour" / "Vuelta" vs full "Giro d'Italia". Reco: short form (Giro / Tour / Vuelta) for breathing room in the UI.

---

## 18. Out of Scope (V1b / V1c+)

### V1b (post-Giro, pre-Tour)
- Sponsor base-bonus rework (T3/T4 flat bonuses, monument line kept for symmetry).
- 4-5 fixed sponsor GT goals with completion tracking + cash rewards on success.
- Goal completion evaluation pipeline.
- Optional: XP rewards on goal success.

### V1c+ (future)
- Substitutes (8+2 with rest-day swaps).
- Stage profile distinction (sprint / hilly / mountain).
- Consumable powers (3 per GT).
- Nemesis system.
- Probability data integration.
- T5 / T6 sponsor rework.
- Jersey-wearing time tracking (materialized view).
