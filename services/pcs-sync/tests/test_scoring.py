"""Tests for scoring.py — calculate_daily_scores with mocked Supabase.

All Supabase I/O is replaced by in-memory mocks (make_supabase / make_chain
from conftest).  No real DB or network calls are made.
"""
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
        [{"rider_id": RIDER_ID, "race_slug": "race/test/2026", "pcs_points": 50}],  # race_results
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
    import scoring
    importlib.reload(scoring)

    sb = make_supabase(
        # 1. race_results
        [{"rider_id": RIDER_ID, "race_slug": "race/test/2026", "pcs_points": 20, "race_date": "2026-03-15"}],
        # 2. contracts (with riders join for strategy matching)
        [{"id": CONTRACT_ID, "team_id": TEAM_ID, "rider_id": RIDER_ID,
          "purchased_at": "2026-01-01T00:00:00Z", "release_date": None,
          "riders": {"specialty": "GC", "nationality": "BE", "real_team": "Soudal", "birthdate": "1998-01-01"}}],
        # 3. team_strategies (none active)
        [],
        # 4. rider_xp_daily upsert (result unused)
        [],
        # 5. teams select — current cumulative_xp + level + league_id
        {"id": TEAM_ID, "cumulative_xp": 0, "level": 1, "league_id": "lg-1"},
        # 6. teams update (result unused)
        [],
        # 7. league teams for snapshot
        [{"id": TEAM_ID, "cumulative_xp": 20}],
        # 8. team_ranking_daily upsert
        [],
    )

    result = await scoring.calculate_daily_scores(sb)

    assert result["status"] == "completed"
    assert result["teams_processed"] == 1
    assert result["errors"] == []


