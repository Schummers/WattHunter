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

from sync import fetch_html, calculate_monthly_salary, get_supabase, format_rider_name
from datetime import datetime

logger = logging.getLogger(__name__)

# Race slug → race_class mapping for sponsor eligibility
RACE_CLASS_MAP = {
    "milano-sanremo": "monument",
    "ronde-van-vlaanderen": "monument",
    "paris-roubaix": "monument",
    "liege-bastogne-liege": "monument",
    "il-lombardia": "monument",
    "giro-d-italia": "grand_tour",
    "tour-de-france": "grand_tour",
    "vuelta-a-espana": "grand_tour",
    "strade-bianche": "classic",
    "e3-harelbeke": "classic",
    "gent-wevelgem": "classic",
    "amstel-gold-race": "classic",
    "la-fleche-wallonne": "classic",
    "san-sebastian": "classic",
    "bretagne-classic": "classic",
    "cyclassics-hamburg": "classic",
    "gp-quebec": "classic",
    "gp-montreal": "classic",
    "omloop-het-nieuwsblad": "classic",
    "dwars-door-vlaanderen": "classic",
    "paris-nice": "stage_race",
    "tirreno-adriatico": "stage_race",
    "volta-a-catalunya": "stage_race",
    "itzulia": "stage_race",
    "tour-de-romandie": "stage_race",
    "dauphine": "stage_race",
    "tour-de-suisse": "stage_race",
    "tour-de-pologne": "stage_race",
    "renewi-tour": "stage_race",
}


def _classify_race(race_slug: str) -> Optional[str]:
    """Determine race_class from a race slug."""
    slug_lower = race_slug.lower()
    for key, cls in RACE_CLASS_MAP.items():
        if key in slug_lower:
            return cls
    return None


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

            row = {
                    "rider_id": rider_id,
                    "race_slug": race_result_slug,
                    "race_name": race_name,
                    "stage": stage_label,
                    "race_date": race_date or None,
                    "pcs_points": int(entry.get("pcs_points") or entry.get("points", 0) or 0),
                    "rank": entry.get("rank"),
                }
            race_class = _classify_race(race_slug)
            if race_class:
                row["race_class"] = race_class

            supabase.table("race_results").upsert(
                row,
                on_conflict="rider_id,race_slug",
            ).execute()
            imported += 1
        except Exception as exc:
            logger.error("Failed to upsert race result for %s: %s", rider_url, exc)
            errors.append(str(exc))

    race_result_slug = stage_url if stage_url else f"{race_slug}/result"
    return {
        "race": fetch_url,
        "race_slug": race_result_slug,
        "imported": imported,
        "skipped": skipped,
        "total_in_race": len(results),
        "errors": errors,
    }


async def import_gc_results(
    supabase: Client,
    page,
    race_slug: str,
    race_name: str,
    race_date: str,
) -> Dict[str, Any]:
    """Fetch GC (General Classification) results for a stage race and upsert.

    Uses the dedicated /gc page URL and Stage.gc() to get final GC standings
    with pcs_points. Falls back to empty if GC is unavailable.
    """
    gc_url = f"{race_slug}/gc"

    html = await fetch_html(page, gc_url)
    stage = Stage(gc_url, html=html, update_html=False)
    gc_entries = stage.gc()

    if not gc_entries:
        logger.warning("No GC results found for %s", gc_url)
        return {"race": gc_url, "imported": 0, "skipped": 0, "total_in_race": 0, "errors": []}

    # Build lookup map from pcs_slug → rider_id
    riders_resp = supabase.table("riders").select("id, pcs_slug").execute()
    rider_map: Dict[str, str] = {
        r["pcs_slug"]: r["id"] for r in (riders_resp.data or [])
    }

    imported = 0
    skipped = 0
    errors: List[str] = []

    for entry in gc_entries:
        rider_url = entry.get("rider_url", "")
        if rider_url not in rider_map:
            skipped += 1
            continue

        try:
            rider_id = rider_map[rider_url]

            row = {
                "rider_id": rider_id,
                "race_slug": gc_url,
                "race_name": f"{race_name} - GC",
                "stage": "gc",
                "race_date": race_date or None,
                "pcs_points": int(entry.get("pcs_points") or 0),
                "rank": entry.get("rank"),
            }
            race_class = _classify_race(race_slug)
            if race_class:
                row["race_class"] = race_class

            supabase.table("race_results").upsert(
                row,
                on_conflict="rider_id,race_slug",
            ).execute()
            imported += 1
        except Exception as exc:
            logger.error("Failed to upsert GC result for %s: %s", rider_url, exc)
            errors.append(str(exc))

    return {
        "race": gc_url,
        "imported": imported,
        "skipped": skipped,
        "total_in_race": len(gc_entries),
        "errors": errors,
    }


