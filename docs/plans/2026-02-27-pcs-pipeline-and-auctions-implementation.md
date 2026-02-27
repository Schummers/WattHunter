# PCS Pipeline & Auction System — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the PCS data pipeline (sync riders + daily scoring) and the full sealed-bid 3-round auction system (US-07 to US-13).

**Architecture:** FastAPI handles 3 backend jobs (sync-riders, daily-scoring, resolve-auction) triggered by GitHub Actions cron. Next.js frontend adds auction calendar, rider catalogue with bidding, and results pages. All state stored in Supabase Postgres with RLS.

**Tech Stack:** Python FastAPI + procyclingstats lib, Next.js 16 App Router, Supabase Postgres, GitHub Actions, Resend (email)

---

## Phase 2a — Validate PCS Library & Implement sync-riders

### Task 1: Validate procyclingstats library works

**Files:**
- Create: `services/pcs-sync/test_pcs_validation.py`

**Step 1: Write a validation script that fetches one real team**

```python
"""
One-time validation script — run manually to confirm:
1. procyclingstats library can fetch team rosters
2. Rate limiting works
3. Data shape matches our riders table
"""
import time
from procyclingstats import Team, Rider

def test_fetch_team():
    # Tudor Pro Cycling Team — PCS slug
    team = Team("team/tudor-pro-cycling-2026")
    riders = team.riders()
    print(f"Found {len(riders)} riders")
    assert len(riders) > 0, "No riders found"

    # Check first rider has expected fields
    first = riders[0]
    print(f"First rider: {first}")
    assert "rider_url" in first or hasattr(first, "rider_url"), f"Unexpected shape: {first}"
    return riders

def test_fetch_rider_profile(slug: str):
    rider = Rider(slug)
    info = rider.parse()
    print(f"Rider info keys: {list(info.keys()) if isinstance(info, dict) else dir(info)}")
    # We need: name, nationality, team, age, pcs_points, specialty
    return info

def test_fetch_rider_results(slug: str):
    rider = Rider(slug)
    results = rider.results()
    print(f"Found {len(results)} results")
    if results:
        print(f"First result: {results[0]}")
    return results

if __name__ == "__main__":
    print("=== Step 1: Fetch team roster ===")
    riders = test_fetch_team()

    if riders:
        slug = riders[0]["rider_url"] if isinstance(riders[0], dict) else riders[0].rider_url
        print(f"\n=== Step 2: Fetch rider profile ({slug}) ===")
        time.sleep(4)  # Rate limit
        profile = test_fetch_rider_profile(slug)

        print(f"\n=== Step 3: Fetch rider results ({slug}) ===")
        time.sleep(4)
        results = test_fetch_rider_results(slug)

    print("\n=== VALIDATION COMPLETE ===")
```

**Step 2: Run the validation script**

```bash
cd services/pcs-sync
pip install -r requirements.txt
python test_pcs_validation.py
```

Expected: prints rider list, profile fields, and race results. **Document the actual field names** returned — they may differ from our assumptions.

**Step 3: Commit the validation script with notes on actual PCS data shape**

```bash
git add services/pcs-sync/test_pcs_validation.py
git commit -m "chore: add PCS library validation script"
```

> **IMPORTANT:** Before proceeding to Task 2, document the actual field names returned by procyclingstats in a comment at the top of test_pcs_validation.py. The rest of the plan assumes certain fields — adapt if the library returns different names.

---

### Task 2: DB migration — add round + status to auction_bids, add points_delta to rider_pcs_history

**Files:**
- Create: `supabase/migrations/20260227000000_auction_rounds_and_scoring.sql`

**Step 1: Write the migration**

```sql
-- =============================================================
-- Migration: Support 3-round sealed-bid auctions + daily scoring
-- =============================================================

-- 1. auction_bids: add round column
ALTER TABLE auction_bids
  ADD COLUMN round int NOT NULL DEFAULT 1
  CHECK (round BETWEEN 1 AND 3);

-- 2. auction_bids: replace is_winning boolean with status enum
ALTER TABLE auction_bids
  ADD COLUMN status text NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'won', 'outbid', 'cancelled'));

-- Migrate existing data: is_winning=true → 'won', false → 'active'
UPDATE auction_bids SET status = 'won' WHERE is_winning = true;
UPDATE auction_bids SET status = 'active' WHERE is_winning = false;

-- Drop old column
ALTER TABLE auction_bids DROP COLUMN is_winning;

-- 3. Unique constraint: one active bid per player per rider per round
CREATE UNIQUE INDEX auction_bids_unique_per_round
  ON auction_bids(auction_id, rider_id, team_id, round)
  WHERE status = 'active';

-- 4. rider_pcs_history: add points_delta for actual race points earned
ALTER TABLE rider_pcs_history
  ADD COLUMN points_delta int NOT NULL DEFAULT 0;

-- 5. Update RLS for auction_bids (allow players to insert/update their own bids)
-- Players can insert bids for their own team during open auctions
CREATE POLICY auction_bids_insert ON auction_bids
  FOR INSERT TO authenticated
  WITH CHECK (
    team_id IN (SELECT id FROM teams WHERE user_id = auth.uid())
    AND auction_id IN (SELECT id FROM auctions WHERE status = 'open')
  );

-- Players can update (cancel) their own active bids
CREATE POLICY auction_bids_update ON auction_bids
  FOR UPDATE TO authenticated
  USING (
    team_id IN (SELECT id FROM teams WHERE user_id = auth.uid())
    AND status = 'active'
  )
  WITH CHECK (
    status IN ('active', 'cancelled')
  );
```

**Step 2: Apply the migration**

```bash
supabase db push
```

**Step 3: Commit**

```bash
git add supabase/migrations/20260227000000_auction_rounds_and_scoring.sql
git commit -m "feat: add round + status to auction_bids, points_delta to rider_pcs_history"
```

---

### Task 3: Implement sync-riders endpoint — Step A (team rosters)

**Files:**
- Modify: `services/pcs-sync/sync.py`
- Modify: `services/pcs-sync/main.py`

**Step 1: Define the ProTeam slugs configuration**

In `services/pcs-sync/sync.py`, add team configuration:

```python
# ProTeam PCS slugs for alpha — expand later
PROTEAM_SLUGS = [
    "team/tudor-pro-cycling-2026",
    "team/cofidis-2026",
    "team/q36-5-pro-cycling-team-2026",
    "team/unibet-2026",           # Verify exact slug from PCS
    "team/totalenergies-2026",
    "team/caja-rural-seguros-rga-2026",
    "team/bardiani-csf-2026",     # Verify exact slug from PCS
]
```

> **NOTE:** The exact PCS URL slugs MUST be verified during Task 1 validation. The slugs above are guesses — adapt to match actual PCS URLs.

**Step 2: Implement the rider profile sync function**

