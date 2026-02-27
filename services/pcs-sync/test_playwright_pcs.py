"""
Test Playwright → PCS pipeline on a single team.
Does NOT write to Supabase — validation only.

Run: python3 test_playwright_pcs.py
"""
import asyncio
import sys
from procyclingstats import Team, Rider

async def test_team(team_slug: str):
    from playwright.async_api import async_playwright

    print(f"\n[1/4] Launching Playwright browser...")
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                       "AppleWebKit/537.36 (KHTML, like Gecko) "
                       "Chrome/120.0.0.0 Safari/537.36"
        )
        page = await context.new_page()

        # --- Step 1: fetch team page ---
        url = f"https://www.procyclingstats.com/{team_slug}"
        print(f"[2/4] Fetching {url} ...")
        await page.goto(url, wait_until="domcontentloaded")
        await page.wait_for_timeout(4000)  # let Cloudflare challenge resolve

        html = await page.content()
        status_hint = "Cloudflare" if "Just a moment" in html or "cf-browser-verification" in html else "OK"
        print(f"      Page loaded — Cloudflare check: {status_hint}")

        if status_hint == "Cloudflare":
            print("\nBLOCKED: Cloudflare challenge not bypassed with headless browser.")
            print("→ Next step: try stealth mode (playwright-stealth) or ScrapFly proxy.")
            await browser.close()
            return False

        title_start = html.find('<title>'); title_end = html.find('</title>')
        title = html[title_start+7:title_end] if title_start >= 0 else '?'
        print(f"      Title: {title}")

        # --- Step 2: parse with procyclingstats ---
        print(f"[3/4] Parsing team roster with procyclingstats...")
        try:
            team = Team(team_slug, html=html, update_html=False)
            riders = team.riders()
        except Exception as e:
            print(f"      Parse error: {e}")
            # Try without pre-fetched HTML to see if library can fetch directly
            print(f"      Checking procyclingstats scraper validation logic...")
            from procyclingstats import scraper as s
            import inspect
            src = inspect.getsource(s.Scraper.__init__)
            print(src[:500])
            await browser.close()
            return False

        print(f"      Found {len(riders)} riders")
        if not riders:
            print("      No riders parsed — HTML structure may have changed.")
            await browser.close()
            return False

        # Print first 3
        for r in riders[:3]:
            print(f"      → {r.get('rider_name', '?')} ({r.get('nationality', '?')}) — "
                  f"{r.get('ranking_points', 0)} pts — rank #{r.get('ranking_position', '?')}")

        # --- Step 3: fetch 1 rider profile ---
        first_slug = riders[0].get("rider_url", "")
        if first_slug:
            print(f"\n[4/4] Fetching rider profile: {first_slug} ...")
            await asyncio.sleep(4)
            rider_url = f"https://www.procyclingstats.com/{first_slug}"
            await page.goto(rider_url, wait_until="domcontentloaded")
            await page.wait_for_timeout(3000)
            rider_html = await page.content()

            rider = Rider(first_slug, html=rider_html, update_html=False)
            try:
                name = rider.name()
                nationality = rider.nationality()
                specialties = rider.points_per_speciality()
                print(f"      Name: {name}")
                print(f"      Nationality: {nationality}")
                print(f"      Specialties: {specialties}")
                print(f"\n✅ PLAYWRIGHT + PCS PIPELINE VALIDATED")
                await browser.close()
                return True
            except Exception as e:
                print(f"      Rider parse error: {e}")

        await browser.close()
        return False

if __name__ == "__main__":
    slug = sys.argv[1] if len(sys.argv) > 1 else "team/tudor-pro-cycling-2026"
    print(f"Testing Playwright → PCS pipeline on: {slug}")
    result = asyncio.run(test_team(slug))
    sys.exit(0 if result else 1)
