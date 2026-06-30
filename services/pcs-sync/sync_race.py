"""
Post-race sync — imports race results, updates rankings.
Uses Playwright + procyclingstats to scrape PCS race/ranking pages.
"""
from __future__ import annotations

import asyncio
import logging
import re
from datetime import date
from typing import Optional, List, Dict, Any

import procyclingstats.utils as _pcs_utils
from procyclingstats import Stage, Race, Ranking, RaceStartlist
from supabase import Client

from sync import fetch_html, calculate_monthly_salary, get_supabase, format_rider_name
from db_utils import _fetch_all
from datetime import datetime

logger = logging.getLogger(__name__)

# Monkey-patch procyclingstats format_time to handle PCS "same time" markers
# PCS uses "0-", ",," or empty strings for riders finishing on the same time
_original_format_time = _pcs_utils.format_time

def _patched_format_time(time: str) -> str:
    cleaned = time.strip().rstrip("-").strip()
    if not cleaned or cleaned == "0" or cleaned == ",,":
        return "0:00:00"
    return _original_format_time(cleaned)

_pcs_utils.format_time = _patched_format_time

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


def _detect_itt(stage) -> bool:
    """True if the Stage's profile indicates an individual/team time trial."""
    try:
        attr = getattr(stage, "stage_type", None)
        stype = attr() if callable(attr) else attr
    except Exception:
        return False
    if not stype:
        return False
    s = str(stype).strip().upper()
    return s in ("ITT", "TTT")