async def test_nominal_processing_with_strategy_bonus():
    """Team with a matching strategy bonus → teams_processed=1, no errors."""
    import scoring
    importlib.reload(scoring)

    sb = make_supabase(
        # 1. race_results
        [{"rider_id": RIDER_ID, "race_slug": "race/test/2026", "pcs_points": 10, "race_date": "2026-03-15"}],
        # 2. contracts (rider is a GC specialist)
        [{"id": CONTRACT_ID, "team_id": TEAM_ID, "rider_id": RIDER_ID,
          "purchased_at": "2026-01-01T00:00:00Z", "release_date": None,
          "riders": {"specialty": "GC", "nationality": "BE", "real_team": "Soudal", "birthdate": "1998-01-01"}}],
        # 3. team_strategies — specialist strategy matching GC
        [{"team_id": TEAM_ID, "config": {"specialty": "GC"},
          "strategies": {"slug": "specialist", "xp_bonus": 0.1}}],
        # 4. rider_xp_daily upsert
        [],
        # 5. teams select
        {"id": TEAM_ID, "cumulative_xp": 0, "level": 1, "league_id": "lg-1"},
        # 6. teams update
        [],
        # 7. league teams for snapshot
        [{"id": TEAM_ID, "cumulative_xp": 11}],
        # 8. team_ranking_daily upsert
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


# ---------------------------------------------------------------------------
# Level-up (Task 3)
# ---------------------------------------------------------------------------


def test_compute_level():
    """compute_level returns correct level for various XP values (8 levels)."""
    from scoring import compute_level

    assert compute_level(0) == 1
    assert compute_level(24) == 1
    assert compute_level(25) == 2
    assert compute_level(149) == 2
    assert compute_level(150) == 3
    assert compute_level(349) == 3
    assert compute_level(350) == 4
    assert compute_level(2000) == 8
    assert compute_level(99999) == 8


# ---------------------------------------------------------------------------
# Per-rider strategy matching (Task 2)
# ---------------------------------------------------------------------------


def test_rider_matches_specialist():
    """specialist strategy matches when rider specialty == config specialty."""
    from scoring import _rider_matches_strategy

    assert _rider_matches_strategy("specialist", {"specialty": "GC"}, {"specialty": "GC"})
    assert _rider_matches_strategy("specialist", {"specialty": "gc"}, {"specialty": "GC"})
    assert not _rider_matches_strategy("specialist", {"specialty": "Sprint"}, {"specialty": "GC"})


def test_rider_matches_national_pride():
    """national_pride matches when nationality matches."""
    from scoring import _rider_matches_strategy

    assert _rider_matches_strategy("national_pride", {"nationality": "BE"}, {"nationality": "BE"})
    assert not _rider_matches_strategy("national_pride", {"nationality": "FR"}, {"nationality": "BE"})


def test_rider_matches_young_blood():
    """young_blood matches when rider age <= max_age."""
    from scoring import _rider_matches_strategy

    # Born in 2001, today is 2026 → age = 25
    assert _rider_matches_strategy("young_blood", {"max_age": 25}, {"birthdate": "2001-06-15"})
    assert not _rider_matches_strategy("young_blood", {"max_age": 24}, {"birthdate": "2001-01-01"})
    assert not _rider_matches_strategy("young_blood", {"max_age": 25}, {"birthdate": None})


# ---------------------------------------------------------------------------
# Contract-date boundary tests
# ---------------------------------------------------------------------------


async def test_race_before_contract_is_skipped():
    """Race before purchased_at → no XP, teams_processed=0."""
    import scoring
    importlib.reload(scoring)

    sb = make_supabase(
        # 1. race_results — race on March 5
        [{"rider_id": RIDER_ID, "race_slug": "race/strade/2026", "pcs_points": 30, "race_date": "2026-03-05"}],
        # 2. rider_xp_daily pre-fetch (idempotency) — empty on first run
        [],
        # 3. contracts — purchased on March 10 (AFTER the race)
        [{"id": CONTRACT_ID, "team_id": TEAM_ID, "rider_id": RIDER_ID,
          "purchased_at": "2026-03-10T00:00:00Z", "release_date": None,
          "riders": {"specialty": "GC", "nationality": "BE", "real_team": "Soudal", "birthdate": "1998-01-01"}}],
        # 4. team_strategies
        [],
    )

    result = await scoring.calculate_daily_scores(sb, race_slugs=["race/strade/2026"])

    assert result["status"] == "completed"
    # No XP should be created — race was before contract
    assert result["teams_processed"] == 0
    assert result["errors"] == []


async def test_race_after_release_is_skipped():
    """Race after release_date → no XP, teams_processed=0."""
    import scoring
    importlib.reload(scoring)

    sb = make_supabase(
        # 1. race_results — race on March 15
        [{"rider_id": RIDER_ID, "race_slug": "race/tirreno/2026/stage-5", "pcs_points": 20, "race_date": "2026-03-15"}],
        # 2. rider_xp_daily pre-fetch (idempotency) — empty on first run
        [],
        # 3. contracts — released on March 10 (BEFORE the race)
        [{"id": CONTRACT_ID, "team_id": TEAM_ID, "rider_id": RIDER_ID,
          "purchased_at": "2026-01-01T00:00:00Z", "release_date": "2026-03-10",
          "riders": {"specialty": "GC", "nationality": "BE", "real_team": "Soudal", "birthdate": "1998-01-01"}}],
        # 4. team_strategies
        [],
    )

    result = await scoring.calculate_daily_scores(sb, race_slugs=["race/tirreno/2026/stage-5"])

    assert result["status"] == "completed"
    assert result["teams_processed"] == 0
    assert result["errors"] == []


async def test_race_on_purchase_day_is_scored():
    """Race on same day as purchased_at → IS scored (boundary: >=)."""
    import scoring
    importlib.reload(scoring)

    sb = make_supabase(
        # 1. race_results — race on March 5
        [{"rider_id": RIDER_ID, "race_slug": "race/msr/2026", "pcs_points": 15, "race_date": "2026-03-05"}],
        # 2. rider_xp_daily pre-fetch (idempotency) — empty on first run
        [],
        # 3. contracts — purchased later on March 5 (same day, afternoon)
        [{"id": CONTRACT_ID, "team_id": TEAM_ID, "rider_id": RIDER_ID,
          "purchased_at": "2026-03-05T15:00:00Z", "release_date": None,
          "riders": {"specialty": "GC", "nationality": "BE", "real_team": "Soudal", "birthdate": "1998-01-01"}}],
        # 4. team_strategies
        [],
        # 5. rider_xp_daily upsert
        [],
        # 6. teams select
        {"id": TEAM_ID, "cumulative_xp": 0, "level": 1, "league_id": "lg-1"},
        # 7. teams update
        [],
        # 8. league teams for snapshot
        [{"id": TEAM_ID, "cumulative_xp": 15}],
        # 9. team_ranking_daily upsert
        [],
    )

    result = await scoring.calculate_daily_scores(sb, race_slugs=["race/msr/2026"])

    assert result["status"] == "completed"
    assert result["teams_processed"] == 1
    assert result["errors"] == []
