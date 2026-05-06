# Budget & Transactions Fix — Design Doc

**Date:** 2026-05-06  
**Scope:** Sujet 2 (transactions/budget), Sujet 3 (treasury adjustment), Sujet 4 (GT roster)  
**Branch:** `fix/budget-transactions`  
**Strategy:** develop + test on local Supabase (Colima/Docker), push to prod only after full verification

---

## Context

The league is currently in Giro phase (Phase 4, May 2 – Jun 1 2026). Previous phases played:
- Season Start (Phase 1) — no sponsor income at the time
- Classics Part 1 (Phase 2) — all teams had 200K/phase sponsor budget
- Classics Part 2 (Phase 3) — all teams had 450K/phase sponsor budget
- Giro (Phase 4) — current, sponsor budgets vary by team

---

## Subject 2 — Budget & Transactions

### Root Causes

Three independent bugs, one shared root:

#### RC-1 : `confirm_phase_setup` RPC never writes treasury_log

`confirm_phase_setup` is called when the user clicks "Confirm Setup" at the start of each phase (end of Round 1). It correctly applies sponsor and strategy changes but does **not**:
- INSERT `sponsor_payment` into `treasury_log`
- INSERT per-rider `payday_salary` into `treasury_log`
- UPDATE `teams.treasury`

`auction.py` explicitly delegates Round 1 salary deductions to this RPC (comment in code), but the RPC never implemented it.

Impact: no historical record of sponsor income or Round 1 salary deductions. All treasury movements from Round 1 phases are invisible.

#### RC-2 : Budget card computes from live state, not treasury_log

