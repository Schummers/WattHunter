"""Tests for reconcile_bonuses — Giro double-count guard + treasury reconciliation."""
import pytest


def test_detects_points_double_count():
    from reconcile_bonuses import find_points_double_counts
    completions = [
        {"team_id": "t1", "rider_id": "r1", "goal_label": "Wear ciclamino",
         "race_slug": "race/giro-d-italia/2026"},
        {"team_id": "t1", "rider_id": "r1", "goal_label": "Win the points classification",
         "race_slug": "race/giro-d-italia/2026"},
    ]
    assert find_points_double_counts(completions) == [("t1", "r1", "race/giro-d-italia/2026")]


def test_no_double_count_when_only_new():
    from reconcile_bonuses import find_points_double_counts
    completions = [
        {"team_id": "t1", "rider_id": "r1", "goal_label": "Win the points classification",
         "race_slug": "race/giro-d-italia/2026"},
    ]
    assert find_points_double_counts(completions) == []


def test_double_count_distinct_riders_not_flagged():
    from reconcile_bonuses import find_points_double_counts
    completions = [
        {"team_id": "t1", "rider_id": "r1", "goal_label": "Wear ciclamino",
         "race_slug": "race/giro-d-italia/2026"},
        {"team_id": "t1", "rider_id": "r2", "goal_label": "Win the points classification",
         "race_slug": "race/giro-d-italia/2026"},
    ]
    assert find_points_double_counts(completions) == []


def test_maglia_ciclamino_variant_also_flagged():
    """'Wear maglia ciclamino' is a valid old label too."""
    from reconcile_bonuses import find_points_double_counts
    completions = [
        {"team_id": "t2", "rider_id": "r3", "goal_label": "Wear maglia ciclamino",
         "race_slug": "race/giro-d-italia/2026"},
        {"team_id": "t2", "rider_id": "r3", "goal_label": "Win the points classification",
         "race_slug": "race/giro-d-italia/2026"},
    ]
    assert find_points_double_counts(completions) == [("t2", "r3", "race/giro-d-italia/2026")]


def test_old_only_not_flagged():
    """Only old label present — not a double-count."""
    from reconcile_bonuses import find_points_double_counts
    completions = [
        {"team_id": "t1", "rider_id": "r1", "goal_label": "Wear ciclamino",
         "race_slug": "race/giro-d-italia/2026"},
    ]
    assert find_points_double_counts(completions) == []


def test_multiple_doubles_sorted():
    """Multiple flagged keys are returned sorted."""
    from reconcile_bonuses import find_points_double_counts
    completions = [
        {"team_id": "t2", "rider_id": "r2", "goal_label": "Wear ciclamino",
         "race_slug": "race/giro-d-italia/2026"},
        {"team_id": "t2", "rider_id": "r2", "goal_label": "Win the points classification",
         "race_slug": "race/giro-d-italia/2026"},
        {"team_id": "t1", "rider_id": "r1", "goal_label": "Wear ciclamino",
         "race_slug": "race/giro-d-italia/2026"},
        {"team_id": "t1", "rider_id": "r1", "goal_label": "Win the points classification",
         "race_slug": "race/giro-d-italia/2026"},
    ]
    result = find_points_double_counts(completions)
    assert result == [
        ("t1", "r1", "race/giro-d-italia/2026"),
        ("t2", "r2", "race/giro-d-italia/2026"),
    ]


# ---------------------------------------------------------------------------
# reconcile_team_treasury — light integration test using make_supabase mock
# ---------------------------------------------------------------------------

def test_reconcile_team_treasury_no_delta():
    """Team with matching sponsor_bonuses + treasury_log → delta == 0."""
    import asyncio
    from tests.helpers import make_supabase
    from reconcile_bonuses import reconcile_team_treasury

    sb = make_supabase(
        [{"id": "team-a"}],                              # teams.select
        [{"final_bonus": 50_000}],                        # sponsor_bonuses
        [{"final_reward": 20_000}],                       # sponsor_goal_completions
        [                                                  # treasury_log
            {"amount": 50_000, "type": "sponsor_bonus"},
            {"amount": 20_000, "type": "gt_goal_bonus"},
        ],
    )

    result = asyncio.run(reconcile_team_treasury(sb, "league-x"))
    assert len(result) == 1
    row = result[0]
    assert row["team_id"] == "team-a"
    assert row["expected"] == 70_000
    assert row["logged"] == 70_000
    assert row["delta"] == 0


def test_reconcile_team_treasury_positive_delta():
    """logged > expected → positive delta (over-credited)."""
    import asyncio
    from tests.helpers import make_supabase
    from reconcile_bonuses import reconcile_team_treasury

    sb = make_supabase(
        [{"id": "team-b"}],
        [{"final_bonus": 30_000}],
        [],                                               # no goal completions
        [
            {"amount": 30_000, "type": "sponsor_bonus"},
            {"amount": 10_000, "type": "sponsor_bonus"},  # extra credit
        ],
    )

    result = asyncio.run(reconcile_team_treasury(sb, "league-y"))
    assert result[0]["delta"] == 10_000


def test_reconcile_team_treasury_ignores_non_bonus_log_entries():
    """treasury_log entries with other types are not counted."""
    import asyncio
    from tests.helpers import make_supabase
    from reconcile_bonuses import reconcile_team_treasury

    sb = make_supabase(
        [{"id": "team-c"}],
        [{"final_bonus": 10_000}],
        [],
        [
            {"amount": 10_000, "type": "sponsor_bonus"},
            {"amount": 5_000, "type": "finance"},        # must be ignored
            {"amount": 2_000, "type": "bid_debit"},      # must be ignored
        ],
    )

    result = asyncio.run(reconcile_team_treasury(sb, "league-z"))
    row = result[0]
    assert row["expected"] == 10_000
    assert row["logged"] == 10_000
    assert row["delta"] == 0
