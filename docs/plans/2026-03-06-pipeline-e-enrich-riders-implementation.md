# Pipeline E — Enrich Riders Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a new pipeline that visits each rider's PCS page to enrich our DB with photo, bio, specialty, team history, season points, and current season results.

**Architecture:** New `enrich.py` module with batch scraping (5 riders sequential, 1min pause). Reuses existing `race_results` and `rider_season_rankings` tables. Creates one new table `rider_teams`. Adds 4 columns to `riders`. Updates specialty CHECK constraint.

**Tech Stack:** Python 3.9+, Playwright, procyclingstats v0.2.7, Supabase

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260306000000_enrich_riders.sql`

**Step 1: Write the migration**

```sql
-- Pipeline E: Enrich riders with individual page data

-- 1. Add new columns to riders
ALTER TABLE public.riders ADD COLUMN IF NOT EXISTS birthdate date;
ALTER TABLE public.riders ADD COLUMN IF NOT EXISTS birth_place text;
ALTER TABLE public.riders ADD COLUMN IF NOT EXISTS height_cm int;
ALTER TABLE public.riders ADD COLUMN IF NOT EXISTS weight_kg int;

-- 2. Update specialty CHECK to accept new values from PCS specialty assignment
-- Drop old constraint and create new one
ALTER TABLE public.riders DROP CONSTRAINT IF EXISTS riders_specialty_check;
ALTER TABLE public.riders ADD CONSTRAINT riders_specialty_check
  CHECK (specialty IN ('climber','sprinter','rouleur','puncheur','time_trialist','all_rounder','GC','OneDay','TT','Sprint'));

-- 3. Create rider_teams table (team history from PCS)
CREATE TABLE public.rider_teams (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id    uuid NOT NULL REFERENCES public.riders(id) ON DELETE CASCADE,
  team_name   text NOT NULL,
  team_url    text,
  season      int NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(rider_id, team_url, season)
);

ALTER TABLE public.rider_teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read rider_teams"
  ON public.rider_teams
  FOR SELECT
  USING (true);
```

**Step 2: Apply the migration**

Run: `supabase db push`
Expected: Migration applied successfully.

**Step 3: Commit**

```bash
git add supabase/migrations/20260306000000_enrich_riders.sql
git commit -m "feat: add migration for rider enrichment (Pipeline E)

Adds birthdate, birth_place, height_cm, weight_kg columns to riders.
Updates specialty CHECK for PCS-based assignment.
Creates rider_teams table for team history.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Core Enrichment Module

**Files:**
- Create: `services/pcs-sync/enrich.py`

**Step 1: Write the failing test**

Create `services/pcs-sync/tests/test_enrich.py`:

```python
"""Tests for enrich.py — rider enrichment from individual PCS pages."""
from __future__ import annotations

import pytest
from conftest import make_supabase


def test_assign_specialty_gc():
    """Highest among GC/OneDay/TT/Sprint wins."""
    from enrich import assign_specialty
    points = {"GC": 3000, "One day races": 1500, "Time trial": 800, "Sprint": 200, "Climber": 5000, "Hills": 4000}
    assert assign_specialty(points) == "GC"


def test_assign_specialty_oneday():
    from enrich import assign_specialty
    points = {"GC": 500, "One day races": 2000, "Time trial": 300, "Sprint": 100}
    assert assign_specialty(points) == "OneDay"


def test_assign_specialty_tt():
    from enrich import assign_specialty
    points = {"GC": 100, "One day races": 200, "Time trial": 3000, "Sprint": 100}
    assert assign_specialty(points) == "TT"


def test_assign_specialty_sprint():
    from enrich import assign_specialty
    points = {"GC": 100, "One day races": 200, "Time trial": 300, "Sprint": 5000}
    assert assign_specialty(points) == "Sprint"


def test_assign_specialty_empty():
    """No matching keys → all_rounder."""
    from enrich import assign_specialty
    assert assign_specialty({}) == "all_rounder"
    assert assign_specialty({"Climber": 5000, "Hills": 3000}) == "all_rounder"


def test_assign_specialty_ignores_climber_hills():
    """Climber and Hills are ignored even if highest."""
    from enrich import assign_specialty
    points = {"GC": 100, "One day races": 50, "Climber": 9999, "Hills": 8888}
    assert assign_specialty(points) == "GC"


def test_parse_rider_data():
    """parse_rider_data extracts the right fields from Rider.parse() output."""
    from enrich import parse_rider_data

    raw = {
        "name": "Tadej Pogacar",
        "birthdate": "1998-09-21",
        "place_of_birth": "Komenda",
        "height": 176,
        "weight": 66,
        "image_url": "https://www.procyclingstats.com/images/riders/tadej-pogacar.jpg",
        "nationality": "SI",
    }
    specialty_points = {"GC": 5000, "One day races": 3000, "Time trial": 1500, "Sprint": 200}
    teams = [
        {"team_name": "UAE Team Emirates", "team_url": "team/uae-team-emirates-2026", "season": 2026},
        {"team_name": "UAE Team Emirates", "team_url": "team/uae-team-emirates-2025", "season": 2025},
    ]
    season_points = [{"season": 2024, "points": 4500}, {"season": 2025, "points": 5200}]

    result = parse_rider_data(raw, specialty_points, teams, season_points)

    assert result["photo_url"] == raw["image_url"]
    assert result["birthdate"] == "1998-09-21"
    assert result["birth_place"] == "Komenda"
    assert result["height_cm"] == 176
    assert result["weight_kg"] == 66
    assert result["specialty"] == "GC"
    assert len(result["teams"]) == 2
    assert len(result["season_points"]) == 2
```

