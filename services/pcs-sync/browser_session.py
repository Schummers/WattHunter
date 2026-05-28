"""
browser_session.py — nodriver shim with Playwright-compatible interface.

Cloudflare bypass strategy:
  1. Start visible Chrome via nodriver (no webdriver flag, real TLS fingerprint).
  2. Warm up on a neutral PCS rider page until cf_clearance cookie is set (~30s).
  3. Reuse the SAME tab for all subsequent navigations — the warm-up tab already
     has a CF-cleared session. New tabs in nodriver don't inherit CF state reliably.

Key design: all fetches go through the single warm-up tab via tab.get(url).
Sequential-only (no parallel fetches), which matches the existing pipeline.

CHROME_EXECUTABLE env var overrides the default Chrome path.
PCS_CF_RESOLVE_TIMEOUT_S controls warm-up timeout (default 35s).
PCS_PAGE_LOAD_WAIT_S controls per-page wait after navigation (default 5s).
"""
from __future__ import annotations

import asyncio
import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)

WARMUP_URL = "https://www.procyclingstats.com/rider/tadej-pogacar"
CF_RESOLVE_TIMEOUT_S = float(os.getenv("PCS_CF_RESOLVE_TIMEOUT_S", "35"))
PAGE_LOAD_WAIT_S = float(os.getenv("PCS_PAGE_LOAD_WAIT_S", "5"))

CHROME_PATH = os.getenv(
    "CHROME_EXECUTABLE",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
)

CLOUDFLARE_MARKERS = [
    "Just a moment", "Checking your browser", "cf-browser-verification",
    "Un instant", "Vérification de sécurité",
]


class NodriverPage:
    """Playwright-compatible page — navigates the single warm-up tab.

    Reuses the tab that obtained cf_clearance during warm-up, so CF cookies
    are guaranteed to be present for every fetch.
    """

    def __init__(self, shared_tab) -> None:
        self._tab = shared_tab  # The warm-up tab, shared across all pages

    async def goto(self, url: str, wait_until: str = "domcontentloaded") -> None:
        """Navigate the shared tab to url, wait for page to load."""
        await self._tab.get(url)
        await asyncio.sleep(PAGE_LOAD_WAIT_S)

    async def wait_for_timeout(self, ms: int) -> None:
        await asyncio.sleep(ms / 1000)

    async def content(self) -> str:
        return await self._tab.get_content()


class NodriverContext:
    """Playwright-compatible BrowserContext — thin wrapper over the shared tab."""

    def __init__(self, shared_tab) -> None:
        self._tab = shared_tab

    async def new_page(self) -> NodriverPage:
        return NodriverPage(self._tab)

    async def close(self) -> None:
        pass  # Don't close the shared tab


class NodriverBrowser:
    """Drop-in replacement for a Playwright Browser.
    Wraps nodriver with one-time CF warm-up on start().
    Exposes new_context() → NodriverContext → NodriverPage API.
    """

    def __init__(self) -> None:
        self._browser = None
        self._tab = None  # Warm-up tab, reused for all fetches

    async def start(self) -> "NodriverBrowser":
        """Start nodriver Chrome, run CF warm-up, return self."""
        import nodriver as uc

        headless = os.getenv("SCRAPER_HEADLESS", "0") == "1"
        logger.info("Starting nodriver (headless=%s, chrome=%s)...", headless, CHROME_PATH)
        self._browser = await uc.start(
            headless=headless,
            browser_executable_path=CHROME_PATH,
        )
        await self._warmup()
        return self

    async def _warmup(self) -> None:
        """Navigate to a neutral PCS page to obtain cf_clearance cookie.

        Keeps the tab open after warm-up — this tab is the shared tab reused
        for all subsequent fetches, ensuring CF cookies are always present.
        """
        print(f"  [nodriver] CF warm-up (max {CF_RESOLVE_TIMEOUT_S:.0f}s)...")
        self._tab = await self._browser.get(WARMUP_URL)
        try:
            await self._tab.find("h1", timeout=CF_RESOLVE_TIMEOUT_S)
            print("  [nodriver] CF cleared — warm-up done.")
            logger.info("CF warm-up successful.")
        except Exception:
            logger.warning("CF warm-up timed out — proceeding anyway.")
            print("  [nodriver] WARNING: warm-up timed out, continuing...")

    async def new_context(self, user_agent: Optional[str] = None, **kwargs) -> NodriverContext:
        if self._tab is None:
            raise RuntimeError("NodriverBrowser not started — call await session.start() first.")
        return NodriverContext(self._tab)

    async def close(self) -> None:
        """Stop nodriver. browser.stop() is synchronous in nodriver."""
        if self._browser is not None:
            try:
                self._browser.stop()
            except Exception:
                pass
            self._browser = None
            self._tab = None

    async def stop(self) -> None:
        await self.close()
