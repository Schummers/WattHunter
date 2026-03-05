# PCS Sync Pipelines — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the broken delta-based race results sync with 3 clean pipelines: Init Riders (annual), Post-Race (per race/stage), and Startlists (pre-auction).

**Architecture:** 3 CLI commands via `run_pipeline.py` (replaces `run_daily_pipeline.py`). Each pipeline uses Playwright to scrape PCS pages, parse with procyclingstats lib, and upsert to Supabase. Shared `fetch_html()` utility. New tables: `race_results`, `rider_season_rankings`, `race_startlists`.

**Tech Stack:** Python 3.9+, Playwright, procyclingstats 0.2.8, Supabase, pytest + pytest-asyncio

**Design doc:** `docs/plans/2026-03-05-pcs-sync-design.md`

---

## Task 1: Supabase Migration — New Tables

**Files:**
- Create: `supabase/migrations/20260305000000_race_results_and_rankings.sql`

**Step 1: Write the migration**

```sql
-- =============================================================
-- race_results — points earned per rider per race/stage
-- =============================================================
create table public.race_results (
  id          uuid primary key default gen_random_uuid(),
  rider_id    uuid not null references public.riders(id) on delete cascade,
  race_slug   text not null,       -- "race/paris-nice/2026/stage-3"
  race_name   text not null,       -- "Paris-Nice - Stage 3"
  stage       text,                -- "stage-3" or NULL for one-day races
  race_date   date not null,
  pcs_points  int not null default 0,
  rank        int,
  created_at  timestamptz not null default now(),
  unique(rider_id, race_slug)
);

alter table public.race_results enable row level security;
create policy "Anyone can read race_results"
  on public.race_results for select using (true);

-- =============================================================
-- rider_season_rankings — PCS ranking per season (historical)
-- =============================================================
create table public.rider_season_rankings (
  rider_id    uuid not null references public.riders(id) on delete cascade,
  season      int not null,        -- 2024, 2025, 2026
  points      int not null default 0,
  rank        int,
  created_at  timestamptz not null default now(),
  primary key (rider_id, season)
);

alter table public.rider_season_rankings enable row level security;
create policy "Anyone can read rider_season_rankings"
  on public.rider_season_rankings for select using (true);

-- =============================================================
-- race_startlists — upcoming race participation per rider
-- =============================================================
create table public.race_startlists (
  rider_id    uuid not null references public.riders(id) on delete cascade,
  race_slug   text not null,       -- "race/paris-nice/2026"
  race_name   text not null,       -- "Paris-Nice"
  race_date   date not null,
  created_at  timestamptz not null default now(),
  primary key (rider_id, race_slug)
);

alter table public.race_startlists enable row level security;
create policy "Anyone can read race_startlists"
  on public.race_startlists for select using (true);
```

**Step 2: Apply the migration**

Run: `cd /Users/jonathanschummers/Documents/WattHunter && supabase db push`
Expected: Migration applied successfully.

**Step 3: Commit**

```bash
git add supabase/migrations/20260305000000_race_results_and_rankings.sql
git commit -m "feat: add race_results, rider_season_rankings, race_startlists tables"
```

---

## Task 2: Add 4 New ProTeams to sync.py

**Files:**
- Modify: `services/pcs-sync/sync.py:27-33` (PROTEAM_SLUGS)

**Step 1: Update PROTEAM_SLUGS**

Replace lines 27-33 with:

```python
PROTEAM_SLUGS = [
    "team/tudor-pro-cycling-team-2026",
    "team/cofidis-2026",
    "team/pinarello-q365-pro-cycling-team-2026",
    "team/totalenergies-2026",
    "team/caja-rural-seguros-rga-2026",
    "team/uno-x-mobility-2026",
    "team/xds-astana-team-2026",
    "team/lotto-intermarche-2026",
    "team/nsn-cycling-team-2026",
]
```

**Step 2: Commit**