**Step 2: Run test to verify it fails**

Run: `cd services/pcs-sync && python3 -m pytest tests/test_enrich.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'enrich'`

**Step 3: Write the enrichment module**

Create `services/pcs-sync/enrich.py`:

```python
"""
Pipeline E — Enrich riders with data from individual PCS pages.
Visits /rider/{slug} for each rider and extracts: photo, bio, specialty,
team history, season points, and current season results.

Scraping strategy: 5 riders sequential, 1 minute pause between batches.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from supabase import Client

from sync import fetch_html, get_supabase, CLOUDFLARE_MARKERS

logger = logging.getLogger(__name__)

# Map PCS specialty keys to our DB values (ignore Climber and Hills)
SPECIALTY_MAP = {
    "GC": "GC",
    "One day races": "OneDay",
    "Time trial": "TT",
    "Sprint": "Sprint",
}

BATCH_SIZE = 5
BATCH_PAUSE_SECONDS = 60


def assign_specialty(points_per_speciality: Dict[str, int]) -> str:
    """Return the single specialty with the most points among GC/OneDay/TT/Sprint."""
    filtered = {
        SPECIALTY_MAP[k]: v
        for k, v in points_per_speciality.items()
        if k in SPECIALTY_MAP
    }
    if not filtered:
        return "all_rounder"
    return max(filtered, key=filtered.get)


def parse_rider_data(
    raw: Dict[str, Any],
    specialty_points: Dict[str, int],
    teams: List[Dict[str, Any]],
    season_points: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Extract structured rider data from procyclingstats Rider output."""
    return {
        "photo_url": raw.get("image_url") or None,
        "birthdate": raw.get("birthdate") or None,
        "birth_place": raw.get("place_of_birth") or None,
        "height_cm": raw.get("height") or None,
        "weight_kg": raw.get("weight") or None,
        "specialty": assign_specialty(specialty_points),
        "teams": teams,
        "season_points": season_points,
    }


async def enrich_single_rider(
    supabase: Client,
    page,
    rider_id: str,
    pcs_slug: str,
) -> Dict[str, Any]:
    """Fetch a single rider's PCS page and upsert enriched data.

    Returns a dict with status and any errors.
    """
    from procyclingstats import Rider

    try:
        html = await fetch_html(page, pcs_slug)
        rider_obj = Rider(pcs_slug, html=html, update_html=False)

        # Extract all data from the single page
        raw = rider_obj.parse()
        specialty_points = rider_obj.points_per_speciality()
        teams = rider_obj.teams_history()
        season_points = rider_obj.points_per_season_history()
        season_results = rider_obj.season_results()

        parsed = parse_rider_data(raw, specialty_points, teams, season_points)

        # 1. Update riders table with bio + specialty
        update_data = {
            "photo_url": parsed["photo_url"],
            "birthdate": parsed["birthdate"],
            "birth_place": parsed["birth_place"],
            "height_cm": parsed["height_cm"],
            "weight_kg": parsed["weight_kg"],
            "specialty": parsed["specialty"],
            "last_synced_at": datetime.utcnow().isoformat(),
        }
        supabase.table("riders").update(update_data).eq("id", rider_id).execute()

        # 2. Upsert team history into rider_teams
        for team in parsed["teams"]:
            team_url = team.get("team_url", "")
            team_name = team.get("team_name", "")
            season = team.get("season")
            if team_name and season:
                supabase.table("rider_teams").upsert(
                    {
                        "rider_id": rider_id,
                        "team_name": team_name,
                        "team_url": team_url,
                        "season": int(season),
                    },
                    on_conflict="rider_id,team_url,season",
                ).execute()

        # 3. Upsert season points into rider_season_rankings (existing table)
        for sp in parsed["season_points"]:
            season_val = sp.get("season")
            points_val = sp.get("points", 0)
            if season_val:
                supabase.table("rider_season_rankings").upsert(
                    {
                        "rider_id": rider_id,
                        "season": int(season_val),
                        "points": int(points_val),
                    },
                    on_conflict="rider_id,season",
                ).execute()

        # 4. Upsert current season results into race_results (existing table)
        for result in season_results:
            race_url = result.get("race_url", "")
            if not race_url:
                continue
            race_name = result.get("race_name", "")
            race_date = result.get("date", "")
            pcs_points = result.get("points", 0) or 0
            rank = result.get("rank")

            supabase.table("race_results").upsert(
                {
                    "rider_id": rider_id,
                    "race_slug": race_url,
                    "race_name": race_name,
                    "race_date": race_date,
                    "pcs_points": pcs_points,
                    "rank": rank,
                },
                on_conflict="rider_id,race_slug",
            ).execute()

        return {"rider": pcs_slug, "status": "ok"}

    except Exception as exc:
        logger.error("Failed to enrich %s: %s", pcs_slug, exc)
        return {"rider": pcs_slug, "status": "error", "error": str(exc)}


async def enrich_riders(
    supabase: Optional[Client] = None,
    start_rank: int = 1,
    end_rank: int = 500,
) -> Dict[str, Any]:
    """Enrich riders ranked between start_rank and end_rank (inclusive).

    Fetches riders from DB ordered by pcs_rank, then visits each rider's
    individual PCS page in batches of 5 with 1-minute pauses.
    """
    from playwright.async_api import async_playwright

    if supabase is None:
        supabase = get_supabase()

    # Fetch riders in the requested rank range
    resp = (
        supabase.table("riders")
        .select("id, pcs_slug, pcs_rank")
        .gte("pcs_rank", start_rank)
        .lte("pcs_rank", end_rank)
        .order("pcs_rank")
        .execute()
    )
    riders = resp.data or []
    total = len(riders)

    if total == 0:
        return {"status": "no_riders", "total": 0, "enriched": 0, "errors": []}

    print(f"  Found {total} riders (rank {start_rank}-{end_rank})")

    results = []
    errors = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)

        try:
            for batch_idx in range(0, total, BATCH_SIZE):
                batch = riders[batch_idx : batch_idx + BATCH_SIZE]
                batch_num = batch_idx // BATCH_SIZE + 1
                total_batches = (total + BATCH_SIZE - 1) // BATCH_SIZE

                print(f"\n  --- Batch {batch_num}/{total_batches} ---")

                for rider in batch:
                    rider_id = rider["id"]
                    pcs_slug = rider["pcs_slug"]
                    pcs_rank = rider.get("pcs_rank", "?")

                    print(f"    #{pcs_rank} {pcs_slug}...", end=" ", flush=True)

                    # Fresh context per rider
                    context = await browser.new_context(
                        user_agent=(
                            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                            "AppleWebKit/537.36 (KHTML, like Gecko) "
                            "Chrome/120.0.0.0 Safari/537.36"
                        )
                    )
                    page = await context.new_page()

                    try:
                        result = await enrich_single_rider(supabase, page, rider_id, pcs_slug)
                        results.append(result)
                        if result["status"] == "ok":
                            print("OK")
                        else:
                            print(f"ERROR: {result.get('error', '?')}")
                            errors.append(result)
                    finally:
                        await context.close()

                # Pause between batches (skip after last batch)
                if batch_idx + BATCH_SIZE < total:
                    print(f"\n  Pausing {BATCH_PAUSE_SECONDS}s before next batch...")
                    await asyncio.sleep(BATCH_PAUSE_SECONDS)

        finally:
            await browser.close()

    enriched = sum(1 for r in results if r["status"] == "ok")
    return {
        "status": "completed",
        "total": total,
        "enriched": enriched,
        "errors": [e.get("error", "") for e in errors],
    }
```

