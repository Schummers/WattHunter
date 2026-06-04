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

# T5 — Visma (post-migration values, Spec C unified barème)
VISMA = {
    "id": "sp-visma",
    "name": "Visma",
    "tier": 5,
    "nationality": None,
    "has_explicit_prestige": False,
    "bonus_gc": 10000,
    "bonus_one_day": 10000,
    "bonus_stage": 5000,
    "gc_threshold": 10,
    "one_day_threshold": 10,
    "stage_threshold": 3,
    "bonus_monument": None,
    "bonus_grand_tour": None,
    "monument_threshold": None,
    "grand_tour_threshold": None,
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

    def test_grand_tour_gc_multiplier_x2(self):
        """Grand tour GC → ×2 multiplier (Spec C B-value applies to grand_tour result type)."""
        from sponsor_bonus import calculate_bonus
        base, mult, final = calculate_bonus(LOTTO, "grand_tour", 10, "FR", "race/tour-de-france/2026")
        assert base == 3000
        assert mult == 2.0
        assert final == 6000

    def test_monument_multiplier_x2(self):
        """Monument → ×2 multiplier (Spec C B-value applies to monuments)."""
        from sponsor_bonus import calculate_bonus
        base, mult, final = calculate_bonus(LOTTO, "monument", 5, "FR", "race/paris-roubaix/2026")
        assert base == 3000
        assert mult == 2.0
        assert final == 6000

    def test_grand_tour_stage_multiplier_x2(self):
        """Stage in a grand tour slug → ×2 multiplier (Spec C B-value)."""
        from sponsor_bonus import calculate_bonus
        base, mult, final = calculate_bonus(
            LOTTO, "stage", 3, "FR", "race/giro-d-italia/2026/stage-5"
        )
        assert base == 2000
        assert mult == 2.0
        assert final == 4000

    def test_stage_non_grand_tour_no_x2(self):
        """Stage in a regular stage race → no ×2 multiplier."""
        from sponsor_bonus import calculate_bonus
        base, mult, final = calculate_bonus(
            LOTTO, "stage", 3, "FR", "race/paris-nice/2026/stage-2"
        )
        assert base == 2000
        assert mult == 1.0
        assert final == 2000

    def test_nationality_match_x120(self):
        """Rider nationality matches sponsor → ×1.20 (Spec C changed from 1.25)."""
        from sponsor_bonus import calculate_bonus
        # Alpecin is BE/NL — rider is BE
        base, mult, final = calculate_bonus(ALPECIN, "one_day", 5, "BE", "race/amstel-gold/2026")
        assert base == 10000
        assert mult == 1.2
        assert final == 12000

    def test_nationality_compound_match(self):
        """Rider matches one of compound nationality codes."""
        from sponsor_bonus import calculate_bonus
        base, mult, final = calculate_bonus(ALPECIN, "one_day", 5, "NL", "race/amstel-gold/2026")
        assert mult == 1.2

    def test_nationality_no_match_no_x125(self):
        """Rider nationality doesn't match → no ×1.25."""
        from sponsor_bonus import calculate_bonus
        base, mult, final = calculate_bonus(ALPECIN, "one_day", 5, "FR", "race/amstel-gold/2026")
        assert mult == 1.0

    def test_stacked_grand_tour_plus_nationality(self):
        """Grand tour GC + nationality match → ×2.0 × 1.20 = ×2.4 (Spec C)."""
        from sponsor_bonus import calculate_bonus
        # Alpecin BE/NL rider from BE wins Tour de France GC
        base, mult, final = calculate_bonus(ALPECIN, "grand_tour", 3, "BE", "race/tour-de-france/2026")
        assert base == 5000
        assert abs(mult - 2.4) < 1e-9
        assert final == 12000

    def test_no_nationality_multiplier_for_t1_t2(self):
        """Lotto (T1) has no nationality → ×1.25 never applies even if rider matches."""
        from sponsor_bonus import calculate_bonus
        # Lotto has nationality=None — rider from any country should not get ×1.25
        base, mult, final = calculate_bonus(LOTTO, "gc", 1, "BE", "race/paris-nice/2026")
        assert mult == 1.0

    def test_vuelta_stage_multiplier_x2(self):
        """Stage in vuelta slug → ×2 multiplier (Spec C B-value for GT stages)."""
        from sponsor_bonus import calculate_bonus
        base, mult, final = calculate_bonus(
            LOTTO, "stage", 1, "ES", "race/vuelta-a-espana/2026/stage-10"
        )
        assert mult == 2.0
        assert final == 4000


# ===========================================================================
# Part C: calculate_bonus T5-T6
# ===========================================================================

class TestCalculateBonusT5T6:
    def test_monument_t5_unified_doubled(self):
        """T5 Visma monument (rank ≤ one_day_threshold=10) → bonus_one_day × 2 = 20K (Spec C unified path)."""
        from sponsor_bonus import calculate_bonus
        base, mult, final = calculate_bonus(VISMA, "monument", 2, "NL", "race/paris-roubaix/2026")
        assert base == 10000
        assert mult == 2.0
        assert final == 20000

    def test_grand_tour_t5_unified_doubled(self):
        """T5 Visma grand_tour (rank ≤ gc_threshold=10) → bonus_gc × 2 = 20K (Spec C unified path)."""
        from sponsor_bonus import calculate_bonus
        base, mult, final = calculate_bonus(VISMA, "grand_tour", 1, "NL", "race/tour-de-france/2026")
        assert base == 10000
        assert mult == 2.0
        assert final == 20000

    def test_t5_gc_non_prestige(self):
        """T5 Visma stage race GC top 10 → 10K."""
        from sponsor_bonus import calculate_bonus
        base, mult, final = calculate_bonus(VISMA, "gc", 4, "NL", "race/paris-nice/2026")
        assert base == 10000
        assert final == 10000

    def test_t5_stage_win_threshold_3(self):
        """T5 stage win (rank=1, threshold=3) → qualifies."""
        from sponsor_bonus import calculate_bonus
        base, mult, final = calculate_bonus(VISMA, "stage", 1, "NL", "race/paris-nice/2026/stage-3")
        assert base == 5000
        assert final == 5000

    def test_t5_stage_rank3_qualifies(self):
        """T5 stage rank=3 (at boundary of threshold=3) → qualifies."""
        from sponsor_bonus import calculate_bonus
        base, mult, final = calculate_bonus(VISMA, "stage", 3, "NL", "race/paris-nice/2026/stage-3")
        assert base == 5000
        assert final == 5000

    def test_t5_stage_rank4_no_bonus(self):
        """T5 stage rank=4 (> threshold=3) → no bonus."""
        from sponsor_bonus import calculate_bonus
        base, mult, final = calculate_bonus(VISMA, "stage", 4, "NL", "race/paris-nice/2026/stage-3")
        assert (base, mult, final) == (0, 0.0, 0)

    def test_t5_grand_tour_stage_x2(self):
        """T5 stage win in grand tour → ×2 (5K → 10K)."""
        from sponsor_bonus import calculate_bonus
        base, mult, final = calculate_bonus(
            VISMA, "stage", 1, "NL", "race/tour-de-france/2026/stage-3"
        )
        assert base == 5000
        assert mult == 2.0
        assert final == 10000

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
        # 4. sponsor_bonuses idempotence pre-fetch (none exist yet)
        [],
        # 5. sponsor_goal_completions — no neutralizing goals
        [],
        # 6. sponsor_bonuses batch upsert
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
        # 4. sponsor_bonuses idempotence pre-fetch (none exist yet)
        [],
        # 5. sponsor_goal_completions — no neutralizing goals
        [],
        # 6. sponsor_bonuses batch upsert
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
        # 4. sponsor_bonuses idempotence pre-fetch (unused — bonus never qualifies)
        [],
        # 5. sponsor_goal_completions — no neutralizing goals
        [],
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


@pytest.mark.asyncio
async def test_process_race_bonuses_idempotent_on_rerun():
    """If a sponsor_bonus row already exists for (team, rider, race, result_type),
    the RPC must NOT be called again — prevents duplicate treasury credits.

    Regression test for the 2026-05-20 Giro bug where 5 reruns of the pipeline
    re-credited the same stage-8 win 6 times.
    """
    from sponsor_bonus import process_race_bonuses

    lotto_row = {**LOTTO, "id": "sp-lotto"}

    sb = make_supabase(
        # 1. race_results — qualifying result (Lotto gc threshold 25, rank 5 qualifies)
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
            "riders": {"nationality": "BE"},
        }],
        # 3. team_sponsors
        [{
            "team_id": TEAM_ID,
            "sponsor_id": "sp-lotto",
            "sponsors": lotto_row,
        }],
        # 4. sponsor_bonuses idempotence pre-fetch — ALREADY EXISTS from prior run
        [{
            "team_id": TEAM_ID,
            "rider_id": RIDER_ID,
            "race_slug": "race/paris-nice/2026",
            "result_type": "gc",
        }],
        # 5. sponsor_goal_completions — no neutralizing goals
        [],
        # 6. sponsor_bonuses upsert (still happens — idempotent at DB level)
        [],
    )

    result = await process_race_bonuses(sb, ["race/paris-nice/2026"])

    assert result["status"] == "completed"
    assert result["errors"] == []
    # CRITICAL: the RPC must NOT have been called (no double-credit)
    sb.rpc.assert_not_called()


