"""
PCS sync logic — wraps procyclingstats and writes to Supabase.
"""
import asyncio
import os
import math
from datetime import date, timedelta
from supabase import create_client, Client

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
RATE_LIMIT_MS = int(os.getenv("PCS_RATE_LIMIT_DELAY_MS", "4000"))
CONVERSION_RATE = int(os.getenv("CONVERSION_RATE_EUR_PER_PCS", "500"))

SALARY_FLOOR = 5_000   # €/month
SALARY_CAP   = 300_000 # €/month


def get_supabase() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def calculate_monthly_salary(pcs_points_1yr: int) -> int:
    """Salary formula from PRD_02: (pcs_1yr / 1000) × 500,000 / 12"""
    annual = (pcs_points_1yr / 1000) * 500_000
    monthly = annual / 12
    return max(SALARY_FLOOR, min(SALARY_CAP, int(monthly)))


async def sync_all_riders() -> dict:
    """
    Sync full rider catalogue from PCS.
    TODO: implement procyclingstats scraping once lib compatibility confirmed.
    """
    # Placeholder — actual implementation after validating procyclingstats
    # on this environment and confirming rate limit safety.
    return {
        "status": "not_implemented",
        "message": "Full sync not yet implemented. Use CSV import for alpha.",
    }


async def sync_rider_daily(pcs_slug: str) -> dict:
    """
    Sync today's PCS points for a single rider.
    TODO: implement with procyclingstats.
    """
    return {
        "status": "not_implemented",
        "pcs_slug": pcs_slug,
        "message": "Daily sync not yet implemented.",
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