**Step 4: Run tests to verify they pass**

Run: `cd services/pcs-sync && python3 -m pytest tests/test_enrich.py -v`
Expected: All 7 tests PASS

**Step 5: Commit**

```bash
git add services/pcs-sync/enrich.py services/pcs-sync/tests/test_enrich.py
git commit -m "feat: add enrich.py — Pipeline E rider enrichment module

Scrapes individual rider pages for photo, bio, specialty, team history,
season points, and current season results. Batches of 5 with 1min pause.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 3: CLI Integration

**Files:**
- Modify: `services/pcs-sync/run_pipeline.py`

**Step 1: Write the failing test**

Add to `services/pcs-sync/tests/test_enrich.py`:

```python
def test_build_parser_accepts_enrich_riders():
    """CLI parser should accept 'enrich-riders' command with --start and --end."""
    from run_pipeline import build_parser
    parser = build_parser()

    args = parser.parse_args(["enrich-riders"])
    assert args.command == "enrich-riders"
    assert args.start == 1
    assert args.end == 500

    args2 = parser.parse_args(["enrich-riders", "--start", "401", "--end", "500"])
    assert args2.start == 401
    assert args2.end == 500
```

**Step 2: Run test to verify it fails**

Run: `cd services/pcs-sync && python3 -m pytest tests/test_enrich.py::test_build_parser_accepts_enrich_riders -v`
Expected: FAIL — `SystemExit` (unrecognized arguments)

**Step 3: Add enrich-riders to the CLI**

Modify `services/pcs-sync/run_pipeline.py`:

In `build_parser()` (after the monthly-finance subparser, around line 336), add:

```python
    # enrich-riders
    enrich = subparsers.add_parser(
        "enrich-riders",
        help="Pipeline E — enrich riders with individual PCS page data (photo, bio, specialty).",
    )
    enrich.add_argument(
        "--start",
        type=int,
        default=1,
        metavar="RANK",
        help="Start PCS rank (default: 1)",
    )
    enrich.add_argument(
        "--end",
        type=int,
        default=500,
        metavar="RANK",
        help="End PCS rank (default: 500)",
    )
