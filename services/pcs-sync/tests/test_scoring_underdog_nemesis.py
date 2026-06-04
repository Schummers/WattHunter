"""SC-2 — Underdog boost and Nemesis duel must not stack.

Underdog (a distinct catch-up role) and Nemesis (a gc_leader/sprinter PvP duel)
are mutually exclusive. When a Nemesis duel materially affects a rider on a
stage, scoring drops the underdog multiplier rather than multiplying the two
(× nemesis × underdog could reach ×8).

Decided 2026-06-04 with the user: "tu peux pas cumulé".
"""
from __future__ import annotations

import scoring
from helpers import make_supabase

TEAM_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1"
ENEMY_TEAM_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa9"
RIDER_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1"
CONTRACT_ID = "cccccccc-cccc-cccc-cccc-ccccccccccc1"
LEAGUE_ID = "dddddddd-dddd-dddd-dddd-ddddddddddd1"
GIRO_SLUG = "race/giro-d-italia/2026/stage-4"
BEFORE_CUTOFF = "2026-05-10T09:00:00+02:00"


def _mock(*, tactics: list[dict], pcs_rank: int = 200, role: str = "underdog"):
    """Squad rider with the given role + pcs_rank, 100 pts on a p4 GT stage."""
    return make_supabase(
        # 1. race_results
        [{"rider_id": RIDER_ID, "race_slug": GIRO_SLUG, "pcs_points": 100,
          "race_date": "2026-05-11", "is_itt": False, "breakaway_kms": None,
          "profile_icon": "p4"}],
        # 2. prev rider_xp_daily
        [],
        # 3. contracts (rider join carries pcs_rank)
        [{"id": CONTRACT_ID, "team_id": TEAM_ID, "rider_id": RIDER_ID,
          "purchased_at": "2026-01-01T00:00:00Z", "release_date": None, "released_at": None,
          "riders": {"specialty": "GC", "nationality": "BE", "real_team": "x",
                     "birthdate": "1998-01-01", "pcs_rank": pcs_rank}}],
        # 4. team_strategies
        [],
        # 5. gt_squad
        [{"team_id": TEAM_ID, "rider_id": RIDER_ID, "created_at": BEFORE_CUTOFF, "removed_at": None}],
        # 6. gt_role_assignments
        [{"team_id": TEAM_ID, "rider_id": RIDER_ID, "role": role,
          "applied_at": BEFORE_CUTOFF}],
        # 7. gt_daily_classifications
        [],
        # 8. gt_tactic_activations
        tactics,
        # 9. rider_xp_daily upsert
        [],
        # 10. teams select
        {"id": TEAM_ID, "cumulative_xp": 0.0, "level": 1, "league_id": LEAGUE_ID},
        # 11. teams update
        [],
        # 12. teams (league snapshot)
        [{"id": TEAM_ID, "cumulative_xp": 0.0}],
    )


async def test_underdog_alone_applies_multiplier():
    """Control: no Nemesis → underdog ×2.0 applies. 100 × 2.0 = 200."""
    sb = _mock(tactics=[])
    await scoring.calculate_daily_scores(sb, race_slugs=[GIRO_SLUG])
    payload = sb._last_upsert_payload("rider_xp_daily")
    assert payload["xp_gained"] == 200.0
    assert payload["underdog_mult"] == 2.0


async def test_underdog_suppressed_when_targeted_by_nemesis():
    """Enemy Nemesis targets this rider and the attacker wins (target penalty ×0.5).
    The underdog ×2.0 is dropped — XP = 100 × 0.5 = 50, NOT 100 × 0.5 × 2.0 = 100."""
    sb = _mock(tactics=[{
        "id": "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1",
        "team_id": ENEMY_TEAM_ID,            # owned by the enemy
        "tactic_type": "nemesis_gc",
        "stage_slug": GIRO_SLUG,
        "nemesis_target_team_id": TEAM_ID,   # targets our team…
        "nemesis_target_role": "gc_leader",
        "resolved_attacker_rider_id": None,
        "resolved_target_rider_id": RIDER_ID,  # …specifically our rider
        "outcome": "attacker_won",
    }])
    await scoring.calculate_daily_scores(sb, race_slugs=[GIRO_SLUG])
    payload = sb._last_upsert_payload("rider_xp_daily")
    assert payload["nemesis_modifier"] == 0.5
    assert payload["underdog_mult"] == 1.0  # suppressed
    assert payload["xp_gained"] == 50.0


async def test_underdog_kept_when_nemesis_no_resolution():
    """An unresolved Nemesis (modifier 1.0, no override) does not affect the rider,
    so the underdog ×2.0 is preserved. 100 × 1.0 × 2.0 = 200."""
    sb = _mock(tactics=[{
        "id": "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee2",
        "team_id": ENEMY_TEAM_ID,
        "tactic_type": "nemesis_gc",
        "stage_slug": GIRO_SLUG,
        "nemesis_target_team_id": TEAM_ID,
        "nemesis_target_role": "gc_leader",
        "resolved_attacker_rider_id": None,
        "resolved_target_rider_id": RIDER_ID,
        "outcome": "no_resolution",
    }])
    await scoring.calculate_daily_scores(sb, race_slugs=[GIRO_SLUG])
    payload = sb._last_upsert_payload("rider_xp_daily")
    assert payload["nemesis_modifier"] == 1.0
    assert payload["underdog_mult"] == 2.0
    assert payload["xp_gained"] == 200.0


def _enemy_nemesis(rid_suffix: str, outcome: str) -> dict:
    return {
        "id": f"eeeeeeee-eeee-eeee-eeee-{rid_suffix}",
        "team_id": ENEMY_TEAM_ID,
        "tactic_type": "nemesis_gc",
        "stage_slug": GIRO_SLUG,
        "nemesis_target_team_id": TEAM_ID,
        "nemesis_target_role": "gc_leader",
        "resolved_attacker_rider_id": None,
        "resolved_target_rider_id": RIDER_ID,
        "outcome": outcome,
    }


async def test_target_won_single_duel_keeps_125_reward():
    """A single enemy duel the target WINS pays the 1.25 reward (regression: the
    old min(1.0, 1.25) clamped it to 1.0). domestique role → 100 × 1.0 × 1.25 = 125."""
    sb = _mock(role="domestique", tactics=[_enemy_nemesis("000000000001", "target_won")])
    await scoring.calculate_daily_scores(sb, race_slugs=[GIRO_SLUG])
    payload = sb._last_upsert_payload("rider_xp_daily")
    assert payload["nemesis_modifier"] == 1.25
    assert payload["xp_gained"] == 125.0


async def test_two_enemy_duels_keep_worst_case_min():
    """SC-3 preserved: 2 enemy duels target the same rider, one lost (0.5) and one
    won (1.25) → worst case 0.5 dominates. 100 × 1.0 × 0.5 = 50."""
    sb = _mock(role="domestique", tactics=[
        _enemy_nemesis("000000000001", "attacker_won"),  # target loses → 0.5
        _enemy_nemesis("000000000002", "target_won"),    # target wins → 1.25
    ])
    await scoring.calculate_daily_scores(sb, race_slugs=[GIRO_SLUG])
    payload = sb._last_upsert_payload("rider_xp_daily")
    assert payload["nemesis_modifier"] == 0.5
    assert payload["xp_gained"] == 50.0