```bash
git add services/pcs-sync/sync.py
git commit -m "feat: add 4 new ProTeams (Uno-X, XDS Astana, Lotto, NSN)"
```

---

## Task 3: Create WT Calendar JSON

**Files:**
- Create: `services/pcs-sync/wt_calendar_2026.json`

**Step 1: Research the 2026 WT calendar**

Scrape or look up the World Tour calendar from PCS. We need: slug, name, start_date, end_date (for stage races), type (one-day vs stage-race).

**Step 2: Create the calendar file**

Create `services/pcs-sync/wt_calendar_2026.json` with the known WT races. Example structure:

```json
[
  {
    "slug": "race/omloop-het-nieuwsblad/2026",
    "name": "Omloop Het Nieuwsblad",
    "date": "2026-03-01",
    "type": "one-day"
  },
  {
    "slug": "race/paris-nice/2026",
    "name": "Paris-Nice",
    "start_date": "2026-03-08",
    "end_date": "2026-03-15",
    "type": "stage-race"
  }
]
```

Populate with all WT races for 2026. This is a manual research step — check procyclingstats.com/races.php for the full list.

**Step 3: Commit**

```bash
git add services/pcs-sync/wt_calendar_2026.json
git commit -m "feat: add 2026 World Tour calendar JSON"
```

---

## Task 4: Write Tests for Post-Race Pipeline

**Files:**
- Create: `services/pcs-sync/tests/test_sync_race.py`

**Step 1: Write failing tests**

```python
"""Tests for post-race sync pipeline."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import date

from tests.helpers import make_chain, make_supabase


@pytest.fixture
def mock_supabase():
    """Supabase mock with rider lookup returning 2 known riders."""
    sb = MagicMock()
    # riders lookup: return 2 riders matching PCS slugs
    riders_chain = make_chain([
        {"id": "r1", "pcs_slug": "rider/tadej-pogacar"},
        {"id": "r2", "pcs_slug": "rider/julian-alaphilippe"},
    ])
    sb.table.return_value = riders_chain
    return sb


class TestImportRaceResults:
    """Tests for import_race_results()."""

    @pytest.mark.asyncio
    async def test_one_day_race_imports_results(self, mock_supabase):
        """One-day race: fetch 1 page, upsert matching riders."""
        from sync_race import import_race_results

        fake_html = "<html>fake stage results</html>"
        mock_page = AsyncMock()

        with patch("sync_race.fetch_html", return_value=fake_html) as mock_fetch, \
             patch("sync_race.Stage") as MockStage:

            stage_instance = MagicMock()
            stage_instance.results.return_value = [
                {"rider_url": "rider/tadej-pogacar", "pcs_points": 100, "rank": 1,
                 "rider_name": "POGAČAR Tadej", "team_name": "UAE"},
                {"rider_url": "rider/unknown-rider", "pcs_points": 50, "rank": 2,
                 "rider_name": "UNKNOWN Rider", "team_name": "Other"},
            ]
            MockStage.return_value = stage_instance

            result = await import_race_results(
                mock_supabase, mock_page,
                race_slug="race/omloop-het-nieuwsblad/2026",
                race_name="Omloop Het Nieuwsblad",
                race_date="2026-03-01",
                stage_url=None,
            )

        assert result["imported"] == 1  # only pogacar matches our riders
        assert result["skipped"] == 1   # unknown rider not in our DB
        mock_fetch.assert_called_once()

    @pytest.mark.asyncio
    async def test_stage_race_fetches_stages(self, mock_supabase):
        """Stage race: detect stages via Race.stages(), import each."""
        from sync_race import get_stage_urls

        fake_html = "<html>fake race overview</html>"
        mock_page = AsyncMock()

        with patch("sync_race.fetch_html", return_value=fake_html) as mock_fetch, \
             patch("sync_race.Race") as MockRace:

            race_instance = MagicMock()
            race_instance.is_one_day_race.return_value = False
            race_instance.stages.return_value = [
                {"stage_url": "race/paris-nice/2026/stage-1", "stage_name": "Stage 1", "date": "03-08"},
                {"stage_url": "race/paris-nice/2026/stage-2", "stage_name": "Stage 2", "date": "03-09"},
            ]
            MockRace.return_value = race_instance

            urls = await get_stage_urls(mock_page, "race/paris-nice/2026")

        assert len(urls) == 2
        assert urls[0]["stage_url"] == "race/paris-nice/2026/stage-1"


class TestUpdateRanking:
    """Tests for update_global_ranking()."""

    @pytest.mark.asyncio
    async def test_updates_matching_riders(self, mock_supabase):
        """Ranking update: match by rider_url, update pcs_points_1yr + salary."""
        from sync_race import update_global_ranking

        fake_html = "<html>fake ranking</html>"
        mock_page = AsyncMock()

        with patch("sync_race.fetch_html", return_value=fake_html), \
             patch("sync_race.Ranking") as MockRanking:

            ranking_instance = MagicMock()
            ranking_instance.individual_ranking.return_value = [
                {"rider_url": "rider/tadej-pogacar", "points": 3000.0, "rank": 1},
                {"rider_url": "rider/other-rider", "points": 500.0, "rank": 100},
            ]
            MockRanking.return_value = ranking_instance

            result = await update_global_ranking(mock_supabase, mock_page)

        assert result["updated"] == 1  # only pogacar matches


class TestImportSeasonRankings:
    """Tests for import_season_rankings()."""

    @pytest.mark.asyncio
    async def test_imports_3_seasons(self, mock_supabase):
        """Season rankings: fetch 3 pages, upsert matching riders."""
        from sync_race import import_season_rankings

        fake_html = "<html>fake ranking</html>"
        mock_page = AsyncMock()

        with patch("sync_race.fetch_html", return_value=fake_html), \
             patch("sync_race.Ranking") as MockRanking:

            ranking_instance = MagicMock()
            ranking_instance.individual_ranking.return_value = [
                {"rider_url": "rider/tadej-pogacar", "points": 500.0, "rank": 10},
            ]
            MockRanking.return_value = ranking_instance

            result = await import_season_rankings(
                mock_supabase, mock_page, seasons=[2024, 2025, 2026]
            )

        assert result["seasons_processed"] == 3
```