In `services/pcs-sync/sync.py`:

```python
import time
import logging
from datetime import datetime, date
from procyclingstats import Team, Rider
from supabase import Client

logger = logging.getLogger(__name__)

SALARY_FLOOR = 5_000
SALARY_CAP = 300_000

SPECIALTY_MAP = {
    # Map PCS specialty strings to our enum values
    # Fill in after Task 1 validation reveals actual PCS field names
    "climber": "climber",
    "sprinter": "sprinter",
    "one day races": "puncheur",
    "time trialist": "time_trialist",
    "all rounder": "all_rounder",
    # Add more mappings as discovered
}

def calculate_monthly_salary(pcs_points_1yr: int) -> int:
    """Calculate monthly salary from PCS rolling 1yr points."""
    annual = (pcs_points_1yr / 1000) * 500_000
    monthly = int(annual / 12)
    return max(SALARY_FLOOR, min(SALARY_CAP, monthly))


async def sync_team_roster(supabase: Client, team_slug: str, rate_limit_ms: int) -> dict:
    """Fetch all riders from a PCS team and upsert into riders table."""
    delay = rate_limit_ms / 1000
    team = Team(team_slug)
    roster = team.riders()
    synced = 0
    errors = []

    for rider_entry in roster:
        try:
            time.sleep(delay)
            slug = rider_entry["rider_url"] if isinstance(rider_entry, dict) else rider_entry.rider_url
            rider = Rider(slug)
            info = rider.parse()

            # Extract fields — adapt keys based on Task 1 validation
            pcs_points = info.get("points", 0) or 0
            salary = calculate_monthly_salary(pcs_points)

            rider_data = {
                "pcs_slug": slug,
                "full_name": info.get("name", "Unknown"),
                "nationality": info.get("nationality", "??")[:2].upper(),
                "real_team": info.get("team", "Unknown"),
                "team_type": "ProTeam",
                "photo_url": info.get("photo_url"),
                "age": info.get("age"),
                "specialty": SPECIALTY_MAP.get(info.get("specialty", "").lower(), "all_rounder"),
                "pcs_points_1yr": pcs_points,
                "pcs_rank": info.get("rank"),
                "monthly_salary": salary,
                "last_synced_at": datetime.utcnow().isoformat(),
            }

            supabase.table("riders").upsert(rider_data, on_conflict="pcs_slug").execute()
            synced += 1

        except Exception as e:
            logger.error(f"Failed to sync rider {rider_entry}: {e}")
            errors.append(str(e))

    return {"team": team_slug, "synced": synced, "errors": errors}


async def sync_all_riders(supabase: Client, rate_limit_ms: int) -> dict:
    """Sync all riders from all configured ProTeams."""
    results = []
    for slug in PROTEAM_SLUGS:
        logger.info(f"Syncing team: {slug}")
        result = await sync_team_roster(supabase, slug, rate_limit_ms)
        results.append(result)

    total_synced = sum(r["synced"] for r in results)
    total_errors = sum(len(r["errors"]) for r in results)
    return {
        "status": "completed",
        "total_synced": total_synced,
        "total_errors": total_errors,
        "teams": results,
    }
```

**Step 3: Wire up the /jobs/sync-riders endpoint in main.py**

Replace the existing placeholder `/sync/riders` with the new job endpoint:

```python
from sync import sync_all_riders

@app.post("/jobs/sync-riders")
async def job_sync_riders(request: Request):
    verify_secret(request)
    rate_limit = int(os.getenv("PCS_RATE_LIMIT_DELAY_MS", "4000"))
    result = await sync_all_riders(supabase, rate_limit)
    return result
```

**Step 4: Test locally**

```bash
cd services/pcs-sync
uvicorn main:app --reload
# In another terminal:
curl -X POST http://localhost:8000/jobs/sync-riders -H "X-API-Secret: your-secret"
```

Expected: riders from 7 ProTeams synced into Supabase `riders` table. Check Supabase dashboard to verify data.

**Step 5: Commit**

```bash
git add services/pcs-sync/sync.py services/pcs-sync/main.py
git commit -m "feat: implement sync-riders job — fetch 7 ProTeams from PCS"
```

---

### Task 4: Implement sync-riders Step B (race results for contracted riders)

**Files:**
- Modify: `services/pcs-sync/sync.py`
- Modify: `services/pcs-sync/main.py`

**Step 1: Add race results sync function**

In `services/pcs-sync/sync.py`:

```python
async def sync_race_results(supabase: Client, rate_limit_ms: int) -> dict:
    """Fetch today's race results for all contracted riders."""
    delay = rate_limit_ms / 1000
    today = date.today().isoformat()

    # Get all riders with active contracts
    response = supabase.table("contracts").select(
        "rider_id, riders(pcs_slug)"
    ).in_("status", ["active", "notice"]).execute()

    contracted = response.data or []
    synced = 0
    errors = []

    for contract in contracted:
        try:
            pcs_slug = contract["riders"]["pcs_slug"]
            time.sleep(delay)

            rider = Rider(pcs_slug)
            results = rider.results()

            # Filter for today's results and sum points earned
            # Adapt field names based on Task 1 validation
            today_points = 0
            for result in results:
                result_date = result.get("date", "")
                if result_date == today:
                    today_points += result.get("points", 0) or 0

            if today_points > 0:
                # Also update the cumulative pcs_points on rider_pcs_history
                rider_response = supabase.table("riders").select(
                    "pcs_points_1yr"
                ).eq("pcs_slug", pcs_slug).single().execute()

                current_cumulative = rider_response.data.get("pcs_points_1yr", 0) if rider_response.data else 0

                supabase.table("rider_pcs_history").upsert({
                    "rider_id": contract["rider_id"],
                    "date": today,
                    "pcs_points": current_cumulative,
                    "points_delta": today_points,
                }, on_conflict="rider_id,date").execute()

                synced += 1

        except Exception as e:
            logger.error(f"Failed to sync results for {contract}: {e}")
            errors.append(str(e))

    return {"status": "completed", "synced": synced, "errors": errors}
```

**Step 2: Add cleanup function**

```python
async def purge_old_history(supabase: Client, keep_days: int = 7):
    """Delete rider_pcs_history entries older than keep_days."""
    from datetime import timedelta
    cutoff = (date.today() - timedelta(days=keep_days)).isoformat()
    supabase.table("rider_pcs_history").delete().lt("date", cutoff).execute()
    return {"status": "purged", "cutoff": cutoff}
```

**Step 3: Wire up the endpoint — sync-riders now includes race results**

Update the `/jobs/sync-riders` endpoint in `main.py` to run both steps:

