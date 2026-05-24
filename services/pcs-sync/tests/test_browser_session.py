"""Unit tests for browser_session.BrowserSession.

Verifies backend selection via ``SCRAPER_BACKEND`` and that the warm-up
loop polls until Cloudflare clears. Does NOT spawn a real Chrome process.
"""
from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

import browser_session


@pytest.fixture(autouse=True)
def reset_env(monkeypatch):
    """Default to nodriver backend, headless off, for every test."""
    monkeypatch.delenv("SCRAPER_BACKEND", raising=False)
    monkeypatch.delenv("SCRAPER_HEADLESS", raising=False)


def _async_return(value):
    async def _coro():
        return value
    return _coro()


def test_default_backend_is_nodriver(monkeypatch):
    monkeypatch.delenv("SCRAPER_BACKEND", raising=False)
    assert browser_session._backend() == "nodriver"


def test_headless_default_is_false(monkeypatch):
    """Default to visible mode — CF blocks headless on this setup."""
    monkeypatch.delenv("SCRAPER_HEADLESS", raising=False)
    assert browser_session._headless_default() is False


def test_headless_env_var_enables_headless(monkeypatch):
    monkeypatch.setenv("SCRAPER_HEADLESS", "1")
    assert browser_session._headless_default() is True


@pytest.mark.asyncio
async def test_nodriver_backend_warmup_resolves_cf(monkeypatch):
    """When the warm-up tab returns clean HTML, BrowserSession proceeds."""
    monkeypatch.setenv("SCRAPER_BACKEND", "nodriver")
    monkeypatch.setenv("SCRAPER_HEADLESS", "0")

    fake_tab = MagicMock()
    fake_tab.get_content = AsyncMock(return_value="<html>clean page</html>")
    fake_tab.close = AsyncMock()

    fake_browser = MagicMock()
    fake_browser.get = AsyncMock(return_value=fake_tab)
    fake_browser.stop = MagicMock()

    with patch.object(browser_session.BrowserSession, "_launch_nodriver",
                      new=AsyncMock(return_value=fake_browser)):
        async with browser_session.BrowserSession() as browser:
            assert isinstance(browser, browser_session._NodriverBrowser)
            # warm-up was attempted exactly once (no fallback needed)
            assert fake_browser.get.await_count == 1

    # Browser stop should have been called via close()
    assert fake_browser.stop.called


@pytest.mark.asyncio
async def test_nodriver_headless_fallback_to_visible(monkeypatch):
    """If headless warm-up times out, retry once in visible mode."""
    monkeypatch.setenv("SCRAPER_BACKEND", "nodriver")
    monkeypatch.setenv("SCRAPER_HEADLESS", "1")
    # Speed up the fallback path
    monkeypatch.setattr(browser_session, "WARMUP_POLL_TIMEOUT_S", 0.1)
    monkeypatch.setattr(browser_session, "WARMUP_POLL_INTERVAL_S", 0.05)

    def make_browser(clean: bool):
        tab = MagicMock()
        # Return CF challenge HTML if not clean, else a clean page.
        html = (
            "<html>clean</html>" if clean
            else "<html>Just a moment ...</html>"
        )
        tab.get_content = AsyncMock(return_value=html)
        tab.close = AsyncMock()
        b = MagicMock()
        b.get = AsyncMock(return_value=tab)
        b.stop = MagicMock()
        return b

    blocked_browser = make_browser(clean=False)
    visible_browser = make_browser(clean=True)

    launches = [blocked_browser, visible_browser]

    async def fake_launch(headless: bool):
        return launches.pop(0)

    with patch.object(browser_session.BrowserSession, "_launch_nodriver",
                      new=AsyncMock(side_effect=fake_launch)):
        async with browser_session.BrowserSession() as browser:
            # First (blocked) browser was stopped; second is the active one.
            assert blocked_browser.stop.called
            assert browser._browser is visible_browser


@pytest.mark.asyncio
async def test_playwright_backend(monkeypatch):
    """SCRAPER_BACKEND=playwright uses the Playwright adapter path."""
    monkeypatch.setenv("SCRAPER_BACKEND", "playwright")

    fake_browser = MagicMock()
    fake_browser.close = AsyncMock()

    fake_chromium = MagicMock()
    fake_chromium.launch = AsyncMock(return_value=fake_browser)

    fake_p = MagicMock()
    fake_p.chromium = fake_chromium

    fake_pw_ctx = MagicMock()
    fake_pw_ctx.__aenter__ = AsyncMock(return_value=fake_p)
    fake_pw_ctx.__aexit__ = AsyncMock(return_value=None)

    with patch("playwright.async_api.async_playwright", return_value=fake_pw_ctx):
        async with browser_session.BrowserSession() as browser:
            assert isinstance(browser, browser_session._PlaywrightBrowserAdapter)

    # Both close paths were exercised
    assert fake_browser.close.called
    assert fake_pw_ctx.__aexit__.called


@pytest.mark.asyncio
async def test_unknown_backend_raises(monkeypatch):
    monkeypatch.setenv("SCRAPER_BACKEND", "selenium")
    with pytest.raises(ValueError, match="Unknown SCRAPER_BACKEND"):
        async with browser_session.BrowserSession():
            pass


def test_is_cf_marker_detects_multilang():
    """Multi-lang CF markers are detected by the shim's marker list."""
    for marker in [
        "Just a moment", "Checking your browser", "Un instant",
        "Un momento", "Einen Moment", "Een ogenblik",
    ]:
        html = f"<html><title>{marker}…</title></html>"
        assert any(m in html for m in browser_session._CF_MARKERS)