**Step 2: Run tests to verify they fail**

Run: `cd /Users/jonathanschummers/Documents/WattHunter/services/pcs-sync && python3 -m pytest tests/test_sync_race.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'sync_race'`

**Step 3: Commit failing tests**

```bash
git add services/pcs-sync/tests/test_sync_race.py
git commit -m "test: add failing tests for post-race pipeline"
```

---

## Task 5: Implement sync_race.py — Core Functions

**Files:**
- Create: `services/pcs-sync/sync_race.py`

**Step 1: Implement sync_race.py**

```python
"""
Post-race sync — imports race results, updates rankings.
Uses Playwright + procyclingstats to scrape PCS race/ranking pages.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import date
from typing import Optional, List, Dict, Any

from procyclingstats import Stage, Race, Ranking, RaceStartlist
from supabase import Client

from sync import fetch_html, calculate_monthly_salary, get_supabase

logger = logging.getLogger(__name__)


async def get_stage_urls(page, race_slug: str) -> List[Dict[str, str]]:
    """
    For a stage race, fetch the race overview and return list of stage URLs.
    For a one-day race, returns empty list.
    """
    html = await fetch_html(page, race_slug)
    race = Race(race_slug, html=html, update_html=False)

    if race.is_one_day_race():
        return []

    return race.stages()


async def import_race_results(
    supabase: Client,
    page,
    race_slug: str,
    race_name: str,
    race_date: str,
    stage_url: Optional[str] = None,
) -> dict:
    """
    Import results from a single race/stage page.
    Fetches Stage.results(), matches rider_url to our riders, upserts race_results.
    """
    # Determine which URL to fetch
    fetch_url = stage_url if stage_url else f"{race_slug}/result"
    stage_label = stage_url.split("/")[-1] if stage_url else None

    html = await fetch_html(page, fetch_url)
    stage = Stage(fetch_url, html=html, update_html=False)
    results = stage.results()

    # Load all our riders for matching
    all_riders = supabase.table("riders").select("id, pcs_slug").execute()
    rider_map = {r["pcs_slug"]: r["id"] for r in (all_riders.data or [])}

    imported = 0
    skipped = 0
    errors = []

    for entry in results:
        rider_url = entry.get("rider_url", "")
        if rider_url not in rider_map:
            skipped += 1
            continue

        try:
            result_slug = stage_url or f"{race_slug}/result"
            display_name = f"{race_name} - {stage_label.replace('-', ' ').title()}" if stage_label else race_name

            supabase.table("race_results").upsert({
                "rider_id": rider_map[rider_url],
                "race_slug": result_slug,
                "race_name": display_name,
                "stage": stage_label,
                "race_date": race_date,
                "pcs_points": int(entry.get("pcs_points", 0) or 0),
                "rank": int(entry.get("rank", 0) or 0) if entry.get("rank") else None,
            }, on_conflict="rider_id,race_slug").execute()
            imported += 1
        except Exception as e:
            logger.error(f"Failed to upsert result for {rider_url}: {e}")
            errors.append(str(e))

    return {
        "race": fetch_url,
        "imported": imported,
        "skipped": skipped,
        "total_in_race": len(results),
        "errors": errors,
    }


async def update_global_ranking(supabase: Client, page) -> dict:
    """
    Fetch the current PCS individual ranking and update riders.pcs_points_1yr,
    pcs_rank, and monthly_salary for all our riders.
    """
    html = await fetch_html(page, "rankings/me/individual")
    ranking = Ranking("rankings/me/individual", html=html, update_html=False)
    entries = ranking.individual_ranking()

    # Load all our riders for matching
    all_riders = supabase.table("riders").select("id, pcs_slug").execute()
    rider_map = {r["pcs_slug"]: r["id"] for r in (all_riders.data or [])}

    updated = 0
    errors = []

    for entry in entries:
        rider_url = entry.get("rider_url", "")
        if rider_url not in rider_map:
            continue

        try:
            points = int(entry.get("points", 0) or 0)
            rank = int(entry.get("rank", 0) or 0)
            salary = calculate_monthly_salary(points)

            supabase.table("riders").update({
                "pcs_points_1yr": points,
                "pcs_rank": rank,
                "monthly_salary": salary,
            }).eq("id", rider_map[rider_url]).execute()
            updated += 1
        except Exception as e:
            logger.error(f"Failed to update ranking for {rider_url}: {e}")
            errors.append(str(e))

    return {"updated": updated, "total_in_ranking": len(entries), "errors": errors}


async def import_season_rankings(
    supabase: Client,
    page,
    seasons: List[int] = None,
) -> dict:
    """
    Import PCS season rankings for specified seasons.
    Default: [2024, 2025, 2026].
    """
    if seasons is None:
        seasons = [2024, 2025, 2026]

    # Load all our riders for matching
    all_riders = supabase.table("riders").select("id, pcs_slug").execute()
    rider_map = {r["pcs_slug"]: r["id"] for r in (all_riders.data or [])}

    total_upserted = 0
    errors = []

    for season in seasons:
        try:
            if season == date.today().year:
                url = "rankings/me/season-individual"
            else:
                url = f"rankings/me/season-individual/{season}-12-31"

            html = await fetch_html(page, url)
            ranking = Ranking(url, html=html, update_html=False)
            entries = ranking.individual_ranking()

            for entry in entries:
                rider_url = entry.get("rider_url", "")
                if rider_url not in rider_map:
                    continue

                supabase.table("rider_season_rankings").upsert({
                    "rider_id": rider_map[rider_url],
                    "season": season,
                    "points": int(entry.get("points", 0) or 0),
                    "rank": int(entry.get("rank", 0) or 0),
                }, on_conflict="rider_id,season").execute()
                total_upserted += 1

        except Exception as e:
            logger.error(f"Failed to import season ranking {season}: {e}")
            errors.append(str(e))

    return {
        "seasons_processed": len(seasons),
        "total_upserted": total_upserted,
        "errors": errors,
    }


async def import_startlist(
    supabase: Client,
    page,
    race_slug: str,
    race_name: str,
    race_date: str,
) -> dict:
    """
    Import startlist for a race. Matches riders to our DB.
    """
    startlist_url = f"{race_slug}/startlist"
    html = await fetch_html(page, startlist_url)
    sl = RaceStartlist(startlist_url, html=html, update_html=False)
    entries = sl.startlist()

    # Load all our riders for matching
    all_riders = supabase.table("riders").select("id, pcs_slug").execute()
    rider_map = {r["pcs_slug"]: r["id"] for r in (all_riders.data or [])}

    imported = 0
    skipped = 0
    errors = []

    for entry in entries:
        rider_url = entry.get("rider_url", "")
        if rider_url not in rider_map:
            skipped += 1
            continue

        try:
            supabase.table("race_startlists").upsert({
                "rider_id": rider_map[rider_url],
                "race_slug": race_slug,
                "race_name": race_name,
                "race_date": race_date,
            }, on_conflict="rider_id,race_slug").execute()
            imported += 1
        except Exception as e:
            logger.error(f"Failed to upsert startlist for {rider_url}: {e}")
            errors.append(str(e))

    return {
        "race": race_slug,
        "imported": imported,
        "skipped": skipped,
        "total_in_startlist": len(entries),
        "errors": errors,
    }
```

