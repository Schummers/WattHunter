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
    """compute_level returns correct level for various XP values (8 levels, L7=2600 L8=5000)."""
    from scoring import compute_level

    assert compute_level(0) == 1
    assert compute_level(24) == 1
    assert compute_level(25) == 2
    assert compute_level(149) == 2
    assert compute_level(150) == 3
    assert compute_level(349) == 3
    assert compute_level(350) == 4
    assert compute_level(600) == 5
    assert compute_level(1200) == 6
    assert compute_level(2599) == 6   # below new L7
    assert compute_level(2600) == 7   # new L7
    assert compute_level(4999) == 7   # below new L8
    assert compute_level(5000) == 8   # new L8
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


# ---------------------------------------------------------------------------
# XP traceability columns (role_mult, classif_bonus)
# ---------------------------------------------------------------------------


async def test_upsert_contains_traceability_columns():
    """rider_xp_daily upsert includes role_mult and classif_bonus."""
    import scoring
    importlib.reload(scoring)

    sb = make_supabase(
        # 1. race_results
        [{"rider_id": RIDER_ID, "race_slug": "race/test/2026", "pcs_points": 20, "race_date": "2026-03-15"}],
        # 2. contracts
        [{"id": CONTRACT_ID, "team_id": TEAM_ID, "rider_id": RIDER_ID,
          "purchased_at": "2026-01-01T00:00:00Z", "release_date": None,
          "riders": {"specialty": "GC", "nationality": "BE", "real_team": "Soudal", "birthdate": "1998-01-01"}}],
        # 3. team_strategies (none)
        [],
        # 4. rider_xp_daily upsert
        [],
        # 5. teams select
        {"id": TEAM_ID, "cumulative_xp": 0, "level": 1, "league_id": "lg-1"},
        # 6. teams update
        [],
        # 7. league teams for snapshot
        [{"id": TEAM_ID, "cumulative_xp": 20}],
        # 8. team_ranking_daily upsert
        [],
    )

    result = await scoring.calculate_daily_scores(sb)

    assert result["status"] == "completed"
    payload = sb._last_upsert_payload("rider_xp_daily")
    assert payload["role_mult"] == 1.0
    assert payload["classif_bonus"] == 0.0
    assert payload["raw_pcs_points"] == 20
    assert payload["strategy_bonus"] == 0.0


# ---------------------------------------------------------------------------
# _classif_bonus — universal base rate
# ---------------------------------------------------------------------------


def test_classif_bonus_matching_role_unchanged():
    """Role-matched rider earns base × 2.0 (V2, Spec A A2)."""
    from scoring import _classif_bonus

    rows = [{"classification_type": "gc", "rank": 3}]
    # gc_leader + GC rank 3: (10+1-3) × 2.0 = 16.0
    assert _classif_bonus(rows, "gc_leader") == 16.0

    rows_pts = [{"classification_type": "points", "rank": 1}]
    # sprinter + Points rank 1: (5+1-1) × 2.0 = 10.0
    assert _classif_bonus(rows_pts, "sprinter") == 10.0

    rows_kom = [{"classification_type": "kom", "rank": 2}]
    # climber + KOM rank 2: (3+1-2) × 2.0 = 4.0
    assert _classif_bonus(rows_kom, "climber") == 4.0


def test_classif_bonus_non_matching_role_earns_zero():
    """V2: non-matching squad roles (domestique/stage_hunter/tt_specialist) earn 0 (Spec A A2)."""
    from scoring import _classif_bonus

    rows = [{"classification_type": "gc", "rank": 3}]
    # No match → 0 for all non-matching roles
    assert _classif_bonus(rows, "domestique") == 0.0
    assert _classif_bonus(rows, "stage_hunter") == 0.0
    assert _classif_bonus(rows, "tt_specialist") == 0.0

    # Rank outside top → 0 (also no match)
    rows_out = [{"classification_type": "gc", "rank": 11}]
    assert _classif_bonus(rows_out, "domestique") == 0.0


def test_classif_bonus_multiple_classifs_summed():
    """Rider in multiple classifications earns sum; V2 role gives 2.0× only on its own classif."""
    from scoring import _classif_bonus

    rows = [
        {"classification_type": "gc", "rank": 5},     # base = (10+1-5) = 6
        {"classification_type": "points", "rank": 2},  # base = (5+1-2)  = 4
    ]
    # domestique: no match → 0.0
    assert _classif_bonus(rows, "domestique") == 0.0
    # sprinter: gc=0 (non-match) + points=4×2.0 (match) = 8.0
    assert _classif_bonus(rows, "sprinter") == 8.0
    # gc_leader: gc=6×2.0 (match) + points=0 (non-match) = 12.0
    assert _classif_bonus(rows, "gc_leader") == 12.0


# --- Spec A P2 scoring helpers ------------------------------------------------

