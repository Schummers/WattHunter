"""Tests for GT scoring path — role multipliers + daily classif bonus."""
from __future__ import annotations

from helpers import make_supabase


TEAM_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1"
RIDER_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1"
CONTRACT_ID = "cccccccc-cccc-cccc-cccc-ccccccccccc1"
LEAGUE_ID = "dddddddd-dddd-dddd-dddd-ddddddddddd1"
GIRO_SLUG = "race/giro-d-italia/2026/stage-4"


def _base_mocks(
    *,
    role: str,
    pcs_points: int = 100,
    is_itt: bool = False,
    prev_xp: list | None = None,
):
    """Build a Supabase mock covering the full GT scoring flow (role multipliers only).

    Response order mirrors the supabase.table() calls made by calculate_daily_scores:
      1. race_results select
      2. rider_xp_daily select (prev — for idempotency delta)
      3. contracts select
      4. team_strategies select
      5. gt_squad select
      6. gt_role_assignments select
      7. rider_xp_daily upsert
      8. teams select (per-team update)
      9. teams update
     10. teams select (league ranking snapshot)
    """
    return make_supabase(
        # 1. race_results
        [{
            "rider_id": RIDER_ID,
            "race_slug": GIRO_SLUG,
            "pcs_points": pcs_points,
            "race_date": "2026-05-11",
            "is_itt": is_itt,
        }],
        # 2. prev rider_xp_daily (seeds delta calc; empty = first run)
        prev_xp if prev_xp is not None else [],
        # 3. contracts
        [{
            "id": CONTRACT_ID,
            "team_id": TEAM_ID,
            "rider_id": RIDER_ID,
            "purchased_at": "2026-01-01T00:00:00Z",
            "release_date": None,
            "released_at": None,
            "riders": {
                "specialty": "GC",
                "nationality": "BE",
                "real_team": "Soudal",
                "birthdate": "1998-01-01",
            },
        }],
        # 4. team_strategies
        [],
        # 5. gt_squad presence
        [{"team_id": TEAM_ID, "rider_id": RIDER_ID}],
        # 6. gt_role_assignments latest
        [{"team_id": TEAM_ID, "rider_id": RIDER_ID, "role": role, "applied_at": "2026-05-10T09:00:00Z"}],
        # 7. rider_xp_daily upsert
        [],
        # 8. teams select
        {"id": TEAM_ID, "cumulative_xp": 0, "level": 1, "league_id": LEAGUE_ID},
        # 9. teams update
        [],
        # 10. teams (league snapshot)
        [{"id": TEAM_ID, "cumulative_xp": 150}],
    )


async def test_gc_leader_applies_1_5x():
    import scoring

    sb = _base_mocks(role="gc_leader")
    await scoring.calculate_daily_scores(sb, race_slugs=[GIRO_SLUG])

    payload = sb._last_upsert_payload("rider_xp_daily")
    assert payload["xp_gained"] == 150.0  # 100 × 1.5


async def test_sprinter_applies_1_5x():
    import scoring

    sb = _base_mocks(role="sprinter")
    await scoring.calculate_daily_scores(sb, race_slugs=[GIRO_SLUG])

    payload = sb._last_upsert_payload("rider_xp_daily")
    assert payload["xp_gained"] == 150.0


async def test_climber_applies_1_5x():
    import scoring

    sb = _base_mocks(role="climber")
    await scoring.calculate_daily_scores(sb, race_slugs=[GIRO_SLUG])

    payload = sb._last_upsert_payload("rider_xp_daily")
    assert payload["xp_gained"] == 150.0


async def test_tt_specialist_no_multiplier_outside_itt():
    import scoring

    sb = _base_mocks(role="tt_specialist", is_itt=False)
    await scoring.calculate_daily_scores(sb, race_slugs=[GIRO_SLUG])

    payload = sb._last_upsert_payload("rider_xp_daily")
    assert payload["xp_gained"] == 100.0


async def test_tt_specialist_2x_on_itt():
    import scoring

    sb = _base_mocks(role="tt_specialist", is_itt=True)
    await scoring.calculate_daily_scores(sb, race_slugs=[GIRO_SLUG])

    payload = sb._last_upsert_payload("rider_xp_daily")
    assert payload["xp_gained"] == 200.0


async def test_stage_hunter_1_5x_on_stage():
    """Stage hunter gets ×1.5 on stage slugs (anything not ending /gc)."""
    import scoring

    sb = _base_mocks(role="stage_hunter")
    await scoring.calculate_daily_scores(sb, race_slugs=[GIRO_SLUG])

    payload = sb._last_upsert_payload("rider_xp_daily")
    assert payload["xp_gained"] == 150.0


