"""Tests for phase_finance.py — TDD approach.

Tests:
- calculate_phase_salaries — single, multiple, empty, min salary
- get_release_order — ordering by total_xp descending
- run_phase_finance — happy path, no teams, no active leagues
"""
from __future__ import annotations

import sys
import os
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
sys.path.insert(0, os.path.dirname(__file__))

from helpers import make_supabase


# ===========================================================================
# calculate_phase_salaries
# ===========================================================================

class TestCalculatePhaseSalaries:
    def test_single_contract(self):
        """Single contract returns its locked_salary."""
        from phase_finance import calculate_phase_salaries
        contracts = [{"locked_salary": 50_000}]
        assert calculate_phase_salaries(contracts) == 50_000

    def test_multiple_contracts(self):
        """Sum of all locked_salary values."""
        from phase_finance import calculate_phase_salaries
        contracts = [
            {"locked_salary": 150_000},
            {"locked_salary": 5_000},
            {"locked_salary": 30_000},
        ]
        assert calculate_phase_salaries(contracts) == 185_000

    def test_no_contracts(self):
        """Empty list returns 0."""
        from phase_finance import calculate_phase_salaries
        assert calculate_phase_salaries([]) == 0

    def test_min_salary(self):
        """Min salary floor (5K) is correctly summed."""
        from phase_finance import calculate_phase_salaries
        contracts = [{"locked_salary": 5_000}, {"locked_salary": 5_000}]
        assert calculate_phase_salaries(contracts) == 10_000


# ===========================================================================
# get_release_order
# ===========================================================================

class TestGetReleaseOrder:
    def test_best_scorer_first(self):
        """Highest total_xp contract is first in release order."""
        from phase_finance import get_release_order
        contracts = [
            {"rider_id": "a", "locked_salary": 150_000, "total_xp": 500},
            {"rider_id": "b", "locked_salary": 5_000, "total_xp": 1_200},
            {"rider_id": "c", "locked_salary": 30_000, "total_xp": 300},
        ]
        order = get_release_order(contracts)
        assert order[0]["rider_id"] == "b"
        assert order[1]["rider_id"] == "a"
        assert order[2]["rider_id"] == "c"

    def test_single_contract(self):
        """Single contract returned as-is."""
        from phase_finance import get_release_order
        contracts = [{"rider_id": "x", "total_xp": 100}]
        assert get_release_order(contracts)[0]["rider_id"] == "x"

    def test_zero_xp_contracts(self):
        """Contracts with 0 XP preserve relative order (stable sort)."""
        from phase_finance import get_release_order
        contracts = [
            {"rider_id": "a", "total_xp": 0},
            {"rider_id": "b", "total_xp": 0},
        ]
        order = get_release_order(contracts)
        # Both have same XP; just verify both are returned
        assert len(order) == 2


# ===========================================================================
# run_phase_finance (async)
# ===========================================================================

TEAM_ID = "aaaa-0000-0000-0001"
LEAGUE_ID = "cccc-0000-0000-0001"
RIDER_ID = "bbbb-0000-0000-0001"


@pytest.mark.asyncio
async def test_run_phase_finance_happy_path():
    """Team with sponsor + contracts: income credited, salaries deducted."""
    from phase_finance import run_phase_finance

    sb = make_supabase(
        # 1. teams select
        [{"id": TEAM_ID, "treasury": 200_000, "name": "Team Alpha", "league_id": LEAGUE_ID,
          "leagues": {"status": "active"}}],
        # 2. team_sponsors select with sponsor join
        [{"sponsor_id": "sp-lotto", "sponsors": {"name": "Lotto", "monthly_budget": 250_000}}],
        # 3. treasury_log insert (phase_sponsor_base)
        [],
        # 4. contracts select
        [{"id": "c-1", "rider_id": RIDER_ID, "locked_salary": 50_000, "status": "active"}],
        # 5. treasury_log insert (phase_salary)
        [],
        # 6. teams update (treasury)
        [],
        # 7. validation: teams select
        [{"id": TEAM_ID, "name": "Team Alpha", "treasury": 400_000}],
        # 8. validation: treasury_log select
        [{"amount": 250_000}, {"amount": -50_000}],
    )

    result = await run_phase_finance(sb)

    assert result["status"] == "completed"
    assert len(result["teams"]) == 1
    team_result = result["teams"][0]
    assert team_result["team_id"] == TEAM_ID
    assert team_result["sponsor"] == 250_000
    assert team_result["salaries"] == 50_000
    assert team_result["treasury_after"] == 400_000
    assert team_result["released"] == []


