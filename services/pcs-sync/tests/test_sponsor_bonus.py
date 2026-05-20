"""Tests for sponsor_bonus.py — TDD approach.

Tests:
- classify_result_type — all 5 types + edge cases
- expand_sponsor_nationality — single, compound, None
- calculate_bonus T1-T4 — thresholds, multipliers, stacking
- calculate_bonus T5-T6 — explicit amounts, no nationality multiplier
- process_race_bonuses — async integration (mock Supabase)
"""
from __future__ import annotations

import sys
import os
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
sys.path.insert(0, os.path.dirname(__file__))

from helpers import make_supabase


# ---------------------------------------------------------------------------
# Shared sponsor fixtures
# ---------------------------------------------------------------------------

# T1 — Lotto (no nationality)
LOTTO = {
    "id": "sp-lotto",
    "name": "Lotto",
    "tier": 1,
    "nationality": None,
    "has_explicit_prestige": False,
    "bonus_gc": 3000,
    "bonus_one_day": 3000,
    "bonus_stage": 2000,
    "gc_threshold": 25,
    "one_day_threshold": 25,
    "stage_threshold": 10,
    "bonus_monument": None,
    "bonus_grand_tour": None,
    "monument_threshold": None,
    "grand_tour_threshold": None,
}

# T3 — Alpecin (BE/NL, one-day oriented)
ALPECIN = {
    "id": "sp-alpecin",
    "name": "Alpecin",
    "tier": 3,
    "nationality": "BE/NL",
    "has_explicit_prestige": False,
    "bonus_gc": 5000,
    "bonus_one_day": 10000,
    "bonus_stage": 5000,
    "gc_threshold": 15,
    "one_day_threshold": 15,
    "stage_threshold": 5,
    "bonus_monument": None,
    "bonus_grand_tour": None,
    "monument_threshold": None,
    "grand_tour_threshold": None,
}

# T5 — Visma ("le pari prestige")
VISMA = {
    "id": "sp-visma",
    "name": "Visma",
    "tier": 5,
    "nationality": None,
    "has_explicit_prestige": True,
    "bonus_gc": 25000,
    "bonus_one_day": 25000,
    "bonus_stage": 15000,
    "gc_threshold": 5,
    "one_day_threshold": 5,
    "stage_threshold": 1,
    "bonus_monument": 75000,
    "bonus_grand_tour": 75000,
    "monument_threshold": 3,
    "grand_tour_threshold": 3,
}

# T6 — UAE Group
UAE = {
    "id": "sp-uae",
    "name": "UAE Group",
    "tier": 6,
    "nationality": None,
    "has_explicit_prestige": True,
    "bonus_gc": 50000,
    "bonus_one_day": 50000,
    "bonus_stage": 25000,
    "gc_threshold": 1,
    "one_day_threshold": 1,
    "stage_threshold": 1,
    "bonus_monument": 100000,
    "bonus_grand_tour": 100000,
    "monument_threshold": 3,
    "grand_tour_threshold": 3,
}


# ===========================================================================
# Part A: classify_result_type
# ===========================================================================

