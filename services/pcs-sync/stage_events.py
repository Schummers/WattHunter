"""Stage event results — KOM crossings + intermediate sprints (issue 02, 2026-08).

Parses the in-race events of a GT stage from the stage page HTML that post-race
already fetched (zero extra HTTP requests):
  - climbs: procyclingstats `Stage.climbs()` (KOM tab, `.today` section);
  - intermediate sprints: not exposed by the lib — local parser mirroring the
    climbs() approach on the Points tab (`<h4>Sprint | ...</h4>` + ranking table).

Rows land in `stage_event_results` (migration 20260828000000). A re-import
first deletes the stage's existing rows, then upserts the freshly parsed set,
so PCS corrections (declassed rider, renamed climb) replace stale rows instead
of piling on top of them.
"""
from __future__ import annotations

import logging
import re
from typing import Any, Dict, List, Optional

from selectolax.parser import HTMLParser
from supabase import Client

from db_utils import _fetch_all

logger = logging.getLogger(__name__)

_CATEGORY_RE = re.compile(r"HC|[1-4]")


def _normalize_category(raw) -> Optional[str]:
    """Normalize a PCS climb category to 'HC'/'1'/'2'/'3'/'4', or None."""
    if not raw:
        return None
    m = _CATEGORY_RE.search(str(raw).strip().upper())
    return m.group(0) if m else None


def _normalize_rider_url(href: str) -> str:
    """PCS hrefs are usually relative ('rider/tadej-pogacar'); riders.pcs_slug
    uses the same form. Strip an absolute-URL prefix (scheme + host), a leading
    slash and any query string."""
    url = (href or "").split("?", 1)[0]
    if "://" in url:
        url = url.split("://", 1)[1].split("/", 1)
        url = url[1] if len(url) > 1 else ""
    return url.lstrip("/")


def parse_stage_climbs(stage) -> List[Dict[str, Any]]:
    """Categorized-climb crossings via the lib. [] when none are listed (ITT, flat)."""
    try:
        climbs = stage.climbs("climb_name", "category", "rank")
    except Exception as exc:
        logger.warning("Stage.climbs() failed: %s", exc)
        return []
    if not isinstance(climbs, list):
        return []
    return climbs


def parse_intermediate_sprints(html: str) -> List[Dict[str, Any]]:
    """Parse the day's intermediate sprints from a stage page's Points tab.

    PCS lists each sprint under the Points resTab's `.today` section as
    `<h4>Sprint | <name> (<km>)</h4>` followed by a ranking table (~15 ranks).
    Returns [{"event_name": str, "rank": [{"rider_url", "rank"}, ...]}, ...].
    Same tab-locating approach as `Stage.climbs()` uses for the KOM tab.
    """
    tree = HTMLParser(html)
    points_tab = None
    for tab_element in tree.css("ul.tabs.tabnav.resultTabs li"):
        link = tab_element.css_first("a")
        if link and "POINTS" in link.text().upper():
            data_id = link.attributes.get("data-id")
            points_tab = tree.css_first(f'div.resTab[data-id="{data_id}"]')
            break
    if points_tab is None:
        return []
    today = points_tab.css_first(".today")
    if today is None:
        return []

    sprints: List[Dict[str, Any]] = []
    for h4 in today.css("h4"):
        header = h4.text(strip=True)
        if not header.upper().startswith("SPRINT"):
            continue
        # "Sprint | Fuente del Maestre (102.6 km)" → keep the part after the pipe.
        name = header.split("|", 1)[1].strip() if "|" in header else header
        table = h4.next
        while table is not None and table.tag != "table":
            table = table.next
        if table is None:
            continue
        ranks: List[Dict[str, Any]] = []
        for tr in table.css("tr"):
            a = tr.css_first('a[href*="rider/"]')
            first_td = tr.css_first("td")
            if a is None or first_td is None:
                continue
            try:
                rank = int(first_td.text(strip=True))
            except (TypeError, ValueError):
                continue
            ranks.append({
                "rider_url": _normalize_rider_url(a.attributes.get("href", "")),
                "rank": rank,
            })
        if ranks:
            sprints.append({"event_name": name, "rank": ranks})
    return sprints


def import_stage_events(
    supabase: Client,
    *,
    stage_slug: str,
    stage,
    html: str,
    rider_map: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    """Upsert every KOM crossing + intermediate sprint of a stage into
    stage_event_results. Riders outside the pool are skipped (counted, no crash).
    Re-runs reconcile: the stage's existing rows are deleted first (only when the
    parse produced events), so stale rows can't double-count in scoring.
    """
    if rider_map is None:
        riders_resp = _fetch_all(lambda: supabase.table("riders").select("id, pcs_slug"))
        rider_map = {r["pcs_slug"]: r["id"] for r in riders_resp}

    events: List[Dict[str, Any]] = []
    for climb in parse_stage_climbs(stage):
        category = _normalize_category(climb.get("category"))
        if category is None:
            logger.warning(
                "Climb %r on %s has unparseable category %r — skipped",
                climb.get("climb_name"), stage_slug, climb.get("category"),
            )
            continue
        events.append({
            "event_type": "kom",
            "event_name": str(climb.get("climb_name") or "unknown climb"),
            "category": category,
            "rank_rows": climb.get("rank") or [],
        })
    for sprint in parse_intermediate_sprints(html):
        events.append({
            "event_type": "sprint",
            "event_name": sprint["event_name"],
            "category": None,
            "rank_rows": sprint["rank"],
        })

    # Reconcile before writing: without this, a re-import after a PCS correction
    # keeps the obsolete rows alongside the new ones and the scoring event terms
    # double-count. Guarded on `events` so a silently broken parse (missing tab,
    # lib failure) can't wipe previously imported data. A delete failure raises
    # to the caller — better to abort than to import on top of stale rows.
    if events:
        supabase.table("stage_event_results").delete().eq(
            "race_slug", stage_slug
        ).execute()

    imported = 0
    skipped_unmapped = 0
    errors: List[str] = []
    for ev in events:
        for row in ev["rank_rows"]:
            rider_url = _normalize_rider_url(str(row.get("rider_url") or ""))
            rid = rider_map.get(rider_url)
            if rid is None:
                skipped_unmapped += 1
                continue
            try:
                rank = int(row.get("rank"))
            except (TypeError, ValueError):
                continue
            try:
                supabase.table("stage_event_results").upsert(
                    {
                        "race_slug": stage_slug,
                        "event_type": ev["event_type"],
                        "event_name": ev["event_name"],
                        "category": ev["category"],
                        "rider_id": rid,
                        "rank": rank,
                    },
                    on_conflict="race_slug,event_type,event_name,rider_id",
                ).execute()
                imported += 1
            except Exception as exc:
                logger.error(
                    "stage_event_results upsert failed (%s, %s, %s): %s",
                    stage_slug, ev["event_name"], rider_url, exc,
                )
                errors.append(str(exc))

    result = {
        "race_slug": stage_slug,
        "kom_events": sum(1 for e in events if e["event_type"] == "kom"),
        "sprint_events": sum(1 for e in events if e["event_type"] == "sprint"),
        "imported": imported,
        "skipped_unmapped": skipped_unmapped,
        "errors": errors,
    }
    logger.info("Stage events for %s: %s", stage_slug, result)
    return result