**Step 2: Run tests**

Run: `cd /Users/jonathanschummers/Documents/WattHunter/services/pcs-sync && python3 -m pytest tests/test_sync_race.py -v`
Expected: All 4 tests PASS.

**Step 3: Commit**

```bash
git add services/pcs-sync/sync_race.py
git commit -m "feat: implement sync_race.py — race results, rankings, startlists"
```

---

## Task 6: Create run_pipeline.py — New CLI

**Files:**
- Create: `services/pcs-sync/run_pipeline.py`

**Step 1: Implement the CLI**

```python
"""
Pipeline runner — CLI for all PCS sync pipelines.

Usage:
  cd services/pcs-sync

  # Pipeline A — Init riders (annual)
  python3 run_pipeline.py init-riders

  # Pipeline B — Post-race (after each WT race/stage)
  python3 run_pipeline.py post-race --race "race/paris-nice/2026/stage-3"
  python3 run_pipeline.py post-race --race "race/omloop-het-nieuwsblad/2026"

  # Pipeline C — Startlists (before auctions/races)
  python3 run_pipeline.py startlists --race "race/paris-nice/2026"

Requires:
  - .env file in this directory (see .env.example)
  - Playwright Chromium: python3 -m playwright install chromium
  - Residential IP (Cloudflare blocks datacenter IPs)
"""
from __future__ import annotations

import asyncio
import argparse
import json
import os
import sys

from dotenv import load_dotenv
load_dotenv()

from sync import sync_all_riders, get_supabase, fetch_html
from sync_race import (
    import_race_results,
    get_stage_urls,
    update_global_ranking,
    import_season_rankings,
    import_startlist,
)
from scoring import calculate_daily_scores


async def cmd_init_riders() -> None:
    """Pipeline A: roster sync (9 teams) + season rankings (3 years)."""
    from playwright.async_api import async_playwright

    supabase = get_supabase()

    print("=== Pipeline A: Init Riders ===\n")

    # Step 1: Roster sync
    print("--- Step 1: Roster sync (9 ProTeams) ---")
    roster = await sync_all_riders(supabase)
    print(f"  Synced: {roster['total_synced']} riders, {roster['total_errors']} errors\n")

    # Step 2: Season rankings
    print("--- Step 2: Season rankings (2024-2026) ---")
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            )
        )
        page = await context.new_page()

        result = await import_season_rankings(supabase, page, seasons=[2024, 2025, 2026])
        print(f"  Seasons: {result['seasons_processed']}, upserted: {result['total_upserted']}")
        if result["errors"]:
            print(f"  Errors: {result['errors']}")

        await context.close()
        await browser.close()

    print("\nDone.")


async def cmd_post_race(race_slug: str) -> None:
    """Pipeline B: import race results + update global ranking + scoring."""
    from playwright.async_api import async_playwright

    supabase = get_supabase()

    print(f"=== Pipeline B: Post-Race — {race_slug} ===\n")

    # Load calendar to get race metadata
    calendar_path = os.path.join(os.path.dirname(__file__), "wt_calendar_2026.json")
    race_meta = None
    if os.path.exists(calendar_path):
        with open(calendar_path) as f:
            calendar = json.load(f)
        for entry in calendar:
            if entry["slug"] == race_slug:
                race_meta = entry
                break

    if not race_meta:
        print(f"  WARNING: Race '{race_slug}' not found in calendar. Using slug as name.")
        race_meta = {"slug": race_slug, "name": race_slug, "type": "one-day"}

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            )
        )
        page = await context.new_page()

        # Step 1: Detect if stage race and get stage URLs
        stage_urls = await get_stage_urls(page, race_slug)

        if stage_urls:
            print(f"--- Stage race detected: {len(stage_urls)} stages ---")
            for stage_info in stage_urls:
                stage_url = stage_info["stage_url"]
                stage_date = stage_info.get("date", race_meta.get("start_date", ""))
                print(f"\n  Importing {stage_url}...")
                result = await import_race_results(
                    supabase, page,
                    race_slug=race_slug,
                    race_name=race_meta["name"],
                    race_date=stage_date,
                    stage_url=stage_url,
                )
                print(f"    Imported: {result['imported']}, skipped: {result['skipped']}")
                await asyncio.sleep(10)  # pause between stages
        else:
            print("--- One-day race ---")
            race_date = race_meta.get("date", race_meta.get("start_date", ""))
            result = await import_race_results(
                supabase, page,
                race_slug=race_slug,
                race_name=race_meta["name"],
                race_date=race_date,
            )
            print(f"  Imported: {result['imported']}, skipped: {result['skipped']}")

        # Step 2: Update global ranking
        print("\n--- Updating global ranking ---")
        await asyncio.sleep(15)  # pause before ranking fetch
        ranking_result = await update_global_ranking(supabase, page)
        print(f"  Updated: {ranking_result['updated']} riders")

        await context.close()
        await browser.close()

    # Step 3: Scoring
    print("\n--- Calculating daily scores ---")
    scoring = await calculate_daily_scores(supabase)
    print(json.dumps(scoring, indent=2))

    print("\nDone.")


async def cmd_startlists(race_slug: str) -> None:
    """Pipeline C: import startlist for a race."""
    from playwright.async_api import async_playwright

    supabase = get_supabase()

    print(f"=== Pipeline C: Startlists — {race_slug} ===\n")

    # Load calendar for race metadata
    calendar_path = os.path.join(os.path.dirname(__file__), "wt_calendar_2026.json")
    race_meta = None
    if os.path.exists(calendar_path):
        with open(calendar_path) as f:
            calendar = json.load(f)
        for entry in calendar:
            if entry["slug"] == race_slug:
                race_meta = entry
                break

    if not race_meta:
        print(f"  WARNING: Race '{race_slug}' not found in calendar.")
        race_meta = {"slug": race_slug, "name": race_slug, "date": ""}

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            )
        )
        page = await context.new_page()

        race_date = race_meta.get("date", race_meta.get("start_date", ""))
        result = await import_startlist(
            supabase, page,
            race_slug=race_slug,
            race_name=race_meta["name"],
            race_date=race_date,
        )
        print(f"  Our riders: {result['imported']}, other: {result['skipped']}, total: {result['total_in_startlist']}")

        await context.close()
        await browser.close()

    print("\nDone.")


async def main() -> None:
    # Verify env
    if not os.getenv("SUPABASE_URL") or not os.getenv("SUPABASE_SERVICE_ROLE_KEY"):
        print("ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.")
        print("Create a .env file from .env.example in this directory.")
        sys.exit(1)

    parser = argparse.ArgumentParser(description="WattHunter PCS Sync Pipelines")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("init-riders", help="Pipeline A: roster + season rankings (annual)")

    post = sub.add_parser("post-race", help="Pipeline B: race results + ranking update")
    post.add_argument("--race", required=True, help='PCS race slug, e.g. "race/paris-nice/2026"')

    sl = sub.add_parser("startlists", help="Pipeline C: import race startlist")
    sl.add_argument("--race", required=True, help='PCS race slug, e.g. "race/paris-nice/2026"')

    args = parser.parse_args()

    if args.command == "init-riders":
        await cmd_init_riders()
    elif args.command == "post-race":
        await cmd_post_race(args.race)
    elif args.command == "startlists":
        await cmd_startlists(args.race)


if __name__ == "__main__":
    asyncio.run(main())
```

