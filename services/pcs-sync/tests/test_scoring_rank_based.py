"""Tests for the GT rank-based scoring barème (2026-07 refonte).

Covers the custom rank→points tables that replace raw PCS points on Grand
Tour slugs, the flat-for-all daily classification bonus (role-matched
multiplier on top), the flat final classifications (no role mult), the
climber profile gating, and the domestique assist bonus.

Non-GT slugs keep the raw PCS-points path — asserted here too.
"""
import importlib

import pytest

from helpers import make_supabase


TEAM_ID = "aaaa-0000-0000-0001"
RIDER_ID = "bbbb-0000-0000-0001"
TEAMMATE_ID = "bbbb-0000-0000-0002"
CONTRACT_ID = "cccc-0000-0000-0001"

TDF = "race/tour-de-france/2026"


# ---------------------------------------------------------------------------
# _points_from_rank — stage + GC final tables
# ---------------------------------------------------------------------------


def test_points_from_rank_stage_table():
    import scoring

    slug = f"{TDF}/stage-2"
    assert scoring._points_from_rank(1, slug) == 100.0
    assert scoring._points_from_rank(2, slug) == 80.0
    assert scoring._points_from_rank(3, slug) == 70.0
    assert scoring._points_from_rank(5, slug) == 55.0
    assert scoring._points_from_rank(10, slug) == 25.0
    assert scoring._points_from_rank(15, slug) == 12.0
    assert scoring._points_from_rank(20, slug) == 2.0
    assert scoring._points_from_rank(21, slug) == 0.0


def test_points_from_rank_gc_final_table():
    import scoring

    slug = f"{TDF}/gc"
    assert scoring._points_from_rank(1, slug) == 250.0
    assert scoring._points_from_rank(2, slug) == 210.0   # -16% (softened vs raw-PCS cliff)
    assert scoring._points_from_rank(3, slug) == 170.0
    assert scoring._points_from_rank(10, slug) == 65.0
    assert scoring._points_from_rank(15, slug) == 40.0
    assert scoring._points_from_rank(20, slug) == 20.0
    assert scoring._points_from_rank(30, slug) == 1.0
    assert scoring._points_from_rank(31, slug) == 0.0


def test_points_from_rank_invalid_ranks():
    import scoring

    slug = f"{TDF}/stage-2"
    assert scoring._points_from_rank(None, slug) == 0.0
    assert scoring._points_from_rank(0, slug) == 0.0
    assert scoring._points_from_rank(-3, slug) == 0.0
    assert scoring._points_from_rank("DNF", slug) == 0.0


# ---------------------------------------------------------------------------
# Daily classification bonus — flat table for all, matched role multiplies
# ---------------------------------------------------------------------------


def _c(ctype, rank):
    return {"classification_type": ctype, "rank": rank}


def test_daily_classif_flat_for_all_roles():
    """A domestique (no matched classification) still earns the flat table."""
    import scoring

    assert scoring._classif_bonus_gt([_c("gc", 1)], "domestique") == 15.0
    assert scoring._classif_bonus_gt([_c("gc", 10)], "stage_hunter") == 2.0
    assert scoring._classif_bonus_gt([_c("points", 1)], "domestique") == 6.0
    assert scoring._classif_bonus_gt([_c("kom", 5)], "tt_specialist") == 1.0
    assert scoring._classif_bonus_gt([_c("youth", 1)], "sprinter") == 4.0


def test_daily_classif_matched_role_multiplies():
    import scoring

    # gc_leader ×1.5 on GC, ×1.5 on youth
    assert scoring._classif_bonus_gt([_c("gc", 1)], "gc_leader") == 22.5
    assert scoring._classif_bonus_gt([_c("youth", 1)], "gc_leader") == 6.0
    # sprinter ×2 on points
    assert scoring._classif_bonus_gt([_c("points", 1)], "sprinter") == 12.0
    # climber ×2 on kom
    assert scoring._classif_bonus_gt([_c("kom", 1)], "climber") == 12.0


def test_daily_classif_zones_and_sum():
    import scoring

    # Outside the zone → 0 (gc top 10, others top 5)
    assert scoring._classif_bonus_gt([_c("gc", 11)], "gc_leader") == 0.0
    assert scoring._classif_bonus_gt([_c("points", 6)], "sprinter") == 0.0
    assert scoring._classif_bonus_gt([_c("youth", 6)], "gc_leader") == 0.0
    # Multiple classifications sum (gc_leader 1st GC + 2nd youth)
    assert scoring._classif_bonus_gt(
        [_c("gc", 1), _c("youth", 2)], "gc_leader"
    ) == 22.5 + 4.5


