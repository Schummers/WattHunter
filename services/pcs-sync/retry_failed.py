"""Retry enrichment for specific rider slugs that failed in the main pipeline."""
import asyncio
import json
from dotenv import load_dotenv
load_dotenv()

from sync import get_supabase
from enrich import enrich_single_rider, BATCH_PAUSE_SECONDS

FAILED_SLUGS = [
    # list index out of range (19 riders — parsing bug, now fixed)
    "rider/gotzon-martin",
    "rider/mauro-cuylits",
    "rider/clement-izquierdo",
    "rider/jelle-johannink",
    "rider/nikita-tsvetkov",
    "rider/abdulla-jasim-al-ali",
    "rider/cedrik-bakke-christophersen",
    "rider/robert-donaldson",
    "rider/haoyu-su",
    "rider/milkias-maekele",
    "rider/aleksey-lutsenko",
    "rider/axel-van-der-tuuk",
    "rider/tijmen-graat",
    "rider/carl-frederik-bevort",
    "rider/sam-maisonobe",
    "rider/davide-donati",
    "rider/matteo-scalco",
    "rider/yukiya-arashiro",
    "rider/filippo-turconi",
    # Network/SSL errors (6 riders — transient, should work on retry)
    "rider/elia-viviani",
    "rider/mirco-maestri",
    "rider/kamiel-bonneu",
    "rider/alex-tolio",
    "rider/arvid-de-kleijn",
    "rider/maikel-zijlaard",
]


async def main():
    from playwright.async_api import async_playwright

    supabase = get_supabase()

    # Look up rider IDs from DB
    riders = []
    for slug in FAILED_SLUGS:
        resp = supabase.table("riders").select("id, pcs_slug, pcs_rank").eq("pcs_slug", slug).execute()
        if resp.data:
            riders.append(resp.data[0])
        else:
            print(f"  WARNING: {slug} not found in DB, skipping")

    print(f"=== Retry: {len(riders)} failed riders ===")
    print(f"Pause between riders: {BATCH_PAUSE_SECONDS}s")
    print()

    ok = 0
    still_failed = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        try:
            for i, rider in enumerate(riders):
                rider_id = rider["id"]
                pcs_slug = rider["pcs_slug"]
                pcs_rank = rider.get("pcs_rank", "?")

                print(f"  [{i+1}/{len(riders)}] #{pcs_rank} {pcs_slug}...", end=" ", flush=True)

                context = await browser.new_context(
                    user_agent=(
                        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/120.0.0.0 Safari/537.36"
                    )
                )
                page = await context.new_page()

                try:
                    result = await enrich_single_rider(supabase, page, rider_id, pcs_slug)
                    if result["status"] == "ok":
                        print("OK")
                        ok += 1
                    else:
                        print(f"STILL FAILED: {result.get('error', '?')}")
                        still_failed.append({"slug": pcs_slug, "error": result.get("error", "?")})
                finally:
                    await context.close()

                if i < len(riders) - 1:
                    print(f"    (waiting {BATCH_PAUSE_SECONDS}s...)")
                    await asyncio.sleep(BATCH_PAUSE_SECONDS)
        finally:
            await browser.close()

    print()
    print(json.dumps({
        "total": len(riders),
        "ok": ok,
        "still_failed": len(still_failed),
        "failures": still_failed,
    }, indent=2))
    print()
    print("Done — retry complete.")


if __name__ == "__main__":
    asyncio.run(main())