**Step 2: Commit**

```bash
git add services/pcs-sync/run_pipeline.py
git commit -m "feat: add run_pipeline.py CLI for all 3 pipelines"
```

---

## Task 7: Update scoring.py to Use race_results Table

**Files:**
- Modify: `services/pcs-sync/scoring.py:44-46`
- Modify: `services/pcs-sync/tests/test_scoring.py`

**Step 1: Update scoring.py**

The current `calculate_daily_scores` reads from `rider_pcs_history` where `points_delta > 0`. It needs to read from the new `race_results` table instead.

Change the query at line 44-46 from:

```python
    history = supabase.table("rider_pcs_history").select(
        "rider_id, points_delta"
    ).eq("date", today).gt("points_delta", 0).execute()
```

To:

```python
    history = supabase.table("race_results").select(
        "rider_id, pcs_points"
    ).eq("race_date", today).gt("pcs_points", 0).execute()
```

And update all references from `points_delta` to `pcs_points` within the scoring logic. The field name change: `entry["points_delta"]` → `entry["pcs_points"]`.

**Step 2: Update existing tests**

In `tests/test_scoring.py`, update the mock data to use `race_results` table name and `pcs_points` field instead of `rider_pcs_history` and `points_delta`.

**Step 3: Run tests**

Run: `cd /Users/jonathanschummers/Documents/WattHunter/services/pcs-sync && python3 -m pytest tests/test_scoring.py -v`
Expected: All 7 tests PASS.