async def update_global_ranking(supabase: Client, browser, *, pages: int = 5) -> Dict[str, Any]:
    """Fetch the PCS individual ranking (top N×100) and update matching riders.

    Uses fresh browser contexts per page to avoid Cloudflare.
    Page 1 uses the clean URL; pages 2+ use rankings.php with offset & filter params
    (simple URL offset doesn't work — PCS requires the form-style URL).

    Updates pcs_points_1yr, pcs_rank, and monthly_salary for each rider
    whose pcs_slug appears in our DB.
    """
    user_agent = (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )

    # Build rider lookup map
    riders_resp = supabase.table("riders").select("id, pcs_slug").execute()
    rider_map: Dict[str, str] = {
        r["pcs_slug"]: r["id"] for r in (riders_resp.data or [])
    }

    updated = 0
    created = 0
    total_entries = 0
    errors: List[str] = []
    seen_ids: set = set()
    new_riders: List[Dict[str, str]] = []

    for page_idx in range(pages):
        offset = page_idx * 100
        context = await browser.new_context(user_agent=user_agent)
        page = await context.new_page()

        try:
            if offset == 0:
                fetch_url = "https://www.procyclingstats.com/rankings/me/individual"
            else:
                fetch_url = "https://www.procyclingstats.com/rankings.php?p=me&s=individual&offset={}&filter=Filter".format(offset)

            await asyncio.sleep(4)
            await page.goto(fetch_url, wait_until="domcontentloaded")
            await page.wait_for_timeout(6000)

            html = await page.content()
            if any(m in html for m in ["Just a moment", "Checking your browser"]):
                logger.warning("Cloudflare blocked at offset=%d", offset)
                break

            ranking = Ranking("rankings/me/individual", html=html, update_html=False)
            ranking_entries = ranking.individual_ranking()
            total_entries += len(ranking_entries)

            batch = 0
            for entry in ranking_entries:
                rider_url = entry.get("rider_url", "")
                if not rider_url:
                    continue

                pcs_points = entry.get("points", 0) or 0
                if pcs_points == 0:
                    continue
                pcs_rank = entry.get("rank")
                salary = calculate_monthly_salary(pcs_points)

                # Create new rider if not in DB
                if rider_url not in rider_map:
                    try:
                        name = format_rider_name(entry.get("rider_name", "Unknown"))
                        team_name = entry.get("team_name", "Unknown")
                        nationality = entry.get("nationality", "??")[:2].upper()

                        rider_data = {
                            "pcs_slug": rider_url,
                            "full_name": name,
                            "nationality": nationality,
                            "real_team": team_name,
                            "pcs_points_1yr": pcs_points,
                            "pcs_rank": pcs_rank,
                            "pcs_rank_prev": entry.get("prev_rank"),
                            "monthly_salary": salary,
                            "ever_in_top500": True,
                            "last_synced_at": datetime.utcnow().isoformat(),
                        }

                        resp = supabase.table("riders").upsert(
                            rider_data, on_conflict="pcs_slug"
                        ).execute()

                        if resp.data:
                            new_id = resp.data[0]["id"]
                            rider_map[rider_url] = new_id
                            new_riders.append({"id": new_id, "pcs_slug": rider_url})
                            seen_ids.add(new_id)
                            created += 1
                            batch += 1
                            logger.info("Created new rider: %s (rank %s)", name, pcs_rank)
                        continue
                    except Exception as exc:
                        logger.error("Failed to create rider %s: %s", rider_url, exc)
                        errors.append(str(exc))
                        continue

                try:
                    rider_id = rider_map[rider_url]
                    seen_ids.add(rider_id)

                    supabase.table("riders").update(
                        {
                            "pcs_points_1yr": pcs_points,
                            "pcs_rank": pcs_rank,
                            "pcs_rank_prev": entry.get("prev_rank"),
                            "monthly_salary": salary,
                        }
                    ).eq("id", rider_id).execute()

                    # Also mark as ever_in_top500 if ranked
                    if pcs_rank and pcs_rank <= 500:
                        supabase.table("riders").update(
                            {"ever_in_top500": True}
                        ).eq("id", rider_id).execute()

                    updated += 1
                    batch += 1
                except Exception as exc:
                    logger.error("Failed to update ranking for %s: %s", rider_url, exc)
                    errors.append(str(exc))

            logger.info("Ranking offset=%d: %d entries, %d matched", offset, len(ranking_entries), batch)

        finally:
            await context.close()

        if page_idx < pages - 1:
            await asyncio.sleep(11)

    # Mark dropped riders (previously ranked ≤500 but no longer in top 500)
    dropped = 0
    if seen_ids:
        try:
            prev_top500_resp = (
                supabase.table("riders")
                .select("id")
                .lte("pcs_rank", 500)
                .execute()
            )
            prev_top500_ids = {r["id"] for r in (prev_top500_resp.data or [])}
            dropped_ids = prev_top500_ids - seen_ids

            for rid in dropped_ids:
                supabase.table("riders").update(
                    {"pcs_rank": 501}
                ).eq("id", rid).execute()
                dropped += 1

            if dropped:
                logger.info("Marked %d riders as dropped from top 500", dropped)
        except Exception as exc:
            logger.error("Failed to mark dropped riders: %s", exc)
            errors.append(str(exc))

    return {
        "updated": updated,
        "created": created,
        "dropped": dropped,
        "new_riders": new_riders,
        "total_in_ranking": total_entries,
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
                            "points": int(entry.get("points", 0) or 0),
                            "rank": int(entry.get("rank", 0) or 0),
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
                    "race_date": race_date or None,
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
