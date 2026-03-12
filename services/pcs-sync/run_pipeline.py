"""
WattHunter PCS Sync CLI — run locally (residential IP required).
Cloudflare blocks datacenter IPs; GitHub Actions cannot be used for scraping.

Requires:
  - .env file in this directory (see .env.example)
  - Playwright Chromium installed: python3 -m playwright install chromium
  - Residential IP (Cloudflare blocks datacenter IPs)

Usage:
  cd services/pcs-sync

  # Pipeline A — sync top 500 PCS riders + season rankings
  python3 run_pipeline.py init-riders

  # Pipeline B — after each race/stage finishes
  python3 run_pipeline.py post-race --race "race/strade-bianche/2026"

  # Pipeline C — before auctions/races open
  python3 run_pipeline.py startlists --race "race/tour-de-france/2026"

  # Pipeline D — monthly finance (sponsor + salaries + bankruptcy)
  python3 run_pipeline.py monthly-finance
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from typing import Dict, List, Optional, Tuple

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

def load_calendar() -> List[Dict]:
    """Load wt_calendar_2026.json and return the race list."""
    with open(CALENDAR_PATH, encoding="utf-8") as fh:
        return json.load(fh)


def lookup_race(slug: str) -> Optional[Dict]:
    """Return the calendar entry whose slug matches, or None."""
    calendar = load_calendar()
    for race in calendar:
        if race.get("slug") == slug:
            return race
    return None


def race_meta(slug: str) -> Tuple[str, str]:
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
    """Annual initialization: sync top 500 PCS riders + import season rankings."""
    from playwright.async_api import async_playwright
    from sync import get_supabase, sync_top500
    from sync_race import import_season_rankings

    supabase = get_supabase()

    print("=== Pipeline A: init-riders ===")
    print()

    # Step 1: sync top 500 PCS global ranking
    print("--- Step 1/2: Sync top 500 PCS riders ---")
    result = await sync_top500(supabase, pages=5)
    print(json.dumps(result, indent=2))

    # Step 2: season rankings — fresh context per season to avoid Cloudflare
    print()
    print("--- Step 2/2: Import season rankings (2024, 2025, 2026) ---")
    seasons = [2024, 2025, 2026]
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        try:
            for i, season in enumerate(seasons):
                context = await browser.new_context(user_agent=USER_AGENT)
                page = await context.new_page()
                print("  Season {}...".format(season))
                result = await import_season_rankings(
                    supabase, page, seasons=[season]
                )
                print("    Upserted: {}, errors: {}".format(
                    result['total_upserted'], len(result['errors'])
                ))
                if result["errors"]:
                    for err in result["errors"][:3]:
                        print("    ERROR: {}".format(err))
                await context.close()
                if i < len(seasons) - 1:
                    print("    Waiting 15s before next season...")
                    await asyncio.sleep(15)
        finally:
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

    # Determine race type from calendar (avoids extra PCS fetch)
    race_entry = lookup_race(race_slug)
    is_stage_race = race_entry and race_entry.get("type") == "stage-race"

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        try:
            if is_stage_race:
                # Step 1: get stage URLs from race overview
                print("--- Step 1: Getting stage list ---")
                ctx1 = await browser.new_context(user_agent=USER_AGENT)
                page1 = await ctx1.new_page()
                stage_urls = await get_stage_urls(page1, race_slug)
                await ctx1.close()
                print(f"  Stage race — {len(stage_urls)} stage(s) found.")

                # Step 2: import each stage with fresh context
                for i, stage_entry in enumerate(stage_urls):
                    stage_url = stage_entry.get("stage_url") or stage_entry.get("url", "")
                    print(f"\n--- Stage {i + 1}/{len(stage_urls)}: {stage_url} ---")
                    ctx = await browser.new_context(user_agent=USER_AGENT)
                    page = await ctx.new_page()
                    try:
                        result = await import_race_results(
                            supabase, page,
                            race_slug=race_slug,
                            race_name=race_name,
                            race_date=race_date,
                            stage_url=stage_url,
                        )
                        print(f"  Imported: {result['imported']}, skipped: {result['skipped']}")
                    except Exception as exc:
                        print(f"  Skipped (no results yet): {exc}")
                    await ctx.close()
                    if i < len(stage_urls) - 1:
                        print("  Waiting 15s before next stage...")
                        await asyncio.sleep(15)
            else:
                # One-day race: single fetch with fresh context
                print("--- One-day race — importing result ---")
                ctx = await browser.new_context(user_agent=USER_AGENT)
                page = await ctx.new_page()
                result = await import_race_results(
                    supabase, page,
                    race_slug=race_slug,
                    race_name=race_name,
                    race_date=race_date,
                )
                await ctx.close()
                print(f"  Imported: {result['imported']}, skipped: {result['skipped']}")

            # Step 3: update global ranking (top 500, 5 pages with fresh contexts)
            print("\n--- Waiting 15s before updating global ranking ---")
            await asyncio.sleep(15)
            print("--- Updating global PCS ranking (top 500) ---")
            ranking_result = await update_global_ranking(supabase, browser, pages=5)
            print(f"  Updated: {ranking_result['updated']} riders (from {ranking_result['total_in_ranking']} ranked)")
            if ranking_result.get("created"):
                print(f"  Created: {ranking_result['created']} new rider(s)")
            if ranking_result.get("dropped"):
                print(f"  Dropped: {ranking_result['dropped']} rider(s) marked as >500")

            # Step 3b: enrich new riders
            new_riders = ranking_result.get("new_riders", [])
            if new_riders:
                from enrich import enrich_single_rider
                print(f"\n--- Enriching {len(new_riders)} new rider(s) ---")
                for i, nr in enumerate(new_riders):
                    ctx = await browser.new_context(user_agent=USER_AGENT)
                    enrich_page = await ctx.new_page()
                    try:
                        result = await enrich_single_rider(
                            supabase, enrich_page, nr["id"], nr["pcs_slug"]
                        )
                        print(f"  Enriched: {nr['pcs_slug']} — {result}")
                    except Exception as exc:
                        print(f"  Failed to enrich {nr['pcs_slug']}: {exc}")
                    finally:
                        await ctx.close()
                    if i < len(new_riders) - 1:
                        print("  Waiting 15s...")
                        await asyncio.sleep(15)
            else:
                print("  No new riders to enrich.")

        finally:
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
    print(json.dumps(result, indent=2))
    print()
    print("Done — monthly-finance complete.")


# ---------------------------------------------------------------------------
# Pipeline E — enrich-riders
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="run_pipeline.py",
        description="WattHunter PCS Sync CLI — 4 pipelines for roster, race results, startlists, and monthly finance.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    # init-riders
    subparsers.add_parser(
        "init-riders",
        help="Pipeline A — sync top 500 PCS riders + import season rankings.",
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

    # monthly-finance
    subparsers.add_parser(
        "monthly-finance",
        help="Pipeline D — monthly: sponsor payment + salary deduction + bankruptcy.",
    )

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
    elif args.command == "monthly-finance":
        await run_monthly_finance_pipeline()
    elif args.command == "enrich-riders":
        await run_enrich_riders(args.start, args.end)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
