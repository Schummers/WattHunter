"""backfill_photos.py — one-shot migration of existing top-ranked rider photos to Supabase Storage.

PCS now blocks direct image hotlinks (Cloudflare 403), so rider photos must be self-hosted.
This backfill downloads the current PCS photo of each top rider (``pcs_rank <= TOP_PHOTO_RANK``,
whose ``photo_url`` is still a PCS path) and uploads it to the ``rider-photos`` bucket, then
rewrites ``photo_url`` to the Supabase CDN URL.

Run locally (residential IP + nodriver warm-up), like the rest of the PCS pipeline:

    cd services/pcs-sync && .venv/bin/python run_pipeline.py backfill-photos

Idempotent: riders whose ``photo_url`` already points at Supabase Storage are skipped, so
the script can be re-run safely (e.g. to retry the ones that failed).
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any, Dict, Optional

from supabase import Client

from sync import fetch_html, get_supabase
from photo_storage import self_host_photo, is_self_hosted, TOP_PHOTO_RANK

logger = logging.getLogger(__name__)

# Gentle pacing between image fetches (in-page fetches are light, but stay polite to CF).
PER_RIDER_PAUSE_S = 1.5
# A stable PCS page to anchor the tab on the procyclingstats.com origin before fetching
# images same-origin (carries the shared cf_clearance cookie).
ANCHOR_PATH = "rider/tadej-pogacar"


async def backfill_rider_photos(supabase: Optional[Client] = None) -> Dict[str, Any]:
    """Download + self-host photos for top riders (<= TOP_PHOTO_RANK) that still have a PCS path."""
    from browser_session import BrowserSession

    if supabase is None:
        supabase = get_supabase()

    resp = (
        supabase.table("riders")
        .select("id, pcs_slug, pcs_rank, photo_url")
        .lte("pcs_rank", TOP_PHOTO_RANK)
        .not_.is_("photo_url", "null")
        .order("pcs_rank")
        .execute()
    )
    all_riders = resp.data or []
    riders = [r for r in all_riders if not is_self_hosted(r.get("photo_url"))]
    total = len(riders)
    already = len(all_riders) - total

    print(f"  Top-{TOP_PHOTO_RANK} riders with a photo: {len(all_riders)} "
          f"({already} already self-hosted, {total} to backfill)")
    if total == 0:
        return {"status": "nothing_to_do", "total": 0, "uploaded": 0, "failed": []}

    uploaded = 0
    failed: list[str] = []

    async with BrowserSession() as browser:
        context = await browser.new_context()
        page = await context.new_page()
        try:
            # Anchor the tab on the PCS origin (and confirm Cloudflare is cleared) so the
            # subsequent in-page image fetches run same-origin with the cf_clearance cookie.
            print(f"  Warming up tab on {ANCHOR_PATH}...")
            await fetch_html(page, ANCHOR_PATH)

            for idx, rider in enumerate(riders, start=1):
                pcs_slug = rider["pcs_slug"]
                pcs_rank = rider.get("pcs_rank")
                print(f"    [{idx}/{total}] #{pcs_rank} {pcs_slug}...", end=" ", flush=True)

                new_url = await self_host_photo(
                    supabase, page, pcs_slug, rider.get("photo_url")
                )
                if new_url:
                    supabase.table("riders").update({"photo_url": new_url}).eq(
                        "id", rider["id"]
                    ).execute()
                    uploaded += 1
                    print("OK")
                else:
                    failed.append(pcs_slug)
                    print("FAILED")

                if idx < total:
                    await asyncio.sleep(PER_RIDER_PAUSE_S)
        finally:
            await context.close()

    return {
        "status": "completed",
        "total": total,
        "uploaded": uploaded,
        "failed": failed,
    }
