"""SC-4 — fail loud when a scored squad-race stage has no imported profile.

Without race_results.profile_icon, _role_multiplier silently degrades the
sprinter ×1.5 to ×1.0 (profile not in SPRINT_PROFILES). scoring.calculate_daily_scores
now runs a preflight that raises rather than scoring on unseeded data.
"""
from __future__ import annotations

import pytest

import scoring
from helpers import make_supabase

GIRO_STAGE = "race/giro-d-italia/2026/stage-4"
GIRO_GC = "race/giro-d-italia/2026/gc"
GIRO_POINTS = "race/giro-d-italia/2026/points"
ONE_DAY = "race/milano-sanremo/2026/result"


# ---------------------------------------------------------------------------
# Unit: _unseeded_stage_slugs
# ---------------------------------------------------------------------------

def test_unseeded_detects_stage_with_null_profile():
    rows = [{"race_slug": GIRO_STAGE, "profile_icon": None}]
    assert scoring._unseeded_stage_slugs(rows) == [GIRO_STAGE]


def test_seeded_stage_is_not_flagged():
    rows = [{"race_slug": GIRO_STAGE, "profile_icon": "p2"}]
    assert scoring._unseeded_stage_slugs(rows) == []


def test_one_non_null_row_seeds_the_whole_stage():
    # Profile is a stage-level attribute; one populated row means it was imported.
    rows = [
        {"race_slug": GIRO_STAGE, "profile_icon": None},
        {"race_slug": GIRO_STAGE, "profile_icon": "p3"},
    ]
    assert scoring._unseeded_stage_slugs(rows) == []


def test_gc_and_classification_finals_are_excluded():
    rows = [
        {"race_slug": GIRO_GC, "profile_icon": None},
        {"race_slug": GIRO_POINTS, "profile_icon": None},
    ]
    assert scoring._unseeded_stage_slugs(rows) == []


def test_one_day_race_is_excluded():
    rows = [{"race_slug": ONE_DAY, "profile_icon": None}]
    assert scoring._unseeded_stage_slugs(rows) == []


def test_empty_string_profile_counts_as_unseeded():
    rows = [{"race_slug": GIRO_STAGE, "profile_icon": ""}]
    assert scoring._unseeded_stage_slugs(rows) == [GIRO_STAGE]


# ---------------------------------------------------------------------------
# Integration: calculate_daily_scores preflight
# ---------------------------------------------------------------------------

async def test_scoring_raises_on_unseeded_squad_stage():
    sb = make_supabase(
        # 1. race_results — squad stage with NULL profile (not imported)
        [{"rider_id": "r1", "race_slug": GIRO_STAGE, "pcs_points": 100,
          "race_date": "2026-05-11", "is_itt": False, "profile_icon": None}],
    )
    with pytest.raises(ValueError, match="Stage profiles not imported"):
        await scoring.calculate_daily_scores(sb, race_slugs=[GIRO_STAGE])


async def test_scoring_does_not_raise_on_gc_final_without_profile():
    # /gc final carries no profile — must not trip the guard. Returns cleanly
    # (no contracts → completed) rather than raising.
    sb = make_supabase(
        [{"rider_id": "r1", "race_slug": GIRO_GC, "pcs_points": 100,
          "race_date": "2026-05-31", "is_itt": False, "profile_icon": None}],
        [],   # prev rider_xp_daily
        [],   # contracts (empty → early completed return)
    )
    result = await scoring.calculate_daily_scores(sb, race_slugs=[GIRO_GC])
    assert result["status"] == "completed"
