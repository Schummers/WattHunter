"""Anti-Runaway Mechanism 1: Remontada Boost helpers.

See docs/plans/2026-04-23-anti-runaway-system-design.md §3."""
from __future__ import annotations
import re
from typing import Optional

GT_SLUGS = ("giro-d-italia", "tour-de-france", "vuelta-a-espana")

_GT_PATTERN = re.compile(r"^race/(giro-d-italia|tour-de-france|vuelta-a-espana)/")
_STAGE_PATTERN = re.compile(r"/stage-(\d+)(?:/|$)")

def get_gt_identifier(race_slug: str) -> Optional[str]:
    """Return 'giro-d-italia' | 'tour-de-france' | 'vuelta-a-espana' or None."""
    if not race_slug:
        return None
    m = _GT_PATTERN.match(race_slug)
    return m.group(1) if m else None

def get_stage_number(race_slug: str) -> Optional[int]:
    """Return the integer stage number from a slug like '.../stage-5'. None for /gc or prologues."""
    if not race_slug:
        return None
    m = _STAGE_PATTERN.search(race_slug)
    return int(m.group(1)) if m else None


from supabase import Client


def snapshot_league_ranking(
    supabase: Client,
    league_id: str,
) -> list[tuple[str, int]]:
    """Return [(team_id, rank), ...] sorted by cumulative_xp desc, rank starting at 1."""
    resp = (
        supabase.table("teams")
        .select("id, cumulative_xp")
        .eq("league_id", league_id)
        .order("cumulative_xp", desc=True)
        .execute()
    )
    rows = resp.data or []
    # Defensive re-sort: treat None as 0.
    rows.sort(key=lambda r: -(r.get("cumulative_xp") or 0))
    return [(row["id"], rank) for rank, row in enumerate(rows, start=1)]