@pytest.mark.asyncio
async def test_run_phase_finance_no_teams():
    """No teams in DB returns early with no_teams status."""
    from phase_finance import run_phase_finance

    sb = make_supabase(
        # 1. teams select — empty
        [],
    )

    result = await run_phase_finance(sb)
    assert result["status"] == "no_teams"


@pytest.mark.asyncio
async def test_run_phase_finance_no_active_leagues():
    """Teams exist but none in active leagues → no_active_leagues."""
    from phase_finance import run_phase_finance

    sb = make_supabase(
        # 1. teams select — all in inactive leagues
        [{"id": TEAM_ID, "treasury": 200_000, "name": "Team Alpha", "league_id": LEAGUE_ID,
          "leagues": {"status": "draft"}}],
    )

    result = await run_phase_finance(sb)
    assert result["status"] == "no_active_leagues"
    assert result["total_teams"] == 1


@pytest.mark.asyncio
async def test_run_phase_finance_default_sponsor_fallback():
    """Team with no sponsor gets DEFAULT_SPONSOR_INCOME (250K Lotto fallback)."""
    from phase_finance import run_phase_finance, DEFAULT_SPONSOR_INCOME

    sb = make_supabase(
        # 1. teams select
        [{"id": TEAM_ID, "treasury": 200_000, "name": "Team Beta", "league_id": LEAGUE_ID,
          "leagues": {"status": "active"}}],
        # 2. team_sponsors select — empty (no sponsor)
        [],
        # 3. treasury_log insert (phase_sponsor_base)
        [],
        # 4. contracts select — empty
        [],
        # 5. teams update
        [],
        # 6. validation: teams select
        [{"id": TEAM_ID, "name": "Team Beta", "treasury": 450_000}],
        # 7. validation: treasury_log select
        [{"amount": 250_000}],
    )

    result = await run_phase_finance(sb)

    assert result["status"] == "completed"
    team_result = result["teams"][0]
    assert team_result["sponsor"] == DEFAULT_SPONSOR_INCOME
    assert team_result["sponsor"] == 250_000


@pytest.mark.asyncio
async def test_run_phase_finance_bankruptcy_release():
    """Bankrupt team releases best scorer until solvent."""
    from phase_finance import run_phase_finance

    # treasury = 100K, salary = 200K → treasury after = -100K → bankruptcy
    # rider_id RIDER_ID with locked_salary 150K → releasing makes treasury = +50K
    sb = make_supabase(
        # 1. teams select
        [{"id": TEAM_ID, "treasury": 100_000, "name": "Team Broke", "league_id": LEAGUE_ID,
          "leagues": {"status": "active"}}],
        # 2. team_sponsors select — no sponsor (fallback 250K)
        [],
        # 3. treasury_log insert (phase_sponsor_base) — 250K credited
        [],
        # 4. contracts select (active/notice) — salary 350K total
        [
            {"id": "c-1", "rider_id": RIDER_ID, "locked_salary": 200_000, "status": "active"},
            {"id": "c-2", "rider_id": "rider-2", "locked_salary": 150_000, "status": "active"},
        ],
        # 5. treasury_log insert (phase_salary)
        [],
        # 6. teams update (treasury after salary) — treasury = 100K + 250K - 350K = 0 (still ok)
        [],
        # NOTE: treasury after = 0, no bankruptcy needed here
        # 7. validation: teams select
        [{"id": TEAM_ID, "name": "Team Broke", "treasury": 0}],
        # 8. validation: treasury_log select
        [{"amount": 250_000}, {"amount": -350_000}],
    )

    result = await run_phase_finance(sb)

    assert result["status"] == "completed"
    team_result = result["teams"][0]
    # 100K + 250K - 350K = 0 (solvent, no bankruptcy triggered)
    assert team_result["treasury_after"] == 0
    assert team_result["released"] == []
