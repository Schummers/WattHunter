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
    """Return stage URL dicts for a multi-stage race, or [] for one-day races.

    Fetches the race overview page, inspects Race.is_one_day_race(), and
    returns Race.stages() if it is a multi-stage event.
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
) -> Dict[str, Any]:
    """Fetch a race/stage results page and upsert matching rider entries.

    For stage races pass stage_url (e.g. "race/tdf-2026/stage-1").
    For one-day races leave stage_url=None; falls back to "{race_slug}/result".
    """
    fetch_url = stage_url if stage_url else f"{race_slug}/result"
    stage_label = stage_url.split("/")[-1] if stage_url else None

    html = await fetch_html(page, fetch_url)
    stage = Stage(fetch_url, html=html, update_html=False)
    results = stage.results()

    # Build lookup map from pcs_slug → rider_id
    riders_resp = supabase.table("riders").select("id, pcs_slug").execute()
    rider_map: Dict[str, str] = {
        r["pcs_slug"]: r["id"] for r in (riders_resp.data or [])
    }

    imported = 0
    skipped = 0
    errors: List[str] = []

    for entry in results:
        rider_url = entry.get("rider_url", "")
        if rider_url not in rider_map:
            skipped += 1
            continue

        try:
            rider_id = rider_map[rider_url]
            race_result_slug = stage_url if stage_url else f"{race_slug}/result"

            supabase.table("race_results").upsert(
                {
                    "rider_id": rider_id,
                    "race_slug": race_result_slug,
                    "race_name": race_name,
                    "stage": stage_label,
                    "race_date": race_date,
                    "pcs_points": entry.get("points", 0) or 0,
                    "rank": entry.get("rank"),
                },
                on_conflict="rider_id,race_slug",
            ).execute()
            imported += 1
        except Exception as exc:
            logger.error("Failed to upsert race result for %s: %s", rider_url, exc)
            errors.append(str(exc))

    return {
        "race": fetch_url,
        "imported": imported,
        "skipped": skipped,
        "total_in_race": len(results),
        "errors": errors,
    }


async def update_global_ranking(supabase: Client, page) -> Dict[str, Any]:
    """Fetch the PCS individual 1-year ranking and update matching riders.

    Updates pcs_points_1yr, pcs_rank, and monthly_salary for each rider
    whose pcs_slug appears in our DB.
    """
    ranking_url = "rankings/me/individual"
    html = await fetch_html(page, ranking_url)
    ranking = Ranking(ranking_url, html=html, update_html=False)
    ranking_entries = ranking.individual_ranking()

    # Build rider lookup map
    riders_resp = supabase.table("riders").select("id, pcs_slug").execute()
    rider_map: Dict[str, str] = {
        r["pcs_slug"]: r["id"] for r in (riders_resp.data or [])
    }

    updated = 0
    errors: List[str] = []

    for entry in ranking_entries:
        rider_url = entry.get("rider_url", "")
        if rider_url not in rider_map:
            continue

        try:
            rider_id = rider_map[rider_url]
            pcs_points = entry.get("points", 0) or 0
            pcs_rank = entry.get("rank")
            salary = calculate_monthly_salary(pcs_points)

            supabase.table("riders").update(
                {
                    "pcs_points_1yr": pcs_points,
                    "pcs_rank": pcs_rank,
                    "monthly_salary": salary,
                }
            ).eq("id", rider_id).execute()
            updated += 1
        except Exception as exc:
            logger.error("Failed to update ranking for %s: %s", rider_url, exc)
            errors.append(str(exc))

    return {
        "updated": updated,
        "total_in_ranking": len(ranking_entries),
        "errors": errors,
    }


async def import_season_rankings(
    supabase: Client,
    page,
    seasons: Optional[List[int]] = None,
) -> Dict[str, Any]:
    """Fetch end-of-season PCS rankings for the given years and upsert into rider_season_rankings.

    For the current calendar year the live ranking URL is used.
    For past years the end-of-year snapshot URL is used (YYYY-12-31).
    """
    if seasons is None:
        seasons = [2024, 2025, 2026]

    current_year = date.today().year
    seasons_processed = 0
    total_upserted = 0
    errors: List[str] = []

    for season in seasons:
        try:
            if season == current_year:
                ranking_url = "rankings/me/season-individual"
            else:
                ranking_url = f"rankings/me/season-individual/{season}-12-31"

            html = await fetch_html(page, ranking_url)
            ranking = Ranking(ranking_url, html=html, update_html=False)
            ranking_entries = ranking.individual_ranking()

            # Build rider lookup per season (fresh query each time)
            riders_resp = supabase.table("riders").select("id, pcs_slug").execute()
            rider_map: Dict[str, str] = {
                r["pcs_slug"]: r["id"] for r in (riders_resp.data or [])
            }

            upserted_this_season = 0
            for entry in ranking_entries:
                rider_url = entry.get("rider_url", "")
                if rider_url not in rider_map:
                    continue

                try:
                    rider_id = rider_map[rider_url]
                    supabase.table("rider_season_rankings").upsert(
                        {
                            "rider_id": rider_id,
                            "season": season,
                            "pcs_points": entry.get("points", 0) or 0,
                            "pcs_rank": entry.get("rank"),
                        },
                        on_conflict="rider_id,season",
                    ).execute()
                    upserted_this_season += 1
                except Exception as exc:
                    logger.error(
                        "Failed to upsert season ranking %s/%s: %s", season, rider_url, exc
                    )
                    errors.append(str(exc))

            total_upserted += upserted_this_season
            seasons_processed += 1

        except Exception as exc:
            logger.error("Failed to process season %s: %s", season, exc)
            errors.append(str(exc))

    return {
        "seasons_processed": seasons_processed,
        "total_upserted": total_upserted,
        "errors": errors,
    }


async def import_startlist(
    supabase: Client,
    page,
    race_slug: str,
    race_name: str,
    race_date: str,
) -> Dict[str, Any]:
    """Fetch a race startlist and upsert matching riders into race_startlists.

    Matches each startlist entry by pcs_slug against our riders table.
    """
    startlist_url = f"{race_slug}/startlist"
    html = await fetch_html(page, startlist_url)
    startlist_obj = RaceStartlist(startlist_url, html=html, update_html=False)
    startlist_entries = startlist_obj.startlist()

    # Build rider lookup map
    riders_resp = supabase.table("riders").select("id, pcs_slug").execute()
    rider_map: Dict[str, str] = {
        r["pcs_slug"]: r["id"] for r in (riders_resp.data or [])
    }

    imported = 0
    skipped = 0
    errors: List[str] = []

    for entry in startlist_entries:
        rider_url = entry.get("rider_url", "")
        if rider_url not in rider_map:
            skipped += 1
            continue

        try:
            rider_id = rider_map[rider_url]
            supabase.table("race_startlists").upsert(
                {
                    "rider_id": rider_id,
                    "race_slug": race_slug,
                    "race_name": race_name,
                    "race_date": race_date,
                    "team_name": entry.get("team_name"),
                },
                on_conflict="rider_id,race_slug",
            ).execute()
            imported += 1
        except Exception as exc:
            logger.error("Failed to upsert startlist entry for %s: %s", rider_url, exc)
            errors.append(str(exc))

    return {
        "race": race_slug,
        "imported": imported,
        "skipped": skipped,
        "total_in_startlist": len(startlist_entries),
        "errors": errors,
    }
