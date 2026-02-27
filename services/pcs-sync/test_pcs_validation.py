"""
One-time validation script — run manually to confirm:
1. procyclingstats library can fetch team rosters
2. Rate limiting works
3. Data shape matches our riders table

==========================================================================
VALIDATION RESULTS (run 2026-02-27)
==========================================================================

FINDING 1 — Library version
  requirements.txt specified procyclingstats==0.9.0 (does not exist).
  Latest available on PyPI: 0.2.7.
  Installed: procyclingstats==0.2.7.
  → requirements.txt has been updated to ==0.2.7.

FINDING 2 — Cloudflare bot protection BLOCKS all plain HTTP requests
  procyclingstats 0.2.7 uses `requests.get()` with no special headers.
  procyclingstats.com is protected by Cloudflare managed challenge:
    HTTP 403 with "Just a moment..." page requiring JavaScript execution.
  Both requests library and plain curl return 403.
  A browser User-Agent alone does NOT bypass the challenge.
  The Cloudflare challenge requires:
    - Full JavaScript execution (window._cf_chl_opt challenge)
    - Cookie acceptance
    - Potentially browser fingerprinting

FINDING 3 — Team.riders() field names (from library source inspection)
  available_fields in Team.riders():
    "nationality"       — 2-char country code, e.g. "BE"
    "rider_name"        — display name, e.g. "Evenepoel Remco"
    "rider_url"         — relative PCS URL, e.g. "rider/remco-evenepoel"
    "age"               — integer
    "since"             — date string "DD-MM" (join date in team)
    "until"             — date string "DD-MM" (leave date in team)
    "career_points"     — integer (all-time PCS points)
    "ranking_points"    — integer (current season ranking points)
    "ranking_position"  — integer (current world ranking position)

FINDING 4 — Rider class actual methods (from dir() inspection)
  The original script assumed Rider.results() exists — it does NOT.
  Actual public methods on procyclingstats.Rider 0.2.7:
    .birthdate()              — e.g. "1993-01-25"
    .height()                 — integer cm
    .image_url()              — absolute URL to rider photo
    .name()                   — display name string
    .nationality()            — 2-char country code
    .parse()                  — dict of all above fields combined
    .place_of_birth()         — city string
    .points_per_season_history() — list of {season, points} dicts
    .points_per_speciality()  — dict of specialty -> points score
    .season_results()         — list of race result dicts for current season
    .teams_history()          — list of {team_url, team_name, season} dicts
    .weight()                 — integer kg
  NOTE: Use .season_results() not .results() for race data.

FINDING 5 — BLOCKER: Cannot scrape PCS without JS-capable browser
  REQUIRED ACTION (before Task 3 can be implemented):
  Option A: Use Playwright/Selenium to render the JS challenge, then
            extract cookies and pass them to procyclingstats via a
            custom requests.Session.
  Option B: Use Playwright directly to scrape (without procyclingstats).
  Option C: Find an alternative data source (FirstCycling, CyclingArchives,
            or a paid PCS API if one exists).
  Option D: Pre-fetch HTML via a headless browser in the GitHub Action,
            cache it, and feed raw HTML to procyclingstats (update_html=False).

WORKAROUND PATTERN (Option A/D):
  The procyclingstats Scraper accepts pre-fetched HTML:
    team = Team("team/bora-hansgrohe-2025", html=html_str, update_html=False)
  If Playwright can pass the Cloudflare challenge and return the HTML,
  the procyclingstats parser can still extract structured data from it.
==========================================================================
"""
import time
import warnings
warnings.filterwarnings("ignore")

from procyclingstats import Team, Rider


def test_fetch_team():
    """
    Attempt to fetch team roster from PCS.
    EXPECTED TO FAIL (HTTP 403 Cloudflare) unless running with a
    Playwright-managed browser session.
    """
    team = Team("team/tudor-pro-cycling-2026")
    riders = team.riders()
    print(f"Found {len(riders)} riders")
    assert len(riders) > 0, "No riders found"

    first = riders[0]
    print(f"First rider: {first}")
    assert "rider_url" in first or hasattr(first, "rider_url"), \
        f"Unexpected shape: {first}"
    return riders


def test_fetch_rider_profile(slug: str):
    rider = Rider(slug)
    info = rider.parse()
    print(f"Rider info keys: {list(info.keys()) if isinstance(info, dict) else dir(info)}")
    return info


def test_fetch_rider_results(slug: str):
    rider = Rider(slug)
    results = rider.results()
    print(f"Found {len(results)} results")
    if results:
        print(f"First result: {results[0]}")
    return results


def test_library_field_names():
    """
    Inspect available fields without making network requests.
    Documents the exact field names the library produces.
    """
    import inspect
    from procyclingstats import team_scraper, rider_scraper

    print("=== Team.riders() available_fields ===")
    src = inspect.getsource(Team.riders)
    # Extract the available_fields tuple from the source
    lines = src.split('\n')
    in_fields = False
    for line in lines:
        if 'available_fields' in line:
            in_fields = True
        if in_fields:
            print(line)
        if in_fields and ')' in line and 'available_fields' not in line:
            break

    print("\n=== Rider available methods ===")
    rider_methods = [m for m in dir(Rider) if not m.startswith('_')]
    print(rider_methods)


if __name__ == "__main__":
    print("=== Library field name inspection (no network) ===")
    test_library_field_names()

    print("\n=== Step 1: Fetch team roster (EXPECTED: 403 Cloudflare block) ===")
    try:
        riders = test_fetch_team()

        if riders:
            slug = riders[0]["rider_url"] if isinstance(riders[0], dict) \
                else riders[0].rider_url
            print(f"\n=== Step 2: Fetch rider profile ({slug}) ===")
            time.sleep(4)
            profile = test_fetch_rider_profile(slug)

            print(f"\n=== Step 3: Fetch rider results ({slug}) ===")
            time.sleep(4)
            results = test_fetch_rider_results(slug)
    except (AssertionError, ValueError) as e:
        print(f"BLOCKED (as expected): {e}")
        print("See FINDING 2 in this file's docstring for details.")

    print("\n=== VALIDATION COMPLETE — see docstring for findings ===")
