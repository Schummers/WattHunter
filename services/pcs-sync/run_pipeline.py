"""
WattHunter PCS Sync CLI — run locally (residential IP required).
Cloudflare blocks datacenter IPs; GitHub Actions cannot be used for scraping.

Requires:
  - .env file in this directory (see .env.example)
  - Playwright Chromium installed: python3 -m playwright install chromium
  - Residential IP (Cloudflare blocks datacenter IPs)

Usage:
  cd services/pcs-sync

  # Pipeline A — sync top 600 PCS riders (no season rankings — Pipeline E handles those)
  python3 run_pipeline.py init-riders

  # Pipeline B — after each race/stage finishes (auto-detect or manual)
  python3 run_pipeline.py post-race --auto
  python3 run_pipeline.py post-race --race "race/strade-bianche/2026"
  python3 run_pipeline.py post-race --race "race/strade-bianche/2026" --with-ranking

  # Pipeline C — before auctions/races open
  python3 run_pipeline.py startlists --race "race/tour-de-france/2026"

  # Pipeline D — phase finance (sponsor base income + salaries + bankruptcy, once per WT phase)
  # phase-finance pipeline removed — replaced by confirmPhaseSetup server action

  # Pipeline E — enrich riders with individual PCS page data
  python3 run_pipeline.py enrich-riders

  # Pre-auction — update global ranking + phase finance
  python3 run_pipeline.py pre-auction
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
import sys
from datetime import date, timedelta
from typing import Dict, List, Optional, Tuple

from dotenv import load_dotenv

load_dotenv()

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)

CALENDAR_PATH = os.path.join(os.path.dirname(__file__), "wt_calendar_2026.json")

GT_SLUG_PREFIXES = (
    "race/giro-d-italia/",
    "race/tour-de-france/",
    "race/vuelta-a-espana/",
)


def _is_gt_stage(slug: str) -> bool:
    """True when the slug is a Grand Tour stage URL (e.g. race/giro-d-italia/2026/stage-4)."""
    return slug.startswith(GT_SLUG_PREFIXES) and "/stage-" in slug


def _is_gt_race(slug: str) -> bool:
    """True when the slug is a Grand Tour race (with or without a /stage-N or /gc suffix)."""
    return slug.startswith(GT_SLUG_PREFIXES)


async def _maybe_import_finals(supabase, browser, parent_slug, race_name, race_date, gc_result, imported_slugs):
    """After a GT's GC import, import the final Points/KOM/Youth jerseys once the GT is complete.

    Completion signal: GC carries PCS points (assigned only after the final stage). GT-only.
    Appends the three final slugs to imported_slugs so scoring picks them up.
    """
    if not (_is_gt_race(parent_slug) and gc_result.get("has_points")):
        return
    from sync_race import import_final_classifications

    print("  Waiting 15s before final classifications...")
    await asyncio.sleep(15)
    ctx_f = await browser.new_context(user_agent=USER_AGENT)
    f_page = await ctx_f.new_page()
    try:
        fc = await import_final_classifications(
            supabase, f_page,
            race_slug=parent_slug, race_name=race_name, race_date=race_date,
        )
        print(f"    Final classifs: points={fc['points']} kom={fc['kom']} youth={fc['youth']}")
        for ct in ("points", "kom", "youth"):
            imported_slugs.append(f"{parent_slug}/{ct}")
    except Exception as exc:
        print(f"    Final classif import failed: {exc}")
    finally:
        await ctx_f.close()


async def _fetch_gt_classifications(supabase, browser, parent_slug: str, stage_url: str) -> None:
    """Fetch gc/points/kom classifications after a GT stage import, using a fresh context."""
    if not _is_gt_stage(stage_url):
        return
    from sync_race import import_daily_classifications

    print("  Fetching daily classifications (gc/points/kom)...")
    ctx_c = await browser.new_context(user_agent=USER_AGENT)
    page_c = await ctx_c.new_page()
    try:
        counts = await import_daily_classifications(
            supabase, page_c,
            race_slug=parent_slug,
            stage_url=stage_url,
        )
        print(f"    gc={counts['gc']} points={counts['points']} kom={counts['kom']}")
    except Exception as exc:
        print(f"    Classif fetch failed: {exc}")
    finally:
        await ctx_c.close()


# ---------------------------------------------------------------------------
# Calendar helpers
# ---------------------------------------------------------------------------

def load_calendar() -> List[Dict]:
    """Load wt_calendar_2026.json and return the race list."""
    with open(CALENDAR_PATH, encoding="utf-8") as fh:
        return json.load(fh)


def lookup_race(slug: str) -> Optional[Dict]:
    """Return the calendar entry whose slug matches, or None.

    Also handles stage slugs (e.g. race/foo/2026/stage-3) by stripping the
    stage suffix and matching the parent race.
    """
    calendar = load_calendar()
    for race in calendar:
        if race.get("slug") == slug:
            return race
    # Fallback: strip /stage-N or /gc and try parent slug
    import re
    m = re.match(r"^(.+)/(?:stage-\d+|gc)$", slug)
    if m:
        parent_slug = m.group(1)
        for race in calendar:
            if race.get("slug") == parent_slug:
                return race
    return None


def race_meta(slug: str) -> Tuple[str, str]:
    """Return (race_name, race_date) for the given slug.

    For stage races with /stage-N suffix, computes the stage date from
    start_date + (N-1) days. Otherwise returns start_date for stage races
    or date for one-day races.
    Falls back to slug as name with a warning if not found.
    """
    import re
    entry = lookup_race(slug)
    if entry is None:
        print(f"WARNING: race '{slug}' not found in wt_calendar_2026.json — using slug as name.")
        return slug, ""

    name = entry.get("name", slug)
    date_val = entry.get("date") or entry.get("start_date") or ""

    # For stage slugs, compute the actual stage date
    m = re.match(r"^.+/stage-(\d+)$", slug)
    if m and entry.get("start_date"):
        stage_num = int(m.group(1))
        start = date.fromisoformat(entry["start_date"])
        rest_days = set(entry.get("rest_days") or [])
        if rest_days:
            # Walk day-by-day from start, skipping rest days, until we reach stage N
            current = start
            count = 0
            while True:
                if current.isoformat() not in rest_days:
                    count += 1
                    if count == stage_num:
                        break
                current += timedelta(days=1)
            date_val = current.isoformat()
        else:
            date_val = (start + timedelta(days=stage_num - 1)).isoformat()
        name = f"{name} — Stage {stage_num}"

    # For /gc slugs, use end_date (final day of stage race)
    if slug.endswith("/gc") and entry.get("end_date"):
        date_val = entry["end_date"]
        name = f"{name} — GC"

    return name, date_val


def find_races_for_today() -> List[Dict]:
    """Find all races/stages in the calendar whose date matches today.

    For stage races without explicit stages arrays, checks if today falls
    within [start_date, end_date] and computes the stage number from the
    day offset.
    """
    today_str = date.today().isoformat()
    calendar = load_calendar()
    matches = []
    for race in calendar:
        race_type = race.get("type", "one-day")
        if race_type == "stage-race":
            # First try explicit stages array
            found_explicit = False
            for stage in race.get("stages", []):
                if stage.get("date") == today_str:
                    matches.append({
                        "slug": race.get("slug"),
                        "name": race.get("name"),
                        "date": stage.get("date"),
                        "stage_url": stage.get("url"),
                        "type": "stage-race",
                    })
                    found_explicit = True
            # Fallback: check if today is within [start_date, end_date]
            if not found_explicit:
                start = race.get("start_date", "")
                end = race.get("end_date", "")
                if start and end and start <= today_str <= end:
                    # Count racing days (non-rest) from start up to and including today
                    rest_set = set(race.get("rest_days") or [])
                    if today_str in rest_set:
                        continue  # today is a rest day, no stage to import
                    current = date.fromisoformat(start)
                    today_d = date.fromisoformat(today_str)
                    stage_num = 0
                    while current <= today_d:
                        if current.isoformat() not in rest_set:
                            stage_num += 1
                        current += timedelta(days=1)
                    matches.append({
                        "slug": race.get("slug"),
                        "name": race.get("name"),
                        "date": today_str,
                        "stage_num": stage_num,
                        "type": "stage-race",
                    })
        else:
            if race.get("date") == today_str:
                matches.append({
                    "slug": race.get("slug"),
                    "name": race.get("name"),
                    "date": race.get("date"),
                    "type": "one-day",
                })
    return matches


# ---------------------------------------------------------------------------
# Browser helper
# ---------------------------------------------------------------------------

async def new_browser_page(browser):
    """Open a new context+page on an already-started BrowserSession browser.

    Returns ``(context, page)``. The browser is owned by the caller's
    ``async with BrowserSession() as browser:`` block.
    """
    context = await browser.new_context(user_agent=USER_AGENT)
    page = await context.new_page()
    return context, page


# ---------------------------------------------------------------------------
# Pipeline A — init-riders (Task 8: removed season rankings import)
# ---------------------------------------------------------------------------

async def run_init_riders() -> None:
    """Annual initialization: sync top 600 PCS riders."""
    from sync import get_supabase, sync_top500

    supabase = get_supabase()

    print("=== Pipeline A: init-riders ===")
    print()

    # Sync top 600 PCS global ranking (season rankings handled by Pipeline E)
    print("--- Sync top 600 PCS riders ---")
    result = await sync_top500(supabase, pages=6)
    print(json.dumps(result, indent=2))

    print()
    print("Done — init-riders complete.")
    print("Note: Run 'enrich-riders' (Pipeline E) to import season rankings, specialty, and bio data.")


# ---------------------------------------------------------------------------
# Pipeline B — post-race
# ---------------------------------------------------------------------------

def _print_contracted_rider_points(supabase, race_slugs: list[str]) -> None:
    """Print a verification table of contracted riders + their imported pcs_points.

    Shows only riders that have an active/notice contract, sorted by race_slug then pcs_points desc.
    Lets the operator cross-check imported values against the PCS website before trusting the scores.
    """
    # Get all contracted rider IDs
    contracts = supabase.table("contracts").select("rider_id").in_("status", ["active", "notice"]).execute()
    contracted_ids = {c["rider_id"] for c in (contracts.data or [])}
    if not contracted_ids:
        print("  (no contracted riders)")
        return

    # Fetch race_results for imported slugs, filter to contracted riders
    results = supabase.table("race_results").select(
        "race_slug, rank, pcs_points, riders:rider_id(full_name)"
    ).in_("race_slug", race_slugs).gt("pcs_points", 0).in_("rider_id", list(contracted_ids)).order(
        "race_slug"
    ).order("pcs_points", desc=True).execute()

    if not results.data:
        print("  No contracted riders with pcs_points > 0 in these races.")
        return

    current_slug = None
    for row in results.data:
        slug = row["race_slug"]
        if slug != current_slug:
            current_slug = slug
            short = slug.split("/")[-1]  # "result", "stage-4", "gc", etc.
            print(f"  [{short.upper()}]")
        rider = row.get("riders") or {}
        name = rider.get("full_name", "?") if isinstance(rider, dict) else "?"
        rank = row.get("rank") or "?"
        pts = row["pcs_points"]
        print(f"    #{rank:>3}  {name:<28}  {pts} pts")


async def _import_single_race(supabase, browser, race_slug: str, race_name: str, race_date: str, with_ranking: bool = False, target_stage: int | None = None) -> list[str]:
    """Import results for a single race/stage. Returns list of imported race_slugs.

    If target_stage is set (auto mode), only import that specific stage number
    instead of all stages.
    """
    from sync_race import get_stage_urls, import_race_results, import_gc_results, update_global_ranking
    from enrich import enrich_single_rider

    imported_slugs = []

    # Direct GC import: when slug ends with /gc, import only the GC results.
    import re as _re
    gc_match = _re.match(r"^(.+)/gc$", race_slug)
    if gc_match:
        parent_slug = gc_match.group(1)
        print(f"--- Direct GC import: {race_slug} ---")
        ctx_gc = await browser.new_context(user_agent=USER_AGENT)
        gc_page = await ctx_gc.new_page()
        gc_result = {}
        try:
            gc_result = await import_gc_results(
                supabase, gc_page,
                race_slug=parent_slug,
                race_name=race_name,
                race_date=race_date,
            )
            print(f"  GC imported: {gc_result['imported']}, skipped: {gc_result['skipped']}")
            imported_slugs.append(f"{parent_slug}/gc")
        except Exception as exc:
            print(f"  GC import failed: {exc}")
        await ctx_gc.close()
        await _maybe_import_finals(supabase, browser, parent_slug, race_name, race_date, gc_result, imported_slugs)
        return imported_slugs

    # Direct stage import: when slug contains /stage-N, bypass get_stage_urls()
    # and import that single stage directly.
    stage_match = _re.match(r"^(.+)/stage-(\d+)$", race_slug)
    if stage_match:
        parent_slug = stage_match.group(1)
        stage_url = race_slug

        print(f"--- Direct stage import: {stage_url} ---")
        ctx = await browser.new_context(user_agent=USER_AGENT)
        page = await ctx.new_page()
        stage_imported = False
        try:
            result = await import_race_results(
                supabase, page,
                race_slug=parent_slug,
                race_name=race_name,
                race_date=race_date,
                stage_url=stage_url,
            )
            print(f"  Imported: {result['imported']}, skipped: {result['skipped']}")
            imported_slugs.append(result.get("race_slug", stage_url))
            stage_imported = result.get("imported", 0) > 0
        except Exception as exc:
            print(f"  Skipped (no results yet): {exc}")
        await ctx.close()

        if stage_imported:
            await _fetch_gt_classifications(supabase, browser, parent_slug, stage_url)

        # Import GC from parent slug
        print("\n--- Importing GC results ---")
        print("  Waiting 15s before GC page...")
        await asyncio.sleep(15)
        ctx_gc = await browser.new_context(user_agent=USER_AGENT)
        gc_page = await ctx_gc.new_page()
        gc_result = {}
        try:
            gc_result = await import_gc_results(
                supabase, gc_page,
                race_slug=parent_slug,
                race_name=race_name,
                race_date=race_date,
            )
            print(f"  GC imported: {gc_result['imported']}, skipped: {gc_result['skipped']}")
            imported_slugs.append(f"{parent_slug}/gc")
        except Exception as exc:
            print(f"  GC import failed: {exc}")
        await ctx_gc.close()
        await _maybe_import_finals(supabase, browser, parent_slug, race_name, race_date, gc_result, imported_slugs)

        return imported_slugs

    race_entry = lookup_race(race_slug)
    is_stage_race = race_entry and race_entry.get("type") == "stage-race"

    if is_stage_race:
        print("--- Getting stage list ---")
        ctx1 = await browser.new_context(user_agent=USER_AGENT)
        page1 = await ctx1.new_page()
        stage_urls = await get_stage_urls(page1, race_slug)
        await ctx1.close()
        print(f"  Stage race — {len(stage_urls)} stage(s) found.")

        # In auto mode, only import the target stage
        if target_stage is not None:
            if target_stage <= len(stage_urls):
                stage_entry = stage_urls[target_stage - 1]
                stage_url = stage_entry.get("stage_url") or stage_entry.get("url", "")
                print(f"\n--- Stage {target_stage}/{len(stage_urls)}: {stage_url} ---")
                ctx = await browser.new_context(user_agent=USER_AGENT)
                page = await ctx.new_page()
                stage_imported = False
                try:
                    result = await import_race_results(
                        supabase, page,
                        race_slug=race_slug,
                        race_name=race_name,
                        race_date=race_date,
                        stage_url=stage_url,
                    )
                    print(f"  Imported: {result['imported']}, skipped: {result['skipped']}")
                    if result.get("race_slug"):
                        imported_slugs.append(result["race_slug"])
                    else:
                        imported_slugs.append(stage_url)
                    stage_imported = result.get("imported", 0) > 0
                except Exception as exc:
                    print(f"  Skipped (no results yet): {exc}")
                await ctx.close()
                if stage_imported:
                    await _fetch_gt_classifications(supabase, browser, race_slug, stage_url)
            else:
                print(f"  WARNING: target stage {target_stage} > {len(stage_urls)} stages found. Skipping.")
        else:
            # Manual mode: import all stages
            for i, stage_entry in enumerate(stage_urls):
                stage_url = stage_entry.get("stage_url") or stage_entry.get("url", "")
                print(f"\n--- Stage {i + 1}/{len(stage_urls)}: {stage_url} ---")
                ctx = await browser.new_context(user_agent=USER_AGENT)
                page = await ctx.new_page()
                stage_imported = False
                try:
                    result = await import_race_results(
                        supabase, page,
                        race_slug=race_slug,
                        race_name=race_name,
                        race_date=race_date,
                        stage_url=stage_url,
                    )
                    print(f"  Imported: {result['imported']}, skipped: {result['skipped']}")
                    if result.get("race_slug"):
                        imported_slugs.append(result["race_slug"])
                    else:
                        imported_slugs.append(stage_url)
                    stage_imported = result.get("imported", 0) > 0
                except Exception as exc:
                    print(f"  Skipped (no results yet): {exc}")
                await ctx.close()
                if stage_imported:
                    await _fetch_gt_classifications(supabase, browser, race_slug, stage_url)
                if i < len(stage_urls) - 1:
                    print("  Waiting 15s before next stage...")
                    await asyncio.sleep(15)

        # Import GC results for stage races — always attempt.
        # PCS /gc page assigns pcs_points only after the final stage,
        # so intermediate fetches harmlessly upsert 0-point rows that
        # get overwritten on the last day.
        if True:
            print("\n--- Importing GC results ---")
            print("  Waiting 15s before GC page...")
            await asyncio.sleep(15)
            ctx_gc = await browser.new_context(user_agent=USER_AGENT)
            gc_page = await ctx_gc.new_page()
            gc_result = {}
            try:
                gc_result = await import_gc_results(
                    supabase, gc_page,
                    race_slug=race_slug,
                    race_name=race_name,
                    race_date=race_date,
                )
                print(f"  GC imported: {gc_result['imported']}, skipped: {gc_result['skipped']}")
                imported_slugs.append(f"{race_slug}/gc")
            except Exception as exc:
                print(f"  GC import failed: {exc}")
            await ctx_gc.close()
            await _maybe_import_finals(supabase, browser, race_slug, race_name, race_date, gc_result, imported_slugs)
    else:
        print("--- One-day race — importing result ---")
        ctx = await browser.new_context(user_agent=USER_AGENT)
        page = await ctx.new_page()
        result = await import_race_results(
            supabase, page,
            race_slug=race_slug,
            race_name=race_name,
            race_date=race_date,
        )
        await ctx.close()
        print(f"  Imported: {result['imported']}, skipped: {result['skipped']}")
        imported_slugs.append(result.get("race_slug", race_slug))

    # Optional: update global ranking
    if with_ranking:
        print("\n--- Waiting 15s before updating global ranking ---")
        await asyncio.sleep(15)
        print("--- Updating global PCS ranking (top 600) ---")
        ranking_result = await update_global_ranking(supabase, browser, pages=6)
        print(f"  Updated: {ranking_result['updated']} riders (from {ranking_result['total_in_ranking']} ranked)")
        if ranking_result.get("created"):
            print(f"  Created: {ranking_result['created']} new rider(s)")
        if ranking_result.get("dropped"):
            print(f"  Dropped: {ranking_result['dropped']} rider(s) marked as >600")

        # Enrich new riders
        new_riders = ranking_result.get("new_riders", [])
        if new_riders:
            print(f"\n--- Enriching {len(new_riders)} new rider(s) ---")
            for i, nr in enumerate(new_riders):
                ctx = await browser.new_context(user_agent=USER_AGENT)
                enrich_page = await ctx.new_page()
                try:
                    result = await enrich_single_rider(
                        supabase, enrich_page, nr["id"], nr["pcs_slug"], nr.get("pcs_rank")
                    )
                    print(f"  Enriched: {nr['pcs_slug']} — {result}")
                except Exception as exc:
                    print(f"  Failed to enrich {nr['pcs_slug']}: {exc}")
                finally:
                    await ctx.close()
                if i < len(new_riders) - 1:
                    print("  Waiting 15s...")
                    await asyncio.sleep(15)

    return imported_slugs


async def run_post_race(race_slug: str | None = None, auto: bool = False, with_ranking: bool = False, no_cutoff: bool = False) -> None:
    """Post-race pipeline: import results then calculate scores."""
    from browser_session import BrowserSession
    from sync import get_supabase
    from scoring import calculate_daily_scores

    supabase = get_supabase()

    print(f"=== Pipeline B: post-race ===")

    all_imported_slugs: list[str] = []

    if auto:
        # Task 12a: auto-detect today's races from calendar
        today_races = find_races_for_today()
        if not today_races:
            print(f"No races found for today ({date.today().isoformat()}) in calendar.")
            return
        print(f"Found {len(today_races)} race(s) for today:")
        for r in today_races:
            print(f"  - {r['name']} ({r['slug']})")
        print()

        async with BrowserSession() as browser:
            for i, r in enumerate(today_races):
                race_name = r["name"]
                r_slug = r["slug"]
                r_date = r.get("date", "")
                stage_num = r.get("stage_num")  # set for stage races detected by date range
                if stage_num:
                    print(f"\n--- Processing: {race_name} (stage {stage_num}) ---")
                else:
                    print(f"\n--- Processing: {race_name} ---")
                slugs = await _import_single_race(
                    supabase, browser, r_slug, race_name, r_date,
                    with_ranking=False,  # auto mode skips ranking (use pre-auction)
                    target_stage=stage_num,
                )
                all_imported_slugs.extend(slugs)
                # Wait between races
                if i < len(today_races) - 1:
                    print("  Waiting 15s before next race...")
                    await asyncio.sleep(15)
    else:
        if not race_slug:
            print("ERROR: --race is required when not using --auto")
            return

        race_name, race_date_val = race_meta(race_slug)
        print(f"Race : {race_name}")
        print(f"Slug : {race_slug}")
        print(f"Date : {race_date_val or '(not in calendar)'}")
        print()

        async with BrowserSession() as browser:
            slugs = await _import_single_race(
                supabase, browser, race_slug, race_name, race_date_val,
                with_ranking=with_ranking,
            )
            all_imported_slugs.extend(slugs)

    # Calculate daily scores with the actual race slugs imported
    print()
    print("--- Calculating daily scores ---")
    scoring_result = await calculate_daily_scores(supabase, race_slugs=all_imported_slugs or None, ignore_role_cutoff=no_cutoff)
    print(json.dumps(scoring_result, indent=2))

    # Sponsor bonuses for race results
    from sponsor_bonus import process_race_bonuses
    bonus_result = await process_race_bonuses(supabase, all_imported_slugs)
    print(f"  Sponsor bonuses: {bonus_result.get('bonuses_created', 0)} bonuses credited")

    # GT Goal evaluation (V1b) — only for GT stages
    gt_prefixes = ("race/giro-d-italia/", "race/tour-de-france/", "race/vuelta-a-espana/")
    gt_parent = None
    for s in all_imported_slugs:
        if any(s.startswith(p) for p in gt_prefixes):
            m = re.match(r"^(race/[a-z0-9-]+/\d{4})", s)
            if m:
                gt_parent = m.group(1)
                break
    if gt_parent:
        from goal_evaluator import evaluate_gt_goals
        goal_result = await evaluate_gt_goals(supabase, gt_parent)
        print(f"  GT Goals: {goal_result.get('goals_completed', 0)} goals awarded")
        if goal_result.get("errors"):
            for err in goal_result["errors"]:
                print(f"    ERROR: {err}")

    # Post-import verification: show contracted riders + imported points for manual cross-check
    if all_imported_slugs:
        print()
        print("--- Import verification (contracted riders) ---")
        print("Cross-check these points against PCS before continuing.\n")
        _print_contracted_rider_points(supabase, all_imported_slugs)

    print()
    print("Done — post-race complete.")


# ---------------------------------------------------------------------------
# Pipeline C — startlists
# ---------------------------------------------------------------------------

async def run_startlists(race_slug: str) -> None:
    """Pre-race pipeline: fetch and import the race startlist."""
    from browser_session import BrowserSession
    from sync import get_supabase
    from sync_race import import_startlist

    supabase = get_supabase()
    race_name, race_date_val = race_meta(race_slug)

    print(f"=== Pipeline C: startlists ===")
    print(f"Race : {race_name}")
    print(f"Slug : {race_slug}")
    print(f"Date : {race_date_val or '(not in calendar)'}")
    print()

    async with BrowserSession() as browser:
        context, page = await new_browser_page(browser)
        try:
            print("--- Importing startlist ---")
            result = await import_startlist(
                supabase,
                page,
                race_slug=race_slug,
                race_name=race_name,
                race_date=race_date_val,
            )
            print(json.dumps(result, indent=2))
        finally:
            await context.close()

    print()
    print("Done — startlists complete.")


# ---------------------------------------------------------------------------
# Pipeline E — enrich-riders
# ---------------------------------------------------------------------------

async def run_enrich_riders(start: int, end: int, retry_missing: bool = False) -> None:
    """Pipeline E: enrich riders with individual PCS page data."""
    from sync import get_supabase
    from enrich import enrich_riders, enrich_missing_riders

    supabase = get_supabase()

    if retry_missing:
        print("=== Pipeline E: enrich-riders (retry missing only) ===")
        print(f"Range: rank {start} to {end}")
        print()
        result = await enrich_missing_riders(supabase, start_rank=start, end_rank=end)
    else:
        print("=== Pipeline E: enrich-riders ===")
        print(f"Range: rank {start} to {end}")
        print()
        result = await enrich_riders(supabase, start_rank=start, end_rank=end)
    print()
    print(json.dumps(result, indent=2))
    print()
    print("Done — enrich-riders complete.")


# ---------------------------------------------------------------------------
# Pre-auction pipeline (Task 12b)
# ---------------------------------------------------------------------------

async def run_pre_auction() -> None:
    """Pre-auction: update global ranking."""
    from browser_session import BrowserSession
    from sync import get_supabase
    from sync_race import update_global_ranking

    supabase = get_supabase()

    print("=== Pre-auction pipeline ===")
    print()

    print("--- Updating global PCS ranking (top 600) ---")
    async with BrowserSession() as browser:
        ranking_result = await update_global_ranking(supabase, browser, pages=6)
        print(f"  Updated: {ranking_result['updated']} riders (from {ranking_result['total_in_ranking']} ranked)")
        if ranking_result.get("created"):
            print(f"  Created: {ranking_result['created']} new rider(s)")
        if ranking_result.get("dropped"):
            print(f"  Dropped: {ranking_result['dropped']} rider(s) marked as >600")

    print()
    print("Done — pre-auction complete.")


async def run_detect_dnfs(race_slug: str, stage_number: int) -> None:
    """Detect DNF riders from a GT stage and flag their gt_squad entries."""
    from browser_session import BrowserSession
    from sync import get_supabase
    from dnf_detection import detect_and_flag_dnfs
    from sync_race import fetch_html

    supabase = get_supabase()

    print(f"=== Detect DNFs: {race_slug} (stage {stage_number}) ===")

    async with BrowserSession() as browser:
        context = await browser.new_context(user_agent=USER_AGENT)
        try:
            page = await context.new_page()
            html = await fetch_html(page, race_slug)
        finally:
            await context.close()

    result = detect_and_flag_dnfs(race_slug, stage_number, html, supabase)
    print(f"Flagged: {result['flagged']}")
    if result["errors"]:
        print(f"Errors: {result['errors']}")


async def run_resolve_gt_rescue(phase_id: int, league_id: str) -> None:
    """Resolve rest-day GT emergency bids for a league."""
    from sync import get_supabase
    from resolve_gt_rescue import resolve_gt_rescue

    supabase = get_supabase()
    print(f"=== Resolve GT Rescue: phase {phase_id}, league {league_id} ===")
    result = resolve_gt_rescue(phase_id, league_id, supabase)
    print(f"Winners ({len(result['winners'])}):")
    for w in result["winners"]:
        print(f"  {w['rider']} → team {w['team_id']} @ {w['amount']}€")
    print(f"Losers resolved: {result['losers_count']}")
    if result["errors"]:
        print(f"Errors: {result['errors']}")


async def run_backfill_photos() -> None:
    """One-shot: self-host top-150 rider photos in Supabase Storage (PCS blocks hotlinks)."""
    from sync import get_supabase
    from backfill_photos import backfill_rider_photos

    supabase = get_supabase()
    print("=== Backfill rider photos (top 150 → Supabase Storage) ===")
    print()
    result = await backfill_rider_photos(supabase)
    print()
    print(f"Uploaded: {result.get('uploaded', 0)} / {result.get('total', 0)}")
    if result.get("failed"):
        print(f"Failed ({len(result['failed'])}): {', '.join(result['failed'])}")
    print("Done — backfill-photos complete.")


async def run_evaluate_goals(race_slug: str) -> None:
    """Evaluate GT sponsor goals (one-time bonuses) for a Grand Tour."""
    from sync import get_supabase
    from goal_evaluator import evaluate_gt_goals

    supabase = get_supabase()
    print(f"=== Evaluate GT Goals: {race_slug} ===")
    result = await evaluate_gt_goals(supabase, race_slug)
    print(f"Goals completed: {result.get('goals_completed', 0)}")
    if result.get("errors"):
        for err in result["errors"]:
            print(f"  ERROR: {err}")
    print("Done.")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="run_pipeline.py",
        description="WattHunter PCS Sync CLI — pipelines for roster, race results, startlists, finance, and pre-auction.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    # init-riders
    subparsers.add_parser(
        "init-riders",
        help="Pipeline A — sync top 600 PCS riders.",
    )

    # post-race
    post_race = subparsers.add_parser(
        "post-race",
        help="Pipeline B — after a race/stage: import results + score. Use --auto or --race.",
    )
    post_race.add_argument(
        "--race",
        required=False,
        metavar="SLUG",
        help='PCS race slug, e.g. "race/strade-bianche/2026"',
    )
    post_race.add_argument(
        "--auto",
        action="store_true",
        help="Auto-detect today's races from calendar",
    )
    post_race.add_argument(
        "--with-ranking",
        action="store_true",
        help="Also update global PCS ranking (normally done in pre-auction)",
    )
    post_race.add_argument(
        "--no-cutoff",
        action="store_true",
        help="Bypass the 11h CET role-assignment cutoff (retroactive scoring only)",
    )
    # startlists
    startlists = subparsers.add_parser(
        "startlists",
        help="Pipeline C — before auctions/race: import the race startlist.",
    )
    startlists.add_argument(
        "--race",
        required=True,
        metavar="SLUG",
        help='PCS race slug, e.g. "race/tour-de-france/2026"',
    )

    # enrich-riders
    enrich = subparsers.add_parser(
        "enrich-riders",
        help="Pipeline E — enrich riders with individual PCS page data (photo, bio, specialty).",
    )
    enrich.add_argument(
        "--start",
        type=int,
        default=1,
        metavar="RANK",
        help="Start PCS rank (default: 1)",
    )
    enrich.add_argument(
        "--end",
        type=int,
        default=600,
        metavar="RANK",
        help="End PCS rank (default: 600)",
    )
    enrich.add_argument(
        "--retry-missing",
        action="store_true",
        default=False,
        help="Only re-enrich riders with missing photo_url or specialty",
    )

    # pre-auction
    subparsers.add_parser(
        "pre-auction",
        help="Pre-auction — update global ranking + monthly finance.",
    )

    # backfill-photos
    subparsers.add_parser(
        "backfill-photos",
        help="One-shot — self-host top-150 rider photos in Supabase Storage (PCS blocks hotlinks).",
    )

    # detect-dnfs
    detect_dnfs_p = subparsers.add_parser(
        "detect-dnfs",
        help="Flag DNF riders in gt_squad after a stage.",
    )
    detect_dnfs_p.add_argument(
        "--race",
        required=True,
        help='Stage slug, e.g. "race/giro-d-italia/2026/stage-3"',
    )
    detect_dnfs_p.add_argument(
        "--stage",
        type=int,
        required=True,
        help="Stage number, e.g. 3",
    )

    # evaluate-goals
    eval_goals_p = subparsers.add_parser(
        "evaluate-goals",
        help="Evaluate GT sponsor goals (one-time bonuses) for a Grand Tour.",
    )
    eval_goals_p.add_argument(
        "--race",
        required=True,
        metavar="SLUG",
        help='GT parent slug, e.g. "race/giro-d-italia/2026"',
    )

    # resolve-gt-rescue
    resolve_p = subparsers.add_parser(
        "resolve-gt-rescue",
        help="Resolve rest-day emergency bids for a league.",
    )
    resolve_p.add_argument(
        "--phase",
        type=int,
        required=True,
        help="Phase ID: 4=Giro, 6=Tour, 8=Vuelta",
    )
    resolve_p.add_argument(
        "--league",
        required=True,
        metavar="LEAGUE_ID",
        help="League UUID",
    )

    return parser


async def main() -> None:
    # Validate environment before doing anything
    if not os.getenv("SUPABASE_URL") or not os.getenv("SUPABASE_SERVICE_ROLE_KEY"):
        print("ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.")
        print("Create a .env file from .env.example in this directory.")
        sys.exit(1)

    parser = build_parser()
    args = parser.parse_args()

    if args.command == "init-riders":
        await run_init_riders()
    elif args.command == "post-race":
        if not args.race and not args.auto:
            print("ERROR: Either --race or --auto is required.")
            sys.exit(1)
        await run_post_race(
            race_slug=args.race,
            auto=args.auto,
            with_ranking=args.with_ranking,
            no_cutoff=args.no_cutoff,
        )
    elif args.command == "startlists":
        await run_startlists(args.race)
    elif args.command == "enrich-riders":
        await run_enrich_riders(args.start, args.end, retry_missing=args.retry_missing)
    elif args.command == "pre-auction":
        await run_pre_auction()
    elif args.command == "backfill-photos":
        await run_backfill_photos()
    elif args.command == "evaluate-goals":
        await run_evaluate_goals(args.race)
    elif args.command == "detect-dnfs":
        await run_detect_dnfs(args.race, args.stage)
    elif args.command == "resolve-gt-rescue":
        await run_resolve_gt_rescue(args.phase, args.league)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
