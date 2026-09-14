"""Issue 08 — the daily classification bonus, jersey by jersey.

Yellow, green and polka dot used to be merged into gt_classif_bonus. These tests
lock the split and, above all, lock that the split still adds back up to the
merged value every existing reader relies on.
"""
import pytest

from scoring import (
    CLASSIF_TYPES,
    _classif_bonus,
    _classif_bonus_gt,
    _classif_breakdown,
    _classif_breakdown_gt,
)

GT_SLUG_ROWS = [
    {"classification_type": "gc", "rank": 1},       # 15
    {"classification_type": "points", "rank": 2},   # 4
    {"classification_type": "kom", "rank": 3},      # 3
    {"classification_type": "youth", "rank": 1},    # 4
]


def test_gt_breakdown_separates_the_four_jerseys():
    breakdown = _classif_breakdown_gt(GT_SLUG_ROWS, "domestique")
    assert breakdown == {"gc": 15.0, "points": 4.0, "kom": 3.0, "youth": 4.0}


def test_gt_breakdown_applies_the_role_multiplier_to_the_right_jersey_only():
    sprinter = _classif_breakdown_gt(GT_SLUG_ROWS, "sprinter")
    assert sprinter["points"] == 8.0   # 4 x 2
    assert sprinter["gc"] == 15.0      # untouched
    assert sprinter["kom"] == 3.0

    climber = _classif_breakdown_gt(GT_SLUG_ROWS, "climber")
    assert climber["kom"] == 6.0       # 3 x 2
    assert climber["points"] == 4.0

    leader = _classif_breakdown_gt(GT_SLUG_ROWS, "gc_leader")
    assert leader["gc"] == 22.5        # 15 x 1.5
    assert leader["youth"] == 6.0      # 4 x 1.5


@pytest.mark.parametrize("role", ["domestique", "gc_leader", "sprinter", "climber"])
def test_gt_breakdown_sums_to_the_merged_bonus(role):
    """The invariant every existing reader of gt_classif_bonus depends on."""
    breakdown = _classif_breakdown_gt(GT_SLUG_ROWS, role)
    assert sum(breakdown.values()) == pytest.approx(_classif_bonus_gt(GT_SLUG_ROWS, role))


def test_one_week_breakdown_sums_to_the_merged_bonus():
    rows = [
        {"classification_type": "gc", "rank": 2},
        {"classification_type": "points", "rank": 1},
    ]
    for role in ("domestique", "gc_leader", "sprinter", "climber"):
        breakdown = _classif_breakdown(rows, role)
        assert sum(breakdown.values()) == pytest.approx(_classif_bonus(rows, role))


def test_one_week_breakdown_pays_nothing_to_an_unmatched_role():
    rows = [{"classification_type": "gc", "rank": 1}]
    assert _classif_breakdown(rows, "domestique") == {t: 0.0 for t in CLASSIF_TYPES}


def test_breakdown_always_carries_the_four_keys():
    for rows in ([], [{"classification_type": "gc", "rank": 1}]):
        assert set(_classif_breakdown_gt(rows, "domestique")) == set(CLASSIF_TYPES)
        assert set(_classif_breakdown(rows, "sprinter")) == set(CLASSIF_TYPES)


def test_breakdown_ignores_an_unknown_classification_and_an_out_of_zone_rank():
    rows = [
        {"classification_type": "teams", "rank": 1},
        {"classification_type": "gc", "rank": 99},
        {"classification_type": "points", "rank": None},
    ]
    assert _classif_breakdown_gt(rows, "domestique") == {t: 0.0 for t in CLASSIF_TYPES}