# ---------------------------------------------------------------------------
# Final secondary classifications — flat (no role mult), new GT scales
# ---------------------------------------------------------------------------


def test_final_secondary_gt_flat_no_role_mult():
    import scoring

    # Winner of points final = 100 whatever the role
    assert scoring._final_secondary_bonus("points", 1, "sprinter", mode="gt") == 100.0
    assert scoring._final_secondary_bonus("points", 1, "domestique", mode="gt") == 100.0
    assert scoring._final_secondary_bonus("kom", 1, "climber", mode="gt") == 100.0
    assert scoring._final_secondary_bonus("kom", 2, "domestique", mode="gt") == 80.0
    # Youth = half scale
    assert scoring._final_secondary_bonus("youth", 1, "gc_leader", mode="gt") == 50.0
    assert scoring._final_secondary_bonus("youth", 3, "domestique", mode="gt") == 32.0
    # Depth top 10
    assert scoring._final_secondary_bonus("points", 10, "sprinter", mode="gt") == 5.0
    assert scoring._final_secondary_bonus("points", 11, "sprinter", mode="gt") == 0.0
    assert scoring._final_secondary_bonus("youth", 10, "sprinter", mode="gt") == 2.0


def test_final_secondary_one_week_legacy_unchanged():
    """1-week races (A9) keep the legacy 40/10/5 scale WITH role match."""
    import scoring

    assert scoring._final_secondary_bonus("points", 1, "sprinter", mode="one_week") == 80.0
    assert scoring._final_secondary_bonus("points", 1, "domestique", mode="one_week") == 40.0
    assert scoring._final_secondary_bonus("youth", 1, "gc_leader", mode="one_week") == 60.0


# ---------------------------------------------------------------------------
# Climber profile gating (p3/p4/p5) — symmetric to sprinter (p1/p2/p3)
# ---------------------------------------------------------------------------


def test_climber_gated_by_profile():
    import scoring

    slug = f"{TDF}/stage-9"
    assert scoring._role_multiplier("climber", slug, False, profile_icon="p4") == 1.5
    assert scoring._role_multiplier("climber", slug, False, profile_icon="p5") == 1.5
    assert scoring._role_multiplier("climber", slug, False, profile_icon="p3") == 1.5
    # Flat sprint stage → no boost anymore
    assert scoring._role_multiplier("climber", slug, False, profile_icon="p1") == 1.0
    assert scoring._role_multiplier("climber", slug, False, profile_icon="p2") == 1.0
    assert scoring._role_multiplier("climber", slug, False, profile_icon=None) == 1.0
    # gc_leader stays ungated
    assert scoring._role_multiplier("gc_leader", slug, False, profile_icon="p1") == 1.5


# ---------------------------------------------------------------------------
# Domestique assists
# ---------------------------------------------------------------------------


def test_assist_bonus_stage_and_gc():
    import scoring

    stage_top3 = [(TEAMMATE_ID, "UAE Team Emirates", 1)]
    gc_top3 = [(TEAMMATE_ID, "UAE Team Emirates", 1)]
    bonus = scoring._domestique_assist_bonus(
        RIDER_ID, "UAE Team Emirates", stage_top3, gc_top3, is_itt=False
    )
    assert bonus == 4.0 + 3.0  # stage win assist + GC lead assist


def test_assist_bonus_positions():
    import scoring

    assert scoring._domestique_assist_bonus(
        RIDER_ID, "Visma", [("x", "Visma", 2)], [], is_itt=False
    ) == 2.0
    assert scoring._domestique_assist_bonus(
        RIDER_ID, "Visma", [("x", "Visma", 3)], [("y", "Visma", 3)], is_itt=False
    ) == 1.0 + 1.0
    # Best teammate position only per category, not summed
    assert scoring._domestique_assist_bonus(
        RIDER_ID, "Visma", [("x", "Visma", 1), ("y", "Visma", 3)], [], is_itt=False
    ) == 4.0


