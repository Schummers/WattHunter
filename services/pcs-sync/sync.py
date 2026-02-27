"""
PCS sync logic — wraps procyclingstats and writes to Supabase.
Uses Playwright to bypass Cloudflare bot-protection on procyclingstats.com.
"""
import asyncio
import logging
import os
from datetime import datetime, date, timedelta
from procyclingstats import Team, Rider
from supabase import create_client, Client

logger = logging.getLogger(__name__)

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
RATE_LIMIT_MS = int(os.getenv("PCS_RATE_LIMIT_DELAY_MS", "4000"))
CONVERSION_RATE = int(os.getenv("CONVERSION_RATE_EUR_PER_PCS", "500"))

SALARY_FLOOR = 5_000    # €/month
SALARY_CAP   = 300_000  # €/month

# ProTeam PCS slugs for alpha (validated 2026-02-27 via Playwright)
PROTEAM_SLUGS = [
    "team/tudor-pro-cycling-team-2026",
    "team/cofidis-2026",
    "team/pinarello-q365-pro-cycling-team-2026",
    "team/totalenergies-2026",
    "team/caja-rural-seguros-rga-2026",
]

SPECIALTY_MAP = {
    "climber": "climber",
    "sprint": "sprinter",
    "one_day_races": "puncheur",
    "hills": "puncheur",
    "time_trial": "time_trialist",
    "gc": "all_rounder",
}


def get_supabase() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def calculate_monthly_salary(pcs_points_1yr: int) -> int:
    """Salary formula from PRD_02: (pcs_1yr / 1000) × 500,000 / 12"""
    annual = (pcs_points_1yr / 1000) * 500_000
    monthly = annual / 12
    return max(SALARY_FLOOR, min(SALARY_CAP, int(monthly)))


async def fetch_html(page, url: str, delay: float = 4.0) -> str:
    """Fetch a page using Playwright to bypass Cloudflare, return HTML."""
    await asyncio.sleep(delay)
    full_url = f"https://www.procyclingstats.com/{url}"
    await page.goto(full_url, wait_until="domcontentloaded")
    # Wait for content to load past Cloudflare challenge
    await page.wait_for_timeout(3000)
    return await page.content()


async def sync_team_roster(supabase: Client, page, team_slug: str, rate_limit_s: float) -> dict:
    """Fetch all riders from a PCS team and upsert into riders table."""
    try:
        html = await fetch_html(page, team_slug, delay=rate_limit_s)
        team = Team(team_slug, html=html, update_html=False)
        roster = team.riders()
    except Exception as e:
        logger.error(f"Failed to fetch team {team_slug}: {e}")
        return {"team": team_slug, "synced": 0, "errors": [str(e)]}

    synced = 0
    errors = []

    for rider_entry in roster:
        try:
            slug = rider_entry.get("rider_url", "")
            if not slug:
                continue

            rider_html = await fetch_html(page, slug, delay=rate_limit_s)
            rider = Rider(slug, html=rider_html, update_html=False)

            # Extract fields using actual PCS library methods
            try:
                name = rider.name()
            except Exception:
                name = rider_entry.get("rider_name", "Unknown")

            try:
                nationality = rider.nationality()[:2].upper()
            except Exception:
                nationality = rider_entry.get("nationality", "??")

            pcs_points = rider_entry.get("ranking_points", 0) or 0
            salary = calculate_monthly_salary(pcs_points)

            # Determine specialty from points_per_speciality
            specialty = "all_rounder"
            try:
                specs = rider.points_per_speciality()
                # PCS returns a dict {specialty_key: points}, e.g. {"climber": 5583, "gc": 2977}
                if specs and isinstance(specs, dict):
                    best_key = max(specs, key=lambda k: specs[k])
                    specialty = SPECIALTY_MAP.get(best_key, "all_rounder")
            except Exception:
                pass

            try:
                photo_url = rider.image_url()
            except Exception:
                photo_url = None

            # Derive a human-readable team name from the slug
            # e.g. "team/tudor-pro-cycling-2026" → "Tudor Pro Cycling"
            real_team = (
                team_slug.split("/")[-1]      # "tudor-pro-cycling-2026"
                .rsplit("-", 1)[0]             # "tudor-pro-cycling"
                .replace("-", " ")             # "tudor pro cycling"
                .title()                       # "Tudor Pro Cycling"
            )

            rider_data = {
                "pcs_slug": slug,
                "full_name": name,
                "nationality": nationality,
                "real_team": real_team,
                "team_type": "ProTeam",
                "photo_url": photo_url,
                "age": rider_entry.get("age"),
                "specialty": specialty,
                "pcs_points_1yr": pcs_points,
                "pcs_rank": rider_entry.get("ranking_position"),
                "monthly_salary": salary,
                "last_synced_at": datetime.utcnow().isoformat(),
            }

            supabase.table("riders").upsert(rider_data, on_conflict="pcs_slug").execute()
            synced += 1

        except Exception as e:
            logger.error(f"Failed to sync rider {rider_entry}: {e}")
            errors.append(str(e))

    return {"team": team_slug, "synced": synced, "errors": errors}


