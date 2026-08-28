"""Tests for the in-race event scoring terms — KOM crossings + intermediate
sprints (issue 03, 2026-08).

Barèmes: HC top 8 `8/6/5/4/3/2/1/1`, cat 1 top 5 `4/3/2/1/1`, nothing for cat
2/3/4; sprints top 8 `6/5/4/3/2/2/1/1`. Event multipliers: climber ×2 (kom),
sprinter ×2 (sprint), stage_hunter ×1.5 (both, unconditional), underdog and
others ×1. Additive inside the parenthesis: NOT multiplied by strategy_bonus
nor by the underdog boost, but scaled by nemesis_modifier.
"""
from __future__ import annotations

import pytest

import scoring
from helpers import make_supabase

TEAM_ID = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaa1"
ENEMY_TEAM_ID = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaa9"
RIDER_ID = "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbb1"
OTHER_RIDER = "ffffffff-ffff-4fff-ffff-fffffffffff1"
CONTRACT_ID = "cccccccc-cccc-4ccc-cccc-ccccccccccc1"
LEAGUE_ID = "dddddddd-dddd-4ddd-dddd-ddddddddddd1"
VUELTA_SLUG = "race/vuelta-a-espana/2026/stage-4"
BEFORE_CUTOFF = "2026-08-20T09:00:00+02:00"


# ---------------------------------------------------------------------------
# _event_bonus — unit
# ---------------------------------------------------------------------------


def _kom(rank, category="HC"):
    return {"event_type": "kom", "category": category, "rank": rank}


def _sprint(rank):
    return {"event_type": "sprint", "category": None, "rank": rank}


def test_event_bonus_climber_first_hc_is_16():
    kom, sprint = scoring._event_bonus([_kom(1, "HC")], "climber")
    assert (kom, sprint) == (16.0, 0.0)


def test_event_bonus_sprinter_first_sprint_is_12():
    kom, sprint = scoring._event_bonus([_sprint(1)], "sprinter")
    assert (kom, sprint) == (0.0, 12.0)


def test_event_bonus_stage_hunter_second_cat1_is_4_5():
    """Unconditional ×1.5 — no breakaway requirement."""
    kom, sprint = scoring._event_bonus([_kom(2, "1")], "stage_hunter")
    assert (kom, sprint) == (4.5, 0.0)


def test_event_bonus_underdog_first_hc_is_8():
    """Underdog gets ×1 on events — the pcs_rank clamp never applies here."""
    kom, sprint = scoring._event_bonus([_kom(1, "HC")], "underdog")
    assert (kom, sprint) == (8.0, 0.0)


def test_event_bonus_domestique_flat():
    kom, sprint = scoring._event_bonus([_kom(3, "HC"), _sprint(2)], "domestique")
    assert (kom, sprint) == (5.0, 5.0)


def test_event_bonus_cat_2_3_4_pay_nothing():
    rows = [_kom(1, "2"), _kom(1, "3"), _kom(1, "4")]
    assert scoring._event_bonus(rows, "climber") == (0.0, 0.0)


def test_event_bonus_depth_limits():
    assert scoring._event_bonus([_kom(8, "HC")], "domestique") == (1.0, 0.0)
    assert scoring._event_bonus([_kom(9, "HC")], "domestique") == (0.0, 0.0)
    assert scoring._event_bonus([_kom(5, "1")], "domestique") == (1.0, 0.0)
    assert scoring._event_bonus([_kom(6, "1")], "domestique") == (0.0, 0.0)
    assert scoring._event_bonus([_sprint(8)], "domestique") == (0.0, 1.0)
    assert scoring._event_bonus([_sprint(9)], "domestique") == (0.0, 0.0)


def test_event_bonus_multiple_events_sum():
    """A climber crossing 2 cat-1 cols first + 1 HC second: (4+4+6) × 2 = 28."""
    rows = [_kom(1, "1"), _kom(1, "1"), _kom(2, "HC")]
    assert scoring._event_bonus(rows, "climber") == (28.0, 0.0)


# ---------------------------------------------------------------------------
# calculate_daily_scores — integration
# ---------------------------------------------------------------------------


def _mock(*, role: str, events: list[dict], profile: str = "p4",
          is_itt: bool = False, rank: int = 1, strategies: list | None = None,
          tactics: list | None = None, pcs_rank: int = 50):
    """Squad rider with the given role, stage rank and event rows on a GT stage."""
    return make_supabase(
        # 1. race_results
        [{"rider_id": RIDER_ID, "race_slug": VUELTA_SLUG, "pcs_points": 100,
          "rank": rank, "race_date": "2026-08-26", "is_itt": is_itt,
          "breakaway_kms": None, "profile_icon": profile}],
        # 2. prev rider_xp_daily
        [],
        # 3. contracts
        [{"id": CONTRACT_ID, "team_id": TEAM_ID, "rider_id": RIDER_ID,
          "purchased_at": "2026-01-01T00:00:00Z", "release_date": None, "released_at": None,
          "riders": {"specialty": "Sprint", "nationality": "BE", "real_team": "x",
                     "birthdate": "1998-01-01", "pcs_rank": pcs_rank}}],
        # 4. team_strategies
        strategies or [],
        # 5. gt_squad
        [{"team_id": TEAM_ID, "rider_id": RIDER_ID, "created_at": BEFORE_CUTOFF,
          "removed_at": None}],
        # 6. gt_role_assignments
        [{"team_id": TEAM_ID, "rider_id": RIDER_ID, "role": role,
          "applied_at": BEFORE_CUTOFF}],
        # 7. gt_daily_classifications
        [],
        # 8. stage_event_results
        events,
        # 9. gt_tactic_activations
        tactics or [],
        # 10. rider_xp_daily upsert
        [],
        # 11. teams select
        {"id": TEAM_ID, "cumulative_xp": 0.0, "level": 1, "league_id": LEAGUE_ID},
        # 12. teams update
        [],
        # 13. teams (league snapshot)
        [{"id": TEAM_ID, "cumulative_xp": 0.0}],
    )