```python
@app.post("/jobs/sync-riders")
async def job_sync_riders(request: Request):
    verify_secret(request)
    rate_limit = int(os.getenv("PCS_RATE_LIMIT_DELAY_MS", "4000"))

    # Step A: Rider profiles
    roster_result = await sync_all_riders(supabase, rate_limit)

    # Step B: Race results for contracted riders
    results_result = await sync_race_results(supabase, rate_limit)

    # Cleanup old history
    purge_result = await purge_old_history(supabase)

    return {
        "roster": roster_result,
        "race_results": results_result,
        "purge": purge_result,
    }
```

**Step 4: Commit**

```bash
git add services/pcs-sync/sync.py services/pcs-sync/main.py
git commit -m "feat: add race results sync + history purge to sync-riders job"
```

---

### Task 5: Implement daily-scoring job

**Files:**
- Create: `services/pcs-sync/scoring.py`
- Modify: `services/pcs-sync/main.py`

**Step 1: Write the scoring logic**

```python
# services/pcs-sync/scoring.py
import os
import logging
from datetime import date
from supabase import Client

logger = logging.getLogger(__name__)

CONVERSION_RATE = int(os.getenv("CONVERSION_RATE_EUR_PER_PCS", "500"))


async def calculate_daily_scores(supabase: Client) -> dict:
    """
    For each contracted rider with points_delta today:
    1. Apply policy multipliers → XP
    2. Calculate revenue → treasury
    """
    today = date.today().isoformat()
    processed = 0
    errors = []

    # Get today's race results
    history = supabase.table("rider_pcs_history").select(
        "rider_id, points_delta"
    ).eq("date", today).gt("points_delta", 0).execute()

    if not history.data:
        return {"status": "completed", "processed": 0, "message": "No race results today"}

    rider_points = {h["rider_id"]: h["points_delta"] for h in history.data}

    # Get all active contracts with their team and policy info
    contracts = supabase.table("contracts").select(
        "id, team_id, rider_id"
    ).in_("status", ["active", "notice"]).execute()

    if not contracts.data:
        return {"status": "completed", "processed": 0, "message": "No active contracts"}

    # Group contracts by team for policy lookup
    team_contracts = {}
    for c in contracts.data:
        team_id = c["team_id"]
        if team_id not in team_contracts:
            team_contracts[team_id] = []
        team_contracts[team_id].append(c)

    # Get active policies for all teams
    policies = supabase.table("team_policies").select(
        "team_id, policy_id, policies(xp_bonus)"
    ).eq("is_active", True).execute()

    team_bonus = {}
    for p in policies.data or []:
        tid = p["team_id"]
        bonus = p["policies"]["xp_bonus"] if p.get("policies") else 0
        team_bonus[tid] = team_bonus.get(tid, 0) + float(bonus)

    # Calculate XP and revenue per team
    for team_id, team_clist in team_contracts.items():
        total_xp = 0
        total_revenue = 0
        bonus = team_bonus.get(team_id, 0)

        for contract in team_clist:
            rider_id = contract["rider_id"]
            raw_points = rider_points.get(rider_id, 0)
            if raw_points == 0:
                continue

            xp = raw_points * (1 + bonus)
            revenue = raw_points * CONVERSION_RATE

            # UPSERT rider_xp_daily
            supabase.table("rider_xp_daily").upsert({
                "team_id": team_id,
                "rider_id": rider_id,
                "contract_id": contract["id"],
                "date": today,
                "raw_pcs_points": raw_points,
                "policy_bonus": bonus,
                "xp_gained": xp,
            }, on_conflict="team_id,rider_id,date").execute()

            total_xp += xp
            total_revenue += revenue

        if total_xp > 0 or total_revenue > 0:
            # Update team cumulative XP
            team = supabase.table("teams").select(
                "id, cumulative_xp, treasury"
            ).eq("id", team_id).single().execute()

            if team.data:
                new_xp = team.data["cumulative_xp"] + int(total_xp)
                new_treasury = team.data["treasury"] + int(total_revenue)

                supabase.table("teams").update({
                    "cumulative_xp": new_xp,
                    "treasury": new_treasury,
                }).eq("id", team_id).execute()

                # Treasury log (with dedup)
                existing = supabase.table("treasury_log").select("id").eq(
                    "team_id", team_id
                ).eq("type", "rider_revenue").gte(
                    "created_at", f"{today}T00:00:00"
                ).execute()

                if not existing.data:
                    supabase.table("treasury_log").insert({
                        "team_id": team_id,
                        "type": "rider_revenue",
                        "amount": int(total_revenue),
                        "description": f"Revenus coureurs du {today}",
                    }).execute()

                processed += 1

    return {"status": "completed", "teams_processed": processed, "errors": errors}
```

**Step 2: Wire up the endpoint**

In `services/pcs-sync/main.py`:

```python
from scoring import calculate_daily_scores

@app.post("/jobs/daily-scoring")
async def job_daily_scoring(request: Request):
    verify_secret(request)
    result = await calculate_daily_scores(supabase)
    return result
```

**Step 3: Test locally with manual data**

Insert a test entry in `rider_pcs_history` via Supabase dashboard, then call:

```bash
curl -X POST http://localhost:8000/jobs/daily-scoring -H "X-API-Secret: your-secret"
```

**Step 4: Commit**

```bash
git add services/pcs-sync/scoring.py services/pcs-sync/main.py
git commit -m "feat: implement daily-scoring job — XP + treasury from race results"
```

---

### Task 6: Implement resolve-auction job

**Files:**
- Create: `services/pcs-sync/auction.py`
- Modify: `services/pcs-sync/main.py`

**Step 1: Write the auction resolution logic**