class TestClassifyResultType:
    def test_stage_wins_over_race_class(self):
        """Stage result → 'stage' regardless of race_class."""
        from sponsor_bonus import classify_result_type
        assert classify_result_type("grand_tour", "stage-3", "race/tour-de-france/2026/stage-3") == "stage"
        assert classify_result_type("monument", "stage-1", "race/paris-roubaix/2026/stage-1") == "stage"

    def test_stage_not_none_means_stage(self):
        """Any non-None stage value → 'stage'."""
        from sponsor_bonus import classify_result_type
        assert classify_result_type("stage_race", "prologue", "race/paris-nice/2026/prologue") == "stage"

    def test_monument_no_stage(self):
        """race_class 'monument', no stage → 'monument'."""
        from sponsor_bonus import classify_result_type
        assert classify_result_type("monument", None, "race/paris-roubaix/2026") == "monument"

    def test_grand_tour_gc(self):
        """race_class 'grand_tour', no stage → 'grand_tour'."""
        from sponsor_bonus import classify_result_type
        assert classify_result_type("grand_tour", None, "race/tour-de-france/2026") == "grand_tour"

    def test_stage_race_gc(self):
        """race_class 'stage_race', no stage → 'gc'."""
        from sponsor_bonus import classify_result_type
        assert classify_result_type("stage_race", None, "race/paris-nice/2026") == "gc"

    def test_classic_one_day(self):
        """race_class 'classic', no stage → 'one_day'."""
        from sponsor_bonus import classify_result_type
        assert classify_result_type("classic", None, "race/amstel-gold/2026") == "one_day"

    def test_one_day_race_class(self):
        """race_class 'one_day', no stage → 'one_day'."""
        from sponsor_bonus import classify_result_type
        assert classify_result_type("one_day", None, "race/strade-bianche/2026") == "one_day"

    def test_none_race_class(self):
        """race_class None → 'one_day' (fallback)."""
        from sponsor_bonus import classify_result_type
        assert classify_result_type(None, None, "race/unclassified/2026") == "one_day"

    def test_unrecognised_class_fallback(self):
        """Unknown race_class → 'one_day' (safe fallback)."""
        from sponsor_bonus import classify_result_type
        assert classify_result_type("unknown_type", None, "race/foo/2026") == "one_day"


# ===========================================================================
# Part B: expand_sponsor_nationality
# ===========================================================================

class TestExpandSponsorNationality:
    def test_single_code(self):
        from sponsor_bonus import expand_sponsor_nationality
        assert expand_sponsor_nationality("FR") == ["FR"]

    def test_compound_code(self):
        from sponsor_bonus import expand_sponsor_nationality
        assert expand_sponsor_nationality("BE/NL") == ["BE", "NL"]

    def test_three_part_compound(self):
        from sponsor_bonus import expand_sponsor_nationality
        assert expand_sponsor_nationality("US/IT") == ["US", "IT"]

    def test_none_returns_empty(self):
        from sponsor_bonus import expand_sponsor_nationality
        assert expand_sponsor_nationality(None) == []

    def test_empty_string_returns_empty(self):
        from sponsor_bonus import expand_sponsor_nationality
        assert expand_sponsor_nationality("") == []


# ===========================================================================
# Part C: calculate_bonus T1-T4
# ===========================================================================

