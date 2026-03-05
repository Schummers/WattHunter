"""Tests for scoring.py — calculate_daily_scores with mocked Supabase.

All Supabase I/O is replaced by in-memory mocks (make_supabase / make_chain
from conftest).  No real DB or network calls are made.
"""
import os
import importlib

import pytest

from helpers import make_supabase


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

TEAM_ID = "aaaa-0000-0000-0001"
RIDER_ID = "bbbb-0000-0000-0001"
CONTRACT_ID = "cccc-0000-0000-0001"


# ---------------------------------------------------------------------------
# Early-return edge cases
# ---------------------------------------------------------------------------


async def test_no_race_results_today():
    """Returns immediately when race_results has no results today."""
    import scoring

    sb = make_supabase([])  # race_results → empty
    result = await scoring.calculate_daily_scores(sb)

    assert result["processed"] == 0
    assert "No race results" in result["message"]
    # Only one table call was made (race_results)
    assert sb.table.call_count == 1


async def test_no_active_contracts():
    """Returns immediately when there are no active/notice contracts."""
    import scoring

    sb = make_supabase(
        [{"rider_id": RIDER_ID, "pcs_points": 50}],  # race_results
        [],  # contracts → empty
    )
    result = await scoring.calculate_daily_scores(sb)

    assert result["processed"] == 0
    assert "No active contracts" in result["message"]


# ---------------------------------------------------------------------------
# Nominal processing
# ---------------------------------------------------------------------------


async def test_nominal_processing():
    """One team with one rider scoring → teams_processed=1, no errors."""
    with pytest.MonkeyPatch.context() as mp:
        mp.setenv("CONVERSION_RATE_EUR_PER_PCS", "500")
        import scoring
        importlib.reload(scoring)  # pick up the patched env var

        sb = make_supabase(
            # 1. race_results
            [{"rider_id": RIDER_ID, "pcs_points": 20}],
            # 2. contracts
            [{"id": CONTRACT_ID, "team_id": TEAM_ID, "rider_id": RIDER_ID}],
            # 3. team_policies (none active)
            [],
            # 4. rider_xp_daily upsert (result unused)
            [],
            # 5. teams select — current cumulative_xp + treasury
            {"id": TEAM_ID, "cumulative_xp": 0, "treasury": 500_000},
            # 6. teams update (result unused)
            [],
            # 7. treasury_log dedup select → empty → will insert
            [],
            # 8. treasury_log insert (result unused)
            [],
        )

        result = await scoring.calculate_daily_scores(sb)

    assert result["status"] == "completed"
    assert result["teams_processed"] == 1
    assert result["errors"] == []


async def test_nominal_processing_with_policy_bonus():
    """Team with a 10% XP bonus policy → teams_processed=1, no errors."""
    with pytest.MonkeyPatch.context() as mp:
        mp.setenv("CONVERSION_RATE_EUR_PER_PCS", "500")
        import scoring
        importlib.reload(scoring)

        sb = make_supabase(
            # 1. race_results
            [{"rider_id": RIDER_ID, "pcs_points": 10}],
            # 2. contracts
            [{"id": CONTRACT_ID, "team_id": TEAM_ID, "rider_id": RIDER_ID}],
            # 3. team_policies — one policy with 10% XP bonus
            [{"team_id": TEAM_ID, "policy_id": "p-1", "policies": {"xp_bonus": 0.1}}],
            # 4. rider_xp_daily upsert
            [],
            # 5. teams select
            {"id": TEAM_ID, "cumulative_xp": 0, "treasury": 500_000},
            # 6. teams update
            [],
            # 7. treasury_log dedup → empty
            [],
            # 8. treasury_log insert
            [],
        )

        result = await scoring.calculate_daily_scores(sb)

    assert result["status"] == "completed"
    assert result["teams_processed"] == 1
    assert result["errors"] == []


# ---------------------------------------------------------------------------
# Pure formula unit tests (no I/O)
# ---------------------------------------------------------------------------


def test_xp_formula_no_bonus():
    """XP = raw_points * (1 + 0) = raw_points."""
    raw_points = 10
    bonus = 0.0
    assert raw_points * (1 + bonus) == 10.0
    assert int(raw_points * (1 + bonus)) == 10


def test_xp_formula_with_bonus():
    """XP = raw_points * (1 + bonus)."""
    raw_points = 10
    bonus = 0.1
    assert int(raw_points * (1 + bonus)) == 11


def test_revenue_formula():
    """Revenue = raw_points * conversion_rate."""
    assert 20 * 500 == 10_000
    assert 100 * 300 == 30_000


def test_bonus_positive_only():
    """Bonus = max(0, pts * 500 - locked_salary). Never negative."""
    from scoring import calculate_rider_bonus

    # Star: 340 pts, salary 150K → bonus = max(0, 170K - 150K) = 20K
    assert calculate_rider_bonus(340, 150000, 500) == 20000

    # Star bad month: 128 pts, salary 150K → bonus = 0
    assert calculate_rider_bonus(128, 150000, 500) == 0

    # Pépite: 30 pts, salary 5K → bonus = max(0, 15K - 5K) = 10K
    assert calculate_rider_bonus(30, 5000, 500) == 10000

    # Zero pts → bonus = 0
    assert calculate_rider_bonus(0, 5000, 500) == 0
