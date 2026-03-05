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
    """Fetch a single rider's PCS page and upsert enriched data."""
    from procyclingstats import Rider

    try:
        html = await fetch_html(page, pcs_slug)
        rider_obj = Rider(pcs_slug, html=html, update_html=False)

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