def test_role_multiplier_gc_final_is_unboosted():
    """Any role on a /gc slug → ×1.0 (GC final raw PCS points, Spec A A2)."""
    from scoring import _role_multiplier
    assert _role_multiplier("gc_leader", "race/giro-d-italia/2026/gc", False) == 1.0
    assert _role_multiplier("climber",   "race/giro-d-italia/2026/gc", False) == 1.0


def test_role_multiplier_gc_leader_and_climber_on_stage():
    from scoring import _role_multiplier
    assert _role_multiplier("gc_leader", "race/giro-d-italia/2026/stage-4", False) == 1.5
    assert _role_multiplier("climber",   "race/giro-d-italia/2026/stage-4", False) == 1.5


def test_role_multiplier_tt_specialist_itt_only():
    from scoring import _role_multiplier
    s = "race/giro-d-italia/2026/stage-7"
    assert _role_multiplier("tt_specialist", s, True) == 2.0
    assert _role_multiplier("tt_specialist", s, False) == 1.0


def test_role_multiplier_sprinter_gated_by_profile():
    """Sprinter ×1.5 only on p1/p2/p3; ×1.0 on p4/p5/unknown (Spec A A4)."""
    from scoring import _role_multiplier
    s = "race/giro-d-italia/2026/stage-4"
    assert _role_multiplier("sprinter", s, False, profile_icon="p1") == 1.5
    assert _role_multiplier("sprinter", s, False, profile_icon="p3") == 1.5
    assert _role_multiplier("sprinter", s, False, profile_icon="p4") == 1.0
    assert _role_multiplier("sprinter", s, False, profile_icon="p5") == 1.0
    assert _role_multiplier("sprinter", s, False, profile_icon=None) == 1.0


def test_role_multiplier_stage_hunter_gated_by_breakaway():
    """Stage hunter ×1.5 only when in the breakaway (≥30 km), else ×1.0 (Spec A A3)."""
    from scoring import _role_multiplier
    s = "race/giro-d-italia/2026/stage-4"
    assert _role_multiplier("stage_hunter", s, False, breakaway_kms=120.0) == 1.5
    assert _role_multiplier("stage_hunter", s, False, breakaway_kms=30.0) == 1.5
    assert _role_multiplier("stage_hunter", s, False, breakaway_kms=29.9) == 1.0
    assert _role_multiplier("stage_hunter", s, False, breakaway_kms=None) == 1.0


def test_breakaway_distance_bonus():
    """+1 XP per 10 km in the break, no cap; 0 below the 30 km threshold (Spec A A3)."""
    from scoring import _breakaway_distance_bonus
    assert _breakaway_distance_bonus(150.0) == 15.0
    assert _breakaway_distance_bonus(255.0) == 25.0   # no cap; floor
    assert _breakaway_distance_bonus(30.0) == 3.0
    assert _breakaway_distance_bonus(29.0) == 0.0      # below threshold → not in break
    assert _breakaway_distance_bonus(None) == 0.0


def test_classif_bonus_v2_role_matched_only():
    """Only the matching classification earns a bonus; matched daily mult is ×2 (Spec A A2)."""
    from scoring import _classif_bonus
    # gc_leader, rank 3 GC: base (10+1-3)=8 × 2.0 = 16
    assert _classif_bonus([{"classification_type": "gc", "rank": 3}], "gc_leader") == 16.0
    # sprinter, rank 2 points: base (5+1-2)=4 × 2.0 = 8
    assert _classif_bonus([{"classification_type": "points", "rank": 2}], "sprinter") == 8.0
    # climber, rank 1 kom: base (3+1-1)=3 × 2.0 = 6
    assert _classif_bonus([{"classification_type": "kom", "rank": 1}], "climber") == 6.0
    # gc_leader, rank 1 youth: base (5+1-1)=5 × 1.5 = 7.5
    assert _classif_bonus([{"classification_type": "youth", "rank": 1}], "gc_leader") == 7.5
    # gc_leader also matches youth AND gc together
    assert _classif_bonus(
        [{"classification_type": "gc", "rank": 1}, {"classification_type": "youth", "rank": 1}],
        "gc_leader",
    ) == 20.0 + 7.5
    # non-matching roles → 0
    assert _classif_bonus([{"classification_type": "gc", "rank": 1}], "domestique") == 0.0
    assert _classif_bonus([{"classification_type": "points", "rank": 1}], "stage_hunter") == 0.0
    assert _classif_bonus([{"classification_type": "gc", "rank": 1}], "tt_specialist") == 0.0
    # sprinter in GC (non-matched ctype for sprinter) → 0
    assert _classif_bonus([{"classification_type": "gc", "rank": 1}], "sprinter") == 0.0
    # out of top-N → 0
    assert _classif_bonus([{"classification_type": "gc", "rank": 11}], "gc_leader") == 0.0