async def sync_all_riders(supabase: Client | None = None, rate_limit_ms: int | None = None) -> dict:
    """
    Sync all riders from all configured ProTeams using Playwright to bypass
    Cloudflare bot-protection on procyclingstats.com.
    """
    from playwright.async_api import async_playwright

    if supabase is None:
        supabase = get_supabase()
    if rate_limit_ms is None:
        rate_limit_ms = RATE_LIMIT_MS

    rate_limit_s = rate_limit_ms / 1000
    results = []

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

        for slug in PROTEAM_SLUGS:
            logger.info(f"Syncing team: {slug}")
            result = await sync_team_roster(supabase, page, slug, rate_limit_s)
            results.append(result)

        await browser.close()

    total_synced = sum(r["synced"] for r in results)
    total_errors = sum(len(r["errors"]) for r in results)
    return {
        "status": "completed",
        "total_synced": total_synced,
        "total_errors": total_errors,
        "teams": results,
    }


async def sync_race_results(supabase: Client, rate_limit_ms: int | None = None) -> dict:
    """
    Fetch today's race results for all contracted riders.

    Uses Playwright to bypass Cloudflare, then calls .season_results() to get
    this season's results and filters for today's date to compute points_delta.
    Upserts into rider_pcs_history (rider_id, date, pcs_points, points_delta).
    """
    from playwright.async_api import async_playwright

    if rate_limit_ms is None:
        rate_limit_ms = RATE_LIMIT_MS

    rate_limit_s = rate_limit_ms / 1000
    today = date.today().isoformat()

    # Get all riders with active/notice contracts and their PCS slug
    response = supabase.table("contracts").select(
        "rider_id, riders(pcs_slug, pcs_points_1yr)"
    ).in_("status", ["active", "notice"]).execute()

    contracted = response.data or []

    if not contracted:
        return {"status": "completed", "synced": 0, "errors": [], "message": "No contracted riders"}

    synced = 0
    errors = []

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

        for contract in contracted:
            try:
                rider_info = contract.get("riders") or {}
                pcs_slug = rider_info.get("pcs_slug")
                if not pcs_slug:
                    continue

                rider_html = await fetch_html(page, pcs_slug, delay=rate_limit_s)
                rider = Rider(pcs_slug, html=rider_html, update_html=False)

                # .season_results() returns list of dicts with race results for current season
                try:
                    results = rider.season_results()
                except Exception as e:
                    logger.warning(f"season_results() failed for {pcs_slug}: {e}")
                    results = []

                # Sum points earned today
                today_points = 0
                for result in results:
                    result_date = result.get("date", "")
                    # PCS dates may be "YYYY-MM-DD" or "DD-MM" — normalise as needed
                    if result_date == today:
                        today_points += int(result.get("points", 0) or 0)

                if today_points > 0:
                    current_cumulative = int(rider_info.get("pcs_points_1yr", 0) or 0)

                    supabase.table("rider_pcs_history").upsert({
                        "rider_id": contract["rider_id"],
                        "date": today,
                        "pcs_points": current_cumulative,
                        "points_delta": today_points,
                    }, on_conflict="rider_id,date").execute()

                    synced += 1

            except Exception as e:
                logger.error(f"Failed to sync race results for contract {contract}: {e}")
                errors.append(str(e))

        await browser.close()

    return {"status": "completed", "synced": synced, "errors": errors}


async def purge_old_history(supabase: Client, keep_days: int = 7) -> dict:
    """Delete rider_pcs_history entries older than keep_days."""
    cutoff = (date.today() - timedelta(days=keep_days)).isoformat()
    supabase.table("rider_pcs_history").delete().lt("date", cutoff).execute()
    return {"status": "purged", "cutoff": cutoff}


async def sync_rider_daily(pcs_slug: str) -> dict:
    """
    Sync today's PCS points for a single rider.
    Kept for legacy endpoint compatibility — race results are now synced in bulk
    via sync_race_results() as part of the /jobs/sync-riders pipeline.
    """
    return {
        "status": "deprecated",
        "pcs_slug": pcs_slug,
        "message": "Use /jobs/sync-riders which calls sync_race_results() for all contracted riders.",
    }


async def sync_rider_history(pcs_slug: str) -> dict:
    """
    Backfill 365 days of PCS history for a newly contracted rider.
    TODO: implement with procyclingstats.
    """
    return {
        "status": "not_implemented",
        "pcs_slug": pcs_slug,
        "message": "History backfill not yet implemented.",
    }
