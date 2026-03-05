"""
PCS sync logic — wraps procyclingstats and writes to Supabase.
Uses Playwright to bypass Cloudflare bot-protection on procyclingstats.com.
Requires residential IP (Cloudflare blocks datacenter IPs like GitHub Actions).
"""
from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, date, timedelta
from typing import Optional
from procyclingstats import Team
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
    "team/uno-x-mobility-2026",
    "team/xds-astana-team-2026",
    "team/lotto-intermarche-2026",
    "team/nsn-cycling-team-2026",
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


CLOUDFLARE_MARKERS = ["Just a moment", "Checking your browser", "cf-browser-verification"]


async def fetch_html(page, url: str, delay: float = 4.0) -> str:
    """Fetch a page using Playwright to bypass Cloudflare, return HTML."""
    await asyncio.sleep(delay)
    full_url = f"https://www.procyclingstats.com/{url}"
    await page.goto(full_url, wait_until="domcontentloaded")
    # Wait for content to load past Cloudflare challenge
    await page.wait_for_timeout(5000)
    html = await page.content()
    if any(marker in html for marker in CLOUDFLARE_MARKERS):
        raise RuntimeError(f"Cloudflare blocked request to {full_url}")
    return html


async def sync_team_roster(supabase: Client, page, team_slug: str, rate_limit_s: float) -> dict:
    """
    Fetch all riders from a PCS team page and upsert into riders table.
    Uses team.riders() data only (no individual rider page fetches) to avoid
    Cloudflare rate limiting. Only fetches 1 page per team.
    """
    try:
        html = await fetch_html(page, team_slug, delay=rate_limit_s)
        team = Team(team_slug, html=html, update_html=False)
        roster = team.riders()
    except Exception as e:
        logger.error(f"Failed to fetch team {team_slug}: {e}")
        return {"team": team_slug, "synced": 0, "errors": [str(e)]}

    synced = 0
    errors = []

    # Derive a human-readable team name from the slug
    # e.g. "team/tudor-pro-cycling-team-2026" → "Tudor Pro Cycling Team"
    real_team = (
        team_slug.split("/")[-1]      # "tudor-pro-cycling-team-2026"
        .rsplit("-", 1)[0]             # "tudor-pro-cycling-team"
        .replace("-", " ")             # "tudor pro cycling team"
        .title()                       # "Tudor Pro Cycling Team"
    )

    for rider_entry in roster:
        try:
            slug = rider_entry.get("rider_url", "")
            if not slug:
                continue

            # Format name: "ALAPHILIPPE Julian" → "Julian Alaphilippe"
            raw_name = rider_entry.get("rider_name", "Unknown")
            parts = raw_name.split(" ", 1)
            if len(parts) == 2 and parts[0] == parts[0].upper():
                name = f"{parts[1]} {parts[0].title()}"
            else:
                name = raw_name

            nationality = rider_entry.get("nationality", "??")[:2].upper()
            pcs_points = rider_entry.get("ranking_points", 0) or 0
            salary = calculate_monthly_salary(pcs_points)

            rider_data = {
                "pcs_slug": slug,
                "full_name": name,
                "nationality": nationality,
                "real_team": real_team,
                "team_type": "ProTeam",
                "age": rider_entry.get("age"),
                "specialty": "all_rounder",
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


async def sync_all_riders(supabase: Optional[Client] = None, rate_limit_ms: Optional[int] = None) -> dict:
    """
    Sync all riders from all configured ProTeams using Playwright to bypass
    Cloudflare bot-protection on procyclingstats.com.

    Uses a fresh browser context per team to avoid Cloudflare session tracking,
    with a 10-second pause between teams to stay under rate limits.
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

        for i, slug in enumerate(PROTEAM_SLUGS):
            # Fresh context per team to avoid Cloudflare session fingerprinting
            context = await browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/120.0.0.0 Safari/537.36"
                )
            )
            page = await context.new_page()

            print(f"  Syncing team {i+1}/{len(PROTEAM_SLUGS)}: {slug}")
            result = await sync_team_roster(supabase, page, slug, rate_limit_s)
            results.append(result)
            print(f"    → {result['synced']} riders synced, {len(result['errors'])} errors")

            await context.close()

            # Pause between teams to avoid Cloudflare rate limiting
            if i < len(PROTEAM_SLUGS) - 1:
                pause = 15
                print(f"    Waiting {pause}s before next team...")
                await asyncio.sleep(pause)

        await browser.close()

    total_synced = sum(r["synced"] for r in results)
    total_errors = sum(len(r["errors"]) for r in results)
    return {
        "status": "completed",
        "total_synced": total_synced,
        "total_errors": total_errors,
        "teams": results,
    }


async def sync_race_results(supabase: Client, rate_limit_ms: Optional[int] = None) -> dict:
    """
    Compute today's points delta for contracted riders by comparing
    the current pcs_points_1yr (just updated by sync_all_riders) with
    yesterday's stored value in rider_pcs_history.

    No PCS page fetches needed — works entirely from Supabase data.
    Must run AFTER sync_all_riders() so riders.pcs_points_1yr is fresh.
    """
    today = date.today().isoformat()
    yesterday = (date.today() - timedelta(days=1)).isoformat()

    # Get all contracted riders with their current PCS points
    response = supabase.table("contracts").select(
        "rider_id, riders(id, pcs_slug, pcs_points_1yr)"
    ).in_("status", ["active", "notice"]).execute()

    contracted = response.data or []
    if not contracted:
        return {"status": "completed", "synced": 0, "errors": [], "message": "No contracted riders"}

    synced = 0
    errors = []

    for contract in contracted:
        try:
            rider_info = contract.get("riders") or {}
            rider_id = contract["rider_id"]
            current_points = int(rider_info.get("pcs_points_1yr", 0) or 0)

            if current_points == 0:
                continue

            # Get yesterday's stored points to compute delta
            prev = supabase.table("rider_pcs_history").select(
                "pcs_points"
            ).eq("rider_id", rider_id).eq("date", yesterday).execute()

            if prev.data:
                previous_points = int(prev.data[0].get("pcs_points", 0) or 0)
            else:
                # First day tracking this rider — no delta, just record baseline
                previous_points = current_points

            points_delta = current_points - previous_points

            # Always record today's snapshot; scoring only uses rows with delta > 0
            supabase.table("rider_pcs_history").upsert({
                "rider_id": rider_id,
                "date": today,
                "pcs_points": current_points,
                "points_delta": max(0, points_delta),
            }, on_conflict="rider_id,date").execute()

            synced += 1

        except Exception as e:
            logger.error(f"Failed to compute delta for rider {contract.get('rider_id')}: {e}")
            errors.append(str(e))

    return {"status": "completed", "synced": synced, "errors": errors}


async def purge_old_history(supabase: Client, keep_days: int = 7) -> dict:
    """Delete rider_pcs_history entries older than keep_days."""
    cutoff = (date.today() - timedelta(days=keep_days)).isoformat()
    supabase.table("rider_pcs_history").delete().lt("date", cutoff).execute()
    return {"status": "purged", "cutoff": cutoff}


