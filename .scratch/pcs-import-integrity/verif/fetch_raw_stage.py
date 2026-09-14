"""Ticket 01 — fetch raw PCS HTML through the exact production path and save it.

Read-only. No DB access.

Usage:
    .venv/bin/python ../.scratch/pcs-import-integrity/verif/fetch_raw_stage.py \
        race/vuelta-a-espana/2026/stage-4 out.html
"""
from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve()
PCS = HERE.parents[3] / "services" / "pcs-sync"
sys.path.insert(0, str(PCS))


async def main(slug: str, out: Path) -> None:
    from browser_session import BrowserSession
    from run_pipeline import USER_AGENT
    from sync import fetch_html

    async with BrowserSession() as browser:
        ctx = await browser.new_context(user_agent=USER_AGENT)
        page = await ctx.new_page()
        try:
            html = await fetch_html(page, slug)
        finally:
            await ctx.close()

    out.write_text(html, encoding="utf-8")
    print(f"saved {len(html)} chars -> {out}")


if __name__ == "__main__":
    slug = sys.argv[1]
    out = Path(sys.argv[2]).resolve()
    print(f"backend={os.environ.get('SCRAPER_BACKEND', 'nodriver')} slug={slug}")
    asyncio.run(main(slug, out))
