"""photo_storage.py — download rider photos from PCS and self-host them in Supabase Storage.

procyclingstats.com (Cloudflare) now returns a 403 challenge page for any direct image
request without a cf_clearance cookie, so the browser <img> hotlinks that used to load
rider photos all broke. The scraper, however, holds a valid cf_clearance via nodriver.

This module downloads a rider's photo **through the warmed-up nodriver tab** (an in-page
``fetch`` runs same-origin on procyclingstats.com and inherits the cf_clearance cookie),
then uploads the bytes to the public ``rider-photos`` Supabase Storage bucket and returns
the public CDN URL to store in ``riders.photo_url``.
"""
from __future__ import annotations

import base64
import json
import logging
from typing import Any, Optional

from supabase import Client

logger = logging.getLogger(__name__)

BUCKET = "rider-photos"

# Only the top 300 riders get a self-hosted photo (product decision — covers most rosters).
TOP_PHOTO_RANK = 300

_CT_EXT = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}


def resolve_pcs_image_url(photo_url: str) -> str:
    """Mirror of the frontend resolvePhotoUrl: relative PCS path -> absolute URL."""
    if photo_url.startswith("http"):
        return photo_url
    return f"https://www.procyclingstats.com/{photo_url.lstrip('/')}"


def is_self_hosted(photo_url: Optional[str]) -> bool:
    """True when the stored URL already points at Supabase Storage (idempotency guard)."""
    return bool(photo_url) and "supabase" in photo_url and "/rider-photos/" in photo_url


async def download_image_via_page(page: Any, image_url: str) -> Optional[tuple[bytes, str]]:
    """Download an image using an in-page fetch from the (PCS-origin) nodriver tab.

    The tab must already be on a procyclingstats.com page (true right after
    ``fetch_html``) so the request is same-origin and carries the cf_clearance cookie.
    Returns ``(bytes, content_type)`` or ``None`` if the fetch failed / was challenged.
    """
    js = (
        "(async () => {"
        f"  const url = {json.dumps(image_url)};"
        "  try {"
        "    const resp = await fetch(url, { credentials: 'include' });"
        "    if (!resp.ok) return 'ERR:status:' + resp.status;"
        "    const ct = (resp.headers.get('content-type') || '').split(';')[0].trim();"
        "    if (!ct.startsWith('image/')) return 'ERR:ct:' + ct;"
        "    const buf = await resp.arrayBuffer();"
        "    const bytes = new Uint8Array(buf);"
        "    let bin = '';"
        "    const chunk = 0x8000;"
        "    for (let i = 0; i < bytes.length; i += chunk) {"
        "      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));"
        "    }"
        "    return 'OK:' + ct + ':' + btoa(bin);"
        "  } catch (e) { return 'ERR:ex:' + (e && e.message ? e.message : e); }"
        "})()"
    )
    try:
        result = await page.evaluate(js, await_promise=True)
    except Exception as exc:  # noqa: BLE001
        logger.warning("in-page fetch raised for %s: %s", image_url, exc)
        return None

    if not isinstance(result, str) or not result.startswith("OK:"):
        logger.warning("photo download failed for %s: %s", image_url, str(result)[:120])
        return None

    _, content_type, b64 = result.split(":", 2)
    try:
        data = base64.b64decode(b64)
    except Exception as exc:  # noqa: BLE001
        logger.warning("base64 decode failed for %s: %s", image_url, exc)
        return None
    if not data:
        return None
    return data, content_type


def upload_rider_photo(
    supabase: Client, pcs_slug: str, image_bytes: bytes, content_type: str = "image/jpeg"
) -> str:
    """Upload (upsert) the image to the rider-photos bucket and return its public URL."""
    ext = _CT_EXT.get(content_type, "jpg")
    path = f"{pcs_slug}.{ext}"
    supabase.storage.from_(BUCKET).upload(
        path,
        image_bytes,
        {"content-type": content_type, "upsert": "true"},
    )
    public_url = supabase.storage.from_(BUCKET).get_public_url(path)
    # Some supabase-py versions append a trailing "?" — strip it for a clean URL.
    return public_url.rstrip("?")


async def self_host_photo(
    supabase: Client, page: Any, pcs_slug: str, photo_url: Optional[str]
) -> Optional[str]:
    """Download a rider's PCS photo and upload it to Supabase Storage.

    Returns the public Supabase URL, the unchanged URL if already self-hosted, or
    ``None`` if there is no source photo or the download failed (caller stores NULL).
    """
    if not photo_url:
        return None
    if is_self_hosted(photo_url):
        return photo_url
    downloaded = await download_image_via_page(page, resolve_pcs_image_url(photo_url))
    if downloaded is None:
        return None
    image_bytes, content_type = downloaded
    try:
        return upload_rider_photo(supabase, pcs_slug, image_bytes, content_type)
    except Exception as exc:  # noqa: BLE001
        logger.warning("storage upload failed for %s: %s", pcs_slug, exc)
        return None