**Step 4: Commit**

```bash
git add services/pcs-sync/scoring.py services/pcs-sync/tests/test_scoring.py
git commit -m "refactor: scoring reads from race_results table instead of rider_pcs_history"
```

---

## Task 8: Update main.py and Clean Up Old Code

**Files:**
- Modify: `services/pcs-sync/main.py`
- Modify: `services/pcs-sync/sync.py` — remove `sync_race_results()` and `purge_old_history()`

**Step 1: Remove obsolete functions from sync.py**

Delete `sync_race_results()` (lines 197-257) and `purge_old_history()` (lines 260-264) from `sync.py`. These are replaced by `sync_race.py`.

Also remove the unused `CONVERSION_RATE` constant (line 21) — scoring handles this, not sync.

**Step 2: Update main.py**

Remove the import of `sync_race_results` and `purge_old_history`. Update the `/jobs/sync-riders` endpoint to only call `sync_all_riders` (roster sync). The post-race and startlist pipelines are CLI-only for now.

Update imports at line 13:

```python
from sync import sync_all_riders
```

Simplify `/jobs/sync-riders` endpoint to only do roster sync:

```python
@app.post("/jobs/sync-riders")
async def job_sync_riders(
    request: Request,
    x_api_secret: Optional[str] = Header(default=None),
):
    """Roster sync: fetches team pages via Playwright, upserts riders."""
    _check_auth(x_api_secret)
    roster_result = await sync_all_riders(_supabase)
    return JSONResponse(content=roster_result)
```

