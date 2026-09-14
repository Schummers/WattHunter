"""Issue 08 — the backfill refuses a split it cannot prove."""
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1] / "scripts"))

from backfill_classif_breakdown import resolve_split  # noqa: E402

GT_STAGE = "race/vuelta-a-espana/2026/stage-4"


def test_a_final_classification_row_is_split_by_its_slug():
    split, reason = resolve_split("race/vuelta-a-espana/2026/points", 150.0, [])
    assert reason == "final"
    assert split == {"gc": 0.0, "points": 150.0, "kom": 0.0, "youth": 0.0}


def test_white_jersey_is_available_from_the_final_classification():
    split, _ = resolve_split("race/vuelta-a-espana/2026/youth", 75.0, [])
    assert split["youth"] == 75.0


def test_a_daily_row_is_reconstructed_when_the_split_adds_back_up():
    rows = [
        {"classification_type": "gc", "rank": 1},      # 15
        {"classification_type": "kom", "rank": 3},     # 3
    ]
    split, reason = resolve_split(GT_STAGE, 18.0, rows)
    assert reason == "reconstructed"
    assert split == {"gc": 15.0, "points": 0.0, "kom": 3.0, "youth": 0.0}


def test_a_row_whose_stored_bonus_no_candidate_reproduces_is_left_untouched():
    rows = [{"classification_type": "gc", "rank": 1}]  # 15, or 22.5 for a gc_leader
    split, reason = resolve_split(GT_STAGE, 99.0, rows)
    assert split is None
    assert "no candidate scale or role" in reason


def test_the_old_matched_only_scale_is_a_candidate_too():
    """The Giro 2026 was scored under the V2 rule, the Vuelta under the current
    one. Deriving the scale from the slug would leave the whole Giro unsplit."""
    rows = [{"classification_type": "gc", "rank": 1}]
    # V2 matched-only, gc_leader: (10 + 1 - 1) * 2 = 20, a value the current
    # flat-for-all scale never produces for this row.
    split, reason = resolve_split(GT_STAGE, 20.0, rows)
    assert reason == "reconstructed"
    assert split == {"gc": 20.0, "points": 0.0, "kom": 0.0, "youth": 0.0}


def test_a_non_zero_bonus_without_a_classification_row_is_left_untouched():
    split, reason = resolve_split(GT_STAGE, 12.0, [])
    assert split is None


def test_a_zero_bonus_needs_no_classification_row():
    split, reason = resolve_split(GT_STAGE, 0.0, [])
    assert reason == "zero"
    assert split == {"gc": 0.0, "points": 0.0, "kom": 0.0, "youth": 0.0}
