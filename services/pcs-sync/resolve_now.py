"""
Manual auction resolution — run to force-resolve a specific round.
Usage:
  python3 resolve_now.py                  # resolve based on date
  python3 resolve_now.py --round 1        # force resolve round 1
  python3 resolve_now.py --round 1 --close  # resolve round 1 and close the auction
"""
import os, sys, pathlib, asyncio, logging, argparse

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

# Load service role key from apps/web/.env.local if not in env
if not os.getenv("SUPABASE_SERVICE_ROLE_KEY"):
    env_path = pathlib.Path(__file__).parent.parent.parent / "apps" / "web" / ".env.local"
    for line in env_path.read_text().splitlines():
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            os.environ[k.strip()] = v.strip()

os.environ.setdefault("SUPABASE_URL", "https://uuvshpykvpnhpeondqjt.supabase.co")

from supabase import create_client
from auction import resolve_current_round

async def main():
    parser = argparse.ArgumentParser(description="Resolve auction round manually")
    parser.add_argument("--round", type=int, default=None, help="Force a specific round (1-3)")
    parser.add_argument("--close", action="store_true", help="Close the auction after resolution")
    args = parser.parse_args()

    supabase = create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_ROLE_KEY"],
    )
    print(f"Resolving auction round (force_round={args.round}, force_close={args.close})...")
    result = await resolve_current_round(supabase, force_round=args.round, force_close=args.close)
    import json
    print(json.dumps(result, indent=2, default=str))

asyncio.run(main())
