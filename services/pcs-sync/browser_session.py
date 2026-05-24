"""browser_session.py — Cloudflare-evading scraper backend.

Drop-in shim that wraps either:
  - **nodriver** (default): undetected CDP-based Chrome driver, successor of
    undetected-chromedriver. Bypasses Cloudflare bot detection that flags
    vanilla Playwright (`navigator.webdriver`, `Runtime.enable` CDP call).
  - **playwright** (fallback via ``SCRAPER_BACKEND=playwright``): emergency
    rollback path. Kept until nodriver has 2+ weeks of clean runs.

Both backends expose the same async API surface used by the rest of pcs-sync::

    async with BrowserSession() as browser:
        ctx = await browser.new_context(user_agent="...")
        page = await ctx.new_page()
        await page.goto(url, wait_until="domcontentloaded")
        await page.wait_for_timeout(5000)
        html = await page.content()
        await ctx.close()

Environment variables:
  - ``SCRAPER_BACKEND``: ``nodriver`` (default) | ``playwright``
  - ``SCRAPER_HEADLESS``: ``1`` (default) | ``0`` to see the browser window
"""

from __future__ import annotations

import asyncio
import atexit
import logging
import os
import signal
from typing import Any, List, Optional

logger = logging.getLogger(__name__)


def _backend() -> str:
    return os.environ.get("SCRAPER_BACKEND", "nodriver").lower()


def _headless_default() -> bool:
    """Default headless setting.

    Default is **False** (visible window). Cloudflare currently flags
    headless Chrome on this setup even with nodriver, causing every
    fresh-browser warm-up to time out before auto-falling back. Visible
    mode skips that 30s wait. Opt-in to headless attempts via
    ``SCRAPER_HEADLESS=1`` once CF stops blocking your IP/fingerprint.
    """
    return os.environ.get("SCRAPER_HEADLESS", "0") == "1"


# Cloudflare interstitial detection (multi-lang).
_CF_MARKERS = (
    "Just a moment", "Checking your browser", "cf-browser-verification",
    "Un instant", "Un momento", "Einen Moment", "Ein Moment", "Een ogenblik",
)

# Default warm-up URL — a stable, popular rider profile (rarely changes,
# unlikely to 404). The warm-up's job is to let nodriver solve the initial
# Cloudflare interstitial so subsequent requests get the CF clearance cookie.
WARMUP_URL = "https://www.procyclingstats.com/rider/tadej-pogacar"
WARMUP_POLL_TIMEOUT_S = float(os.environ.get("PCS_WARMUP_TIMEOUT_S", "30"))
WARMUP_POLL_INTERVAL_S = 2.0


# ===================================================================
# nodriver backend
# ===================================================================


class _NodriverPage:
    """Wraps a ``nodriver.Tab`` with the Playwright Page API subset we use."""

    def __init__(self, tab: Any) -> None:
        self._tab = tab

    async def goto(self, url: str, wait_until: str = "domcontentloaded") -> None:  # noqa: ARG002
        # nodriver awaits the navigation response internally;
        # `wait_until` is accepted for Playwright API compatibility but ignored.
        await self._tab.get(url)

    async def wait_for_timeout(self, ms: int) -> None:
        await asyncio.sleep(ms / 1000)

    async def content(self) -> str:
        return await self._tab.get_content()

    async def close(self) -> None:
        try:
            await self._tab.close()
        except Exception as exc:
            logger.debug("Tab close failed: %s", exc)


class _NodriverContext:
    """Owns a set of tabs spawned via this context so we can clean them up.

    nodriver doesn't have a per-context isolation primitive — all tabs share
    cookies and the Cloudflare clearance with the parent browser, which is
    actually what we want for CF evasion (no challenge re-solve per page).
    """

    def __init__(self, browser: Any, user_agent: Optional[str] = None) -> None:
        self._browser = browser
        self._tabs: List[Any] = []
        # `user_agent` kwarg accepted for API compat but ignored — nodriver
        # uses the real Chrome UA, which is better for CF evasion than a
        # spoofed string.
        _ = user_agent

    async def new_page(self) -> _NodriverPage:
        tab = await self._browser.get("about:blank", new_tab=True)
        self._tabs.append(tab)
        return _NodriverPage(tab)

    async def close(self) -> None:
        for tab in self._tabs:
            try:
                await tab.close()
            except Exception as exc:
                logger.debug("Tab close failed during ctx.close: %s", exc)
        self._tabs.clear()


class _NodriverBrowser:
    def __init__(self, browser: Any) -> None:
        self._browser = browser

    async def new_context(
        self, user_agent: Optional[str] = None, **_kwargs: Any
    ) -> _NodriverContext:
        return _NodriverContext(self._browser, user_agent=user_agent)

    async def close(self) -> None:
        try:
            self._browser.stop()
        except Exception as exc:
            logger.warning("nodriver browser.stop() failed: %s", exc)


# ===================================================================
# Playwright backend (fallback)
# ===================================================================


class _PlaywrightBrowserAdapter:
    """Thin adapter so Playwright's browser exposes the same surface."""

    def __init__(self, browser: Any, playwright_ctx: Any) -> None:
        self._browser = browser
        self._pw_ctx = playwright_ctx

    async def new_context(
        self, user_agent: Optional[str] = None, **kwargs: Any
    ) -> Any:
        if user_agent is not None:
            kwargs["user_agent"] = user_agent
        return await self._browser.new_context(**kwargs)

    async def close(self) -> None:
        try:
            await self._browser.close()
        finally:
            await self._pw_ctx.__aexit__(None, None, None)


# ===================================================================
# Public API
# ===================================================================


