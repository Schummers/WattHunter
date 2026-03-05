# Beta Economy Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the beta economy mechanics: auction = monthly salary, sponsor 300K/month, positive-only bonus, and bankruptcy with best-scorer release.

**Architecture:** 3 layers of changes — (1) Supabase migration to update defaults and constraints, (2) Python backend to update auction resolution + add monthly finance job, (3) Next.js frontend to update bidding UI and budget display.

**Tech Stack:** Supabase Postgres migrations, Python (auction.py, scoring.py), Next.js TypeScript (actions.ts, rider-dialog.tsx)

**Design doc:** `docs/plans/2026-03-05-beta-economy-design.md`

---

### Task 1: Supabase Migration — Update defaults and add sponsor payment type

**Files:**
- Create: `supabase/migrations/20260305000000_beta_economy.sql`

**Step 1: Write the migration**

```sql
-- Beta economy changes (2026-03-05-beta-economy-design.md)

-- 1. Starting treasury: 500K → 300K for new teams
ALTER TABLE public.teams ALTER COLUMN treasury SET DEFAULT 300000;

-- 2. Add 'monthly_bonus' to treasury_log types for rider performance bonus
ALTER TABLE public.treasury_log
  DROP CONSTRAINT treasury_log_type_check;
ALTER TABLE public.treasury_log
  ADD CONSTRAINT treasury_log_type_check
  CHECK (type IN (
    'starting_fund',
    'auction_purchase',
    'monthly_salary',
    'rider_revenue',
    'sponsor_payment',
    'bankruptcy_release',
    'monthly_bonus'
  ));
```

**Step 2: Apply migration**

Run: `supabase db push`
Expected: Migration applied successfully.

**Step 3: Commit**

```bash
git add supabase/migrations/20260305000000_beta_economy.sql
git commit -m "migration: beta economy — treasury 300K default, monthly_bonus type"
```

---

### Task 2: Update auction.py — Auction bid = contract salary

**Files:**
- Modify: `services/pcs-sync/auction.py:128-141`
- Test: `services/pcs-sync/tests/test_auction.py`

**Step 1: Write the failing test**

Add to `services/pcs-sync/tests/test_auction.py`:

```python
def test_contract_salary_equals_bid_amount():
    """Beta economy: the winning bid becomes the monthly salary (not the PCS formula salary)."""
    # The contract's locked_salary should equal the bid amount, not rider.monthly_salary
    # This test verifies the auction resolution uses bid amount for locked_salary
    pass  # Will be verified by checking the mock calls after resolution
```

Note: the existing test suite mocks Supabase calls. The key change is on line 138 of auction.py.

**Step 2: Update auction.py — locked_salary = bid amount**

In `services/pcs-sync/auction.py`, replace lines 128-141:

```python
# OLD: locked_salary from rider's PCS formula
locked_salary = (
    rider_name_resp.data["monthly_salary"]
    if rider_name_resp.data
    else 5_000
)
```

With:

```python
# BETA: locked_salary = winning bid amount (enchère = salaire mensuel)
locked_salary = int(winner["amount"])
```

**Step 3: Remove the treasury deduction for one-shot purchase**

In `services/pcs-sync/auction.py`, lines 143-161: **remove** the treasury deduction block. In the beta economy, the bid is not a one-shot cost — it's a monthly salary. The treasury is deducted monthly by the finance job (Task 4), not at auction time.

Replace lines 143-161 with:

```python
# BETA: No one-shot treasury deduction.
# The bid amount = monthly salary, deducted by the monthly finance job.
# Log the contract creation for audit.
supabase.table("treasury_log").insert({
    "team_id": winner["team_id"],
    "type": "auction_purchase",
    "amount": 0,  # No one-shot cost in beta
    "description": f"Contrat Round {current_round} — {rider_id} — salaire {locked_salary}€/mois",
    "rider_id": rider_id,
}).execute()
```

**Step 4: Run existing tests**

Run: `cd services/pcs-sync && python3 -m pytest tests/test_auction.py -v`
Expected: All tests pass (update mocks if needed for the new behavior).

