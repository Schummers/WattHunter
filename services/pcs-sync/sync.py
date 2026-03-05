"""
PCS sync logic — wraps procyclingstats and writes to Supabase.
Uses Playwright to bypass Cloudflare bot-protection on procyclingstats.com.
Requires residential IP (Cloudflare blocks datacenter IPs like GitHub Actions).
"""
from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime
from typing import Optional
from procyclingstats import Team
from supabase import create_client, Client

logger = logging.getLogger(__name__)

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
RATE_LIMIT_MS = int(os.getenv("PCS_RATE_LIMIT_DELAY_MS", "4000"))

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


# Level gating thresholds: level → max PCS rank accessible
LEVEL_RANK_THRESHOLDS = [500, 400, 300, 200, 150, 100, 75, 50, 25, 10]


def rank_max_for_level(level: int) -> int:
    """Return the max PCS rank a player at this level can access."""
    idx = max(0, min(level, 10) - 1)
    return LEVEL_RANK_THRESHOLDS[idx]


def format_rider_name(raw_name: str) -> str:
    """Convert PCS format 'DE KLEIJN Arvid' → 'Arvid De Kleijn'."""
    words = raw_name.split()
    i = 0
    while i < len(words) and words[i] == words[i].upper() and len(words[i]) > 1:
        i += 1
    if 0 < i < len(words):
        first_parts = words[i:]
        last_parts = [w.title() for w in words[:i]]
        return " ".join(first_parts) + " " + " ".join(last_parts)
    return raw_name


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

            # Format name: "DE KLEIJN Arvid" → "Arvid De Kleijn"
            # PCS puts ALL-CAPS lastname (possibly multi-word) first
            raw_name = rider_entry.get("rider_name", "Unknown")
            words = raw_name.split()
            i = 0
            while i < len(words) and words[i] == words[i].upper() and len(words[i]) > 1:
                i += 1
            if 0 < i < len(words):
                first_parts = words[i:]
                last_parts = [w.title() for w in words[:i]]
                name = " ".join(first_parts) + " " + " ".join(last_parts)
            else:
                name = raw_name

            nationality = rider_entry.get("nationality", "??")[:2].upper()

            # NOTE: pcs_points_1yr, pcs_rank, monthly_salary are NOT set here.
            # Team.riders() ranking_points is unreliable for many riders.
            # These fields are only updated by update_global_ranking() in sync_race.py
            # which scrapes the authoritative PCS individual ranking page.

            rider_data = {
                "pcs_slug": slug,
                "full_name": name,
                "nationality": nationality,
                "real_team": real_team,
                "team_type": "ProTeam",
                "age": rider_entry.get("age"),
                "specialty": "all_rounder",
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


async def sync_top500(supabase: Optional[Client] = None, pages: int = 5) -> dict:
    """
    Scrape the PCS global individual ranking (top N×100) and upsert riders.

    This replaces sync_all_riders() — the game pool is the top 500 PCS global,
    not specific ProTeam rosters.

    Uses fresh browser context per page to avoid Cloudflare.
    Page 1 uses clean URL; pages 2+ use rankings.php with offset & filter params.
    """
    from playwright.async_api import async_playwright
    from procyclingstats import Ranking

    if supabase is None:
        supabase = get_supabase()

    results = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)

        for page_idx in range(pages):
            offset = page_idx * 100
            context = await browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/120.0.0.0 Safari/537.36"
                )
            )
            page = await context.new_page()

            try:
                if offset == 0:
                    fetch_url = "https://www.procyclingstats.com/rankings/me/individual"
                else:
                    fetch_url = (
                        "https://www.procyclingstats.com/rankings.php"
                        "?p=me&s=individual&offset={}&filter=Filter".format(offset)
                    )

                await asyncio.sleep(4)
                await page.goto(fetch_url, wait_until="domcontentloaded")
                await page.wait_for_timeout(6000)

                html = await page.content()
                if any(m in html for m in ["Just a moment", "Checking your browser"]):
                    logger.warning("Cloudflare blocked at offset=%d", offset)
                    break

                ranking = Ranking("rankings/me/individual", html=html, update_html=False)
                entries = ranking.individual_ranking()

                synced = 0
                errors = []

                for entry in entries:
                    try:
                        slug = entry.get("rider_url", "")
                        if not slug:
                            continue

                        name = format_rider_name(entry.get("rider_name", "Unknown"))
                        team_name = entry.get("team_name", "Unknown")
                        nationality = entry.get("nationality", "??")[:2].upper()
                        pcs_points = entry.get("points", 0) or 0
                        pcs_rank = entry.get("rank")
                        salary = calculate_monthly_salary(pcs_points)

                        rider_data = {
                            "pcs_slug": slug,
                            "full_name": name,
                            "nationality": nationality,
                            "real_team": team_name,
                            "pcs_points_1yr": pcs_points,
                            "pcs_rank": pcs_rank,
                            "monthly_salary": salary,
                            "ever_in_top500": True,
                            "last_synced_at": datetime.utcnow().isoformat(),
                        }

                        supabase.table("riders").upsert(
                            rider_data, on_conflict="pcs_slug"
                        ).execute()
                        synced += 1

                    except Exception as e:
                        logger.error("Failed to sync rider %s: %s", slug, e)
                        errors.append(str(e))

                results.append({
                    "offset": offset,
                    "synced": synced,
                    "total_on_page": len(entries),
                    "errors": errors,
                })

            finally:
                await context.close()

            if page_idx < pages - 1:
                pause = 15
                print("    Waiting {}s before next page...".format(pause))
                await asyncio.sleep(pause)

        await browser.close()

    total_synced = sum(r["synced"] for r in results)
    total_errors = sum(len(r["errors"]) for r in results)
    return {
        "status": "completed",
        "total_synced": total_synced,
        "total_errors": total_errors,
        "pages": results,
    }