async def test_stage_hunter_no_multiplier_on_gc():
    """Stage hunter: GC slug (ends /gc) → ×1, not ×1.5."""
    import scoring

    gc_slug = "race/giro-d-italia/2026/gc"
    sb = make_supabase(
        [{
            "rider_id": RIDER_ID,
            "race_slug": gc_slug,
            "pcs_points": 100,
            "race_date": "2026-05-28",
            "is_itt": False,
        }],
        [],
        [{
            "id": CONTRACT_ID,
            "team_id": TEAM_ID,
            "rider_id": RIDER_ID,
            "purchased_at": "2026-01-01T00:00:00Z",
            "release_date": None,
            "released_at": None,
            "riders": {
                "specialty": "GC",
                "nationality": "BE",
                "real_team": "Soudal",
                "birthdate": "1998-01-01",
            },
        }],
        [],
        [{"team_id": TEAM_ID, "rider_id": RIDER_ID}],
        [{"team_id": TEAM_ID, "rider_id": RIDER_ID, "role": "stage_hunter", "applied_at": "2026-05-10T09:00:00Z"}],
        [],
        {"id": TEAM_ID, "cumulative_xp": 0, "level": 1, "league_id": LEAGUE_ID},
        [],
        [{"id": TEAM_ID, "cumulative_xp": 100}],
    )
    await scoring.calculate_daily_scores(sb, race_slugs=[gc_slug])

    payload = sb._last_upsert_payload("rider_xp_daily")
    assert payload["xp_gained"] == 100.0


async def test_domestique_no_multiplier():
    import scoring

    sb = _base_mocks(role="domestique")
    await scoring.calculate_daily_scores(sb, race_slugs=[GIRO_SLUG])

    payload = sb._last_upsert_payload("rider_xp_daily")
    assert payload["xp_gained"] == 100.0


async def test_non_gt_race_no_multiplier():
    """Outside GT phases, roles are irrelevant even if rider is in a squad."""
    import scoring

    classics_slug = "race/paris-nice/2026/stage-3"
    sb = make_supabase(
        [{
            "rider_id": RIDER_ID,
            "race_slug": classics_slug,
            "pcs_points": 100,
            "race_date": "2026-03-08",
            "is_itt": True,
        }],
        [],
        [{
            "id": CONTRACT_ID,
            "team_id": TEAM_ID,
            "rider_id": RIDER_ID,
            "purchased_at": "2026-01-01T00:00:00Z",
            "release_date": None,
            "released_at": None,
            "riders": {"specialty": "TT", "nationality": "BE", "real_team": "x", "birthdate": "1998-01-01"},
        }],
        [],
        # No gt_squad / gt_role calls should be made for non-GT slugs — mock still provides
        # empty responses in case future behavior queries them.
        [],
        [],
        [],
        {"id": TEAM_ID, "cumulative_xp": 0, "level": 1, "league_id": LEAGUE_ID},
        [],
        [{"id": TEAM_ID, "cumulative_xp": 100}],
    )
    await scoring.calculate_daily_scores(sb, race_slugs=[classics_slug])

    payload = sb._last_upsert_payload("rider_xp_daily")
    assert payload["xp_gained"] == 100.0


async def test_rider_not_in_squad_no_multiplier():
    """Even on a GT slug, a rider absent from gt_squad gets no multiplier."""
    import scoring

    sb = make_supabase(
        [{
            "rider_id": RIDER_ID,
            "race_slug": GIRO_SLUG,
            "pcs_points": 100,
            "race_date": "2026-05-11",
            "is_itt": False,
        }],
        [],
        [{
            "id": CONTRACT_ID,
            "team_id": TEAM_ID,
            "rider_id": RIDER_ID,
            "purchased_at": "2026-01-01T00:00:00Z",
            "release_date": None,
            "released_at": None,
            "riders": {"specialty": "GC", "nationality": "BE", "real_team": "x", "birthdate": "1998-01-01"},
        }],
        [],
        [],  # gt_squad empty
        [],  # gt_role_assignments empty
        [],
        {"id": TEAM_ID, "cumulative_xp": 0, "level": 1, "league_id": LEAGUE_ID},
        [],
        [{"id": TEAM_ID, "cumulative_xp": 100}],
    )
    await scoring.calculate_daily_scores(sb, race_slugs=[GIRO_SLUG])

    payload = sb._last_upsert_payload("rider_xp_daily")
    assert payload["xp_gained"] == 100.0