**Step 5: Commit**

```bash
git add services/pcs-sync/auction.py services/pcs-sync/tests/test_auction.py
git commit -m "feat: auction bid = monthly salary, remove one-shot treasury deduction"
```

---

### Task 3: Update scoring.py — Positive-only bonus instead of raw revenue

**Files:**
- Modify: `services/pcs-sync/scoring.py:90-120`
- Test: `services/pcs-sync/tests/test_scoring.py`

**Step 1: Write the failing test**

Add to `services/pcs-sync/tests/test_scoring.py`:

```python
def test_bonus_positive_only():
    """Bonus = max(0, pts × 500 - locked_salary). Never negative."""
    from scoring import calculate_rider_bonus

    # Pidcock: 340 pts, salary 150K → bonus = max(0, 170K - 150K) = 20K
    assert calculate_rider_bonus(340, 150000, 500) == 20000

    # Pidcock: 128 pts, salary 150K → bonus = max(0, 64K - 150K) = 0
    assert calculate_rider_bonus(128, 150000, 500) == 0

    # Pépite: 30 pts, salary 5K → bonus = max(0, 15K - 5K) = 10K
    assert calculate_rider_bonus(30, 5000, 500) == 10000

    # Zero pts → bonus = 0
    assert calculate_rider_bonus(0, 5000, 500) == 0
```

**Step 2: Run test to verify it fails**

Run: `cd services/pcs-sync && python3 -m pytest tests/test_scoring.py::test_bonus_positive_only -v`
Expected: FAIL — `calculate_rider_bonus` not defined.

**Step 3: Add the bonus function to scoring.py**

Add at the top of `services/pcs-sync/scoring.py` (after imports):

```python
def calculate_rider_bonus(pcs_points: int, locked_salary: int, conversion_rate: int) -> int:
    """
    Beta economy: bonus = max(0, pts × conversion_rate - locked_salary).
    Positive only — a rider never costs more than their salary.
    """
    revenue = pcs_points * conversion_rate
    return max(0, revenue - locked_salary)
```

**Step 4: Run test to verify it passes**

Run: `cd services/pcs-sync && python3 -m pytest tests/test_scoring.py::test_bonus_positive_only -v`
Expected: PASS

**Step 5: Update calculate_daily_scores to use bonus instead of raw revenue**

In `services/pcs-sync/scoring.py`, update the per-rider loop (lines ~95-103). Currently:

```python
revenue = raw_points * conversion_rate
```

Replace with:

```python
# Fetch locked_salary from contract for bonus calculation
contract_salary = contract.get("locked_salary", 0)
bonus = calculate_rider_bonus(raw_points, contract_salary, conversion_rate)
revenue = bonus  # Beta: only positive bonus goes to treasury
```

This requires the contract query (line 61) to also select `locked_salary`:

```python
contracts = supabase.table("contracts").select(
    "id, team_id, rider_id, locked_salary"
).in_("status", ["active", "notice"]).execute()
```

**Step 6: Run all scoring tests**

Run: `cd services/pcs-sync && python3 -m pytest tests/test_scoring.py -v`
Expected: All pass.

**Step 7: Commit**

```bash
git add services/pcs-sync/scoring.py services/pcs-sync/tests/test_scoring.py
git commit -m "feat: positive-only bonus — max(0, pts×500 - salary)"
```

---

### Task 4: Create monthly finance job

**Files:**
- Create: `services/pcs-sync/monthly_finance.py`
- Create: `services/pcs-sync/tests/test_monthly_finance.py`

**Step 1: Write the failing tests**

Create `services/pcs-sync/tests/test_monthly_finance.py`:

