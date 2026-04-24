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


def detect_overtakes(
    before: list[tuple[str, int]],
    after: list[tuple[str, int]],
) -> list[tuple[str, str]]:
    """Return [(overtaker_team_id, overtaken_team_id), ...] for each eligible overtake.

    Eligibility (per spec §3.2):
      - League must have >= 4 teams (non-podium slot must exist).
      - Overtaker's new rank must be >= 4 (ended hors-podium).
      - Overtaken team must have ended BELOW the overtaker in 'after' AND been ABOVE in 'before'.
    """
    if len(after) < 4:
        return []

    before_rank = {team_id: rank for team_id, rank in before}
    after_rank = {team_id: rank for team_id, rank in after}

    overtakes: list[tuple[str, str]] = []
    for team_id, new_rank in after_rank.items():
        if new_rank < 4:
            continue  # overtaker must end hors-podium
        old_rank = before_rank.get(team_id)
        if old_rank is None or old_rank <= new_rank:
            continue  # team didn't move up
        # Every team that was above us before AND is below us now = a pair overtaken.
        for other_id, other_new_rank in after_rank.items():
            if other_id == team_id:
                continue
            other_old_rank = before_rank.get(other_id)
            if other_old_rank is None:
                continue
            if other_old_rank < old_rank and other_new_rank > new_rank:
                overtakes.append((team_id, other_id))
    return overtakes