**Step 3: Run all tests**

Run: `cd /Users/jonathanschummers/Documents/WattHunter/services/pcs-sync && python3 -m pytest tests/ -v`
Expected: All tests PASS.

**Step 4: Commit**

```bash
git add services/pcs-sync/sync.py services/pcs-sync/main.py
git commit -m "refactor: remove obsolete sync_race_results/purge_old_history, simplify main.py"
```

---

## Task 9: Update Documentation

**Files:**
- Modify: `/Users/jonathanschummers/Documents/WattHunter/CLAUDE.md`
- Modify: `services/pcs-sync/.env.example`

**Step 1: Update CLAUDE.md**

Update the "Sync PCS" section to document the 3 pipelines and new CLI:

```markdown
## Sync PCS (données coureurs)
3 pipelines, tous lancés manuellement via CLI (IP résidentielle requise).

### Lancer les pipelines
```bash
cd services/pcs-sync

# Pipeline A — Init riders (1x/an) : roster 9 ProTeams + season rankings
python3 run_pipeline.py init-riders

# Pipeline B — Post-race : résultats + ranking update + scoring
python3 run_pipeline.py post-race --race "race/paris-nice/2026/stage-3"

# Pipeline C — Startlists : programme prévisionnel
python3 run_pipeline.py startlists --race "race/paris-nice/2026"
```
```