def test_assist_bonus_exclusions():
    import scoring

    # Different real team → nothing
    assert scoring._domestique_assist_bonus(
        RIDER_ID, "Cofidis", [("x", "Visma", 1)], [("y", "UAE", 1)], is_itt=False
    ) == 0.0
    # The rider himself in the top 3 is not his own teammate
    assert scoring._domestique_assist_bonus(
        RIDER_ID, "Visma", [(RIDER_ID, "Visma", 1)], [], is_itt=False
    ) == 0.0
    # ITT stages pay no assists
    assert scoring._domestique_assist_bonus(
        RIDER_ID, "Visma", [("x", "Visma", 1)], [("x", "Visma", 1)], is_itt=True
    ) == 0.0
    # No real team info → nothing
    assert scoring._domestique_assist_bonus(
        RIDER_ID, None, [("x", "Visma", 1)], [], is_itt=False
    ) == 0.0


# ---------------------------------------------------------------------------
# Integration — calculate_daily_scores on GT slugs
# ---------------------------------------------------------------------------


def _gt_contract(rider_id=RIDER_ID, real_team="UAE Team Emirates", pcs_rank=450):
    return {
        "id": CONTRACT_ID, "team_id": TEAM_ID, "rider_id": rider_id,
        "purchased_at": "2026-06-01T00:00:00Z", "release_date": None,
        "riders": {"specialty": "GC", "nationality": "SI", "real_team": real_team,
                   "birthdate": "1998-09-21", "pcs_rank": pcs_rank},
    }


def _squad_row(rider_id=RIDER_ID):
    return {"team_id": TEAM_ID, "rider_id": rider_id,
            "created_at": "2026-06-01T00:00:00Z", "removed_at": None}


def _role_row(role, rider_id=RIDER_ID):
    return {"team_id": TEAM_ID, "rider_id": rider_id, "role": role,
            "applied_at": "2026-06-01T00:00:00Z"}


async def _run_gt(sb, slug):
    import scoring
    importlib.reload(scoring)
    return await scoring.calculate_daily_scores(sb, race_slugs=[slug])


async def test_gt_stage_base_is_rank_derived():
    """GT stage: base = rank table (not pcs_points), role mult applies on top."""
    slug = f"{TDF}/stage-2"
    sb = make_supabase(
        # race_results — rank 3 → 70 base; pcs_points ignored on GT slugs
        [{"rider_id": RIDER_ID, "race_slug": slug, "pcs_points": 999, "rank": 3,
          "race_date": "2026-07-05", "is_itt": False, "breakaway_kms": None,
          "profile_icon": "p1", "riders": {"real_team": "UAE Team Emirates"}}],
        [],                       # prev rider_xp_daily
        [_gt_contract()],         # contracts
        [],                       # team_strategies
        [_squad_row()],           # gt_squad
        [_role_row("gc_leader")], # gt_role_assignments
        [],                       # gt_daily_classifications
        [],                       # gt_tactic_activations
        {"id": TEAM_ID, "cumulative_xp": 0, "level": 8, "league_id": "lg-1"},
        [],
        [{"id": TEAM_ID, "cumulative_xp": 105}],
        [],
    )
    result = await _run_gt(sb, slug)

    assert result.get("errors") in (None, [],) or not result["errors"]
    payload = sb._last_upsert_payload("rider_xp_daily")
    assert payload["raw_pcs_points"] == 70          # rank-derived base
    assert payload["gt_role_mult"] == 1.5           # gc_leader
    assert payload["xp_gained"] == 105.0            # 70 × 1.5


async def test_gt_gc_final_flat_for_underdog():
    """GC final: flat top-30 table, no role mult, no underdog clamp."""
    slug = f"{TDF}/gc"
    sb = make_supabase(
        [{"rider_id": RIDER_ID, "race_slug": slug, "pcs_points": 500, "rank": 5,
          "race_date": "2026-07-26", "is_itt": False, "breakaway_kms": None,
          "profile_icon": None, "riders": {"real_team": "UAE Team Emirates"}}],
        [],
        [_gt_contract(pcs_rank=450)],   # underdog candidate, clamp would be ×4
        [],
        [_squad_row()],
        [_role_row("underdog")],
        [],
        [],
        {"id": TEAM_ID, "cumulative_xp": 0, "level": 8, "league_id": "lg-1"},
        [],
        [{"id": TEAM_ID, "cumulative_xp": 125}],
        [],
    )
    await _run_gt(sb, slug)

    payload = sb._last_upsert_payload("rider_xp_daily")
    assert payload["raw_pcs_points"] == 125         # GC final rank 5
    assert payload["gt_role_mult"] == 1.0
    assert payload["underdog_mult"] == 1.0          # no clamp on finals
    assert payload["xp_gained"] == 125.0