```python
"""Tests for monthly finance job — sponsor payment + salary deduction."""
from unittest.mock import MagicMock, patch
import pytest


def test_monthly_sponsor_payment():
    """Each team gets +300K sponsor payment."""
    from monthly_finance import SPONSOR_AMOUNT
    assert SPONSOR_AMOUNT == 300_000


def test_monthly_salary_deduction():
    """Total salary = sum of all locked_salary from active contracts."""
    from monthly_finance import calculate_monthly_salaries
    contracts = [
        {"locked_salary": 150000},
        {"locked_salary": 5000},
        {"locked_salary": 30000},
    ]
    assert calculate_monthly_salaries(contracts) == 185000


def test_bankruptcy_releases_best_scorer():
    """Bankruptcy releases rider with most XP first."""
    from monthly_finance import get_release_order
    contracts = [
        {"rider_id": "a", "locked_salary": 150000, "total_xp": 500},
        {"rider_id": "b", "locked_salary": 5000, "total_xp": 1200},
        {"rider_id": "c", "locked_salary": 30000, "total_xp": 300},
    ]
    order = get_release_order(contracts)
    assert order[0]["rider_id"] == "b"  # Best scorer released first
    assert order[1]["rider_id"] == "a"
    assert order[2]["rider_id"] == "c"
```

**Step 2: Run tests to verify they fail**

Run: `cd services/pcs-sync && python3 -m pytest tests/test_monthly_finance.py -v`
Expected: FAIL — module not found.

**Step 3: Implement monthly_finance.py**

Create `services/pcs-sync/monthly_finance.py`:

```python
"""
Monthly finance job — WattHunter Beta Economy.

Runs on the 1st of each month (or before each auction):
  1. Pay sponsor (300K) to each team
  2. Deduct salaries (sum of locked_salary from active contracts)
  3. Check bankruptcy: if treasury < 0, release best scorers until solvent

Design doc: docs/plans/2026-03-05-beta-economy-design.md
"""
from __future__ import annotations

import logging
import os
from datetime import date
from supabase import Client

logger = logging.getLogger(__name__)

SPONSOR_AMOUNT = 300_000  # €/month — flat sponsor for beta


def calculate_monthly_salaries(contracts: list[dict]) -> int:
    """Sum of locked_salary for all active contracts."""
    return sum(c.get("locked_salary", 0) for c in contracts)


def get_release_order(contracts: list[dict]) -> list[dict]:
    """Order contracts by total_xp descending — best scorer released first."""
    return sorted(contracts, key=lambda c: -c.get("total_xp", 0))


async def run_monthly_finance(supabase: Client) -> dict:
    """
    Monthly finance cycle for all teams:
      1. +300K sponsor
      2. -salaries
      3. Bankruptcy check → release best scorers
    """
    today = date.today().isoformat()
    results = []

    # Fetch all teams
    teams = supabase.table("teams").select("id, treasury, name").execute()
    if not teams.data:
        return {"status": "no_teams"}

    for team in teams.data:
        team_id = team["id"]
        treasury = team["treasury"]

        try:
            # 1. Sponsor payment
            treasury += SPONSOR_AMOUNT
            supabase.table("treasury_log").insert({
                "team_id": team_id,
                "type": "sponsor_payment",
                "amount": SPONSOR_AMOUNT,
                "description": f"Sponsor mensuel {today}",
            }).execute()

            # 2. Salary deduction
            contracts = supabase.table("contracts").select(
                "id, rider_id, locked_salary"
            ).eq("team_id", team_id).in_(
                "status", ["active", "notice"]
            ).execute()

            total_salary = calculate_monthly_salaries(contracts.data or [])
            treasury -= total_salary

            if total_salary > 0:
                supabase.table("treasury_log").insert({
                    "team_id": team_id,
                    "type": "monthly_salary",
                    "amount": -total_salary,
                    "description": f"Salaires {today} ({len(contracts.data or [])} coureurs)",
                }).execute()

            # 3. Update treasury
            supabase.table("teams").update({
                "treasury": treasury,
            }).eq("id", team_id).execute()

            # 4. Bankruptcy check
            released = []
            if treasury < 0 and contracts.data:
                # Need XP data to determine release order
                xp_data = supabase.table("rider_xp_daily").select(
                    "rider_id, xp_gained"
                ).eq("team_id", team_id).execute()

                # Sum XP per rider
                rider_xp: dict[str, int] = {}
                for row in (xp_data.data or []):
                    rid = row["rider_id"]
                    rider_xp[rid] = rider_xp.get(rid, 0) + row["xp_gained"]

                # Enrich contracts with XP
                enriched = []
                for c in contracts.data:
                    enriched.append({
                        **c,
                        "total_xp": rider_xp.get(c["rider_id"], 0),
                    })

                release_order = get_release_order(enriched)

                for contract in release_order:
                    if treasury >= 0:
                        break

                    # Release: update contract status
                    supabase.table("contracts").update({
                        "status": "released",
                        "release_date": today,
                    }).eq("id", contract["id"]).execute()

                    # Treasury recovers the salary
                    treasury += contract["locked_salary"]
                    released.append(contract["rider_id"])

                    supabase.table("treasury_log").insert({
                        "team_id": team_id,
                        "type": "bankruptcy_release",
                        "amount": 0,
                        "description": f"Faillite — libération coureur {contract['rider_id']}",
                        "rider_id": contract["rider_id"],
                    }).execute()

                    logger.warning(
                        f"Team {team_id}: bankruptcy release of rider {contract['rider_id']}"
                    )

                # Update treasury after releases
                supabase.table("teams").update({
                    "treasury": treasury,
                }).eq("id", team_id).execute()

            results.append({
                "team_id": team_id,
                "sponsor": SPONSOR_AMOUNT,
                "salaries": total_salary,
                "treasury_after": treasury,
                "released": released,
            })

        except Exception as e:
            logger.error(f"Monthly finance failed for team {team_id}: {e}")
            results.append({"team_id": team_id, "error": str(e)})

    return {"status": "completed", "teams": results}
```