```python
# services/pcs-sync/auction.py
import logging
from datetime import date, datetime
from supabase import Client

logger = logging.getLogger(__name__)


async def resolve_current_round(supabase: Client) -> dict:
    """
    Resolve the current auction round:
    1. Find open auctions
    2. Determine current round
    3. For each rider with bids: highest bid wins (tiebreak: earliest timestamp)
    4. Create contracts, deduct treasury
    5. All in a single logical transaction
    """
    today = date.today()

    # Find open auctions
    auctions = supabase.table("auctions").select("*").eq("status", "open").execute()

    if not auctions.data:
        return {"status": "no_open_auctions"}

    results = []

    for auction in auctions.data:
        opens = datetime.fromisoformat(auction["opens_at"]).date()
        current_round = (today - opens).days + 1

        if current_round < 1 or current_round > 3:
            logger.warning(f"Auction {auction['id']} round {current_round} out of range, skipping")
            continue

        # Get all active bids for this round
        bids = supabase.table("auction_bids").select(
            "id, rider_id, team_id, amount, placed_at"
        ).eq("auction_id", auction["id"]).eq(
            "round", current_round
        ).eq("status", "active").execute()

        if not bids.data:
            logger.info(f"No active bids for auction {auction['id']} round {current_round}")
            if current_round == 3:
                supabase.table("auctions").update({"status": "closed", "resolved_at": datetime.utcnow().isoformat()}).eq("id", auction["id"]).execute()
            results.append({"auction_id": auction["id"], "round": current_round, "resolved": 0})
            continue

        # Group bids by rider
        rider_bids = {}
        for bid in bids.data:
            rid = bid["rider_id"]
            if rid not in rider_bids:
                rider_bids[rid] = []
            rider_bids[rid].append(bid)

        resolved_count = 0
        for rider_id, rbids in rider_bids.items():
            # Sort: highest amount first, then earliest timestamp
            rbids.sort(key=lambda b: (-b["amount"], b["placed_at"]))
            winner = rbids[0]
            losers = rbids[1:]

            # Mark winner
            supabase.table("auction_bids").update({
                "status": "won"
            }).eq("id", winner["id"]).execute()

            # Mark losers
            for loser in losers:
                supabase.table("auction_bids").update({
                    "status": "outbid"
                }).eq("id", loser["id"]).execute()

            # Get rider's current salary for the contract
            rider = supabase.table("riders").select(
                "monthly_salary"
            ).eq("id", rider_id).single().execute()

            locked_salary = rider.data["monthly_salary"] if rider.data else 5000

            # Create contract
            supabase.table("contracts").insert({
                "team_id": winner["team_id"],
                "rider_id": rider_id,
                "locked_salary": locked_salary,
                "status": "active",
                "purchased_at": datetime.utcnow().isoformat(),
            }).execute()

            # Deduct treasury
            team = supabase.table("teams").select(
                "treasury"
            ).eq("id", winner["team_id"]).single().execute()

            if team.data:
                new_treasury = team.data["treasury"] - winner["amount"]
                supabase.table("teams").update({
                    "treasury": new_treasury
                }).eq("id", winner["team_id"]).execute()

            # Treasury log
            supabase.table("treasury_log").insert({
                "team_id": winner["team_id"],
                "type": "auction_purchase",
                "amount": -winner["amount"],
                "description": f"Enchere Round {current_round}",
                "rider_id": rider_id,
            }).execute()

            # Mark rider as active in game
            supabase.table("riders").update({
                "is_active_in_game": True
            }).eq("id", rider_id).execute()

            resolved_count += 1

        # Close auction after round 3
        if current_round == 3:
            supabase.table("auctions").update({
                "status": "closed",
                "resolved_at": datetime.utcnow().isoformat(),
            }).eq("id", auction["id"]).execute()

        results.append({
            "auction_id": auction["id"],
            "round": current_round,
            "resolved": resolved_count,
        })

    return {"status": "completed", "auctions": results}
```

**Step 2: Wire up the endpoint**

In `services/pcs-sync/main.py`:

```python
from auction import resolve_current_round

@app.post("/jobs/resolve-auction")
async def job_resolve_auction(request: Request):
    verify_secret(request)
    result = await resolve_current_round(supabase)
    return result
```

**Step 3: Commit**

```bash
git add services/pcs-sync/auction.py services/pcs-sync/main.py
git commit -m "feat: implement resolve-auction job — 3-round sealed-bid resolution"
```

---

### Task 7: GitHub Actions workflows

**Files:**
- Create: `.github/workflows/daily-pipeline.yml`
- Create: `.github/workflows/auction-resolve.yml`

**Step 1: Create daily pipeline workflow**

```yaml
# .github/workflows/daily-pipeline.yml
name: Daily Pipeline (Sync + Scoring)

on:
  schedule:
    - cron: '0 8 * * *'  # 08:00 UTC every day
  workflow_dispatch:        # Allow manual trigger

jobs:
  daily-pipeline:
    runs-on: ubuntu-latest
    steps:
      - name: Sync riders from PCS
        run: |
          response=$(curl -sf -w "%{http_code}" -o /tmp/sync.json \
            -X POST "${{ secrets.FASTAPI_URL }}/jobs/sync-riders" \
            -H "X-API-Secret: ${{ secrets.FASTAPI_SECRET }}" \
            --max-time 1200)
          echo "Status: $response"
          cat /tmp/sync.json
          [ "$response" = "200" ] || exit 1

      - name: Calculate daily scores
        run: |
          response=$(curl -sf -w "%{http_code}" -o /tmp/scoring.json \
            -X POST "${{ secrets.FASTAPI_URL }}/jobs/daily-scoring" \
            -H "X-API-Secret: ${{ secrets.FASTAPI_SECRET }}" \
            --max-time 120)
          echo "Status: $response"
          cat /tmp/scoring.json
          [ "$response" = "200" ] || exit 1
```

**Step 2: Create auction resolve workflow**

```yaml
# .github/workflows/auction-resolve.yml
name: Auction Resolution (Midnight)

on:
  schedule:
    - cron: '0 0 * * *'  # 00:00 UTC every day
  workflow_dispatch:

jobs:
  resolve:
    runs-on: ubuntu-latest
    steps:
      - name: Resolve auction round
        run: |
          response=$(curl -sf -w "%{http_code}" -o /tmp/resolve.json \
            -X POST "${{ secrets.FASTAPI_URL }}/jobs/resolve-auction" \
            -H "X-API-Secret: ${{ secrets.FASTAPI_SECRET }}" \
            --max-time 120)
          echo "Status: $response"
          cat /tmp/resolve.json
          # OK even if no auctions open (returns 200 with no_open_auctions)
          [ "$response" = "200" ] || exit 1
```

**Step 3: Commit**

```bash
mkdir -p .github/workflows
git add .github/workflows/daily-pipeline.yml .github/workflows/auction-resolve.yml
git commit -m "feat: add GitHub Actions cron for daily pipeline + auction resolution"
```

> **NOTE:** After pushing, set `FASTAPI_URL` and `FASTAPI_SECRET` in GitHub repo Settings → Secrets and variables → Actions.

---

## Phase 2b — Frontend: Auction Calendar (US-07)

### Task 8: Create auction calendar page

**Files:**
- Create: `apps/web/app/(game)/league/[leagueId]/auctions/page.tsx`

**Step 1: Write the page**