# ===========================================================================
# No-cumul rule — base bonus suppressed when a one-time goal already paid
# (GAME_RULES.md §17). Neutralization targets come from
# sponsor_goal_completions.neutralized_stage_slugs.
# ===========================================================================

_DECATHLON = {
    "id": "sp-dec", "tier": 4, "nationality": None,
    "bonus_gc": 10000, "gc_threshold": 10,
    "bonus_stage": 5000, "stage_threshold": 3,
    "bonus_one_day": 10000, "one_day_threshold": 10,
    "has_explicit_prestige": False,
}


@pytest.mark.asyncio
async def test_no_cumul_skips_gc_base_bonus_when_goal_completed():
    """A rider who triggered gc_podium must NOT also receive the /gc base bonus."""
    from sponsor_bonus import process_race_bonuses

    sb = make_supabase(
        # 1. race_results — GC final, rank 2 (would normally earn the gc base bonus)
        [{
            "rider_id": RIDER_ID,
            "race_slug": "race/giro-d-italia/2026/gc",
            "race_class": "stage_race",
            "stage": "gc",
            "rank": 2,
            "pcs_points": 200,
            "race_date": "2026-05-30",
        }],
        # 2. contracts
        [{"team_id": TEAM_ID, "rider_id": RIDER_ID, "status": "active",
          "riders": {"nationality": "IT"}}],
        # 3. team_sponsors (T4 Decathlon)
        [{"team_id": TEAM_ID, "sponsor_id": "sp-dec", "sponsors": _DECATHLON}],
        # 4. sponsor_bonuses idempotence pre-fetch — none
        [],
        # 5. sponsor_goal_completions — gc_podium consumed the /gc base bonus
        [{"team_id": TEAM_ID, "rider_id": RIDER_ID,
          "neutralized_stage_slugs": ["race/giro-d-italia/2026/gc"]}],
    )

    result = await process_race_bonuses(sb, ["race/giro-d-italia/2026/gc"])

    assert result["status"] == "completed"
    assert result["bonuses_created"] == 0
    # No treasury credit: the goal already paid.
    sb.rpc.assert_not_called()


