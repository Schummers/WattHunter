"""Tests for monthly finance job."""
import pytest


def test_monthly_sponsor_payment():
    """Each team gets +200K sponsor payment."""
    from monthly_finance import SPONSOR_AMOUNT
    assert SPONSOR_AMOUNT == 200_000


def test_monthly_salary_deduction():
    """Total salary = sum of all locked_salary from active contracts."""
    from monthly_finance import calculate_monthly_salaries
    contracts = [
        {"locked_salary": 150000},
        {"locked_salary": 5000},
        {"locked_salary": 30000},
    ]
    assert calculate_monthly_salaries(contracts) == 185000


def test_salary_empty_contracts():
    """Empty contracts = 0 salary."""
    from monthly_finance import calculate_monthly_salaries
    assert calculate_monthly_salaries([]) == 0


def test_bankruptcy_releases_best_scorer():
    """Bankruptcy releases rider with most XP first."""
    from monthly_finance import get_release_order
    contracts = [
        {"rider_id": "a", "locked_salary": 150000, "total_xp": 500},
        {"rider_id": "b", "locked_salary": 5000, "total_xp": 1200},
        {"rider_id": "c", "locked_salary": 30000, "total_xp": 300},
    ]
    order = get_release_order(contracts)
    assert order[0]["rider_id"] == "b"  # Best scorer first
    assert order[1]["rider_id"] == "a"
    assert order[2]["rider_id"] == "c"
