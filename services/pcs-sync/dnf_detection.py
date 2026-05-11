from __future__ import annotations
import logging
from typing import Any

logger = logging.getLogger(__name__)


def extract_dnf_rider_slugs(stage_results: list[dict[str, Any]]) -> list[str]:
    """Return rider_url (pcs slugs) for entries with rank == 'DNF'."""
    # stage.results() returns rank as str for DNF, int for finishers
    # Check both 'DNF' string and None rank (DNS/DNF)
    return [
        row["rider_url"]
        for row in stage_results
        if row.get("rider_url") and str(row.get("rank", "")).upper() == "DNF"
    ]


def match_dnf_to_squad(
    dnf_slugs: list[str],
    squad_rows: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Return squad rows whose rider pcs_slug matches a DNF slug (case-insensitive)."""
    dnf_lower = {s.lower() for s in dnf_slugs}
    return [
        row for row in squad_rows
        if row.get("pcs_slug", "").lower() in dnf_lower
    ]


def detect_and_flag_dnfs(
    race_slug: str,
    stage_number: int,
    html: str,
    supabase_admin,
) -> dict[str, Any]:
    """
    Given pre-fetched stage HTML, parses DNF riders, matches against active
    gt_squad entries, and updates dnf_stage.

    Args:
        race_slug: e.g. "race/giro-d-italia/2026/stage-3"
        stage_number: e.g. 3
        html: pre-fetched stage HTML (from Playwright)
        supabase_admin: supabase-py admin client

    Returns:
        {"flagged": [...], "errors": [...]}
    """
    from procyclingstats import Stage

    parts = race_slug.split("/")
    if len(parts) < 3:
        return {"flagged": [], "errors": [f"Invalid race slug: {race_slug}"]}

    gt_identifier = parts[1]  # e.g. "giro-d-italia"
    gt_year = int(parts[2])

    phase_map = {
        "giro-d-italia": 4,
        "tour-de-france": 6,
        "vuelta-a-espana": 8,
    }
    phase_id = phase_map.get(gt_identifier)
    if phase_id is None:
        return {"flagged": [], "errors": [f"Unknown GT: {gt_identifier}"]}

    # Parse stage results from pre-fetched HTML
    stage = Stage(race_slug, html=html, update_html=False)
    try:
        stage_data = stage.results()
    except Exception as e:
        return {"flagged": [], "errors": [f"Failed to parse stage results: {e}"]}

    dnf_slugs = extract_dnf_rider_slugs(stage_data)
    logger.info(f"DNF slugs on {race_slug}: {dnf_slugs}")

    if not dnf_slugs:
        return {"flagged": [], "errors": []}

    # Fetch active gt_squad entries for this phase/year with pcs_slug
    resp = (
        supabase_admin
        .from_("gt_squad")
        .select("id, rider_id, riders(name, pcs_slug), team_id")
        .eq("phase_id", phase_id)
        .eq("year", gt_year)
        .is_("removed_at", "null")
        .is_("dnf_stage", "null")
        .execute()
    )
    squad_rows = [
        {
            "id": r["id"],
            "rider_id": r["rider_id"],
            "rider_name": r["riders"]["name"],
            "pcs_slug": r["riders"]["pcs_slug"] or "",
            "team_id": r["team_id"],
        }
        for r in (resp.data or [])
        if r.get("riders")
    ]

    matched = match_dnf_to_squad(dnf_slugs, squad_rows)
    flagged = []
    errors = []

    for row in matched:
        update_resp = (
            supabase_admin
            .from_("gt_squad")
            .update({"dnf_stage": stage_number})
            .eq("id", row["id"])
            .execute()
        )
        if update_resp.data:
            flagged.append({"squad_id": row["id"], "rider_name": row["rider_name"]})
            logger.info(f"Flagged DNF: {row['rider_name']} (squad {row['id']})")
        else:
            errors.append(f"Failed to update squad {row['id']}")

    return {"flagged": flagged, "errors": errors}