def _stage_profile_icon(stage) -> Optional[str]:
    """Return the PCS profile icon (p0-p5) for a stage, or None if unavailable."""
    try:
        attr = getattr(stage, "profile_icon", None)
        val = attr() if callable(attr) else attr
    except Exception:
        return None
    if not val:
        return None
    return str(val).strip().lower()


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
    profile_icon = _stage_profile_icon(stage)
    results = stage.results()

    # Build lookup map from pcs_slug → rider_id
    riders_resp = _fetch_all(lambda: supabase.table("riders").select("id, pcs_slug"))
    rider_map: Dict[str, str] = {
        r["pcs_slug"]: r["id"] for r in riders_resp
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
                    "is_itt": _detect_itt(stage),
                    "breakaway_kms": entry.get("breakaway_kms"),
                    "profile_icon": profile_icon,
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
        return {"race": gc_url, "imported": 0, "skipped": 0, "total_in_race": 0, "errors": [], "has_points": False}

    # Build lookup map from pcs_slug → rider_id
    riders_resp = _fetch_all(lambda: supabase.table("riders").select("id, pcs_slug"))
    rider_map: Dict[str, str] = {
        r["pcs_slug"]: r["id"] for r in riders_resp
    }

    imported = 0
    skipped = 0
    errors: List[str] = []
    has_points = False

    for entry in gc_entries:
        rider_url = entry.get("rider_url", "")
        if rider_url not in rider_map:
            skipped += 1
            continue

        try:
            rider_id = rider_map[rider_url]
            pts = int(entry.get("pcs_points") or 0)
            if pts > 0:
                has_points = True

            row = {
                "rider_id": rider_id,
                "race_slug": gc_url,
                "race_name": f"{race_name} - GC",
                "stage": "gc",
                "race_date": race_date or None,
                "pcs_points": pts,
                "rank": entry.get("rank"),
                "is_itt": False,
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
        "has_points": has_points,
    }


FINAL_SECONDARY_TYPES = ("points", "kom", "youth")


async def import_final_classifications(
    supabase: Client,
    page,
    *,
    race_slug: str,
    race_name: str,
    race_date: str,
) -> Dict[str, int]:
    """Import final Points/KOM/Youth standings for a completed GT (Spec A A2).

    These jerseys carry no PCS points, so we store the rank into the DEDICATED table
    gt_final_classifications (NOT race_results — see the storage rationale at the top of
    Task 4) keyed by race_slug {race_slug}/points|/kom|/youth; scoring's finals pass applies
    the 2-value rank scale. GT-only — the caller gates on GT completion (GC has points).
    """
    counts = {"points": 0, "kom": 0, "youth": 0}

    riders_resp = _fetch_all(lambda: supabase.table("riders").select("id, pcs_slug"))
    rider_map: Dict[str, str] = {
        r["pcs_slug"]: r["id"] for r in riders_resp
    }

    for ctype in FINAL_SECONDARY_TYPES:
        url = f"{race_slug}/{ctype}"
        try:
            html = await fetch_html(page, url)
            stage = Stage(url, html=html, update_html=False)
            # Stage.points()/kom()/youth() parse the standings table on the dedicated page.
            # ⚠️ Verify against live lib during the first real scraping run: confirm
            # Stage("race/<gt>/2026/points").points() returns final standings with
            # rider_url + rank on the dedicated jersey page. If a method name differs,
            # adjust the getattr mapping here. The unit test mocks Stage independently.
            entries = getattr(stage, ctype)() or []
        except Exception as exc:
            logger.warning("Failed to fetch final %s for %s: %s", ctype, url, exc)
            continue

        for entry in entries:
            rider_url = entry.get("rider_url", "")
            rank = entry.get("rank")
            rid = rider_map.get(rider_url)
            if not rid or rank is None:
                continue
            try:
                supabase.table("gt_final_classifications").upsert(
                    {
                        "race_slug": url,
                        "classification_type": ctype,
                        "rider_id": rid,
                        "rank": int(rank),
                        "race_date": race_date or None,
                    },
                    on_conflict="race_slug,rider_id",
                ).execute()
                counts[ctype] += 1
            except Exception as exc:
                logger.error("Failed final %s upsert (%s): %s", ctype, rid, exc)

    return counts


async def update_global_ranking(supabase: Client, browser, *, pages: int = 6) -> Dict[str, Any]:
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
    riders_resp = _fetch_all(lambda: supabase.table("riders").select("id, pcs_slug"))
    rider_map: Dict[str, str] = {
        r["pcs_slug"]: r["id"] for r in riders_resp
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
                rel_url = "rankings/me/individual"
            else:
                rel_url = "rankings.php?p=me&s=individual&offset={}&filter=Filter".format(offset)

            html = await fetch_html(page, rel_url, delay=4.0)

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
                            "ever_in_pool": True,
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

                    # Also mark as ever_in_pool if ranked (covers top 600 pool)
                    if pcs_rank and pcs_rank <= 600:
                        supabase.table("riders").update(
                            {"ever_in_pool": True}
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

    # Mark dropped riders (previously ranked ≤600 but no longer in top 600)
    dropped = 0
    if seen_ids:
        try:
            prev_top500_resp = (
                supabase.table("riders")
                .select("id")
                .lte("pcs_rank", 600)
                .execute()
            )
            prev_top500_ids = {r["id"] for r in (prev_top500_resp.data or [])}
            dropped_ids = prev_top500_ids - seen_ids

            for rid in dropped_ids:
                supabase.table("riders").update(
                    {"pcs_rank": 601}
                ).eq("id", rid).execute()
                dropped += 1

            if dropped:
                logger.info("Marked %d riders as dropped from top 600", dropped)
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
            riders_resp = _fetch_all(lambda: supabase.table("riders").select("id, pcs_slug"))
            rider_map: Dict[str, str] = {
                r["pcs_slug"]: r["id"] for r in riders_resp
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


async def import_daily_classifications(
    supabase: Client,
    page,
    *,
    race_slug: str,
    stage_url: str,
) -> Dict[str, int]:
    """Fetch gc/points/kom/youth classifications for a single GT stage and upsert.

    Stores top 50 GC, top 20 points, top 10 KOM, top 20 youth for safety;
    scoring reads only the top 10/5/3 respectively. Swallows errors per
    classification so a single failed fetch does not abort the whole call.
    """
    counts = {"gc": 0, "points": 0, "kom": 0, "youth": 0}
    stage_label = stage_url.split("/")[-1]

    riders_resp = _fetch_all(lambda: supabase.table("riders").select("id, pcs_slug"))
    rider_map: Dict[str, str] = {
        r["pcs_slug"]: r["id"] for r in riders_resp
    }

    html = await fetch_html(page, stage_url)
    stage = Stage(stage_url, html=html, update_html=False)

    fetchers = [
        ("gc", lambda: stage.gc()[:50]),
        ("points", lambda: stage.points()[:20]),
        ("kom", lambda: stage.kom()[:10]),
        ("youth", lambda: stage.youth()[:20]),
    ]

    for kind, fetch in fetchers:
        try:
            entries = fetch() or []
        except Exception as exc:
            logger.warning("Failed to fetch %s for %s: %s", kind, stage_url, exc)
            continue

        for entry in entries:
            rider_url = entry.get("rider_url", "")
            rank = entry.get("rank")
            if not rider_url or rank is None:
                continue
            rid = rider_map.get(rider_url)
            if not rid:
                continue
            try:
                supabase.table("gt_daily_classifications").upsert(
                    {
                        "race_slug": stage_url,
                        "stage": stage_label,
                        "rider_id": rid,
                        "classification_type": kind,
                        "rank": int(rank),
                    },
                    on_conflict="race_slug,rider_id,classification_type",
                ).execute()
                counts[kind] += 1
            except Exception as exc:
                logger.error("Failed classif upsert (%s, %s): %s", kind, rid, exc)

    return counts


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
    riders_resp = _fetch_all(lambda: supabase.table("riders").select("id, pcs_slug"))
    rider_map: Dict[str, str] = {
        r["pcs_slug"]: r["id"] for r in riders_resp
    }

    imported = 0
    skipped = 0
    removed = 0
    errors: List[str] = []
    imported_ids: List[str] = []

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
            imported_ids.append(rider_id)
        except Exception as exc:
            logger.error("Failed to upsert startlist entry for %s: %s", rider_url, exc)
            errors.append(str(exc))

    # Purge stale entries: riders previously stored for this race but no longer on the
    # PCS startlist (provisional selections get trimmed to the final squad as the race
    # nears). Only runs when this scrape returned a real startlist, so a failed/empty
    # fetch never wipes the existing data.
    if imported_ids:
        existing = (
            supabase.table("race_startlists")
            .select("rider_id")
            .eq("race_slug", race_slug)
            .execute()
        )
        stale_ids = [r["rider_id"] for r in (existing.data or []) if r["rider_id"] not in set(imported_ids)]
        if stale_ids:
            supabase.table("race_startlists").delete().eq("race_slug", race_slug).in_(
                "rider_id", stale_ids
            ).execute()
            removed = len(stale_ids)

    return {
        "race": race_slug,
        "imported": imported,
        "skipped": skipped,
        "removed": removed,
        "total_in_startlist": len(startlist_entries),
        "errors": errors,
    }


def _stage_year_from_slug(race_slug: str) -> Optional[int]:
    """Extract the 4-digit year from a race slug like 'race/tour-de-france/2026'."""
    import re
    m = re.search(r"/(\d{4})(?:/|$)", race_slug)
    return int(m.group(1)) if m else None


def _stage_date_from_md(md: Optional[str], year: Optional[int]) -> Optional[str]:
    """Combine a 'MM-DD' string from Race.stages() with the year inferred from the slug.

    Returns an ISO date string ('YYYY-MM-DD') or None on missing/invalid input.
    """
    if not md or not year:
        return None
    s = str(md).strip()
    parts = s.split("-")
    if len(parts) != 2:
        return None
    try:
        mm = int(parts[0])
        dd = int(parts[1])
        return f"{year:04d}-{mm:02d}-{dd:02d}"
    except ValueError:
        return None


async def import_stage_profiles(
    supabase: Client,
    page,
    race_slug: str,
    race_name: str,
) -> Dict[str, int]:
    """Scrape every stage's profile_icon from the race overview page (Race.stages())
    and upsert one row per stage into stage_profiles.

    One fetch per race — no per-stage scraping. Skips stages with no profile_icon
    (CHECK constraint forbids NULL). Returns counts.
    """
    html = await fetch_html(page, race_slug)
    race = Race(race_slug, html=html, update_html=False)

    if race.is_one_day_race():
        return {"imported": 0, "skipped": 0, "total_stages": 0}

    stages = race.stages()
    year = _stage_year_from_slug(race_slug)

    imported = 0
    skipped = 0

    for stage in stages:
        stage_url = stage.get("stage_url") or ""
        raw_icon = stage.get("profile_icon")
        icon = str(raw_icon).strip().lower() if raw_icon else ""
        if not stage_url or not icon:
            skipped += 1
            continue

        # PCS sometimes returns a canonical race URL that differs from the
        # input slug (e.g. `race/dauphine/2026` → `race/tour-auvergne-rhone-alpes/2026`).
        # Persist under the input slug so the rest of the codebase (front,
        # wt_calendar, wt-race-slugs) can look stages up by their canonical
        # WattHunter slug.
        normalized_slug = _normalize_stage_slug(stage_url, race_slug)
        if normalized_slug is None:
            logger.warning(
                "Unparseable stage_url %r for race_slug %r — skipping",
                stage_url, race_slug,
            )
            skipped += 1
            continue

        race_date = _stage_date_from_md(stage.get("date"), year)
        stage_type = _parse_stage_type(stage.get("stage_name"))
        try:
            supabase.table("stage_profiles").upsert(
                {
                    "race_slug": normalized_slug,
                    "profile_icon": icon,
                    "race_date": race_date,
                    "stage_type": stage_type,
                },
                on_conflict="race_slug",
            ).execute()
            imported += 1
        except Exception as exc:
            logger.error("Failed stage_profiles upsert for %s: %s", normalized_slug, exc)
            skipped += 1

    return {"imported": imported, "skipped": skipped, "total_stages": len(stages)}


# Matches "(ITT)" or "(TTT)" anywhere in the stage name (PCS includes it in the
# title for TT stages, e.g. "Stage 16 (ITT) | Évian Les-Bains - Thonon Les-Bains").
_STAGE_TYPE_RE = re.compile(r"\((I|T)TT\)")


def _parse_stage_type(stage_name: Any) -> str:
    """Return 'ITT', 'TTT' or 'RR' based on the marker PCS embeds in the
    stage name from `Race.stages()`. Defaults to 'RR' when no marker is found
    or when `stage_name` is missing — the same default as the column.
    """
    if not stage_name:
        return "RR"
    match = _STAGE_TYPE_RE.search(str(stage_name))
    if not match:
        return "RR"
    return f"{match.group(1)}TT"


_STAGE_SUFFIX_RE = re.compile(r"/(stage-\d+(?:[a-z])?)$")


def _normalize_stage_slug(pcs_stage_url: str, input_race_slug: str) -> Optional[str]:
    """Rewrite a PCS-canonical stage URL (`race/<pcs-name>/<year>/stage-N`)
    onto the input race slug, so that `stage_profiles.race_slug` matches the
    slug the rest of the codebase uses (wt_calendar, wt-race-slugs, front).

    Returns the rewritten slug, or None if the PCS URL has no `/stage-N` suffix.
    Idempotent: when PCS canonical and input slugs are identical, returns
    the same value as before (no behavior change).
    """
    match = _STAGE_SUFFIX_RE.search(pcs_stage_url)
    if not match:
        return None
    return f"{input_race_slug.rstrip('/')}/{match.group(1)}"
