"""
Daily pipeline runner — run locally (cron or manual).
Runs sync + scoring sequentially without needing the FastAPI server.

Requires:
  - .env file in this directory (see .env.example)
  - Playwright Chromium installed: python3 -m playwright install chromium
  - Residential IP (Cloudflare blocks datacenter IPs)

Usage:
  cd services/pcs-sync
  python3 run_daily_pipeline.py          # full pipeline
  python3 run_daily_pipeline.py --roster # roster sync only (no scoring)
"""
import asyncio
import json
import sys
import os

from dotenv import load_dotenv
load_dotenv()

from sync import sync_all_riders, sync_race_results, purge_old_history, get_supabase
from scoring import calculate_daily_scores


async def main() -> None:
    roster_only = "--roster" in sys.argv

    # Verify env
    if not os.getenv("SUPABASE_URL") or not os.getenv("SUPABASE_SERVICE_ROLE_KEY"):
        print("ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.")
        print("Create a .env file from .env.example in this directory.")
        sys.exit(1)

    supabase = get_supabase()

    print("=== Step A: Sync rider roster ===")
    roster = await sync_all_riders(supabase)
    print(json.dumps(roster, indent=2))

    if roster_only:
        print("\nDone (roster only).")
        return

    print("\n=== Step B: Sync race results ===")
    results = await sync_race_results(supabase)
    print(json.dumps(results, indent=2))

    print("\n=== Step C: Purge old history ===")
    purge = await purge_old_history(supabase)
    print(json.dumps(purge, indent=2))

    print("\n=== Step D: Calculate daily scores ===")
    scoring = await calculate_daily_scores(supabase)
    print(json.dumps(scoring, indent=2))

    print("\nDone.")


if __name__ == "__main__":
    asyncio.run(main())
