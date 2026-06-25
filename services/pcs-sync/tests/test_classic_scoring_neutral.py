"""Scoring neutrality regression test for classic-mode leagues.

Classic leagues have no active strategies and no underdog role,
so the scoring pipeline must produce:
  - strategy_bonus == 0
  - underdog_mult == 1
  - xp == raw_pcs_points (on a non-squad race; gt_role_mult == 1.0 by default)

This mirrors the style of test_scoring_gt.py (make_supabase positional mocks).
The mock ordering follows calculate_daily_scores for a non-squad race:
  1. race_results
  2. prev rider_xp_daily (idempotency delta)
  3. contracts
  4. team_strategies  ← empty (classic = no strategies)
  5. rider_xp_daily upsert
  6. teams select
  7. teams update
  8. teams snapshot (league ranking)
  9. team_ranking_daily upsert
"""
from __future__ import annotations

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
sys.path.insert(0, os.path.dirname(__file__))

from helpers import make_supabase

TEAM_ID    = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1"
RIDER_ID   = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1"
CONTRACT_ID = "cccccccc-cccc-cccc-cccc-ccccccccccc1"
LEAGUE_ID  = "dddddddd-dddd-dddd-dddd-ddddddddddd1"

# A one-day classic: not a squad race → no role multiplier, no GT paths
CLASSIC_RACE_SLUG = "race/milan-sanremo/2026"


def _classic_mocks(*, pcs_points: int = 100):
    """Build a Supabase mock for a classic-league team on a non-squad (one-day) race.

    No strategies, no underdog, no GT squad paths.
    Mock ordering follows calculate_daily_scores (non-squad branch):
      1  race_results
      2  prev rider_xp_daily
      3  contracts
      4  team_strategies (empty — classic has none)
      5  rider_xp_daily upsert
      6  teams select
      7  teams update
      8  teams snapshot
      9  team_ranking_daily upsert
    """
    return make_supabase(
        # 1. race_results
        [{
            "rider_id": RIDER_ID,
            "race_slug": CLASSIC_RACE_SLUG,
            "pcs_points": pcs_points,
            "race_date": "2026-03-22",
            "is_itt": False,
            "breakaway_kms": None,
            "profile_icon": None,
        }],
        # 2. prev rider_xp_daily (empty = first run)
        [],
        # 3. contracts
        [{
            "id": CONTRACT_ID,
            "team_id": TEAM_ID,
            "rider_id": RIDER_ID,
            "purchased_at": "2026-01-01T00:00:00Z",
            "release_date": None,
            "released_at": None,
            "riders": {
                "specialty": "OneDay",
                "nationality": "BE",
                "real_team": "Alpecin",
                "birthdate": "1996-03-05",
                "pcs_rank": 50,
            },
        }],
        # 4. team_strategies (classic = no strategies)
        [],
        # 5. rider_xp_daily upsert
        [],
        # 6. teams select
        {"id": TEAM_ID, "cumulative_xp": 0.0, "level": 1, "league_id": LEAGUE_ID},
        # 7. teams update
        [],
        # 8. teams snapshot (league ranking)
        [{"id": TEAM_ID, "cumulative_xp": float(pcs_points)}],
        # 9. team_ranking_daily upsert
        [],
    )


async def test_classic_scoring_strategy_bonus_is_zero():
    """Classic-league team: no strategies → strategy_bonus == 0."""
    import scoring

    sb = _classic_mocks(pcs_points=80)
    await scoring.calculate_daily_scores(sb, race_slugs=[CLASSIC_RACE_SLUG])

    payload = sb._last_upsert_payload("rider_xp_daily")
    assert payload["strategy_bonus"] == 0.0


async def test_classic_scoring_underdog_mult_is_one():
    """Classic-league team: no underdog role → underdog_mult == 1."""
    import scoring

    sb = _classic_mocks(pcs_points=80)
    await scoring.calculate_daily_scores(sb, race_slugs=[CLASSIC_RACE_SLUG])

    payload = sb._last_upsert_payload("rider_xp_daily")
    assert payload["underdog_mult"] == 1.0


async def test_classic_scoring_xp_equals_raw_pcs_points():
    """Classic-league: xp == raw_pcs_points (role_mult=1, bonus=0, underdog=1)."""
    import scoring

    pcs = 120
    sb = _classic_mocks(pcs_points=pcs)
    await scoring.calculate_daily_scores(sb, race_slugs=[CLASSIC_RACE_SLUG])

    payload = sb._last_upsert_payload("rider_xp_daily")
    assert payload["raw_pcs_points"] == pcs
    assert payload["gt_role_mult"] == 1.0
    assert payload["xp_gained"] == float(pcs)
