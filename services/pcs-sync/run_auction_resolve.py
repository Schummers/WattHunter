"""
Auction resolution runner — used by GitHub Actions.
Runs auction resolution without needing the FastAPI server.
"""
import asyncio
import json

from sync import get_supabase
from auction import resolve_current_round


async def main() -> None:
    supabase = get_supabase()

    print("=== Resolving auction round ===")
    result = await resolve_current_round(supabase)
    print(json.dumps(result, indent=2))

    print("\nDone.")


if __name__ == "__main__":
    asyncio.run(main())