@pytest.mark.asyncio
async def test_no_cumul_multistage_keeps_uncounted_stage():
    """win_2_stages neutralizes only the counted stages; a third (uncounted) stage
    win keeps its base bonus."""
    from sponsor_bonus import process_race_bonuses

    def _stage(n):
        return {
            "rider_id": RIDER_ID,
            "race_slug": f"race/paris-nice/2026/stage-{n}",
            "race_class": "stage_race",
            "stage": f"stage-{n}",
            "rank": 1,
            "pcs_points": 100,
            "race_date": "2026-03-0{}".format(n),
        }

    sb = make_supabase(
        # 1. race_results — 3 stage wins
        [_stage(1), _stage(2), _stage(3)],
        # 2. contracts
        [{"team_id": TEAM_ID, "rider_id": RIDER_ID, "status": "active",
          "riders": {"nationality": None}}],
        # 3. team_sponsors (T4 Decathlon)
        [{"team_id": TEAM_ID, "sponsor_id": "sp-dec", "sponsors": _DECATHLON}],
        # 4. sponsor_bonuses idempotence pre-fetch — none
        [],
        # 5. sponsor_goal_completions — goal consumed stages 1 & 2 only
        [{"team_id": TEAM_ID, "rider_id": RIDER_ID,
          "neutralized_stage_slugs": [
              "race/paris-nice/2026/stage-1",
              "race/paris-nice/2026/stage-2",
          ]}],
        # 6. sponsor_bonuses batch upsert
        [],
    )

    result = await process_race_bonuses(sb, [
        "race/paris-nice/2026/stage-1",
        "race/paris-nice/2026/stage-2",
        "race/paris-nice/2026/stage-3",
    ])

    assert result["status"] == "completed"
    # Only stage-3 survives.
    assert result["bonuses_created"] == 1
    sb.rpc.assert_called_once_with("credit_sponsor_bonuses", {
        "p_team_id": TEAM_ID,
        "p_bonuses": [{
            "amount": 5000,
            "rider_id": RIDER_ID,
            "description": "Sponsor bonus: stage rank 1 in race/paris-nice/2026/stage-3 (×1.0)",
        }],
    })


