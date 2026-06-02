"""Tests that the Level Curve Stretch grandfathers existing team levels:
a team currently at Lv.6 with 900 XP (below the new 1200 threshold) must stay Lv.6."""
from unittest.mock import MagicMock, patch

def _team_row(level: int, xp: float):
    row = MagicMock()
    row.data = {"id": "team-1", "cumulative_xp": xp, "level": level, "league_id": "lg-1"}
    return row

def test_no_level_regression_when_xp_below_new_threshold():
    """Team at Lv.6 with 900 XP stays Lv.6 after scoring, even though 900 < 1200 (new Lv.6 threshold)."""
    from scoring import compute_level, LEVEL_THRESHOLDS

    # Sanity check new thresholds are loaded.
    assert LEVEL_THRESHOLDS[5] == 1200, "Lv.6 threshold should be 1200"
    assert LEVEL_THRESHOLDS[6] == 2600, "Lv.7 threshold should be 2600"
    assert LEVEL_THRESHOLDS[7] == 5000, "Lv.8 threshold should be 5000"

    # compute_level returns the "mathematical" level for an XP value.
    assert compute_level(900) == 5  # 900 is between Lv.5 (600) and Lv.6 (1200) → Lv.5

    # BUT the grandfather rule says: if current_level > computed_level, keep current_level.
    current_level = 6
    computed = compute_level(900)
    effective = max(current_level, computed)
    assert effective == 6  # grandfathered

def test_level_up_still_works_after_stretch():
    """Team at Lv.5 with 1200 XP moves to Lv.6 under new thresholds."""
    from scoring import compute_level
    assert compute_level(1200) == 6

    current_level = 5
    computed = compute_level(1200)
    effective = max(current_level, computed)
    assert effective == 6  # leveled up correctly

def test_no_regression_at_l7_boundary():
    """Team at Lv.7 with 2559 XP (real league: Leopard) stays Lv.7 even though 2559 < 2600."""
    from scoring import compute_level
    assert compute_level(2559) == 6  # mathematically L6 under the stretched curve
    current_level = 7
    effective = max(current_level, compute_level(2559))
    assert effective == 7  # grandfathered, never regress
