# Classic League Mode — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a second league game-mode (`classic`) that reuses the existing auction/scoring engine but flattens the economy: every team is level 8, gets a fresh 1.5M budget each phase, drafts 8 exclusive riders, scores, and only the cumulative XP / GC ranking persists across phases.

**Architecture:** A single `leagues.mode` column branches behavior at ~4 backend points and a handful of UI components. We reuse phases, auctions/rounds, `place_bid`, scoring, GT squad/roles, and tactics. The per-phase economy reset is a NEW dedicated RPC (`classic_phase_reset`) called instead of `confirm_phase_setup` for classic leagues, keeping the manager path untouched. No new tables.

**Tech Stack:** Next.js 16 App Router + TypeScript strict, Supabase Postgres (SQL migrations + SECURITY DEFINER RPCs), Python 3.12 pipelines (`services/pcs-sync`), vitest (web), pytest (pipelines).

## Global Constraints

- Migrations only for DB changes: `supabase/migrations/<timestamp>_<desc>.sql`, then `supabase db push --linked`, then commit. NEVER mutate DB outside a migration. (CLAUDE.md Rule #2)
- RPCs are recreated wholesale: to change one, copy its latest full definition into a NEW migration and modify the copy. Never edit an applied migration.
- All user-facing app text in English. Code comments, variable names, commit messages in English. (CLAUDE.md Language rule)
- Money increment = 1000 €; rider prices display via `formatMoney` (`apps/web/lib/format.ts`).
- Classic budget constant = **1 500 000 €** (`CLASSIC_PHASE_BUDGET`). Squad size = **8** (existing role caps: gc_leader 1, sprinter 1, climber 1, tt_specialist 1, stage_hunter 2, domestique 2).
- Never expose service_role key to client. Web app uses anon key + RLS; privileged RPC calls use the existing `admin` server client.
- Conventional commits (`feat:`, `fix:`, `test:`, `chore:`).
- Design System first for any UI: read `docs/watthunter-design-system-v3.md`; use semantic tokens, never hardcode px/hex.

## Scoping note (MVP vs follow-on)

The 4 classic phases are Classics → Giro → Tour → Vuelta. In 2026, Classics and Giro are already past (today is 2026-06-25), so the first real classic league only plays **Tour + Vuelta**, which are both **GT phases**. Therefore:

- **MVP (Tasks 1-15):** classic mode for GT phases (roles + tactics). Fully covers Tour + Vuelta this season.
- **Follow-on (Task 16):** the Classics phase scoring path (one-day races, no roles). Not needed for the 2026 launch; included so the 4-phase model is complete.

## Locked decisions (from the design spec)

Spec: `docs/superpowers/specs/2026-06-25-classic-league-mode-design.md`.

- Single layer: the GT squad of 8 IS the roster. Drop "My Team" + "Budget" sub-tabs in classic. No bench → **Call the Bus tactic hidden** in classic.
- Everyone level 8 → full market, co-unlock auto-satisfied (no `place_bid` gating change beyond the slot cap).
- Cap exactly 8 contracts in classic (the L8 slot cap is 12 → branch to 8).
- No sponsors, no policies, no underdog (`underdog_eligible = false`).
- 3 rounds per auction (unchanged). Roster frozen during a phase (no release).
- Ranking Level/Treasury columns left as-is (render empty in classic).
- Achievements left as-is.

## File Structure

**New files:**
- `supabase/migrations/<ts>_leagues_mode_column.sql` — adds `leagues.mode`.
- `supabase/migrations/<ts>_classic_phase_reset_rpc.sql` — the per-phase economy reset RPC.
- `supabase/migrations/<ts>_place_bid_classic_cap.sql` — copy of latest `place_bid` + classic slot cap = 8.
- `apps/web/lib/league-mode.ts` — `LeagueMode` type, `CLASSIC_PHASE_BUDGET`, `CLASSIC_SQUAD_SIZE`, helpers.
- `apps/web/lib/classic-phases.ts` — the classic 4-phase calendar derived from `lib/phases.ts`.

**Modified files (each detailed in its task):**
- `apps/web/app/(auth)/league/create/actions.ts` — accept `mode`, classic team defaults.
- `apps/web/app/(auth)/league/create/*` UI — mode picker.
- `apps/web/app/(lobby)/lobby/[leagueId]/lobby-panels.tsx` — hide "Level & Pool" in classic.
- `apps/web/app/(game)/league/[leagueId]/auction/actions.ts` — call `classic_phase_reset` for classic; pass cap to validate/place flows.
- `apps/web/app/(game)/league/[leagueId]/team/layout.tsx` — sub-tabs by mode.
- `apps/web/app/(game)/league/[leagueId]/team/gt/gt-team-client.tsx` — hide Sponsors Goals in classic.
- `apps/web/components/team-tactics-section.tsx` — hide Call the Bus in classic.
- `apps/web/components/config-cards.tsx`, `apps/web/components/budget-summary.tsx` — auction UI by mode.
- `apps/web/components/bottom-nav.tsx`, `apps/web/components/sidebar.tsx` — hide Budget/My Team in classic.
- `services/pcs-sync/sponsor_bonus.py`, `services/pcs-sync/goal_evaluator.py` — skip classic leagues.

---

## Phase 0 — Mode foundation

### Task 1: Add `leagues.mode` column

**Files:**
- Create: `supabase/migrations/<ts>_leagues_mode_column.sql`

**Interfaces:**
- Produces: `leagues.mode text NOT NULL DEFAULT 'manager' CHECK (mode IN ('manager','classic'))`.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/<ts>_leagues_mode_column.sql` (use a timestamp later than the latest existing migration):

```sql
-- Classic League Mode: add a game-mode discriminator to leagues.
-- 'manager' = existing full-economy mode (default, no behavior change).
-- 'classic' = flattened mode (level 8, flat per-phase budget, 8-rider squad).
ALTER TABLE public.leagues
  ADD COLUMN mode text NOT NULL DEFAULT 'manager'
  CHECK (mode IN ('manager', 'classic'));

COMMENT ON COLUMN public.leagues.mode IS
  'Game mode: manager (full economy) or classic (flat budget, level 8, 8-rider squad).';
```

- [ ] **Step 2: Apply locally and verify**

Run: `supabase db reset` (local) then
`docker exec -i supabase_db_WattHunter psql -U postgres -d postgres -c "\d public.leagues" | grep mode`
Expected: shows `mode | text | not null | 'manager'::text` with the CHECK.

- [ ] **Step 3: Verify existing leagues default to manager**

Run: `docker exec -i supabase_db_WattHunter psql -U postgres -d postgres -c "SELECT count(*) FROM leagues WHERE mode <> 'manager';"`
Expected: `0`.

- [ ] **Step 4: Push to remote**

Run: `supabase db push --linked`
Expected: migration applied, no error.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(classic): add leagues.mode discriminator column"
```

---

### Task 2: League-mode constants and helpers (web)

**Files:**
- Create: `apps/web/lib/league-mode.ts`
- Test: `apps/web/lib/league-mode.test.ts`

**Interfaces:**
- Produces:
  - `type LeagueMode = 'manager' | 'classic'`
  - `const CLASSIC_PHASE_BUDGET = 1_500_000`
  - `const CLASSIC_SQUAD_SIZE = 8`
  - `function isClassic(mode: LeagueMode | null | undefined): boolean`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/lib/league-mode.test.ts
import { describe, it, expect } from "vitest";
import { isClassic, CLASSIC_PHASE_BUDGET, CLASSIC_SQUAD_SIZE } from "./league-mode";

describe("league-mode", () => {
  it("isClassic is true only for classic", () => {
    expect(isClassic("classic")).toBe(true);
    expect(isClassic("manager")).toBe(false);
    expect(isClassic(null)).toBe(false);
    expect(isClassic(undefined)).toBe(false);
  });
  it("exposes the classic constants", () => {
    expect(CLASSIC_PHASE_BUDGET).toBe(1_500_000);
    expect(CLASSIC_SQUAD_SIZE).toBe(8);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- league-mode`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
// apps/web/lib/league-mode.ts
export type LeagueMode = "manager" | "classic";

/** Flat per-phase budget granted to every classic-mode team. */
export const CLASSIC_PHASE_BUDGET = 1_500_000;

/** Number of riders a classic-mode team drafts per phase (= GT role caps sum). */
export const CLASSIC_SQUAD_SIZE = 8;

export function isClassic(mode: LeagueMode | null | undefined): boolean {
  return mode === "classic";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- league-mode`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/league-mode.ts apps/web/lib/league-mode.test.ts
git commit -m "feat(classic): add league-mode constants and isClassic helper"
```

---

## Phase 1 — Classic league creation

### Task 3: `createLeague` accepts mode and sets classic team defaults

**Files:**
- Modify: `apps/web/app/(auth)/league/create/actions.ts`
- Test: `apps/web/app/(auth)/league/create/actions.test.ts`

**Context to read first:** open `apps/web/app/(auth)/league/create/actions.ts`. It currently creates `leagues`, `teams`, `team_sponsors`, `league_members`, auto-assigns a sponsor by `starting_level` (L1→Lotto, L2→Astana, L3+→none), and sets `teams.starting_level`.

**Interfaces:**
- Consumes: `LeagueMode`, `CLASSIC_PHASE_BUDGET` from Task 2.
- Produces: `createLeague(input: { ...existing, mode?: LeagueMode })`. When `mode === 'classic'`: insert `leagues.mode='classic'`; create the commissioner team with `starting_level=8`, `treasury=CLASSIC_PHASE_BUDGET`, `underdog_eligible=false`, and **no** `team_sponsors` row. When `mode` omitted/`'manager'`: behavior unchanged.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/app/(auth)/league/create/actions.test.ts
import { describe, it, expect, vi } from "vitest";
// Use the project's existing Supabase mock pattern (vi.hoisted + mockSupabase).
// Assert: when called with mode:'classic', the leagues insert carries mode:'classic',
// the teams insert carries starting_level:8 and treasury:1_500_000 and underdog_eligible:false,
// and team_sponsors is NOT inserted.
import { classicTeamDefaults } from "./actions";

describe("classicTeamDefaults", () => {
  it("returns level 8, flat budget, underdog off, no sponsor", () => {
    expect(classicTeamDefaults()).toEqual({
      starting_level: 8,
      treasury: 1_500_000,
      underdog_eligible: false,
      assignSponsor: false,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- create/actions`
Expected: FAIL (`classicTeamDefaults` not exported).

- [ ] **Step 3: Implement**

Add to `apps/web/app/(auth)/league/create/actions.ts` an exported pure helper and branch the creation logic on it:

```ts
import { CLASSIC_PHASE_BUDGET, type LeagueMode } from "@/lib/league-mode";

/** Team seed values for a classic-mode league (pure, testable). */
export function classicTeamDefaults() {
  return {
    starting_level: 8,
    treasury: CLASSIC_PHASE_BUDGET,
    underdog_eligible: false,
    assignSponsor: false,
  } as const;
}
```

Then, in the create flow: accept `mode` (default `'manager'`) on the input schema; set `leagues.mode = mode`. When `mode === 'classic'`, build the team insert from `classicTeamDefaults()` and skip the `team_sponsors` insert. Leave the manager branch exactly as it is.

- [ ] **Step 4: Run tests**

Run: `pnpm --filter web test -- create/actions`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter web typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/\(auth\)/league/create/
git commit -m "feat(classic): seed classic-mode leagues with level 8 + flat budget, no sponsor"
```

---

### Task 4: Mode picker on the create form + hide "Level & Pool" in classic lobby

**Files:**
- Modify: create-league UI under `apps/web/app/(auth)/league/create/` (the form component that posts to `createLeague`).
- Modify: `apps/web/app/(lobby)/lobby/[leagueId]/lobby-panels.tsx`
- Test: `apps/web/app/(lobby)/lobby/[leagueId]/lobby-panels.test.tsx`

**Context to read first:** `docs/watthunter-design-system-v3.md` (segmented-control / Filter Chips pattern). `lobby-panels.tsx` renders tabs `Lobby | Level & Pool | Rules`.

**Interfaces:**
- Consumes: `isClassic` (Task 2), `leagues.mode` passed into lobby panels as a prop.
- Produces: create form sends `mode`; lobby hides "Level & Pool" tab when `isClassic(mode)`.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/app/(lobby)/lobby/[leagueId]/lobby-panels.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { LobbyPanels } from "./lobby-panels";

describe("LobbyPanels tabs by mode", () => {
  const base = { /* minimal required props; see component signature */ } as any;
  it("hides Level & Pool in classic mode", () => {
    render(<LobbyPanels {...base} mode="classic" />);
    expect(screen.queryByText(/Level & Pool/i)).toBeNull();
  });
  it("shows Level & Pool in manager mode", () => {
    render(<LobbyPanels {...base} mode="manager" />);
    expect(screen.getByText(/Level & Pool/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- lobby-panels`
Expected: FAIL (component does not accept `mode` / always renders the tab).

- [ ] **Step 3: Implement**

- Add a `mode: LeagueMode` prop to `LobbyPanels`; when `isClassic(mode)`, omit the "Level & Pool" tab and its panel from the tab list.
- On the create form, add a 2-option segmented control (Manager / Classic) using the design-system segmented-control component; default Manager; include the value in the `createLeague` payload.

- [ ] **Step 4: Run tests + typecheck**

Run: `pnpm --filter web test -- lobby-panels && pnpm --filter web typecheck`
Expected: PASS, no type errors.

- [ ] **Step 5: Verify visually (preview)**

Start the dev server (preview_start), open the create-league page, confirm the Manager/Classic toggle renders; create a classic league and confirm the lobby shows only `Lobby | Rules`. Screenshot for proof.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/\(auth\)/league/create/ apps/web/app/\(lobby\)/
git commit -m "feat(classic): mode picker on create + hide Level & Pool in classic lobby"
```

---

## Phase 2 — Classic phase calendar + per-phase reset

### Task 5: Classic 4-phase calendar

**Files:**
- Create: `apps/web/lib/classic-phases.ts`
- Test: `apps/web/lib/classic-phases.test.ts`

**Context to read first:** `apps/web/lib/phases.ts` (`AUCTION_PHASES`, `getCurrentPhase`, `getNextPhase`, `getPhaseById`) and `apps/web/lib/gt-phases.ts` (`GT_PHASE_IDS = [4,6,8]`, Giro/Tour/Vuelta).

**Interfaces:**
- Produces: `CLASSIC_PHASE_IDS: number[]` (the 4 phases: the Classics block id + 4 (Giro) + 6 (Tour) + 8 (Vuelta)); `getCurrentClassicPhase(date)`, `getNextClassicPhase(date)`, `isClassicPhaseId(id)`. These wrap the existing phase helpers, restricted to `CLASSIC_PHASE_IDS`.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/lib/classic-phases.test.ts
import { describe, it, expect } from "vitest";
import { CLASSIC_PHASE_IDS, isClassicPhaseId } from "./classic-phases";

describe("classic-phases", () => {
  it("has exactly 4 phases incl. the 3 GTs", () => {
    expect(CLASSIC_PHASE_IDS).toHaveLength(4);
    expect(CLASSIC_PHASE_IDS).toEqual(expect.arrayContaining([4, 6, 8])); // Giro, Tour, Vuelta
  });
  it("isClassicPhaseId matches the set", () => {
    expect(isClassicPhaseId(6)).toBe(true);
    expect(isClassicPhaseId(2)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- classic-phases`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
// apps/web/lib/classic-phases.ts
import { AUCTION_PHASES, getCurrentPhase, getNextPhase } from "./phases";

// Identify the spring "Classics" phase id from AUCTION_PHASES by its label,
// then add the three GT phases (Giro=4, Tour=6, Vuelta=8).
const CLASSICS_BLOCK_ID =
  AUCTION_PHASES.find((p) => /classic/i.test(p.label))?.id ?? 3;

export const CLASSIC_PHASE_IDS: number[] = [CLASSICS_BLOCK_ID, 4, 6, 8];

export function isClassicPhaseId(id: number): boolean {
  return CLASSIC_PHASE_IDS.includes(id);
}

export function getCurrentClassicPhase(date = new Date()) {
  const p = getCurrentPhase(date);
  return p && isClassicPhaseId(p.id) ? p : null;
}

export function getNextClassicPhase(date = new Date()) {
  let p = getNextPhase(date);
  while (p && !isClassicPhaseId(p.id)) p = getNextPhase(p);
  return p ?? null;
}
```

Note: confirm the real "Classics" phase id and `getNextPhase` signature against `lib/phases.ts` while implementing; adjust the `find`/loop accordingly. If `getNextPhase` takes a phase (not a date), thread it correctly.

- [ ] **Step 4: Run tests**

Run: `pnpm --filter web test -- classic-phases`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/classic-phases.ts apps/web/lib/classic-phases.test.ts
git commit -m "feat(classic): classic 4-phase calendar derived from AUCTION_PHASES"
```

---

### Task 6: `classic_phase_reset` RPC

**Files:**
- Create: `supabase/migrations/<ts>_classic_phase_reset_rpc.sql`

**Context to read first:** the latest `confirm_phase_setup` in `supabase/migrations/20260605000300_underdog_payday_discount.sql` (to mirror its signature/markers: `phase_confirmed_id`, `phase_confirmed_at`, contract status values, `treasury_log` insert shape). Latest `release_rider` semantics in `supabase/migrations/20260512000000_release_cooldown.sql` (contract archival fields `released_at`, `available_from`, `effective_phase_id`).

**Interfaces:**
- Produces RPC `public.classic_phase_reset(p_team_id uuid, p_phase_id int, p_phase_label text) RETURNS jsonb`. Behavior:
  1. Archive the team's prior-phase contracts: set `status='released'`, `released_at = now()` (so scoring's contract-date guard attributes prior races correctly), `available_from = now()` (no inter-phase cooldown — classic resets fully).
  2. Set `teams.treasury = 1500000`.
  3. Insert one `treasury_log` row `type='budget_reset', amount=1500000, description='Classic budget reset — '||p_phase_label`.
  4. Mark `teams.phase_confirmed_id = p_phase_id`, `phase_confirmed_at = now()`.
  5. Idempotent: if `phase_confirmed_id = p_phase_id` already, no-op and return `{ ok:true, skipped:true }`.
  Returns `{ ok:true, phaseId, budget:1500000 }`. SECURITY DEFINER; grant to `authenticated` and `service_role`.

- [ ] **Step 1: Add `budget_reset` to the treasury_log type CHECK (same migration, first)**

```sql
-- treasury_log.type CHECK currently enumerates allowed types; add 'budget_reset'.
-- Read the current constraint name and definition first:
--   docker exec -i supabase_db_WattHunter psql -U postgres -d postgres -c "\d+ public.treasury_log"
ALTER TABLE public.treasury_log DROP CONSTRAINT IF EXISTS treasury_log_type_check;
ALTER TABLE public.treasury_log ADD CONSTRAINT treasury_log_type_check
  CHECK (type IN (
    'starting_fund','auction_purchase','monthly_salary','rider_revenue',
    'sponsor_payment','sponsor_bonus','bankruptcy_release','phase_salary',
    'phase_sponsor_base','payday_salary','release_fee','transfer_bonus',
    'sponsor_bonus_revert','budget_reset'
  ));
```

Note: copy the EXACT current list from `\d+ public.treasury_log` and append `'budget_reset'` — do not trust this list verbatim if the DB shows additional types.

- [ ] **Step 2: Write the RPC (same migration)**

```sql
CREATE OR REPLACE FUNCTION public.classic_phase_reset(
  p_team_id uuid, p_phase_id int, p_phase_label text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_already int;
BEGIN
  SELECT phase_confirmed_id INTO v_already FROM teams WHERE id = p_team_id;
  IF v_already IS NOT DISTINCT FROM p_phase_id THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true);
  END IF;

  -- 1. Archive prior-phase roster (contracts) so the new auction starts empty.
  UPDATE contracts
     SET status = 'released', released_at = now(), available_from = now()
   WHERE team_id = p_team_id AND status IN ('active','notice');

  -- 2. Flat budget reset.
  UPDATE teams
     SET treasury = 1500000,
         phase_confirmed_id = p_phase_id,
         phase_confirmed_at = now()
   WHERE id = p_team_id;

  -- 3. Audit line.
  INSERT INTO treasury_log (team_id, type, amount, description)
  VALUES (p_team_id, 'budget_reset', 1500000,
          'Classic budget reset — ' || p_phase_label);

  RETURN jsonb_build_object('ok', true, 'phaseId', p_phase_id, 'budget', 1500000);
END $$;

GRANT EXECUTE ON FUNCTION public.classic_phase_reset(uuid, int, text)
  TO authenticated, service_role;
```

Note: align column names (`phase_confirmed_id`, `available_from`, contract `status` enum values) with what `\d public.teams` / `\d public.contracts` actually show before finalizing.

- [ ] **Step 3: Apply locally and test idempotency**

Run: `supabase db reset` then a SQL check via a seeded team:

```bash
docker exec -i supabase_db_WattHunter psql -U postgres -d postgres <<'SQL'
-- pick any team id, call twice, assert second call is skipped and treasury stays 1.5M
SELECT public.classic_phase_reset((SELECT id FROM teams LIMIT 1), 6, 'Tour de France');
SELECT public.classic_phase_reset((SELECT id FROM teams LIMIT 1), 6, 'Tour de France');
SELECT treasury, phase_confirmed_id FROM teams ORDER BY created_at LIMIT 1;
SELECT count(*) FROM treasury_log WHERE type='budget_reset';
SQL
```
Expected: first call returns `skipped:false` shape, second returns `skipped:true`; treasury = 1500000; exactly 1 `budget_reset` row.

- [ ] **Step 4: Push to remote**

Run: `supabase db push --linked`
Expected: applied cleanly.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(classic): classic_phase_reset RPC (flat budget + roster archive)"
```

---

### Task 7: Wire the reset into the auction payday path

**Files:**
- Modify: `apps/web/app/(game)/league/[leagueId]/auction/actions.ts` (the `payTeamsForPhase` flow around line 308 that calls `confirm_phase_setup`)
- Test: `apps/web/app/(game)/league/[leagueId]/auction/actions.test.ts`

**Context to read first:** `auction/actions.ts` — `payTeamsForPhase()` iterates active teams and calls `admin.rpc("confirm_phase_setup", {...})`. The league row is available (or fetchable) in this scope.

**Interfaces:**
- Consumes: `isClassic` (Task 2), `classic_phase_reset` (Task 6).
- Produces: for a classic league, each team gets `classic_phase_reset` instead of `confirm_phase_setup`; manager path unchanged.

- [ ] **Step 1: Write the failing test**

```ts
// in auction/actions.test.ts — using the project's hoisted mockRpc pattern
import { describe, it, expect, vi } from "vitest";
import { phaseResetRpcFor } from "./actions";

describe("phaseResetRpcFor", () => {
  it("routes classic leagues to classic_phase_reset", () => {
    expect(phaseResetRpcFor("classic")).toBe("classic_phase_reset");
  });
  it("routes manager leagues to confirm_phase_setup", () => {
    expect(phaseResetRpcFor("manager")).toBe("confirm_phase_setup");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- auction/actions`
Expected: FAIL (`phaseResetRpcFor` not exported).

- [ ] **Step 3: Implement**

Add the pure router and use it in `payTeamsForPhase`:

```ts
import { isClassic, type LeagueMode } from "@/lib/league-mode";

export function phaseResetRpcFor(mode: LeagueMode): "classic_phase_reset" | "confirm_phase_setup" {
  return isClassic(mode) ? "classic_phase_reset" : "confirm_phase_setup";
}
```

In `payTeamsForPhase`, fetch `leagues.mode`; if classic, call
`admin.rpc("classic_phase_reset", { p_team_id, p_phase_id, p_phase_label })` per team;
else keep the existing `confirm_phase_setup` call. Keep error forwarding identical.

- [ ] **Step 4: Run tests + typecheck**

Run: `pnpm --filter web test -- auction/actions && pnpm --filter web typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(game\)/league/\[leagueId\]/auction/actions.ts apps/web/app/\(game\)/league/\[leagueId\]/auction/actions.test.ts
git commit -m "feat(classic): route classic leagues to classic_phase_reset at phase transition"
```

---

## Phase 3 — Classic auction (cap 8, no sponsor/strategy)

### Task 8: `place_bid` slot cap = 8 in classic

**Files:**
- Create: `supabase/migrations/<ts>_place_bid_classic_cap.sql`

**Context to read first:** the FULL latest `place_bid` in `supabase/migrations/20260602110100_place_bid_increment_1000.sql`. Note step 10 (slot check) maps level→max slots (L8→12). The function already reads the team row and the league.

**Interfaces:**
- Produces: a new migration that `CREATE OR REPLACE`s `place_bid` with one change — in classic leagues the slot cap is `CLASSIC_SQUAD_SIZE = 8` regardless of level. Everything else identical (level 8 already opens the pool and satisfies co-unlock).

- [ ] **Step 1: Copy the latest definition into the new migration**

Copy the entire `CREATE OR REPLACE FUNCTION public.place_bid(...) ... $$;` block from `20260602110100_place_bid_increment_1000.sql` into the new migration file unchanged.

- [ ] **Step 2: Add the classic cap branch**

In the copied body, locate where `v_max_slots` is derived from team level (step 10). Add, right after the league row is available (the function already needs the league for league_id; fetch `mode` alongside it):

```sql
  -- Classic mode: fixed squad size regardless of level.
  IF v_league_mode = 'classic' THEN
    v_max_slots := 8;
  END IF;
```

Declare `v_league_mode text;` and populate it from the league lookup the function already performs (add `, mode` to that SELECT, or a dedicated `SELECT mode INTO v_league_mode FROM leagues WHERE id = v_league_id;`).

- [ ] **Step 3: Apply locally and test**

Run: `supabase db reset`, then in psql: set a test league to `mode='classic'`, set its team to level 8, insert 8 active contracts, and assert a 9th `place_bid` is rejected with the slot-cap error; in a manager league the 9th still succeeds (up to 12).

```bash
docker exec -i supabase_db_WattHunter psql -U postgres -d postgres -c "SELECT proname FROM pg_proc WHERE proname='place_bid';"
```
Expected: function present; manual bid test rejects the 9th in classic.

- [ ] **Step 4: Push to remote**

Run: `supabase db push --linked`

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(classic): cap classic-mode teams at 8 contracts in place_bid"
```

---

### Task 9: Auction UI by mode (hide sponsor + strategies, flat budget bar)

**Files:**
- Modify: `apps/web/components/config-cards.tsx`
- Modify: `apps/web/components/budget-summary.tsx`
- Modify: `apps/web/app/(game)/league/[leagueId]/auction/auctions-client.tsx` (pass `mode` down)
- Test: `apps/web/components/config-cards.test.tsx`, `apps/web/components/budget-summary.test.tsx`

**Context to read first:** design system (Filter Chips, ConfigCards). `config-cards.tsx` renders a Sponsor card + Strategies card. `budget-summary.tsx` computes purchasing power from treasury + sponsor income − salaries − draft bids.

**Interfaces:**
- Consumes: `isClassic`, `CLASSIC_PHASE_BUDGET`, `mode` prop threaded from the auction page (which now reads `leagues.mode`).
- Produces: in classic, `ConfigCards` renders nothing (no sponsor, no strategies); `BudgetSummary` shows a simplified "Budget 1.5M / Spent X / Remaining Y" with no sponsor-income or salary lines.

- [ ] **Step 1: Write the failing tests**

```tsx
// config-cards.test.tsx
import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ConfigCards } from "./config-cards";

describe("ConfigCards by mode", () => {
  it("renders nothing in classic", () => {
    const { container } = render(<ConfigCards {...({} as any)} mode="classic" />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

```tsx
// budget-summary.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { BudgetSummary } from "./budget-summary";

describe("BudgetSummary classic", () => {
  it("shows flat budget and hides sponsor income line", () => {
    render(<BudgetSummary {...({ treasury: 1_500_000, draftBidsTotal: 300_000 } as any)} mode="classic" />);
    expect(screen.queryByText(/Sponsor/i)).toBeNull();
    expect(screen.getByText(/Remaining/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter web test -- config-cards budget-summary`
Expected: FAIL (components ignore `mode`).

- [ ] **Step 3: Implement**

- `ConfigCards`: add `mode` prop; `if (isClassic(mode)) return null;`.
- `BudgetSummary`: add `mode` prop; when classic, render only `Budget = treasury`, `Spent = draftBidsTotal`, `Remaining = treasury − draftBidsTotal` (use `formatMoney`), omitting the sponsor-income and salary rows. Keep manager rendering unchanged.
- Thread `mode` from `auctions-client.tsx` / the auction server page (read `leagues.mode`).

- [ ] **Step 4: Run tests + typecheck**

Run: `pnpm --filter web test -- config-cards budget-summary && pnpm --filter web typecheck`
Expected: PASS.

- [ ] **Step 5: Verify visually (preview)**

Open a classic league's auction page; confirm no sponsor/strategy cards and the flat budget bar. Screenshot.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/config-cards.tsx apps/web/components/budget-summary.tsx apps/web/components/config-cards.test.tsx apps/web/components/budget-summary.test.tsx apps/web/app/\(game\)/league/\[leagueId\]/auction/auctions-client.tsx
git commit -m "feat(classic): hide sponsor/strategies and show flat budget in classic auction"
```

---

## Phase 4 — Classic Race Team + tactics + nav

### Task 10: Race Team — hide Sponsors Goals in classic

**Files:**
- Modify: `apps/web/app/(game)/league/[leagueId]/team/gt/gt-team-client.tsx`
- Test: `apps/web/app/(game)/league/[leagueId]/team/gt/gt-team-client.test.tsx`

**Context to read first:** `gt-team-client.tsx` renders, top-to-bottom: ScoringDocCard, Nemesis banner, "Sponsors Goals" (`SponsorBonusCard`), "Team Tactics", "Team Composition" (role blocks). It already receives `underdogEligible`.

**Interfaces:**
- Consumes: `isClassic`, `mode` prop (thread from `team/gt/page.tsx`, read `leagues.mode`).
- Produces: in classic, the "Sponsors Goals" section is not rendered. Team Composition (8 role slots) and Team Tactics still render.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { GtTeamClient } from "./gt-team-client";

describe("GtTeamClient classic", () => {
  it("hides Sponsors Goals in classic", () => {
    render(<GtTeamClient {...({} as any)} mode="classic" />);
    expect(screen.queryByText(/Sponsors Goals/i)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- gt-team-client`
Expected: FAIL.

- [ ] **Step 3: Implement**

Add `mode` prop; wrap the Sponsors Goals block in `{!isClassic(mode) && (...)}`. Thread `mode` from `team/gt/page.tsx`.

- [ ] **Step 4: Run tests + typecheck**

Run: `pnpm --filter web test -- gt-team-client && pnpm --filter web typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(game\)/league/\[leagueId\]/team/gt/
git commit -m "feat(classic): hide Sponsors Goals on Race Team in classic"
```

---

### Task 11: Hide Call the Bus tactic in classic

**Files:**
- Modify: `apps/web/components/team-tactics-section.tsx`
- Test: `apps/web/components/team-tactics-section.test.tsx`

**Context to read first:** `team-tactics-section.tsx` renders 5 `TacticCard`s: `unleash, overdrive, call_the_bus, nemesis_gc, nemesis_sprint`.

**Interfaces:**
- Consumes: `isClassic`, `mode` prop.
- Produces: in classic, the `call_the_bus` card is filtered out; the other 4 render.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { TeamTacticsSection } from "./team-tactics-section";

describe("TeamTacticsSection classic", () => {
  it("does not render Call the Bus in classic", () => {
    render(<TeamTacticsSection {...({} as any)} mode="classic" />);
    expect(screen.queryByText(/Call the Bus/i)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- team-tactics-section`
Expected: FAIL.

- [ ] **Step 3: Implement**

Add `mode` prop; build the tactic list, then `if (isClassic(mode)) filter out 'call_the_bus'` before rendering.

- [ ] **Step 4: Run tests + typecheck**

Run: `pnpm --filter web test -- team-tactics-section && pnpm --filter web typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/team-tactics-section.tsx apps/web/components/team-tactics-section.test.tsx
git commit -m "feat(classic): hide Call the Bus tactic in classic (no bench)"
```

---

### Task 12: Sub-tabs + nav hide My Team / Budget in classic

**Files:**
- Modify: `apps/web/app/(game)/league/[leagueId]/team/layout.tsx`
- Modify: `apps/web/components/bottom-nav.tsx`
- Modify: `apps/web/components/sidebar.tsx`
- Test: `apps/web/app/(game)/league/[leagueId]/team/layout.test.tsx`

**Context to read first:** `team/layout.tsx` renders `SubTabs` with `My Team | Race Team | Budget`. `bottom-nav.tsx` / `sidebar.tsx` build nav from `NavTabKey` incl. `budget`; sidebar has Team sub-items `My Team | {GT} | Budget`.

**Interfaces:**
- Consumes: `isClassic`, `mode` (thread from layout server scope reading `leagues.mode`).
- Produces: in classic, Team sub-tabs = only `Race Team`; nav hides the `budget` item and the `My Team` sub-item. Manager unchanged.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { TeamSubTabs } from "./layout"; // export the tab list builder or a presentational subcomponent

describe("Team sub-tabs by mode", () => {
  it("shows only Race Team in classic", () => {
    render(<TeamSubTabs {...({} as any)} mode="classic" />);
    expect(screen.queryByText(/My Team/i)).toBeNull();
    expect(screen.queryByText(/Budget/i)).toBeNull();
    expect(screen.getByText(/Team/i)).toBeInTheDocument(); // Race Team label
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- team/layout`
Expected: FAIL.

- [ ] **Step 3: Implement**

- Extract the sub-tab list into a small presentational `TeamSubTabs({ mode, ... })`; in classic return only the Race Team tab.
- `bottom-nav.tsx` / `sidebar.tsx`: accept `mode`; when classic, drop `budget` from the unlocked tabs and drop the `My Team` Team sub-item. Thread `mode` from the `(game)/league/[leagueId]/layout.tsx` that already computes unlocked tabs.

- [ ] **Step 4: Run tests + typecheck**

Run: `pnpm --filter web test -- team/layout && pnpm --filter web typecheck`
Expected: PASS.

- [ ] **Step 5: Verify visually (preview)**

In a classic league, confirm nav has no Budget, and Team shows only Race Team. Screenshot.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/\(game\)/league/\[leagueId\]/team/layout.tsx apps/web/components/bottom-nav.tsx apps/web/components/sidebar.tsx apps/web/app/\(game\)/league/\[leagueId\]/team/layout.test.tsx
git commit -m "feat(classic): show only Race Team and hide Budget nav in classic"
```

---

## Phase 5 — Pipelines

### Task 13: Skip sponsor/goal pipelines for classic leagues

**Files:**
- Modify: `services/pcs-sync/sponsor_bonus.py`
- Modify: `services/pcs-sync/goal_evaluator.py`
- Test: `services/pcs-sync/tests/test_classic_mode_skips.py`

**Context to read first:** how each script loads leagues/teams (the Supabase client query). Add a mode filter so classic leagues are excluded.

**Interfaces:**
- Produces: a shared guard `is_classic_league(league_row) -> bool` (or filter `mode == 'classic'` out of the leagues query) applied at the top of each script's per-league loop. Classic leagues yield 0 processed teams.

- [ ] **Step 1: Write the failing test**

```python
# services/pcs-sync/tests/test_classic_mode_skips.py
from sponsor_bonus import is_classic_league  # add this helper

def test_classic_league_detected():
    assert is_classic_league({"mode": "classic"}) is True
    assert is_classic_league({"mode": "manager"}) is False
    assert is_classic_league({}) is False
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/pcs-sync && .venv/bin/python -m pytest tests/test_classic_mode_skips.py -q`
Expected: FAIL (ImportError).

- [ ] **Step 3: Implement**

Add to `sponsor_bonus.py` (and import/reuse in `goal_evaluator.py`):

```python
def is_classic_league(league: dict) -> bool:
    """Classic-mode leagues have no sponsors/goals; skip them."""
    return league.get("mode") == "classic"
```

Then in each script's league loop, `if is_classic_league(league): continue` (or add `.eq("mode", "manager")` / `.neq("mode", "classic")` to the leagues query). Log one line per skipped classic league.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/pcs-sync && .venv/bin/python -m pytest tests/test_classic_mode_skips.py -q`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/pcs-sync/sponsor_bonus.py services/pcs-sync/goal_evaluator.py services/pcs-sync/tests/test_classic_mode_skips.py
git commit -m "feat(classic): skip sponsor_bonus and goal_evaluator for classic leagues"
```

---

### Task 14: Scoring neutrality regression test for classic

**Files:**
- Test: `services/pcs-sync/tests/test_classic_scoring_neutral.py`

**Context to read first:** `services/pcs-sync/scoring.py` XP formula. In classic data there are no `team_strategies` (strategy_bonus = 0) and `underdog_eligible=false` (underdog_mult = 1). This task adds a guard test proving scoring needs NO code change; if the test reveals a hidden dependency, fix it in `scoring.py` within this task.

**Interfaces:**
- Produces: a pytest that scores a synthetic GT stage for a classic-shaped team (no strategies, no underdog) and asserts XP = `raw_pcs_points * gt_role_mult` (+ classif/distance where applicable), with `strategy_bonus == 0` and `underdog_mult == 1`.

- [ ] **Step 1: Write the test**

```python
# services/pcs-sync/tests/test_classic_scoring_neutral.py
# Reuse the existing scoring test fixtures/harness (see tests/test_scoring*.py).
def test_classic_team_scores_without_policy_or_underdog(scoring_harness):
    result = scoring_harness.score_stage(
        team={"underdog_eligible": False, "strategies": []},
        rider={"role": "gc_leader", "pcs_points": 100, "profile": "mountain"},
        stage={"is_gt": True},
    )
    assert result.strategy_bonus == 0
    assert result.underdog_mult == 1
    assert result.xp == result.raw_pcs_points * result.gt_role_mult
```

Adapt the fixture names to the existing scoring test harness in `services/pcs-sync/tests/`.

- [ ] **Step 2: Run it**

Run: `cd services/pcs-sync && .venv/bin/python -m pytest tests/test_classic_scoring_neutral.py -q`
Expected: PASS (no scoring change needed). If FAIL, fix the offending dependency in `scoring.py`, re-run until PASS.

- [ ] **Step 3: Commit**

```bash
git add services/pcs-sync/tests/test_classic_scoring_neutral.py
git commit -m "test(classic): assert scoring is neutral without policies/underdog"
```

---

## Phase 6 — End-to-end + regression

### Task 15: E2E classic happy path + manager regression

**Files:**
- Create/Modify: `apps/web/e2e/classic-mode.spec.ts` (Playwright; mirror the GT-tactics e2e pattern, may start as `test.fixme` until seed data)
- Test: full web + pipeline suites

**Interfaces:**
- Consumes: everything above.
- Produces: an e2e that creates a classic league, runs a 3-round auction, drafts ≤8 riders, assigns roles, and confirms the budget bar + sub-tabs; plus a regression assertion that a manager league behaves unchanged.

- [ ] **Step 1: Write the e2e skeleton**

Mirror `apps/web/e2e/gt-tactics.spec.ts`. Cover: create classic league → lobby shows only Lobby+Rules → auction shows flat 1.5M and no sponsor cards → draft riders, 9th bid rejected → Race Team shows 8 role slots, no Sponsors Goals → tactics has no Call the Bus.

- [ ] **Step 2: Run the full web suite**

Run: `pnpm --filter web test && pnpm --filter web typecheck && pnpm --filter web lint`
Expected: all green.

- [ ] **Step 3: Run the pipeline suite**

Run: `cd services/pcs-sync && .venv/bin/python -m pytest -q`
Expected: all green (incl. the two new classic tests).

- [ ] **Step 4: Manager-mode regression check**

Confirm no manager test changed behavior: the default `mode='manager'` path is untouched (no classic branch executes). Spot-check by creating a manager league in preview and validating a round as before.

- [ ] **Step 5: Commit**

```bash
git add apps/web/e2e/classic-mode.spec.ts
git commit -m "test(classic): e2e classic happy path + manager regression"
```

---

### Task 16 (follow-on, post-2026-launch): Classics-phase one-day scoring + UI

**Files:**
- Modify: `apps/web/app/(game)/league/[leagueId]/team/gt/gt-team-client.tsx` (no-roles variant for the Classics phase)
- Modify: scoring/feed config for the Classics race set
- Create: `apps/web/lib/classic-phases.ts` race-set definition for the Classics block

**Why deferred:** the Classics and Giro phases are already past in 2026; Tour + Vuelta (both GT phases, covered by Tasks 1-15) are enough to launch. The Classics phase scores one-day races via the existing non-GT contract path (raw PCS points, no roles), and needs a roles-free Race Team view.

- [ ] **Step 1: Define the Classics race set** (which WT one-day slugs + 5 Monuments fall in the Classics block window) in `classic-phases.ts`, with a unit test asserting the slug list is non-empty and within the phase window.
- [ ] **Step 2: Race Team roles-free variant** for the Classics phase: when the current classic phase is the Classics block (non-GT), render the 8 owned riders as a flat list (no role slots, no tactics). Test the conditional render.
- [ ] **Step 3:** Confirm `scoring.py` attributes one-day results to classic contracts via the existing non-GT path (pytest with a one-day fixture).
- [ ] **Step 4: Commit** `feat(classic): Classics-phase one-day scoring and roles-free Race Team`.

---

## Self-Review

**Spec coverage:**
- `leagues.mode` → Task 1. ✓
- Classic team defaults (L8, 1.5M, no sponsor, underdog off) → Task 3. ✓
- 4-phase calendar → Task 5 (+ Task 16 for Classics race set). ✓
- Per-phase 1.5M reset + roster archive → Tasks 6-7. ✓
- Cap 8 → Task 8. ✓
- Auction UI (no sponsor/strategy, flat budget) → Task 9. ✓
- Race Team (no Sponsors Goals, 8 slots) → Task 10. ✓
- Call the Bus hidden → Task 11. ✓
- Sub-tabs/nav (Race Team only, no Budget/My Team) → Task 12. ✓
- Pipelines skip classic → Task 13. ✓
- Scoring neutrality → Task 14. ✓
- Ranking columns left as-is (empty) → no task needed (intentional non-change), covered by Task 15 regression. ✓
- Achievements left as-is → no task (intentional non-change). ✓
- E2E + manager regression → Task 15. ✓
- Classics-phase scoring → Task 16 (deferred). ✓

**Placeholder scan:** No "TBD/TODO". Where a task says "read the current X first," it is because RPCs are recreated wholesale and column names must be confirmed against the live schema — the change itself is fully specified (exact new code blocks).

**Type consistency:** `isClassic`, `LeagueMode`, `CLASSIC_PHASE_BUDGET`, `CLASSIC_SQUAD_SIZE` defined in Task 2 and reused verbatim in Tasks 3, 7, 9, 10, 11, 12. RPC `classic_phase_reset(uuid,int,text)` defined in Task 6, called in Task 7. `phaseResetRpcFor` defined and tested in Task 7. Consistent.

## Risks

- **Column-name drift:** `phase_confirmed_id`, `available_from`, contract `status` enum, and `treasury_log` type list must be confirmed against the live schema before finalizing Tasks 6 and 8 (instructions say so).
- **`place_bid` copy:** Task 8 copies a ~200-line SECURITY DEFINER function; diff carefully against the source migration so only the slot-cap branch changes.
- **Mode threading:** several UI tasks need `leagues.mode` passed from server pages into client components; verify each server page actually selects `mode`.