class BrowserSession:
    """Async context manager that yields a backend-agnostic Browser proxy.

    Usage::

        async with BrowserSession() as browser:           # SCRAPER_BACKEND default
            ctx = await browser.new_context()
            page = await ctx.new_page()
            await page.goto("https://example.com")
            html = await page.content()
            await ctx.close()

        async with BrowserSession(headless=False) as browser:  # visible window
            ...
    """

    def __init__(self, headless: Optional[bool] = None) -> None:
        self._headless_override = headless
        self._backend = _backend()
        self._inner: Any = None
        self._atexit_handler: Optional[Any] = None
        self._prev_sigterm: Any = None

    @property
    def headless(self) -> bool:
        if self._headless_override is not None:
            return self._headless_override
        return _headless_default()

    async def __aenter__(self) -> Any:
        if self._backend == "nodriver":
            return await self._start_nodriver()
        if self._backend == "playwright":
            return await self._start_playwright()
        raise ValueError(
            f"Unknown SCRAPER_BACKEND={self._backend!r}. "
            "Use 'nodriver' (default) or 'playwright'."
        )

    async def _start_nodriver(self) -> _NodriverBrowser:
        """Start nodriver Chrome and resolve Cloudflare via warm-up.

        If the user asked for headless mode but the warm-up fails (CF
        challenge unresolved in time — Cloudflare often blocks headless
        Chrome even with nodriver), automatically retry once in visible
        mode. This keeps the scraper working without intervention.
        """
        # First attempt: respect the user's headless preference.
        browser = await self._launch_nodriver(self.headless)
        self._register_shutdown(lambda: browser.stop())

        warmup_ok = await self._warmup_nodriver(browser)
        if not warmup_ok and self.headless:
            # Fall back to visible mode — CF is harder to bypass headless.
            logger.warning(
                "Headless warm-up failed; restarting in visible mode "
                "(set SCRAPER_HEADLESS=0 to skip the headless attempt)."
            )
            self._unregister_shutdown()
            try:
                browser.stop()
            except Exception:
                pass
            browser = await self._launch_nodriver(headless=False)
            self._register_shutdown(lambda: browser.stop())
            await self._warmup_nodriver(browser)

        self._inner = _NodriverBrowser(browser)
        return self._inner

    @staticmethod
    async def _launch_nodriver(headless: bool) -> Any:
        import nodriver as uc

        try:
            return await uc.start(
                headless=headless,
                browser_args=["--lang=en-US"],
            )
        except FileNotFoundError as exc:
            raise RuntimeError(
                "Chrome binary not found. Install Google Chrome from "
                "https://www.google.com/chrome/ (expected at "
                "/Applications/Google Chrome.app on macOS)."
            ) from exc

    @staticmethod
    async def _warmup_nodriver(browser: Any) -> bool:
        """Visit a benign URL and wait for Cloudflare clearance.

        nodriver's initial Chrome instance triggers the hardest CF challenge
        on the first request. After the JS challenge resolves (~6-10s),
        subsequent requests in the same browser process inherit the
        ``cf_clearance`` cookie and pass without further challenges.

        Returns True if the warm-up resolved CF within the timeout,
        False otherwise.
        """
        logger.info("CF warm-up: %s (timeout %.0fs)", WARMUP_URL, WARMUP_POLL_TIMEOUT_S)
        tab = await browser.get(WARMUP_URL)
        # Initial 2s pause to let nav settle.
        await asyncio.sleep(2.0)
        elapsed = 2.0
        while elapsed < WARMUP_POLL_TIMEOUT_S:
            try:
                html = await tab.get_content()
            except Exception as exc:
                logger.warning("warm-up get_content failed: %s", exc)
                return False
            if not any(m in html for m in _CF_MARKERS):
                logger.info("CF warm-up resolved in %.1fs", elapsed)
                # Note: we deliberately do NOT close the warm-up tab.
                # In nodriver, closing the only remaining tab terminates
                # the browser process. The warm-up tab is kept open
                # (idle on a benign rider page) for the rest of the session.
                return True
            await asyncio.sleep(WARMUP_POLL_INTERVAL_S)
            elapsed += WARMUP_POLL_INTERVAL_S
        logger.warning(
            "CF warm-up timeout after %.0fs — challenge still present",
            elapsed,
        )
        return False

    async def _start_playwright(self) -> _PlaywrightBrowserAdapter:
        from playwright.async_api import async_playwright

        pw_ctx = async_playwright()
        p = await pw_ctx.__aenter__()
        browser = await p.chromium.launch(headless=self.headless)
        self._inner = _PlaywrightBrowserAdapter(browser, pw_ctx)
        return self._inner

    async def __aexit__(self, exc_type: Any, exc: Any, tb: Any) -> None:
        if self._inner is not None:
            try:
                await self._inner.close()
            except Exception as e:
                logger.warning("Backend close failed: %s", e)
            self._inner = None
        self._unregister_shutdown()

    def _register_shutdown(self, stop_callable: Any) -> None:
        def _handler(*_args: Any) -> None:
            try:
                stop_callable()
            except Exception as exc:
                logger.debug("Shutdown handler failed: %s", exc)

        self._atexit_handler = _handler
        atexit.register(_handler)

        # SIGTERM handler — best-effort (asyncio.run installs its own SIGINT).
        try:
            self._prev_sigterm = signal.signal(
                signal.SIGTERM, lambda *_: _handler()
            )
        except (ValueError, RuntimeError):
            # Not in main thread, or signals already overridden.
            pass

    def _unregister_shutdown(self) -> None:
        if self._atexit_handler is not None:
            try:
                atexit.unregister(self._atexit_handler)
            except Exception:
                pass
            self._atexit_handler = None
        if self._prev_sigterm is not None:
            try:
                signal.signal(signal.SIGTERM, self._prev_sigterm)
            except (ValueError, RuntimeError):
                pass
            self._prev_sigterm = None
