"""
Manual auction resolution — run to force-resolve round 1 without waiting.
Usage: python3 resolve_now.py
"""
import os, sys, pathlib, asyncio, logging

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
    supabase = create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_ROLE_KEY"],
    )
    print("Resolving current auction round...")
    result = await resolve_current_round(supabase)
    import json
    print(json.dumps(result, indent=2, default=str))

asyncio.run(main())