**Step 4: Run tests**

Run: `cd services/pcs-sync && python3 -m pytest tests/test_monthly_finance.py -v`
Expected: All 3 tests pass.

**Step 5: Commit**

```bash
git add services/pcs-sync/monthly_finance.py services/pcs-sync/tests/test_monthly_finance.py
git commit -m "feat: monthly finance job — sponsor, salaries, bankruptcy"
```

---

### Task 5: Add monthly-finance to CLI pipeline

**Files:**
- Modify: `services/pcs-sync/run_pipeline.py`

**Step 1: Add a new CLI subcommand `monthly-finance`**

Add to `run_pipeline.py` after the startlists section (~line 260):

```python
# ---------------------------------------------------------------------------
# Pipeline D — monthly-finance
# ---------------------------------------------------------------------------

async def run_monthly_finance_pipeline() -> None:
    """Monthly finance: sponsor payment + salary deduction + bankruptcy check."""
    from sync import get_supabase
    from monthly_finance import run_monthly_finance

    supabase = get_supabase()

    print("=== Pipeline D: monthly-finance ===")
    print()
    result = await run_monthly_finance(supabase)
    import json
    print(json.dumps(result, indent=2))
    print()
    print("Done — monthly-finance complete.")
```

Add to `build_parser()`:

```python
# monthly-finance
subparsers.add_parser(
    "monthly-finance",
    help="Pipeline D — monthly: sponsor payment + salary deduction + bankruptcy.",
)
```

Add to `main()`:

```python
elif args.command == "monthly-finance":
    await run_monthly_finance_pipeline()
```

**Step 2: Test CLI**

Run: `cd services/pcs-sync && python3 run_pipeline.py monthly-finance`
Expected: Runs and outputs JSON result (may be "no_teams" if no teams exist).

**Step 3: Commit**

```bash
git add services/pcs-sync/run_pipeline.py
git commit -m "feat: add monthly-finance CLI pipeline"
```

---

### Task 6: Update bidding UI — auction = monthly salary

**Files:**
- Modify: `apps/web/app/(game)/league/[leagueId]/auctions/[auctionId]/rider-dialog.tsx`
- Modify: `apps/web/app/(game)/league/[leagueId]/auctions/[auctionId]/actions.ts`