**Step 2: Commit**

```bash
git add CLAUDE.md services/pcs-sync/.env.example
git commit -m "docs: update CLAUDE.md with new 3-pipeline CLI commands"
```

---

## Task 10: Integration Test — Init Riders Pipeline

**Files:** None (manual test)

**Step 1: Run init-riders pipeline locally**

```bash
cd /Users/jonathanschummers/Documents/WattHunter/services/pcs-sync
python3 run_pipeline.py init-riders
```

Expected output:
- ~260 riders synced from 9 ProTeams
- 3 seasons of rankings imported
- 0 errors

**Step 2: Verify in Supabase**

Check `riders` table: should have ~260 rows.
Check `rider_season_rankings` table: should have rows for matching riders across 3 seasons.

**Step 3: Test post-race with a known race**

```bash
python3 run_pipeline.py post-race --race "race/omloop-het-nieuwsblad/2026"
```

Expected: imports results, updates ranking, runs scoring.

**Step 4: Test startlists**

```bash
python3 run_pipeline.py startlists --race "race/paris-nice/2026"
```

Expected: imports startlist, shows our riders vs total.

---

## Summary

| Task | What | Commit |
|------|------|--------|
| 1 | Migration: 3 new tables | `feat: add race_results, rider_season_rankings, race_startlists tables` |
| 2 | Add 4 ProTeams | `feat: add 4 new ProTeams` |
| 3 | WT calendar JSON | `feat: add 2026 World Tour calendar JSON` |
| 4 | Tests for sync_race | `test: add failing tests for post-race pipeline` |
| 5 | sync_race.py implementation | `feat: implement sync_race.py` |
| 6 | run_pipeline.py CLI | `feat: add run_pipeline.py CLI for all 3 pipelines` |
| 7 | Update scoring to use race_results | `refactor: scoring reads from race_results` |
| 8 | Clean up old code | `refactor: remove obsolete functions, simplify main.py` |
| 9 | Documentation | `docs: update CLAUDE.md` |
| 10 | Integration test | Manual verification |