```tsx
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@iconify/react";
import Link from "next/link";

export default async function AuctionsPage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  const supabase = await createClient();

  const { data: auctions } = await supabase
    .from("auctions")
    .select("*")
    .eq("league_id", leagueId)
    .order("opens_at", { ascending: false });

  const now = new Date();

  const active = auctions?.find((a) => a.status === "open");
  const upcoming = auctions?.filter((a) => a.status === "scheduled") ?? [];
  const closed = auctions?.filter((a) => a.status === "closed") ?? [];

  // Calculate round for active auction
  let activeRound = 0;
  if (active) {
    const opens = new Date(active.opens_at);
    activeRound = Math.floor((now.getTime() - opens.getTime()) / 86400000) + 1;
    activeRound = Math.min(Math.max(activeRound, 1), 3);
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-foreground">Encheres</h1>

      {active && (
        <div className="rounded-md border border-border bg-wh-surface p-6">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Icon icon="solar:bolt-linear" className="size-5 text-accent" />
                <span className="text-lg font-semibold text-foreground">
                  {active.name}
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Badge variant="secondary">Round {activeRound}/3</Badge>
                <span>Resolution a minuit</span>
              </div>
            </div>
            <Link href={`/league/${leagueId}/auctions/${active.id}`}>
              <Button variant="brand">Voir les coureurs</Button>
            </Link>
          </div>
        </div>
      )}

      {upcoming.length > 0 && (
        <>
          <div className="border-b border-border" />
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase text-muted-foreground">
              A venir
            </span>
            {upcoming.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between border-b border-border py-3 last:border-0"
              >
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">
                    {new Date(a.opens_at).toLocaleDateString("fr-FR")}
                  </span>
                  <span className="text-sm text-foreground">{a.name}</span>
                </div>
                <Badge variant="secondary">Planifie</Badge>
              </div>
            ))}
          </div>
        </>
      )}

      {closed.length > 0 && (
        <>
          <div className="border-b border-border" />
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase text-muted-foreground">
              Terminees
            </span>
            {closed.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between border-b border-border py-3 last:border-0"
              >
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">
                    {new Date(a.opens_at).toLocaleDateString("fr-FR")}
                  </span>
                  <span className="text-sm text-foreground">{a.name}</span>
                </div>
                <Link href={`/league/${leagueId}/auctions/${a.id}/results`}>
                  <Button variant="ghost" size="sm">Resultats</Button>
                </Link>
              </div>
            ))}
          </div>
        </>
      )}

      {(!auctions || auctions.length === 0) && (
        <div className="flex flex-col items-center gap-4 py-16">
          <Icon icon="solar:bolt-linear" className="size-12 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Aucune enchere planifiee pour le moment.
          </p>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Verify in browser**

```bash
pnpm dev
```

Navigate to `/league/[id]/auctions`. Should show empty state.

**Step 3: Commit**

```bash
git add apps/web/app/\(game\)/league/\[leagueId\]/auctions/page.tsx
git commit -m "feat: auction calendar page (US-07)"
```

---

## Phase 2c — Frontend: Rider Catalogue + Bidding (US-08, 09, 10, 11, 13)

### Task 9: Create auction detail page with treasury widget and rider table

**Files:**
- Create: `apps/web/app/(game)/league/[leagueId]/auctions/[auctionId]/page.tsx`
- Create: `apps/web/app/(game)/league/[leagueId]/auctions/[auctionId]/treasury-widget.tsx`
- Create: `apps/web/app/(game)/league/[leagueId]/auctions/[auctionId]/rider-table.tsx`

**Step 1: Write the treasury widget (US-13)**

```tsx
// treasury-widget.tsx
import { cn } from "@/lib/utils";

interface TreasuryWidgetProps {
  treasury: number;
  activeBidsTotal: number;
}

export function TreasuryWidget({ treasury, activeBidsTotal }: TreasuryWidgetProps) {
  const available = treasury - activeBidsTotal;

  return (
    <div className="sticky top-0 z-10 flex items-center gap-8 border-b border-border bg-wh-surface py-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-muted-foreground">Tresorerie</span>
        <span className="text-sm font-semibold text-foreground">
          {treasury.toLocaleString("fr-FR")} EUR
        </span>
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-muted-foreground">Mises actives</span>
        <span className="text-sm font-semibold text-foreground">
          {activeBidsTotal.toLocaleString("fr-FR")} EUR
        </span>
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-muted-foreground">Budget disponible</span>
        <span
          className={cn(
            "text-sm font-semibold",
            available >= 50_000 ? "text-accent" : "text-destructive"
          )}
        >
          {available.toLocaleString("fr-FR")} EUR
        </span>
      </div>
    </div>
  );
}
```

**Step 2: Write the rider table (US-08)**

```tsx
// rider-table.tsx
"use client";

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Rider {
  id: string;
  full_name: string;
  real_team: string;
  specialty: string;
  nationality: string;
  pcs_points_1yr: number;
  monthly_salary: number;
  photo_url: string | null;
  is_contracted: boolean;
}

interface RiderTableProps {
  riders: Rider[];
  myBidRiderIds: Set<string>;
  onRiderClick: (rider: Rider) => void;
}

const SPECIALTY_LABELS: Record<string, string> = {
  climber: "GRI",
  sprinter: "SPR",
  rouleur: "ROU",
  puncheur: "PUN",
  time_trialist: "CLM",
  all_rounder: "POL",
};

