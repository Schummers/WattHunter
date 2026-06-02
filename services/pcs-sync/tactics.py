"""GT Tactic modifier computation.

Each helper returns the override values to apply when a given tactic is
active for a stage. None means "no change from default".

Formula context (from rider_xp_daily):
  xp = (raw_pcs × gt_role_mult × (1 + strat) + classif) × nemesis
"""
from __future__ import annotations
from typing import Optional

# Spec A A3 — mirror of scoring.BREAKAWAY_THRESHOLD_KM.
# Duplicated here to avoid a circular import (scoring imports from tactics).
# Both reference Spec A A3 = 30 km; keep them in sync.
BREAKAWAY_THRESHOLD_KM = 30.0


def _in_breakaway(breakaway_kms) -> bool:
    try:
        return breakaway_kms is not None and float(breakaway_kms) >= BREAKAWAY_THRESHOLD_KM
    except (TypeError, ValueError):
        return False


def _is_stage_result(race_slug: str) -> bool:
    """Stage slugs end in /stage-N. GC final ends in /gc."""
    return "/stage-" in race_slug


def compute_unleash_modifier(
    role: str, race_slug: str
) -> tuple[Optional[float], Optional[str]]:
    """Domestiques scoring on a stage become Stage Hunters (×1.5)."""
    if role != "domestique":
        return (None, None)
    if not _is_stage_result(race_slug):
        return (None, None)
    return (1.5, "unleash")


def compute_overdrive_modifier(
    role: str, race_slug: str, breakaway_kms=None
) -> tuple[Optional[float], Optional[str]]:
    """Stage Hunters in the breakaway jump to ×2.0 on stage results (Spec A A7).

    No effect for non-stage-hunters, non-stage results, or riders not in the break.
    """
    if role != "stage_hunter":
        return (None, None)
    if not _is_stage_result(race_slug):
        return (None, None)
    if not _in_breakaway(breakaway_kms):
        return (None, None)
    return (2.0, "overdrive")


def compute_call_bus_modifier(
    in_squad: bool, race_slug: str
) -> tuple[bool, Optional[str]]:
    """Bench riders are scored as domestiques (×1.0) for this stage.
    Returns (should_include, tactic_applied)."""
    if in_squad:
        return (False, None)
    if not _is_stage_result(race_slug):
        return (False, None)
    return (True, "call_the_bus")


def compute_nemesis_modifier(
    outcome: str,
    rider_role: str,  # "attacker" or "target"
    tactic_type: str,  # "nemesis_gc" or "nemesis_sprint"
) -> tuple[Optional[float], float, str]:
    """Returns (gt_role_mult_override, nemesis_modifier, tactic_applied).

    | Outcome       | Role     | role_mult | nemesis_mod |
    |---------------|----------|-----------|-------------|
    | attacker_won  | attacker | 2.0       | 1.0         |
    | attacker_won  | target   | None      | 0.5         |
    | target_won    | attacker | None      | 0.75        |
    | target_won    | target   | None      | 1.25        |
    | no_resolution | both     | None      | 1.0         |
    """
    assert rider_role in ("attacker", "target")
    assert outcome in ("attacker_won", "target_won", "no_resolution")
    assert tactic_type in ("nemesis_gc", "nemesis_sprint")

    if outcome == "no_resolution":
        return (None, 1.0, tactic_type)

    if outcome == "attacker_won":
        if rider_role == "attacker":
            return (2.0, 1.0, tactic_type)
        else:  # target
            return (None, 0.5, tactic_type)

    # target_won
    if rider_role == "attacker":
        return (None, 0.75, tactic_type)
    else:  # target
        return (None, 1.25, tactic_type)