def _ev(rank, event_type="kom", category="HC", rider_id=RIDER_ID):
    return {"race_slug": VUELTA_SLUG, "rider_id": rider_id,
            "event_type": event_type, "category": category, "rank": rank}


async def test_climber_stage_win_plus_first_hc():
    """Climber wins a p4 stage (100 × 1.5) and its HC col (8 × 2 = 16) → 166."""
    sb = _mock(role="climber", events=[_ev(1, "kom", "HC")])
    await scoring.calculate_daily_scores(sb, race_slugs=[VUELTA_SLUG])
    payload = sb._last_upsert_payload("rider_xp_daily")
    assert payload["kom_event_bonus"] == 16.0
    assert payload["sprint_event_bonus"] == 0.0
    assert payload["xp_gained"] == 166.0


async def test_event_term_not_multiplied_by_strategy_bonus():
    """Sprinter, p1 stage win with +5% specialist strategy: base 100 × 1.5 × 1.05
    = 157.5; sprint win 6 × 2 = 12 stays OUTSIDE the strategy multiplier → 169.5
    (not 170.1, which would mean the event term was inside `(1 + bonus)`)."""
    sb = _mock(
        role="sprinter", profile="p1",
        events=[_ev(1, "sprint", None),
                # p1 stage: no KOM rows needed for the guard
                ],
        strategies=[{"team_id": TEAM_ID, "config": {"specialty": "Sprint"},
                     "strategies": {"slug": "specialist", "xp_bonus": 0.05}}],
    )
    await scoring.calculate_daily_scores(sb, race_slugs=[VUELTA_SLUG])
    payload = sb._last_upsert_payload("rider_xp_daily")
    assert payload["sprint_event_bonus"] == 12.0
    assert payload["xp_gained"] == 169.5


async def test_event_term_scaled_by_nemesis_modifier():
    """Domestique targeted by a lost duel (×0.5): (100 + 4) × 0.5 = 52 — the
    event term IS inside the nemesis multiplier."""
    sb = _mock(
        role="domestique",
        events=[_ev(1, "kom", "1")],
        tactics=[{
            "id": "eeeeeeee-eeee-4eee-eeee-eeeeeeeeeee1",
            "team_id": ENEMY_TEAM_ID,
            "tactic_type": "nemesis_gc",
            "stage_slug": VUELTA_SLUG,
            "nemesis_target_team_id": TEAM_ID,
            "nemesis_target_role": "gc_leader",
            "resolved_attacker_rider_id": None,
            "resolved_target_rider_id": RIDER_ID,
            "outcome": "attacker_won",
        }],
    )
    await scoring.calculate_daily_scores(sb, race_slugs=[VUELTA_SLUG])
    payload = sb._last_upsert_payload("rider_xp_daily")
    assert payload["kom_event_bonus"] == 4.0
    assert payload["nemesis_modifier"] == 0.5
    assert payload["xp_gained"] == 52.0


async def test_underdog_event_term_not_boosted():
    """Underdog pcs_rank 300 (×3.0 on rank_points): stage win 100 × 3.0 = 300
    + HC win 8 (×1, never clamped) = 308."""
    sb = _mock(role="underdog", pcs_rank=300, events=[_ev(1, "kom", "HC")])
    await scoring.calculate_daily_scores(sb, race_slugs=[VUELTA_SLUG])
    payload = sb._last_upsert_payload("rider_xp_daily")
    assert payload["underdog_mult"] == 3.0
    assert payload["kom_event_bonus"] == 8.0
    assert payload["xp_gained"] == 308.0


async def test_itt_stage_scores_zero_events_without_error():
    """An ITT stores no events — 0 everywhere, no guard, no crash."""
    sb = _mock(role="tt_specialist", profile="p4", is_itt=True, events=[])
    await scoring.calculate_daily_scores(sb, race_slugs=[VUELTA_SLUG])
    payload = sb._last_upsert_payload("rider_xp_daily")
    assert payload["kom_event_bonus"] == 0.0
    assert payload["sprint_event_bonus"] == 0.0
    assert payload["xp_gained"] == 200.0  # 100 × 2.0 tt_specialist


async def test_mountain_stage_without_kom_data_fails_loud():
    """Anti-silence guard (issue 02): a p4/p5 road stage with zero imported KOM
    rows must raise, not score 0 event XP silently."""
    sb = _mock(role="climber", profile="p4", events=[])
    with pytest.raises(ValueError, match="No KOM event rows"):
        await scoring.calculate_daily_scores(sb, race_slugs=[VUELTA_SLUG])


async def test_flat_stage_without_kom_data_is_fine():
    """A col can legitimately be absent on p1/p2/p3 — no guard there."""
    sb = _mock(role="sprinter", profile="p1", events=[])
    await scoring.calculate_daily_scores(sb, race_slugs=[VUELTA_SLUG])
    payload = sb._last_upsert_payload("rider_xp_daily")
    assert payload["xp_gained"] == 150.0  # 100 × 1.5, no events