class TestCalculateBonusT1T4:
    def test_qualifying_result_lotto(self):
        """Lotto GC top 25: rank 10 qualifies, base 3K, multiplier 1.0."""
        from sponsor_bonus import calculate_bonus
        base, mult, final = calculate_bonus(LOTTO, "gc", 10, "FR", "race/paris-nice/2026")
        assert base == 3000
        assert mult == 1.0
        assert final == 3000

    def test_non_qualifying_rank_exceeds_threshold(self):
        """Rank 30 > gc_threshold 25 → no bonus."""
        from sponsor_bonus import calculate_bonus
        base, mult, final = calculate_bonus(LOTTO, "gc", 30, "FR", "race/paris-nice/2026")
        assert (base, mult, final) == (0, 0.0, 0)

    def test_rank_exactly_at_threshold(self):
        """Rank == threshold (boundary) → qualifies."""
        from sponsor_bonus import calculate_bonus
        base, mult, final = calculate_bonus(LOTTO, "gc", 25, "FR", "race/paris-nice/2026")
        assert base == 3000
        assert final == 3000

    def test_grand_tour_gc_multiplier_x1(self):
        """Grand tour GC → flat multiplier 1.0 (no x2 prestige for T1-T4)."""
        from sponsor_bonus import calculate_bonus
        base, mult, final = calculate_bonus(LOTTO, "grand_tour", 10, "FR", "race/tour-de-france/2026")
        assert base == 3000
        assert mult == 1.0
        assert final == 3000

    def test_monument_multiplier_x1(self):
        """Monument → flat multiplier 1.0 (no x2 prestige for T1-T4)."""
        from sponsor_bonus import calculate_bonus
        base, mult, final = calculate_bonus(LOTTO, "monument", 5, "FR", "race/paris-roubaix/2026")
        assert base == 3000
        assert mult == 1.0
        assert final == 3000

    def test_grand_tour_stage_multiplier_x1(self):
        """Stage in a grand tour slug → flat multiplier 1.0 (no x2 for T1-T4)."""
        from sponsor_bonus import calculate_bonus
        base, mult, final = calculate_bonus(
            LOTTO, "stage", 3, "FR", "race/giro-d-italia/2026/stage-5"
        )
        assert base == 2000
        assert mult == 1.0
        assert final == 2000

    def test_stage_non_grand_tour_no_x2(self):
        """Stage in a regular stage race → no ×2 multiplier."""
        from sponsor_bonus import calculate_bonus
        base, mult, final = calculate_bonus(
            LOTTO, "stage", 3, "FR", "race/paris-nice/2026/stage-2"
        )
        assert base == 2000
        assert mult == 1.0
        assert final == 2000

    def test_nationality_match_x125(self):
        """Rider nationality matches sponsor → ×1.25."""
        from sponsor_bonus import calculate_bonus
        # Alpecin is BE/NL — rider is BE
        base, mult, final = calculate_bonus(ALPECIN, "one_day", 5, "BE", "race/amstel-gold/2026")
        assert base == 10000
        assert mult == 1.25
        assert final == 12500

    def test_nationality_compound_match(self):
        """Rider matches one of compound nationality codes."""
        from sponsor_bonus import calculate_bonus
        base, mult, final = calculate_bonus(ALPECIN, "one_day", 5, "NL", "race/amstel-gold/2026")
        assert mult == 1.25

    def test_nationality_no_match_no_x125(self):
        """Rider nationality doesn't match → no ×1.25."""
        from sponsor_bonus import calculate_bonus
        base, mult, final = calculate_bonus(ALPECIN, "one_day", 5, "FR", "race/amstel-gold/2026")
        assert mult == 1.0

    def test_stacked_grand_tour_plus_nationality(self):
        """Grand tour GC + nationality match → ×1.25 only (no x2 prestige for T1-T4)."""
        from sponsor_bonus import calculate_bonus
        # Alpecin BE/NL rider from BE wins Tour de France GC
        base, mult, final = calculate_bonus(ALPECIN, "grand_tour", 3, "BE", "race/tour-de-france/2026")
        assert base == 5000
        assert mult == 1.25
        assert final == 6250

    def test_no_nationality_multiplier_for_t1_t2(self):
        """Lotto (T1) has no nationality → ×1.25 never applies even if rider matches."""
        from sponsor_bonus import calculate_bonus
        # Lotto has nationality=None — rider from any country should not get ×1.25
        base, mult, final = calculate_bonus(LOTTO, "gc", 1, "BE", "race/paris-nice/2026")
        assert mult == 1.0

    def test_vuelta_stage_multiplier_x1(self):
        """Stage in vuelta slug → flat ×1.0 multiplier (no x2 for T1-T4)."""
        from sponsor_bonus import calculate_bonus
        base, mult, final = calculate_bonus(
            LOTTO, "stage", 1, "ES", "race/vuelta-a-espana/2026/stage-10"
        )
        assert mult == 1.0


# ===========================================================================
# Part C: calculate_bonus T5-T6
# ===========================================================================

