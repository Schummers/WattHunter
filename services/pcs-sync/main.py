"""
WattHunter — PCS Sync Microservice
FastAPI service for syncing procyclingstats data to Supabase.
"""
from __future__ import annotations

from fastapi import FastAPI, HTTPException, Header, Request
from fastapi.responses import JSONResponse
import os
from typing import Optional
from dotenv import load_dotenv

from sync import sync_all_riders
from scoring import calculate_daily_scores
from auction import resolve_current_round

from supabase import create_client

load_dotenv()

app = FastAPI(title="WattHunter PCS Sync", version="0.2.0")

API_SECRET = os.getenv("SYNC_API_SECRET")
if not API_SECRET:
    import warnings
    warnings.warn("SYNC_API_SECRET not set — API authentication disabled. Set this in production!", stacklevel=2)

# Supabase client (service role — never exposed to browser)
_supabase = create_client(
    os.getenv("SUPABASE_URL", ""),
    os.getenv("SUPABASE_SERVICE_ROLE_KEY", ""),
)


def _check_auth(x_api_secret: Optional[str]) -> None:
    """Simple secret-based auth for internal calls."""
    if not API_SECRET:
        return  # Auth disabled (dev mode only)
    if x_api_secret != API_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "pcs-sync"}


@app.post("/sync/riders")
async def sync_riders_endpoint(x_api_secret: Optional[str] = Header(default=None)):
    """
    Full rider catalogue sync (~500 top riders from PCS global ranking).
    Updates pcs_points_1yr, pcs_rank, monthly_salary for all riders.
    Runtime: ~2 min with 15s pause between pages.
    """
    _check_auth(x_api_secret)
    result = await sync_all_riders()
    return JSONResponse(content=result)


@app.post("/jobs/sync-riders")
async def job_sync_riders(
    request: Request,
    x_api_secret: Optional[str] = Header(default=None),
):
    """
    Top 600 sync: fetches PCS global ranking pages via Playwright, upserts riders.
    Race results are now handled by sync_race.py (separate pipeline).

    Runtime: ~2 min (6 ranking pages fetched, 15s pause between pages).
    """
    _check_auth(x_api_secret)

    roster_result = await sync_all_riders(_supabase)

    return JSONResponse(content={"roster": roster_result})


@app.post("/jobs/daily-scoring")
async def job_daily_scoring(
    request: Request,
    x_api_secret: Optional[str] = Header(default=None),
):
    """
    Calculate daily XP for all teams with contracted riders who earned PCS points today.
    Treasury is handled separately by /jobs/phase-finance and sponsor bonuses.
    """
    _check_auth(x_api_secret)
    result = await calculate_daily_scores(_supabase)
    return JSONResponse(content=result)


@app.post("/jobs/resolve-auction")
async def job_resolve_auction(
    request: Request,
    x_api_secret: Optional[str] = Header(default=None),
):
    """
    Resolve the current round of all open auctions (3-round sealed-bid system).
    Returns {"status": "no_open_auctions"} if nothing to resolve.
    """
    _check_auth(x_api_secret)
    result = await resolve_current_round(_supabase)
    return JSONResponse(content=result)
