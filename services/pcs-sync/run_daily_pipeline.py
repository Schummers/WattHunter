"""
Daily pipeline runner — used by GitHub Actions.
Runs sync + scoring sequentially without needing the FastAPI server.
"""
import asyncio
import json
import sys

from sync import sync_all_riders, sync_race_results, purge_old_history, get_supabase
from scoring import calculate_daily_scores


async def main() -> None:
    supabase = get_supabase()

    print("=== Step A: Sync rider roster ===")
    roster = await sync_all_riders(supabase)
    print(json.dumps(roster, indent=2))

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
