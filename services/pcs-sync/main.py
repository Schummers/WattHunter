"""
WattHunter — PCS Sync Microservice
FastAPI service for syncing procyclingstats data to Supabase.
"""
from fastapi import FastAPI, HTTPException, Header
from fastapi.responses import JSONResponse
import os
from dotenv import load_dotenv

from sync import sync_all_riders, sync_rider_daily, sync_rider_history

load_dotenv()

app = FastAPI(title="WattHunter PCS Sync", version="0.1.0")

API_SECRET = os.getenv("SYNC_API_SECRET", "")


def _check_auth(x_api_secret: str | None) -> None:
    """Simple secret-based auth for internal calls."""
    if API_SECRET and x_api_secret != API_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "pcs-sync"}


@app.post("/sync/riders")
async def sync_riders_endpoint(x_api_secret: str | None = Header(default=None)):
    """
    Full rider catalogue sync (~923 riders).
    Updates pcs_points_1yr, pcs_rank, monthly_salary for all riders.
    Run: daily at 08:00 UTC via pg_cron → HTTP trigger.
    Runtime: ~62 min with 4s delay between requests.
    """
    _check_auth(x_api_secret)
    result = await sync_all_riders()
    return JSONResponse(content=result)


@app.post("/sync/daily/{rider_pcs_slug}")
async def sync_rider_daily_endpoint(
    rider_pcs_slug: str,
    x_api_secret: str | None = Header(default=None),
):
    """
    Sync today's PCS points for a single active rider.
    Called at 08:30 UTC for all is_active_in_game=true riders.
    """
    _check_auth(x_api_secret)
    result = await sync_rider_daily(rider_pcs_slug)
    return JSONResponse(content=result)


@app.post("/sync/history/{rider_pcs_slug}")
async def sync_rider_history_endpoint(
    rider_pcs_slug: str,
    x_api_secret: str | None = Header(default=None),
):
    """
    Backfill 365-day PCS history for a newly contracted rider.
    Called at auction resolution for each winning rider.
    """
    _check_auth(x_api_secret)
    result = await sync_rider_history(rider_pcs_slug)
    return JSONResponse(content=result)