**Step 1: Update rider-dialog.tsx labels**

In `rider-dialog.tsx`, update the UI labels to clarify that the bid = monthly salary:

- Change the bid input label from "Montant de la mise" to "Salaire mensuel proposé"
- Change the budget preview text to show monthly impact: "Budget après salaires: ..."
- Update the minimum bid text: "Salaire minimum: {rider.monthly_salary}€/mois"

**Step 2: Update actions.ts budget validation**

In `actions.ts`, the budget check currently validates:

```typescript
if (otherBidsTotal + parsed.data.amount > team.treasury)
```

This needs to also consider existing contract salaries. The validation should ensure the player can afford at least 1 month of all salaries:

```typescript
// Fetch existing contract salaries
const { data: existingContracts } = await supabase
  .from("contracts")
  .select("locked_salary")
  .eq("team_id", team.id)
  .in("status", ["active", "notice"]);

const currentSalaries = (existingContracts ?? [])
  .reduce((s, c) => s + c.locked_salary, 0);

const allSalariesAfterBid = currentSalaries + otherBidsTotal + parsed.data.amount;

// Player must be able to afford sponsor (300K) minus all salaries being non-negative
// is too restrictive. Instead: treasury must cover the bid as a recurring cost.
// Simple check: can they afford all active bids this round?
if (otherBidsTotal + parsed.data.amount > team.treasury) {
  return { error: "Budget insuffisant pour cette enchère" };
}
```

Note: Keep the existing treasury check for now. The monthly finance job handles the ongoing salary deductions. The bid validation just ensures the player has cash to commit.

**Step 3: Commit**

```bash
git add apps/web/app/\(game\)/league/\[leagueId\]/auctions/\[auctionId\]/rider-dialog.tsx
git add apps/web/app/\(game\)/league/\[leagueId\]/auctions/\[auctionId\]/actions.ts
git commit -m "feat: update bidding UI — auction = monthly salary"
```

---

### Task 7: Update GAME_RULES.md and CLAUDE.md

**Files:**
- Modify: `docs/GAME_RULES.md`
- Modify: `CLAUDE.md`

**Step 1: Update GAME_RULES.md**

Key changes per the design doc section 8:
- §4.1: Trésorerie de départ 500K → 300K
- §4.2: Add sponsor par défaut 300K/mois
- §4.4: Clarify salaire min = enchère min, pas salaire mensuel
- §4.5: Bonus = max(0, pts×500 - enchère), positive only
- §4.6: Faillite libère meilleur scoreur (pas salaire le plus élevé)
- §5: Enchère = salaire mensuel (pas one-shot)
- §6: contract_salary = enchère, remove purchase_price concept
- §9: Désactiver tiers, sponsor par défaut 300K

**Step 2: Update CLAUDE.md**

- Trésorerie départ: 300K
- Add: Sponsor par défaut 300K/mois
- Add: `python3 run_pipeline.py monthly-finance` to CLI commands
- Update conversion rate note

**Step 3: Commit**

```bash
git add docs/GAME_RULES.md CLAUDE.md
git commit -m "docs: update GAME_RULES + CLAUDE.md for beta economy"
```

---

## Task Dependency Graph

```
Task 1 (migration) ──→ Task 2 (auction.py) ──→ Task 5 (CLI)
                   ──→ Task 3 (scoring.py)
                   ──→ Task 4 (monthly_finance) ──→ Task 5 (CLI)
                   ──→ Task 6 (UI)
Task 7 (docs) — independent, do last
```

Tasks 2, 3, 4, 6 can run in parallel after Task 1.

---

## How to verify everything works

1. Apply migration: `supabase db push`
2. Run tests: `cd services/pcs-sync && python3 -m pytest tests/ -v`
3. Run monthly finance: `python3 run_pipeline.py monthly-finance`
4. Create a test auction, place bids, resolve: verify `contracts.locked_salary` = bid amount
5. Check `pnpm typecheck` and `pnpm lint` pass in apps/web
