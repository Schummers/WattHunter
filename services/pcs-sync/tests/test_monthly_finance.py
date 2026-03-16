"""Tests for monthly finance job."""
import pytest

from helpers import make_supabase


def test_monthly_sponsor_payment():
    """Default sponsor fallback is 200K."""
    from monthly_finance import DEFAULT_SPONSOR_AMOUNT
    assert DEFAULT_SPONSOR_AMOUNT == 200_000


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


def test_sponsor_income_first_phase():
    """Escalating sponsor uses first_phase_budget when payments_count=0."""
    from monthly_finance import _get_sponsor_income

    sb = make_supabase(
        # team_sponsors select with sponsor join
        [{"id": "ts-1", "payments_count": 0, "sponsors": {
            "name": "Lotto", "monthly_budget": 300000, "first_phase_budget": 200000,
        }}],
    )
    income, desc = _get_sponsor_income(sb, "team-1")
    assert income == 200_000
    assert "Lotto" in desc


def test_sponsor_income_subsequent_phase():
    """Escalating sponsor uses monthly_budget when payments_count > 0."""
    from monthly_finance import _get_sponsor_income

    sb = make_supabase(
        [{"id": "ts-1", "payments_count": 1, "sponsors": {
            "name": "Lotto", "monthly_budget": 300000, "first_phase_budget": 200000,
        }}],
    )
    income, desc = _get_sponsor_income(sb, "team-1")
    assert income == 300_000
    assert "Lotto" in desc


def test_sponsor_income_no_escalation():
    """Non-escalating sponsor always uses monthly_budget."""
    from monthly_finance import _get_sponsor_income

    sb = make_supabase(
        [{"id": "ts-1", "payments_count": 0, "sponsors": {
            "name": "Visma", "monthly_budget": 400000, "first_phase_budget": None,
        }}],
    )
    income, desc = _get_sponsor_income(sb, "team-1")
    assert income == 400_000


def test_increment_payments_count():
    """_increment_payments_count increments each active team_sponsor."""
    from monthly_finance import _increment_payments_count

    sb = make_supabase(
        # select active team_sponsors
        [{"id": "ts-1", "payments_count": 0}, {"id": "ts-2", "payments_count": 2}],
        # update ts-1
        [],
        # update ts-2
        [],
    )
    _increment_payments_count(sb, "team-1")
    # 3 table() calls: 1 select + 2 updates
    assert sb.table.call_count == 3