export function RiderTable({ riders, myBidRiderIds, onRiderClick }: RiderTableProps) {
  const [search, setSearch] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [specialtyFilter, setSpecialtyFilter] = useState("");

  const teams = useMemo(
    () => [...new Set(riders.map((r) => r.real_team))].sort(),
    [riders]
  );

  const filtered = useMemo(() => {
    return riders
      .filter((r) => {
        if (search && !r.full_name.toLowerCase().includes(search.toLowerCase())) return false;
        if (teamFilter && r.real_team !== teamFilter) return false;
        if (specialtyFilter && r.specialty !== specialtyFilter) return false;
        return true;
      })
      .sort((a, b) => b.pcs_points_1yr - a.pcs_points_1yr);
  }, [riders, search, teamFilter, specialtyFilter]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Rechercher un coureur..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <select
          value={teamFilter}
          onChange={(e) => setTeamFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Toutes les equipes</option>
          {teams.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select
          value={specialtyFilter}
          onChange={(e) => setSpecialtyFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Toutes specialites</option>
          <option value="climber">Grimpeur</option>
          <option value="sprinter">Sprinteur</option>
          <option value="rouleur">Rouleur</option>
          <option value="puncheur">Puncheur</option>
          <option value="time_trialist">CLM</option>
          <option value="all_rounder">Polyvalent</option>
        </select>
      </div>

      <span className="text-xs font-medium uppercase text-muted-foreground">
        {filtered.length} coureurs
      </span>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Coureur</TableHead>
            <TableHead>Equipe</TableHead>
            <TableHead>Spe.</TableHead>
            <TableHead>Nat.</TableHead>
            <TableHead className="text-right">PCS</TableHead>
            <TableHead className="text-right">Salaire</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((rider) => (
            <TableRow
              key={rider.id}
              className={
                rider.is_contracted
                  ? "opacity-40 cursor-not-allowed"
                  : "cursor-pointer hover:bg-muted"
              }
              onClick={() => !rider.is_contracted && onRiderClick(rider)}
            >
              <TableCell className="font-medium">{rider.full_name}</TableCell>
              <TableCell className="text-muted-foreground">{rider.real_team}</TableCell>
              <TableCell>
                <span className="text-xs text-muted-foreground">
                  {SPECIALTY_LABELS[rider.specialty] ?? rider.specialty}
                </span>
              </TableCell>
              <TableCell className="text-muted-foreground">{rider.nationality}</TableCell>
              <TableCell className="text-right">{rider.pcs_points_1yr.toLocaleString("fr-FR")}</TableCell>
              <TableCell className="text-right">
                {rider.monthly_salary.toLocaleString("fr-FR")} EUR
              </TableCell>
              <TableCell>
                {rider.is_contracted && <Badge variant="outline">Recrute</Badge>}
                {myBidRiderIds.has(rider.id) && <Badge variant="secondary">Mise</Badge>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

**Step 3: Write the auction detail page (orchestrator)**

```tsx
// page.tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { TreasuryWidget } from "./treasury-widget";
import { AuctionClient } from "./auction-client";

export default async function AuctionDetailPage({
  params,
}: {
  params: Promise<{ leagueId: string; auctionId: string }>;
}) {
  const { leagueId, auctionId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [
    { data: auction },
    { data: team },
    { data: riders },
    { data: myBids },
    { data: contracts },
  ] = await Promise.all([
    supabase.from("auctions").select("*").eq("id", auctionId).single(),
    supabase.from("teams").select("*").eq("user_id", user.id).eq("league_id", leagueId).single(),
    supabase.from("riders").select("*").eq("team_type", "ProTeam").order("pcs_points_1yr", { ascending: false }),
    supabase.from("auction_bids").select("*").eq("auction_id", auctionId),
    supabase.from("contracts").select("rider_id").in("status", ["active", "notice"]),
  ]);

  if (!auction || !team) {
    return <p className="text-muted-foreground">Enchere introuvable.</p>;
  }

  // Calculate current round
  const now = new Date();
  const opens = new Date(auction.opens_at);
  const currentRound = Math.min(Math.max(Math.floor((now.getTime() - opens.getTime()) / 86400000) + 1, 1), 3);

  // My bids for current round
  const myCurrentBids = (myBids ?? []).filter(
    (b) => b.team_id === team.id && b.round === currentRound && b.status === "active"
  );
  const activeBidsTotal = myCurrentBids.reduce((sum, b) => sum + b.amount, 0);

  // Contracted rider IDs
  const contractedIds = new Set((contracts ?? []).map((c) => c.rider_id));

  // Enrich riders with contract status
  const enrichedRiders = (riders ?? []).map((r) => ({
    ...r,
    is_contracted: contractedIds.has(r.id),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">{auction.name}</h1>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Round {currentRound}/3</span>
          <span>·</span>
          <span>Resolution a minuit</span>
        </div>
      </div>

      <TreasuryWidget treasury={team.treasury} activeBidsTotal={activeBidsTotal} />

      <AuctionClient
        riders={enrichedRiders}
        myBids={myCurrentBids}
        team={team}
        auctionId={auctionId}
        currentRound={currentRound}
      />
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add apps/web/app/\(game\)/league/\[leagueId\]/auctions/\[auctionId\]/
git commit -m "feat: auction detail page with treasury widget + rider table (US-08, US-13)"
```

---

### Task 10: Create rider detail dialog + bidding (US-09, US-10, US-11)

**Files:**
- Create: `apps/web/app/(game)/league/[leagueId]/auctions/[auctionId]/rider-dialog.tsx`
- Create: `apps/web/app/(game)/league/[leagueId]/auctions/[auctionId]/actions.ts`
- Create: `apps/web/app/(game)/league/[leagueId]/auctions/[auctionId]/auction-client.tsx`

**Step 1: Write the server actions for bidding**

```tsx
// actions.ts
"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod/v4";

const BidSchema = z.object({
  auctionId: z.string().uuid(),
  riderId: z.string().uuid(),
  amount: z.number().int().positive().multipleOf(100),
  round: z.number().int().min(1).max(3),
});

export async function placeBid(input: z.infer<typeof BidSchema>) {
  const parsed = BidSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Donnees invalides" };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifie" };

  const { data: team } = await supabase
    .from("teams")
    .select("id, treasury")
    .eq("user_id", user.id)
    .single();

  if (!team) return { error: "Equipe introuvable" };

  // Check rider min salary
  const { data: rider } = await supabase
    .from("riders")
    .select("monthly_salary")
    .eq("id", parsed.data.riderId)
    .single();

  if (!rider) return { error: "Coureur introuvable" };
  if (parsed.data.amount < rider.monthly_salary) {
    return { error: `Mise minimum: ${rider.monthly_salary} EUR` };
  }

  // Budget check: sum of active bids + this bid <= treasury
  const { data: activeBids } = await supabase
    .from("auction_bids")
    .select("amount")
    .eq("team_id", team.id)
    .eq("auction_id", parsed.data.auctionId)
    .eq("round", parsed.data.round)
    .eq("status", "active");

  const currentTotal = (activeBids ?? []).reduce((s, b) => s + b.amount, 0);
  if (currentTotal + parsed.data.amount > team.treasury) {
    return { error: "Budget insuffisant" };
  }

  // Upsert bid (insert or update if already exists for this rider/round)
  const { error } = await supabase.from("auction_bids").upsert(
    {
      auction_id: parsed.data.auctionId,
      rider_id: parsed.data.riderId,
      team_id: team.id,
      amount: parsed.data.amount,
      round: parsed.data.round,
      status: "active",
      placed_at: new Date().toISOString(),
    },
    { onConflict: "auction_id,rider_id,team_id,round" }
  );

  if (error) return { error: error.message };

  revalidatePath(`/league`);
  return { success: true };
}

export async function cancelBid(bidId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("auction_bids")
    .update({ status: "cancelled" })
    .eq("id", bidId);

  if (error) return { error: error.message };

  revalidatePath(`/league`);
  return { success: true };
}
```

**Step 2: Write the rider detail dialog**

```tsx
// rider-dialog.tsx
"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { placeBid, cancelBid } from "./actions";

interface Rider {
  id: string;
  full_name: string;
  real_team: string;
  specialty: string;
  nationality: string;
  pcs_points_1yr: number;
  pcs_rank: number | null;
  monthly_salary: number;
  photo_url: string | null;
  age: number | null;
}

interface ExistingBid {
  id: string;
  amount: number;
}

interface RiderDialogProps {
  rider: Rider | null;
  existingBid: ExistingBid | null;
  treasury: number;
  activeBidsTotal: number;
  auctionId: string;
  currentRound: number;
  onClose: () => void;
}

const SPECIALTY_NAMES: Record<string, string> = {
  climber: "Grimpeur",
  sprinter: "Sprinteur",
  rouleur: "Rouleur",
  puncheur: "Puncheur",
  time_trialist: "Contre-la-montre",
  all_rounder: "Polyvalent",
};

export function RiderDialog({
  rider,
  existingBid,
  treasury,
  activeBidsTotal,
  auctionId,
  currentRound,
  onClose,
}: RiderDialogProps) {
  const [amount, setAmount] = useState(
    existingBid?.amount?.toString() ?? rider?.monthly_salary?.toString() ?? ""
  );
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  if (!rider) return null;

  const numAmount = parseInt(amount) || 0;
  const budgetAfter = treasury - activeBidsTotal - numAmount + (existingBid?.amount ?? 0);
  const isValid =
    numAmount >= rider.monthly_salary &&
    numAmount % 100 === 0 &&
    budgetAfter >= 0;

  function handleSubmit() {
    setError("");
    startTransition(async () => {
      const result = await placeBid({
        auctionId,
        riderId: rider!.id,
        amount: numAmount,
        round: currentRound,
      });
      if (result.error) {
        setError(result.error);
      } else {
        onClose();
      }
    });
  }

  function handleCancel() {
    if (!existingBid) return;
    startTransition(async () => {
      const result = await cancelBid(existingBid.id);
      if (result.error) {
        setError(result.error);
      } else {
        onClose();
      }
    });
  }

  const infoRows = [
    { label: "Specialite", value: SPECIALTY_NAMES[rider.specialty] ?? rider.specialty },
    { label: "Points PCS (1 an)", value: `${rider.pcs_points_1yr.toLocaleString("fr-FR")} pts` },
    { label: "Classement PCS", value: rider.pcs_rank ? `#${rider.pcs_rank}` : "—" },
    { label: "Salaire minimum", value: `${rider.monthly_salary.toLocaleString("fr-FR")} EUR/mois` },
  ];

  return (
    <Dialog open={!!rider} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-4">
            {rider.photo_url ? (
              <img
                src={rider.photo_url}
                alt={rider.full_name}
                className="size-16 rounded-md object-cover"
              />
            ) : (
              <div className="flex size-16 items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
                Photo
              </div>
            )}
            <div>
              <DialogTitle className="text-lg">{rider.full_name}</DialogTitle>
              <p className="text-sm text-muted-foreground">
                {rider.real_team} · {rider.nationality}
                {rider.age ? ` · ${rider.age} ans` : ""}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="my-4 border-b border-border" />

        {infoRows.map((row, i) => (
          <div
            key={row.label}
            className={cn(
              "flex items-center justify-between py-2 text-sm",
              i < infoRows.length - 1 && "border-b border-border"
            )}
          >
            <span className="text-muted-foreground">{row.label}</span>
            <span className="font-medium text-foreground">{row.value}</span>
          </div>
        ))}

        <div className="my-4 border-b border-border" />

        <div className="flex flex-col gap-3">
          <span className="text-sm font-semibold text-foreground">
            {existingBid ? "Modifier la mise" : "Placer une mise"}
          </span>

          {existingBid && (
            <p className="text-sm text-muted-foreground">
              Mise actuelle : {existingBid.amount.toLocaleString("fr-FR")} EUR
            </p>
          )}

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-foreground">
              Montant (min. {rider.monthly_salary.toLocaleString("fr-FR")} EUR)
            </label>
            <Input
              type="number"
              step={100}
              min={rider.monthly_salary}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={rider.monthly_salary.toString()}
            />
          </div>

          <p
            className={cn(
              "text-xs",
              budgetAfter >= 50_000
                ? "text-muted-foreground"
                : budgetAfter >= 0
                  ? "text-muted-foreground"
                  : "text-destructive"
            )}
          >
            Budget dispo apres mise : {budgetAfter.toLocaleString("fr-FR")} EUR
          </p>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button
            variant="brand"
            className="w-full"
            disabled={!isValid || isPending}
            onClick={handleSubmit}
          >
            {isPending
              ? "..."
              : existingBid
                ? "Modifier la mise"
                : "Confirmer la mise"}
          </Button>

          {existingBid && (
            <Button
              variant="ghost"
              className="w-full text-destructive"
              disabled={isPending}
              onClick={handleCancel}
            >
              Annuler la mise
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 3: Write the auction-client orchestrator**

```tsx
// auction-client.tsx
"use client";

import { useState } from "react";
import { RiderTable } from "./rider-table";
import { RiderDialog } from "./rider-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cancelBid } from "./actions";

interface Rider {
  id: string;
  full_name: string;
  real_team: string;
  specialty: string;
  nationality: string;
  pcs_points_1yr: number;
  pcs_rank: number | null;
  monthly_salary: number;
  photo_url: string | null;
  age: number | null;
  is_contracted: boolean;
}

interface Bid {
  id: string;
  rider_id: string;
  amount: number;
}

interface Team {
  id: string;
  treasury: number;
}

interface AuctionClientProps {
  riders: Rider[];
  myBids: Bid[];
  team: Team;
  auctionId: string;
  currentRound: number;
}

export function AuctionClient({
  riders,
  myBids,
  team,
  auctionId,
  currentRound,
}: AuctionClientProps) {
  const [selectedRider, setSelectedRider] = useState<Rider | null>(null);

  const myBidRiderIds = new Set(myBids.map((b) => b.rider_id));
  const activeBidsTotal = myBids.reduce((s, b) => s + b.amount, 0);

  const existingBid = selectedRider
    ? myBids.find((b) => b.rider_id === selectedRider.id) ?? null
    : null;

  return (
    <>
      {myBids.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase text-muted-foreground">
            Mes mises ({myBids.length})
          </span>
          {myBids.map((bid) => {
            const rider = riders.find((r) => r.id === bid.rider_id);
            return (
              <div
                key={bid.id}
                className="flex items-center justify-between border-b border-border py-2 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-foreground">
                    {rider?.full_name ?? "—"}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {rider?.real_team}
                  </span>
                  <span className="text-sm font-semibold text-accent">
                    {bid.amount.toLocaleString("fr-FR")} EUR
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => rider && setSelectedRider(rider)}
                  >
                    Modifier
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => cancelBid(bid.id)}
                  >
                    Annuler
                  </Button>
                </div>
              </div>
            );
          })}
          <div className="my-2 border-b border-border" />
        </div>
      )}

      <RiderTable
        riders={riders}
        myBidRiderIds={myBidRiderIds}
        onRiderClick={setSelectedRider}
      />

      <RiderDialog
        rider={selectedRider}
        existingBid={existingBid}
        treasury={team.treasury}
        activeBidsTotal={activeBidsTotal}
        auctionId={auctionId}
        currentRound={currentRound}
        onClose={() => setSelectedRider(null)}
      />
    </>
  );
}
```

**Step 4: Commit**

```bash
git add apps/web/app/\(game\)/league/\[leagueId\]/auctions/\[auctionId\]/
git commit -m "feat: rider detail dialog + bidding actions (US-09, US-10, US-11)"
```

---

## Phase 2d — Frontend: Results Page

### Task 11: Create round results page

**Files:**
- Create: `apps/web/app/(game)/league/[leagueId]/auctions/[auctionId]/results/page.tsx`

**Step 1: Write the results page**

```tsx
import { createClient } from "@/lib/supabase/server";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function AuctionResultsPage({
  params,
}: {
  params: Promise<{ leagueId: string; auctionId: string }>;
}) {
  const { leagueId, auctionId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: auction }, { data: bids }, { data: teams }] = await Promise.all([
    supabase.from("auctions").select("*").eq("id", auctionId).single(),
    supabase
      .from("auction_bids")
      .select("*, riders(full_name, real_team, specialty, nationality), teams(name)")
      .eq("auction_id", auctionId)
      .in("status", ["won", "outbid"]),
    supabase.from("teams").select("id, user_id").eq("league_id", leagueId),
  ]);

  if (!auction) {
    return <p className="text-muted-foreground">Enchere introuvable.</p>;
  }

  const myTeamId = teams?.find((t) => t.user_id === user?.id)?.id;

  // Group by round
  const rounds = [1, 2, 3];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">{auction.name}</h1>
        <Badge variant="outline">Terminee</Badge>
      </div>

      <Tabs defaultValue="1">
        <TabsList variant="line">
          {rounds.map((r) => (
            <TabsTrigger key={r} value={r.toString()}>
              Round {r}
            </TabsTrigger>
          ))}
        </TabsList>

        {rounds.map((round) => {
          const roundBids = (bids ?? []).filter((b) => b.round === round);
          const won = roundBids.filter((b) => b.status === "won");
          const total = won.reduce((s, b) => s + b.amount, 0);

          return (
            <TabsContent key={round} value={round.toString()}>
              {won.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Aucun coureur attribue pour ce round.
                </p>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Coureur</TableHead>
                        <TableHead>Equipe</TableHead>
                        <TableHead>Spe.</TableHead>
                        <TableHead>Gagnant</TableHead>
                        <TableHead className="text-right">Montant</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {won.map((bid) => (
                        <TableRow key={bid.id}>
                          <TableCell className="font-medium">
                            {bid.riders?.full_name}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {bid.riders?.real_team}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {bid.riders?.nationality}
                          </TableCell>
                          <TableCell
                            className={
                              bid.team_id === myTeamId
                                ? "font-medium text-accent"
                                : "text-foreground"
                            }
                          >
                            {bid.teams?.name}
                          </TableCell>
                          <TableCell className="text-right">
                            {bid.amount.toLocaleString("fr-FR")} EUR
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <div className="my-6 border-b border-border" />

                  <div className="flex flex-col gap-0">
                    <div className="flex items-center justify-between border-b border-border py-2 text-sm">
                      <span className="text-muted-foreground">Coureurs attribues</span>
                      <span className="font-medium text-foreground">{won.length}</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-border py-2 text-sm">
                      <span className="text-muted-foreground">Montant total</span>
                      <span className="font-medium text-foreground">
                        {total.toLocaleString("fr-FR")} EUR
                      </span>
                    </div>
                    {won.length > 0 && (
                      <div className="flex items-center justify-between py-2 text-sm">
                        <span className="text-muted-foreground">Mise moyenne</span>
                        <span className="font-medium text-foreground">
                          {Math.round(total / won.length).toLocaleString("fr-FR")} EUR
                        </span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/app/\(game\)/league/\[leagueId\]/auctions/\[auctionId\]/results/
git commit -m "feat: auction results page with round tabs"
```

---

## Phase 2e — Email Notification (US-12)

### Task 12: Add email notification to resolve-auction job

**Files:**
- Modify: `services/pcs-sync/auction.py`
- Create: `services/pcs-sync/email_notify.py`
- Modify: `services/pcs-sync/requirements.txt`

**Step 1: Add Resend to requirements**

Add to `requirements.txt`:

```
resend==2.0.0
```

**Step 2: Write the email notification module**

```python
# services/pcs-sync/email_notify.py
import os
import logging
import resend

logger = logging.getLogger(__name__)

resend.api_key = os.getenv("RESEND_API_KEY", "")
FROM_EMAIL = os.getenv("FROM_EMAIL", "WattHunter <noreply@watthunter.com>")


def send_round_recap(
    to_email: str,
    player_name: str,
    auction_name: str,
    current_round: int,
    won: list[dict],
    lost: list[dict],
    treasury: int,
):
    """Send round recap email to a player."""
    if not resend.api_key:
        logger.warning("RESEND_API_KEY not set, skipping email")
        return

    won_lines = "\n".join(
        f"  - {w['rider_name']} ({w['team']}) — {w['amount']:,} EUR".replace(",", " ")
        for w in won
    ) or "  Aucun"

    lost_lines = "\n".join(
        f"  - {l['rider_name']} ({l['team']}) — ta mise: {l['my_amount']:,} EUR / gagnante: {l['winning_amount']:,} EUR".replace(",", " ")
        for l in lost
    ) or "  Aucune"

    body = f"""Bonjour {player_name},

Voici les resultats du Round {current_round} :

COUREURS REMPORTES
{won_lines}

MISES PERDUES
{lost_lines}

Tresorerie : {treasury:,} EUR

{"Round " + str(current_round + 1) + " commence demain." if current_round < 3 else "Enchere terminee."}

— WattHunter
""".replace(",", " ")

    try:
        resend.Emails.send({
            "from": FROM_EMAIL,
            "to": [to_email],
            "subject": f"Round {current_round}/3 termine — {auction_name}",
            "text": body,
        })
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {e}")
```

**Step 3: Integrate into resolve-auction**

Add email sending at the end of `resolve_current_round()` in `auction.py`, after all riders are resolved for the round. Fetch each player's email, their won/lost bids, and call `send_round_recap()`.

**Step 4: Commit**

```bash
git add services/pcs-sync/email_notify.py services/pcs-sync/auction.py services/pcs-sync/requirements.txt
git commit -m "feat: add email notification after auction round resolution (US-12)"
```

---

## Post-Implementation Checklist

After all tasks are complete:

1. [ ] Run `pnpm typecheck` — zero errors
2. [ ] Run `pnpm lint` — zero errors
3. [ ] Test full flow in browser: calendar → catalogue → bid → modify → cancel
4. [ ] Test FastAPI endpoints locally with curl
5. [ ] Verify Supabase data after sync-riders
6. [ ] Push to GitHub and set Actions secrets (`FASTAPI_URL`, `FASTAPI_SECRET`)
7. [ ] Update `docs/ARCHITECTURE.md` with new routes and jobs
8. [ ] Update `docs/GAME_RULES.md` with 3-round sealed-bid mechanic