class TestCalculateBonusT5T6:
    def test_monument_explicit_amount_visma(self):
        """T5 Visma monument podium (rank ≤ 3) → explicit 75K (not ×2 of one_day 25K)."""
        from sponsor_bonus import calculate_bonus
        base, mult, final = calculate_bonus(VISMA, "monument", 2, "NL", "race/paris-roubaix/2026")
        assert base == 75000
        assert mult == 1.0
        assert final == 75000

    def test_grand_tour_explicit_amount_visma(self):
        """T5 Visma grand tour podium → explicit 75K."""
        from sponsor_bonus import calculate_bonus
        base, mult, final = calculate_bonus(VISMA, "grand_tour", 1, "NL", "race/tour-de-france/2026")
        assert base == 75000
        assert mult == 1.0
        assert final == 75000

    def test_t5_gc_non_prestige(self):
        """T5 Visma stage race GC top 5 → 25K."""
        from sponsor_bonus import calculate_bonus
        base, mult, final = calculate_bonus(VISMA, "gc", 4, "NL", "race/paris-nice/2026")
        assert base == 25000
        assert final == 25000

    def test_t5_stage_win_threshold_1(self):
        """T5 stage win (rank=1, threshold=1) → qualifies."""
        from sponsor_bonus import calculate_bonus
        base, mult, final = calculate_bonus(VISMA, "stage", 1, "NL", "race/paris-nice/2026/stage-3")
        assert base == 15000
        assert final == 15000

    def test_t5_stage_second_no_bonus(self):
        """T5 stage 2nd (rank=2 > threshold=1) → no bonus."""
        from sponsor_bonus import calculate_bonus
        base, mult, final = calculate_bonus(VISMA, "stage", 2, "NL", "race/paris-nice/2026/stage-3")
        assert (base, mult, final) == (0, 0.0, 0)

    def test_t5_grand_tour_stage_x2(self):
        """T5 stage win in grand tour → ×2 (15K → 30K)."""
        from sponsor_bonus import calculate_bonus
        base, mult, final = calculate_bonus(
            VISMA, "stage", 1, "NL", "race/tour-de-france/2026/stage-3"
        )
        assert base == 15000
        assert mult == 2.0
        assert final == 30000

    def test_t5_no_nationality_multiplier(self):
        """T5 Visma: no nationality multiplier even if rider matches (T5-T6 rule)."""
        from sponsor_bonus import calculate_bonus
        # Hypothetical: Visma with nationality would still not apply ×1.25
        visma_with_nat = {**VISMA, "nationality": "NL"}
        base, mult, final = calculate_bonus(visma_with_nat, "gc", 1, "NL", "race/paris-nice/2026")
        assert mult == 1.0

    def test_t6_uae_monument_podium(self):
        """T6 UAE monument podium → explicit 100K."""
        from sponsor_bonus import calculate_bonus
        base, mult, final = calculate_bonus(UAE, "monument", 3, "FR", "race/paris-roubaix/2026")
        assert base == 100000
        assert final == 100000

    def test_t6_uae_monument_rank_too_low(self):
        """T6 UAE monument rank 4 > threshold 3 → no bonus."""
        from sponsor_bonus import calculate_bonus
        base, mult, final = calculate_bonus(UAE, "monument", 4, "FR", "race/paris-roubaix/2026")
        assert (base, mult, final) == (0, 0.0, 0)

    def test_t6_uae_gc_victory_only(self):
        """T6 UAE GC: only victory (rank=1, threshold=1) qualifies."""
        from sponsor_bonus import calculate_bonus
        base, mult, final = calculate_bonus(UAE, "gc", 1, "FR", "race/paris-nice/2026")
        assert base == 50000
        assert final == 50000

    def test_t6_uae_gc_rank2_no_bonus(self):
        """T6 UAE GC: rank 2 > threshold 1 → no bonus."""
        from sponsor_bonus import calculate_bonus
        base, mult, final = calculate_bonus(UAE, "gc", 2, "FR", "race/paris-nice/2026")
        assert (base, mult, final) == (0, 0.0, 0)


# ===========================================================================
# Part D: process_race_bonuses (async)
# ===========================================================================

TEAM_ID = "aaaa-0000-0000-0001"
RIDER_ID = "bbbb-0000-0000-0001"


@pytest.mark.asyncio
async def test_process_race_bonuses_qualifying_result():
    """Qualifying result creates a sponsor bonus entry and credits treasury via RPC."""
    from sponsor_bonus import process_race_bonuses

    # Lotto sponsor data as stored in DB
    lotto_row = {**LOTTO, "id": "sp-lotto"}

    sb = make_supabase(
        # 1. race_results fetch
        [{
            "rider_id": RIDER_ID,
            "race_slug": "race/paris-nice/2026",
            "race_class": "stage_race",
            "stage": None,
            "rank": 5,
            "pcs_points": 40,
            "race_date": "2026-03-09",
        }],
        # 2. contracts with rider nationality join
        [{
            "team_id": TEAM_ID,
            "rider_id": RIDER_ID,
            "status": "active",
            "riders": {"nationality": "BE"},
        }],
        # 3. team_sponsors with full sponsor data
        [{
            "team_id": TEAM_ID,
            "sponsor_id": "sp-lotto",
            "sponsors": lotto_row,
        }],
        # 4. sponsor_bonuses batch upsert
        [],
    )

    result = await process_race_bonuses(sb, ["race/paris-nice/2026"])

    assert result["status"] == "completed"
    assert result["bonuses_created"] == 1
    assert result["errors"] == []

    # RPC was called once with the correct team and bonus entries
    sb.rpc.assert_called_once_with("credit_sponsor_bonuses", {
        "p_team_id": TEAM_ID,
        "p_bonuses": [{
            "amount": 3000,
            "rider_id": RIDER_ID,
            "description": "Sponsor bonus: gc rank 5 in race/paris-nice/2026 (×1.0)",
        }],
    })


