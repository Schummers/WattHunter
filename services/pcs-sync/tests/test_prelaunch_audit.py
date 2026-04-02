"""Pre-launch audit tests — Track 7 (T2, T3, T5, T9)."""
from __future__ import annotations

from datetime import date as real_date
from unittest.mock import patch, MagicMock

import pytest

from helpers import make_supabase, make_chain


# ---------------------------------------------------------------------------
# T3: Bankruptcy releases riders in order until treasury >= 0
# ---------------------------------------------------------------------------

def test_bankruptcy_stabilizes_treasury():
    """Release best scorers until treasury is non-negative."""
    from phase_finance import get_release_order

    contracts = [
        {"rider_id": "a", "locked_salary": 20_000, "total_xp": 100},
        {"rider_id": "b", "locked_salary": 30_000, "total_xp": 500},
        {"rider_id": "c", "locked_salary": 10_000, "total_xp": 300},
    ]
    order = get_release_order(contracts)

    # Simulate: treasury = -25_000, release order: b (500xp), c (300xp), a (100xp)
    treasury = -25_000
    released = []
    for contract in order:
        if treasury >= 0:
            break
        treasury += contract["locked_salary"]
        released.append(contract["rider_id"])

    # b (30k) brings treasury to 5k → stop
    assert treasury >= 0
    assert released == ["b"]
    assert treasury == 5_000


def test_bankruptcy_releases_multiple_until_solvent():
    """Need to release multiple riders to reach solvency."""
    from phase_finance import get_release_order

    contracts = [
        {"rider_id": "a", "locked_salary": 5_000, "total_xp": 10},
        {"rider_id": "b", "locked_salary": 5_000, "total_xp": 50},
        {"rider_id": "c", "locked_salary": 5_000, "total_xp": 30},
    ]
    order = get_release_order(contracts)

    treasury = -12_000
    released = []
    for contract in order:
        if treasury >= 0:
            break
        treasury += contract["locked_salary"]
        released.append(contract["rider_id"])

    # Release b (50xp) → -7k, then c (30xp) → -2k, then a (10xp) → 3k
    assert treasury >= 0
    assert len(released) == 3


# ---------------------------------------------------------------------------
# T5: Level gating consistency TS vs Python (cross-validation)
# ---------------------------------------------------------------------------

def test_level_gating_matches_levels_ts():
    """Pool min values in Python must match TypeScript lib/levels.ts (8 levels)."""
    from sync import rank_min_for_level

    # These are the poolMin values from apps/web/lib/levels.ts
    expected = {
        1: 300, 2: 200, 3: 100, 4: 30, 5: 20,
        6: 10, 7: 4, 8: 1,
    }
    for level, pool_min in expected.items():
        assert rank_min_for_level(level) == pool_min, (
            f"Level {level}: Python={rank_min_for_level(level)}, TS={pool_min}"
        )


def test_level_gating_boundary_values():
    """Clamp: level 0 → level 1 behavior, level 9 → level 8 behavior."""
    from sync import rank_min_for_level

    assert rank_min_for_level(0) == rank_min_for_level(1)
    assert rank_min_for_level(9) == rank_min_for_level(8)
    assert rank_min_for_level(-1) == rank_min_for_level(1)


# ---------------------------------------------------------------------------
# T9: Policy matching edge cases
# ---------------------------------------------------------------------------

def test_salary_calculation_edge_cases():
    """Salary with zero/negative/missing locked_salary."""
    from phase_finance import calculate_phase_salaries as calculate_monthly_salaries

    # Missing locked_salary key defaults to 0
    assert calculate_monthly_salaries([{"other": "field"}]) == 0
    assert calculate_monthly_salaries([{"locked_salary": 0}]) == 0
    # Single contract
    assert calculate_monthly_salaries([{"locked_salary": 5_000}]) == 5_000


def test_release_order_with_zero_xp():
    """All riders with 0 XP — order doesn't matter but must not crash."""
    from phase_finance import get_release_order

    contracts = [
        {"rider_id": "a", "locked_salary": 10_000, "total_xp": 0},
        {"rider_id": "b", "locked_salary": 10_000, "total_xp": 0},
    ]
    order = get_release_order(contracts)
    assert len(order) == 2


def test_release_order_with_missing_xp():
    """Missing total_xp field defaults to 0."""
    from phase_finance import get_release_order

    contracts = [
        {"rider_id": "a", "locked_salary": 10_000},
        {"rider_id": "b", "locked_salary": 10_000, "total_xp": 100},
    ]
    order = get_release_order(contracts)
    # b has XP, so it's released first
    assert order[0]["rider_id"] == "b"