# ===========================================================================
# Spec C 2-value barème
# ===========================================================================

def _t4_sponsor():
    # Decathlon (tier 4) post-migration values
    return {
        "id": "sp-dec", "tier": 4, "nationality": "FR",
        "bonus_gc": 10000, "gc_threshold": 10,
        "bonus_stage": 5000, "stage_threshold": 3,
        "bonus_one_day": 10000, "one_day_threshold": 10,
        "has_explicit_prestige": False,
    }


def test_t4_stage_one_week_is_A_value():
    from sponsor_bonus import calculate_bonus
    base, mult, final = calculate_bonus(
        _t4_sponsor(), "stage", 2, None, "race/paris-nice/2026/stage-2")
    assert (base, mult, final) == (5000, 1.0, 5000)


def test_t4_stage_grand_tour_is_doubled():
    from sponsor_bonus import calculate_bonus
    base, mult, final = calculate_bonus(
        _t4_sponsor(), "stage", 2, None, "race/giro-d-italia/2026/stage-2")
    assert (base, mult, final) == (5000, 2.0, 10000)


def test_t4_monument_one_day_is_doubled():
    from sponsor_bonus import calculate_bonus
    base, mult, final = calculate_bonus(
        _t4_sponsor(), "monument", 5, None, "race/ronde-van-vlaanderen/2026/result")
    assert (base, mult, final) == (10000, 2.0, 20000)


def test_t4_nationality_is_1_20_not_1_25():
    from sponsor_bonus import calculate_bonus
    base, mult, final = calculate_bonus(
        _t4_sponsor(), "stage", 1, "FR", "race/giro-d-italia/2026/stage-2")
    assert base == 5000
    assert abs(mult - 2.4) < 1e-9
    assert final == 12000


def test_t4_threshold_excludes_rank_beyond():
    from sponsor_bonus import calculate_bonus
    assert calculate_bonus(_t4_sponsor(), "stage", 4, None,
                           "race/giro-d-italia/2026/stage-2") == (0, 0.0, 0)


def test_t5_has_no_nationality_bonus():
    from sponsor_bonus import calculate_bonus
    visma = {
        "id": "sp-vis", "tier": 5, "nationality": None,
        "bonus_gc": 10000, "gc_threshold": 10,
        "bonus_stage": 5000, "stage_threshold": 3,
        "bonus_one_day": 10000, "one_day_threshold": 10,
        "has_explicit_prestige": False,
    }
    base, mult, final = calculate_bonus(visma, "stage", 1, "NL",
                                        "race/giro-d-italia/2026/stage-2")
    assert (base, mult, final) == (5000, 2.0, 10000)