@pytest.mark.asyncio
async def test_process_race_bonuses_rpc_failure_captured():
    """RPC failure for treasury credit is captured in errors, not raised."""
    from sponsor_bonus import process_race_bonuses

    lotto_row = {**LOTTO, "id": "sp-lotto"}

    sb = make_supabase(
        # 1. race_results fetch
        [{
            "rider_id": RIDER_ID,
            "race_slug": "race/paris-nice/2026",
            "race_class": "stage_race",
            "stage": None,
            "rank": 5,
            "pcs_points": 40,
            "race_date": "2026-03-09",
        }],
        # 2. contracts
        [{
            "team_id": TEAM_ID,
            "rider_id": RIDER_ID,
            "status": "active",
            "riders": {"nationality": "FR"},
        }],
        # 3. team_sponsors
        [{
            "team_id": TEAM_ID,
            "sponsor_id": "sp-lotto",
            "sponsors": lotto_row,
        }],
        # 4. sponsor_bonuses batch upsert
        [],
    )

    # Make the RPC raise an exception
    sb.rpc.return_value.execute.side_effect = Exception("DB connection lost")

    result = await process_race_bonuses(sb, ["race/paris-nice/2026"])

    assert result["status"] == "completed"
    assert result["bonuses_created"] == 1
    assert any("rpc credit_sponsor_bonuses" in e for e in result["errors"])


@pytest.mark.asyncio
async def test_process_race_bonuses_non_qualifying_result():
    """Non-qualifying rank creates no bonus."""
    from sponsor_bonus import process_race_bonuses

    lotto_row = {**LOTTO, "id": "sp-lotto"}

    sb = make_supabase(
        # 1. race_results — rank 30 > gc_threshold 25
        [{
            "rider_id": RIDER_ID,
            "race_slug": "race/paris-nice/2026",
            "race_class": "stage_race",
            "stage": None,
            "rank": 30,
            "pcs_points": 5,
            "race_date": "2026-03-09",
        }],
        # 2. contracts
        [{
            "team_id": TEAM_ID,
            "rider_id": RIDER_ID,
            "status": "active",
            "riders": {"nationality": "FR"},
        }],
        # 3. team_sponsors
        [{
            "team_id": TEAM_ID,
            "sponsor_id": "sp-lotto",
            "sponsors": lotto_row,
        }],
    )

    result = await process_race_bonuses(sb, ["race/paris-nice/2026"])

    assert result["status"] == "completed"
    assert result["bonuses_created"] == 0
    assert result["errors"] == []


@pytest.mark.asyncio
async def test_process_race_bonuses_no_results():
    """Empty race_results → completed with 0 bonuses."""
    from sponsor_bonus import process_race_bonuses

    sb = make_supabase(
        # 1. race_results — empty
        [],
    )

    result = await process_race_bonuses(sb, ["race/nonexistent/2026"])

    assert result["status"] == "completed"
    assert result["bonuses_created"] == 0


@pytest.mark.asyncio
async def test_process_race_bonuses_no_active_contracts():
    """Race results but no active contracts → 0 bonuses."""
    from sponsor_bonus import process_race_bonuses

    sb = make_supabase(
        # 1. race_results — has results
        [{
            "rider_id": RIDER_ID,
            "race_slug": "race/paris-nice/2026",
            "race_class": "stage_race",
            "stage": None,
            "rank": 5,
            "pcs_points": 40,
            "race_date": "2026-03-09",
        }],
        # 2. contracts — empty
        [],
    )

    result = await process_race_bonuses(sb, ["race/paris-nice/2026"])

    assert result["status"] == "completed"
    assert result["bonuses_created"] == 0