`budget/page.tsx` builds the P&L card using:
- `sponsorBase` = `currentSponsor.monthly_budget` (today's sponsor, regardless of phase)
- `phaseSalaries` = `SUM(active contracts.locked_salary)` (today's roster)
- `bonuses` = `income - sponsorBase` (fragile derivation)

When navigating to a past phase, the card reflects current team state, not the historical phase. Bonuses show +0 because `income` (sum of positive treasury_log entries) minus `sponsorBase` (current sponsor amount) goes negative.

#### RC-3 : Transaction row doesn't show race name for bonuses

`treasury_log` bonus entries have `description = "Sponsor bonus: stage rank 3 in race/giro-d-italia/2026/stage-5 (×1.0)"`. The race name is embedded but not extracted for display.

---

### Fix 2A — Extend `confirm_phase_setup` RPC

**New migration:** `20260506100000_rpc_confirm_phase_setup_payday.sql`

Adds after Step 5 (strategies applied), before Step 6 (mark confirmed):

```sql
-- Step 5b: Fetch sponsor
SELECT s.monthly_budget, s.name
INTO v_sponsor_budget, v_sponsor_name
FROM public.team_sponsors ts
JOIN public.sponsors s ON s.id = ts.sponsor_id
WHERE ts.team_id = p_team_id;

-- v_sponsor_budget stays 0 if no sponsor (no crash)

-- Step 5c: Log sponsor income
IF v_sponsor_budget > 0 THEN
  INSERT INTO public.treasury_log (team_id, type, amount, description)
  VALUES (p_team_id, 'sponsor_payment', v_sponsor_budget,
          format('Sponsor income — %s', p_current_phase_label));
END IF;

-- Step 5d: Log per-rider salaries
FOR v_contract IN
  SELECT c.id, c.locked_salary, r.full_name
  FROM public.contracts c
  JOIN public.riders r ON r.id = c.rider_id
  WHERE c.team_id = p_team_id AND c.status = 'active'
LOOP
  INSERT INTO public.treasury_log (team_id, type, amount, description, rider_id)
  VALUES (p_team_id, 'payday_salary', -v_contract.locked_salary,
          format('Salary — %s', v_contract.full_name),
          v_contract.rider_id);  -- rider_id filled from contracts join
  v_total_salaries := v_total_salaries + v_contract.locked_salary;
END LOOP;

-- Step 5e: Update treasury atomically
UPDATE public.teams
SET treasury = treasury + v_sponsor_budget - v_total_salaries
WHERE id = p_team_id;
```

**Interaction with auction.py (no conflict):**
- `confirm_phase_setup` runs at Round 1 closure. At that moment only pre-existing contracts and Round 1 wins are active.
- Round 2/3 wins: Python deducts immediately at resolution (independent, after payday). No double-counting.
- Next phase payday: deducts ALL active contracts again (correct — recurring monthly salary).

**Idempotence:** existing guard `phase_confirmed_id = p_current_phase_id → return error` prevents any double execution. No data-safety risk.

---

### Fix 2B — Budget page: typed sums from treasury_log

**File:** `apps/web/app/(game)/league/[leagueId]/budget/page.tsx`

Replace the current `income`/`outgoing`/`phaseSalaries` computation with three typed sums over the phase-filtered `treasury_log` rows:

```ts
const sponsorPaid  = totals.filter(t => t.type === 'sponsor_payment')
                           .reduce((s, t) => s + t.amount, 0)

const bonusEarned  = totals.filter(t => t.type === 'sponsor_bonus')
                           .reduce((s, t) => s + t.amount, 0)

const salariesPaid = totals.filter(t => t.type === 'payday_salary')
                           .reduce((s, t) => s + Math.abs(t.amount), 0)
                    + totals.filter(t => t.type === 'auction_purchase')
                           .reduce((s, t) => s + Math.abs(t.amount), 0)
```

> Note: `auction_purchase` not used currently, kept for future-proofing. In practice only `payday_salary` matters.

Remove: `income`, `outgoing`, `phaseSalaries`, the separate `contracts` query.  
Pass to client: `{ sponsorPaid, bonusEarned, salariesPaid }`.

**Budget card display:**
- Sponsor line: `sponsorPaid` (0 if not yet paid — no badge, no fallback)
- Bonuses line: `bonusEarned` (direct sum)
- Salaries line: `salariesPaid` (absolute value)
- Phase result: `sponsorPaid + bonusEarned - salariesPaid`

Before payday (confirm not yet called): all three show 0. After payday: show actuals. Simple, honest.

---

### Fix 2C — Transaction row: race name for bonuses

**File:** `apps/web/components/transaction-row.tsx`

For `type === 'sponsor_bonus'`, extract race name from `description`:

```ts
function extractRaceLabel(description: string | null): string {
  if (!description) return 'Race bonus'
  // Match "in race/giro-d-italia/2026/stage-5"
  const match = description.match(/in (race\/[^\s]+)/)
  if (!match) return 'Race bonus'
  const parts = match[1].split('/')  // ['race', 'giro-d-italia', '2026', 'stage-5']
  const raceSlug = parts[1]
  const stageSlug = parts[3]  // undefined for one-day races

  const RACE_NAMES: Record<string, string> = {
    'giro-d-italia':  "Giro d'Italia",
    'tour-de-france': 'Tour de France',
    'vuelta-a-espana': 'La Vuelta',
    'milan-san-remo': 'Milan — San Remo',
    'paris-roubaix': 'Paris — Roubaix',
    'liege-bastogne-liege': 'Liège — Bastogne — Liège',
    'tour-of-flanders': 'Tour of Flanders',
    'il-lombardia': 'Il Lombardia',
    'paris-nice': 'Paris — Nice',
    'tirreno-adriatico': 'Tirreno — Adriatico',
  }

  const raceName = RACE_NAMES[raceSlug] ?? raceSlug
  if (stageSlug?.startsWith('stage-')) {
    const stageNum = stageSlug.replace('stage-', '')
    return `${raceName} — Stage ${stageNum}`
  }
  return raceName
}
```

---

### Fix 2D — Backfill Classics Part 1 & Part 2

**One-shot SQL script** (run manually in local, then in prod).  
Does NOT update `teams.treasury` — the treasury already reflects historical reality.  
Only inserts the missing log entries so the budget page can display historical phases.

#### Classics Part 1 (Phase 2, Mar 2 2026) — 200K sponsor each

```sql
-- sponsor_payment: one row per team that had a sponsor active on Mar 2 2026
INSERT INTO treasury_log (team_id, type, amount, description, created_at)
SELECT ts.team_id, 'sponsor_payment', 200000,
       'Sponsor income — Classics Part 1 [backfill]',
       '2026-03-02T12:00:00Z'
FROM team_sponsors ts
-- Only teams in leagues that were active before Apr 1
JOIN teams t ON t.id = ts.team_id
WHERE ts.activated_at < '2026-04-01'
ON CONFLICT DO NOTHING;

-- payday_salary: one row per contract active during Classics Part 1
INSERT INTO treasury_log (team_id, type, amount, description, rider_id, created_at)
SELECT c.team_id, 'payday_salary', -c.locked_salary,
       format('Salary — %s [backfill]', r.full_name),
       c.rider_id,
       '2026-03-02T12:00:00Z'
FROM contracts c
JOIN riders r ON r.id = c.rider_id
WHERE c.purchased_at < '2026-04-01'
  AND (c.released_at IS NULL OR c.released_at > '2026-03-02');
```

#### Classics Part 2 (Phase 3, Apr 2 2026) — 450K sponsor each

```sql
INSERT INTO treasury_log (team_id, type, amount, description, created_at)
SELECT ts.team_id, 'sponsor_payment', 450000,
       'Sponsor income — Classics Part 2 [backfill]',
       '2026-04-02T12:00:00Z'
FROM team_sponsors ts
JOIN teams t ON t.id = ts.team_id
WHERE ts.activated_at < '2026-05-01'
ON CONFLICT DO NOTHING;

INSERT INTO treasury_log (team_id, type, amount, description, rider_id, created_at)
SELECT c.team_id, 'payday_salary', -c.locked_salary,
       format('Salary — %s [backfill]', r.full_name),
       c.rider_id,
       '2026-04-02T12:00:00Z'
FROM contracts c
JOIN riders r ON r.id = c.rider_id
WHERE c.purchased_at < '2026-05-01'
  AND (c.released_at IS NULL OR c.released_at > '2026-04-02');
```

> These scripts must be verified against real data in local before running in prod. The `ON CONFLICT DO NOTHING` is a safety net if re-run accidentally (treasury_log has no unique constraint today — add one if needed).

---

## Subject 3 — Treasury Adjustment (Jonathan)

One-time manual operation. No migration, no feature code.

```sql
-- Run in local first to verify team_id, then in prod
SELECT t.id, t.name, t.treasury, u.email
FROM teams t
JOIN users u ON u.id = t.user_id
WHERE u.email = 'jonathan.schummers@gmail.com';

-- Insert log entry
INSERT INTO treasury_log (team_id, type, amount, description)
VALUES ('<jonathan_team_id>', 'starting_fund', -50000, 'Fair Play — Équilibrage');

-- Update treasury
UPDATE teams SET treasury = treasury - 50000
WHERE id = '<jonathan_team_id>';
```

Run via `docker exec -i supabase_db_WattHunter psql -U postgres -d postgres` (bypasses trigger on `teams.treasury`).

---

## Subject 4 — GT Roster: released riders still appear

### Root Cause

`ensureGtSquad` (in `team/gt/actions.ts`) creates the squad once from active contracts at creation time. `getSquadWithRoles` returns all rows from `gt_squad` without filtering by current contract status. Riders released after squad creation remain visible in the GT view.

### Fix

In `getSquadWithRoles`, after fetching the squad, cross-reference with active contracts:

```ts
const { data: activeContracts } = await supabase
  .from("contracts")
  .select("rider_id")
  .eq("team_id", teamId)
  .eq("status", "active")

const activeIds = new Set((activeContracts ?? []).map(c => c.rider_id))

return squad
  .filter(s => activeIds.has(s.rider_id))
  .map(s => { ... })  // existing mapping unchanged
```

No migration needed. No change to `gt_squad` table or `ensureGtSquad`. Stale rows stay in `gt_squad` (acceptable — alpha, clean up later).

---

## Testing Strategy (local Supabase)

1. Start: `colima start --cpu 4 --memory 6` + `supabase start --exclude vector,edge-runtime,logflare,imgproxy,studio,mailpit`
2. `supabase db reset` → applies all 34 migrations from scratch
3. Seed minimal data: 1 league, 3 teams, 5 contracts per team, 2 closed phases
4. Call `confirm_phase_setup` → verify treasury_log entries created
5. Navigate budget page → verify sponsor/bonus/salary columns show correct values
6. Navigate to past phase → verify historical data displays (not current-state bleed)
7. Run backfill scripts → verify Classics Part 1/2 entries appear
8. Verify treasury reconciliation via `validation.py validate_treasury`
9. Release a rider → verify GT squad no longer shows them
10. Sujet 3 manually → verify treasury drops by 50K, log entry visible

---

## Files Changed

| File | Type | Change |
|------|------|--------|
| `supabase/migrations/20260506100000_rpc_confirm_phase_setup_payday.sql` | New migration | Extends RPC with payday logic |
| `supabase/migrations/20260506200000_backfill_classics_sponsor_salary.sql` | New migration | Backfill Classics Part 1 & 2 logs |
| `apps/web/app/(game)/league/[leagueId]/budget/page.tsx` | Modified | Typed treasury_log sums, remove contracts query |
| `apps/web/app/(game)/league/[leagueId]/budget/budget-client.tsx` | Modified | New props: `sponsorPaid`, `bonusEarned`, `salariesPaid` |
| `apps/web/components/transaction-row.tsx` | Modified | Extract race name for sponsor_bonus entries |
| `apps/web/app/(game)/league/[leagueId]/team/gt/actions.ts` | Modified | Filter released riders from `getSquadWithRoles` |

Manual (no code change):
- Sujet 3: SQL run directly via `docker exec psql`