```

Add the pipeline runner function (after `run_monthly_finance_pipeline`, around line 288):

```python
async def run_enrich_riders(start: int, end: int) -> None:
    """Pipeline E: enrich riders with individual PCS page data."""
    from sync import get_supabase
    from enrich import enrich_riders

    supabase = get_supabase()

    print("=== Pipeline E: enrich-riders ===")
    print(f"Range: rank {start} to {end}")
    print()
    result = await enrich_riders(supabase, start_rank=start, end_rank=end)
    print()
    print(json.dumps(result, indent=2))
    print()
    print("Done — enrich-riders complete.")
```

In `main()` (around line 358), add the elif:

```python
    elif args.command == "enrich-riders":
        await run_enrich_riders(args.start, args.end)
```

**Step 4: Run tests to verify they pass**

Run: `cd services/pcs-sync && python3 -m pytest tests/test_enrich.py -v`
Expected: All 8 tests PASS

**Step 5: Commit**

```bash
git add services/pcs-sync/run_pipeline.py services/pcs-sync/tests/test_enrich.py
git commit -m "feat: add enrich-riders CLI command (Pipeline E)

Usage: python3 run_pipeline.py enrich-riders [--start 401 --end 500]

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 4: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Add Pipeline E to the docs**

In the "Lancer les pipelines" section (after Pipeline D), add:

```markdown
# Pipeline E — Enrichissement coureurs (1x/an) : photo, bio, spécialité, teams, résultats
python3 run_pipeline.py enrich-riders
python3 run_pipeline.py enrich-riders --start 401 --end 500
```

Add the timing line:

```markdown
- Pipeline E : ~1h (100 coureurs) / ~5h (500 coureurs, par batch de 5 + 1min pause)
```

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add Pipeline E to CLAUDE.md

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 5: Integration Test — Dry Run on 2 Riders

**Not automated — manual verification.**

**Step 1: Run on 2 riders to validate**

```bash
cd services/pcs-sync
python3 run_pipeline.py enrich-riders --start 499 --end 500
```

Expected: 2 riders enriched, output shows OK for both.

**Step 2: Verify data in Supabase**

Check in Supabase dashboard:
- `riders` table: 2 riders have `photo_url`, `birthdate`, `birth_place`, `height_cm`, `weight_kg`, `specialty` filled
- `rider_teams` table: rows created for these 2 riders
- `rider_season_rankings` table: rows upserted for these 2 riders
- `race_results` table: current season results upserted

**Step 3: If OK, run the full test batch**

```bash
python3 run_pipeline.py enrich-riders --start 401 --end 500
```

Expected: ~1h, 100 riders enriched.