async def test_gt_domestique_earns_assists():
    """Domestique outside top 20 earns stage + GC assists from real teammates."""
    slug = f"{TDF}/stage-4"
    sb = make_supabase(
        # race_results: domestique rank 47 (0 pts) + teammate wins the stage
        [{"rider_id": RIDER_ID, "race_slug": slug, "pcs_points": 0, "rank": 47,
          "race_date": "2026-07-07", "is_itt": False, "breakaway_kms": None,
          "profile_icon": "p2", "riders": {"real_team": "UAE Team Emirates"}},
         {"rider_id": TEAMMATE_ID, "race_slug": slug, "pcs_points": 0, "rank": 1,
          "race_date": "2026-07-07", "is_itt": False, "breakaway_kms": None,
          "profile_icon": "p2", "riders": {"real_team": "UAE Team Emirates"}}],
        [],
        [_gt_contract()],               # only the domestique is contracted by this team
        [],
        [_squad_row()],
        [_role_row("domestique")],
        # gt_daily_classifications: teammate leads the GC
        [{"race_slug": slug, "rider_id": TEAMMATE_ID, "classification_type": "gc",
          "rank": 1, "riders": {"real_team": "UAE Team Emirates"}}],
        [],
        {"id": TEAM_ID, "cumulative_xp": 0, "level": 8, "league_id": "lg-1"},
        [],
        [{"id": TEAM_ID, "cumulative_xp": 7}],
        [],
    )
    await _run_gt(sb, slug)

    payload = sb._last_upsert_payload("rider_xp_daily")
    assert payload["assist_bonus"] == 7.0           # 4 (stage win) + 3 (GC lead)
    assert payload["raw_pcs_points"] == 0
    assert payload["xp_gained"] == 7.0


async def test_gt_domestique_dnf_earns_no_assist():
    """A non-classified domestique (DNF, rank NULL) earns no assist even when a
    real teammate wins — a bare race_results row is not proof he finished."""
    slug = f"{TDF}/stage-4"
    sb = make_supabase(
        # domestique DNF (rank NULL, 0 pts) + teammate wins the stage
        [{"rider_id": RIDER_ID, "race_slug": slug, "pcs_points": 0, "rank": None,
          "race_date": "2026-07-07", "is_itt": False, "breakaway_kms": None,
          "profile_icon": "p2", "riders": {"real_team": "UAE Team Emirates"}},
         {"rider_id": TEAMMATE_ID, "race_slug": slug, "pcs_points": 0, "rank": 1,
          "race_date": "2026-07-07", "is_itt": False, "breakaway_kms": None,
          "profile_icon": "p2", "riders": {"real_team": "UAE Team Emirates"}}],
        [],
        [_gt_contract()],
        [],
        [_squad_row()],
        [_role_row("domestique")],
        # teammate leads the GC — would trigger the GC assist if the DNF gate failed
        [{"race_slug": slug, "rider_id": TEAMMATE_ID, "classification_type": "gc",
          "rank": 1, "riders": {"real_team": "UAE Team Emirates"}}],
        [],
        {"id": TEAM_ID, "cumulative_xp": 0, "level": 8, "league_id": "lg-1"},
        [],
        [{"id": TEAM_ID, "cumulative_xp": 0}],
        [],
    )
    await _run_gt(sb, slug)

    payload = sb._last_upsert_payload("rider_xp_daily")
    assert payload["assist_bonus"] == 0.0           # DNF → no assist
    assert payload["raw_pcs_points"] == 0
    assert payload["xp_gained"] == 0.0


async def test_non_gt_race_keeps_pcs_points_base():
    """Non-GT slugs (classics, 1-week) still score raw PCS points."""
    slug = "race/il-lombardia/2026/result"
    sb = make_supabase(
        [{"rider_id": RIDER_ID, "race_slug": slug, "pcs_points": 60, "rank": 3,
          "race_date": "2026-10-10"}],
        [],
        [_gt_contract()],
        [],
        {"id": TEAM_ID, "cumulative_xp": 0, "level": 8, "league_id": "lg-1"},
        [],
        [{"id": TEAM_ID, "cumulative_xp": 60}],
        [],
    )
    import scoring
    importlib.reload(scoring)
    await scoring.calculate_daily_scores(sb, race_slugs=[slug])

    payload = sb._last_upsert_payload("rider_xp_daily")
    assert payload["raw_pcs_points"] == 60          # PCS path untouched
    assert payload["xp_gained"] == 60.0
