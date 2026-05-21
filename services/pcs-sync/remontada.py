"""Anti-Runaway Mechanism 1: Remontada Boost helpers.

See docs/plans/2026-04-23-anti-runaway-system-design.md §3."""
from __future__ import annotations
import re
from datetime import datetime, timezone
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


from postgrest.exceptions import APIError

BOOST_WINDOW_STAGES = 3
DEFAULT_MULTIPLIER = 1.5

# Feature flag — Remontada Boost mecanique desactivee le 2026-05-21.
# Fragile au recalcul retroactif (la detection d'overtakes corrompt l'historique
# des triggers/boosts a chaque rescore). Code conserve pour reactivation future.
# Voir docs/GAME_RULES.md §12.1 et MEMORY.md.
REMONTADA_ENABLED = False


def record_overtake(
    supabase: Client,
    *,
    league_id: str,
    gt_identifier: str,
    overtaker_team_id: str,
    overtaken_team_id: str,
    triggered_at_stage: int,
) -> bool:
    """Insert an anti-ping-pong trigger and upsert the active boost.

    Returns True if the overtake was NEW (trigger inserted + boost applied),
    False if the trigger already existed (ping-pong prevented — no boost change).

    Reset cumul: upsert on (team_id, gt_identifier) replaces expires_after_stage with
    triggered_at_stage + BOOST_WINDOW_STAGES, keeping multiplier at DEFAULT_MULTIPLIER.
    """
    if not REMONTADA_ENABLED:
        return False

    # 1) Try to insert the trigger (unique key enforces 1 per pair per GT).
    try:
        supabase.table("remontada_boost_triggers").insert({
            "league_id": league_id,
            "gt_identifier": gt_identifier,
            "overtaker_team_id": overtaker_team_id,
            "overtaken_team_id": overtaken_team_id,
            "triggered_at_stage": triggered_at_stage,
        }).execute()
    except APIError as e:
        # unique_violation on primary key → pair already triggered this GT.
        if getattr(e, "code", None) == "23505" or "23505" in str(e):
            return False
        raise

    # 2) Upsert the boost (Reset behavior: refresh expires_after_stage).
    supabase.table("remontada_boosts").upsert({
        "league_id": league_id,
        "team_id": overtaker_team_id,
        "gt_identifier": gt_identifier,
        "triggered_at_stage": triggered_at_stage,
        "expires_after_stage": triggered_at_stage + BOOST_WINDOW_STAGES,
        "multiplier": DEFAULT_MULTIPLIER,
        "overtaken_team_id": overtaken_team_id,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }, on_conflict="team_id,gt_identifier").execute()

    return True


def get_active_multiplier(
    supabase: Client,
    *,
    team_id: str,
    gt_identifier: str,
    stage_number: int,
) -> float:
    """Return the boost multiplier active for this team at this GT stage, else 1.0.

    Window semantics: a boost triggered at stage T covers stages T+1..T+BOOST_WINDOW_STAGES
    (i.e., expires_after_stage inclusive). The trigger stage itself (T) is NOT boosted.
    """
    if not REMONTADA_ENABLED:
        return 1.0

    resp = (
        supabase.table("remontada_boosts")
        .select("triggered_at_stage, expires_after_stage, multiplier")
        .eq("team_id", team_id)
        .eq("gt_identifier", gt_identifier)
        .limit(1)
        .execute()
    )
    rows = (resp.data if resp else None) or []
    if not rows:
        return 1.0
    row = rows[0]
    if not row:
        return 1.0
    if stage_number <= row["triggered_at_stage"]:
        return 1.0
    if stage_number > row["expires_after_stage"]:
        return 1.0
    return float(row["multiplier"])
