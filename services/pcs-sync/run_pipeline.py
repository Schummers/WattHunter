"""
WattHunter PCS Sync CLI — run locally (residential IP required).
Cloudflare blocks datacenter IPs; GitHub Actions cannot be used for scraping.

Requires:
  - .env file in this directory (see .env.example)
  - Playwright Chromium installed: python3 -m playwright install chromium
  - Residential IP (Cloudflare blocks datacenter IPs)

Usage:
  cd services/pcs-sync

  # Pipeline A — annual initialization (roster + season rankings)
  python3 run_pipeline.py init-riders

  # Pipeline B — after each race/stage finishes
  python3 run_pipeline.py post-race --race "race/strade-bianche/2026"

  # Pipeline C — before auctions/races open
  python3 run_pipeline.py startlists --race "race/tour-de-france/2026"
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys

from dotenv import load_dotenv

load_dotenv()

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)

CALENDAR_PATH = os.path.join(os.path.dirname(__file__), "wt_calendar_2026.json")


# ---------------------------------------------------------------------------
# Calendar helpers
# ---------------------------------------------------------------------------

def load_calendar() -> list[dict]:
    """Load wt_calendar_2026.json and return the race list."""
    with open(CALENDAR_PATH, encoding="utf-8") as fh:
        return json.load(fh)


def lookup_race(slug: str) -> dict | None:
    """Return the calendar entry whose slug matches, or None."""
    calendar = load_calendar()
    for race in calendar:
        if race.get("slug") == slug:
            return race
    return None


def race_meta(slug: str) -> tuple[str, str]:
    """Return (race_name, race_date) for the given slug.

    race_date is start_date for stage races, date for one-day races.
    Falls back to slug as name with a warning if not found.
    """
    entry = lookup_race(slug)
    if entry is None:
        print(f"WARNING: race '{slug}' not found in wt_calendar_2026.json — using slug as name.")
        return slug, ""

    name = entry.get("name", slug)
    date = entry.get("date") or entry.get("start_date") or ""
    return name, date


# ---------------------------------------------------------------------------
# Browser helper
# ---------------------------------------------------------------------------

async def new_browser_page(p):
    """Launch a headless Chromium browser and return (browser, context, page)."""
    browser = await p.chromium.launch(headless=True)
    context = await browser.new_context(user_agent=USER_AGENT)
    page = await context.new_page()
    return browser, context, page


# ---------------------------------------------------------------------------
# Pipeline A — init-riders
# ---------------------------------------------------------------------------

async def run_init_riders() -> None:
    """Annual initialization: sync all rider rosters + import season rankings."""
    from playwright.async_api import async_playwright
    from sync import sync_all_riders, get_supabase
    from sync_race import import_season_rankings

    supabase = get_supabase()

    print("=== Pipeline A: init-riders ===")
    print()

    # Step 1: roster sync (manages its own browser internally)
    print("--- Step 1/2: Sync rider rosters (9 ProTeams) ---")
    roster_result = await sync_all_riders(supabase)
    print(json.dumps(roster_result, indent=2))

    # Step 2: season rankings — needs a single shared browser page
    print()
    print("--- Step 2/2: Import season rankings (2024, 2025, 2026) ---")
    async with async_playwright() as p:
        browser, context, page = await new_browser_page(p)
        try:
            rankings_result = await import_season_rankings(
                supabase, page, seasons=[2024, 2025, 2026]
            )
            print(json.dumps(rankings_result, indent=2))
        finally:
            await context.close()
            await browser.close()

    print()
    print("Done — init-riders complete.")


# ---------------------------------------------------------------------------
# Pipeline B — post-race
# ---------------------------------------------------------------------------

async def run_post_race(race_slug: str) -> None:
    """Post-race pipeline: import results for every stage then update global ranking."""
    from playwright.async_api import async_playwright
    from sync import get_supabase
    from sync_race import get_stage_urls, import_race_results, update_global_ranking
    from scoring import calculate_daily_scores

    supabase = get_supabase()
    race_name, race_date = race_meta(race_slug)

    print(f"=== Pipeline B: post-race ===")
    print(f"Race : {race_name}")
    print(f"Slug : {race_slug}")
    print(f"Date : {race_date or '(not in calendar)'}")
    print()

    async with async_playwright() as p:
        browser, context, page = await new_browser_page(p)
        try:
            # Step 1: detect stage race vs one-day
            print("--- Step 1: Detecting race type ---")
            stage_urls = await get_stage_urls(page, race_slug)

            if stage_urls:
                print(f"  Stage race detected — {len(stage_urls)} stage(s) found.")
                print()
                # Step 2a: import each stage result
                for i, stage_entry in enumerate(stage_urls):
                    stage_url = stage_entry.get("stage_url") or stage_entry.get("url", "")
                    print(f"--- Stage {i + 1}/{len(stage_urls)}: {stage_url} ---")
                    result = await import_race_results(
                        supabase,
                        page,
                        race_slug=race_slug,
                        race_name=race_name,
                        race_date=race_date,
                        stage_url=stage_url,
                    )
                    print(json.dumps(result, indent=2))

                    if i < len(stage_urls) - 1:
                        print("  Waiting 10s before next stage...")
                        await asyncio.sleep(10)
            else:
                print("  One-day race detected.")
                print()
                # Step 2b: import single result
                print("--- Step 2: Importing race result ---")
                result = await import_race_results(
                    supabase,
                    page,
                    race_slug=race_slug,
                    race_name=race_name,
                    race_date=race_date,
                    stage_url=None,
                )
                print(json.dumps(result, indent=2))

            # Step 3: update global ranking
            print()
            print("--- Waiting 15s before updating global ranking ---")
            await asyncio.sleep(15)
            print("--- Updating global PCS ranking ---")
            ranking_result = await update_global_ranking(supabase, page)
            print(json.dumps(ranking_result, indent=2))

        finally:
            await context.close()
            await browser.close()

    # Step 4: calculate daily scores (no browser needed)
    print()
    print("--- Calculating daily scores ---")
    scoring_result = await calculate_daily_scores(supabase)
    print(json.dumps(scoring_result, indent=2))

    print()
    print("Done — post-race complete.")


# ---------------------------------------------------------------------------
# Pipeline C — startlists
# ---------------------------------------------------------------------------

async def run_startlists(race_slug: str) -> None:
    """Pre-race pipeline: fetch and import the race startlist."""
    from playwright.async_api import async_playwright
    from sync import get_supabase
    from sync_race import import_startlist

    supabase = get_supabase()
    race_name, race_date = race_meta(race_slug)

    print(f"=== Pipeline C: startlists ===")
    print(f"Race : {race_name}")
    print(f"Slug : {race_slug}")
    print(f"Date : {race_date or '(not in calendar)'}")
    print()

    async with async_playwright() as p:
        browser, context, page = await new_browser_page(p)
        try:
            print("--- Importing startlist ---")
            result = await import_startlist(
                supabase,
                page,
                race_slug=race_slug,
                race_name=race_name,
                race_date=race_date,
            )
            print(json.dumps(result, indent=2))
        finally:
            await context.close()
            await browser.close()

    print()
    print("Done — startlists complete.")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="run_pipeline.py",
        description="WattHunter PCS Sync CLI — 3 pipelines for roster, race results, and startlists.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    # init-riders
    subparsers.add_parser(
        "init-riders",
        help="Pipeline A — annual init: sync all rosters + import season rankings.",
    )

    # post-race
    post_race = subparsers.add_parser(
        "post-race",
        help="Pipeline B — after a race/stage: import results + update global ranking + score.",
    )
    post_race.add_argument(
        "--race",
        required=True,
        metavar="SLUG",
        help='PCS race slug, e.g. "race/strade-bianche/2026"',
    )

    # startlists
    startlists = subparsers.add_parser(
        "startlists",
        help="Pipeline C — before auctions/race: import the race startlist.",
    )
    startlists.add_argument(
        "--race",
        required=True,
        metavar="SLUG",
        help='PCS race slug, e.g. "race/tour-de-france/2026"',
    )

    return parser


async def main() -> None:
    # Validate environment before doing anything
    if not os.getenv("SUPABASE_URL") or not os.getenv("SUPABASE_SERVICE_ROLE_KEY"):
        print("ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.")
        print("Create a .env file from .env.example in this directory.")
        sys.exit(1)

    parser = build_parser()
    args = parser.parse_args()

    if args.command == "init-riders":
        await run_init_riders()
    elif args.command == "post-race":
        await run_post_race(args.race)
    elif args.command == "startlists":
        await run_startlists(args.race)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
