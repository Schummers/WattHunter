"""Tests for GT scoring path — role multipliers + daily classif bonus."""
from __future__ import annotations

from helpers import make_supabase


TEAM_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1"
RIDER_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1"
CONTRACT_ID = "cccccccc-cccc-cccc-cccc-ccccccccccc1"
LEAGUE_ID = "dddddddd-dddd-dddd-dddd-ddddddddddd1"
GIRO_SLUG = "race/giro-d-italia/2026/stage-4"

BEFORE_CUTOFF = "2026-05-10T09:00:00+02:00"
AFTER_CUTOFF = "2026-05-11T12:00:00+02:00"


def _base_mocks(
    *,
    role: str,
    pcs_points: int = 100,
    is_itt: bool = False,
    prev_xp: list | None = None,
    classif_rows: list | None = None,
    starting_cumulative_xp: float = 0.0,
    squad_created_at: str = BEFORE_CUTOFF,
    squad_removed_at: str | None = None,
    role_applied_at: str = "2026-05-10T09:00:00+02:00",
):
    """Build a Supabase mock covering the full GT scoring flow (role multipliers only).

    Response order mirrors the supabase.table() calls made by calculate_daily_scores:
      1. race_results select
      2. rider_xp_daily select (prev — for idempotency delta)
      3. contracts select
      4. team_strategies select
      5. gt_squad select (with created_at, removed_at for cutoff filtering)
      6. gt_role_assignments select
      7. gt_daily_classifications select
      8. remontada_boosts (None = no active boost)
      9. rider_xp_daily upsert
     10. teams select (per-team update)
     11. teams update
     12. teams (league snapshot)
    """
    normalized_classif = []
    for c in (classif_rows or []):
        normalized_classif.append({
            "race_slug": c.get("race_slug", GIRO_SLUG),
            "rider_id": c.get("rider_id", RIDER_ID),
            "classification_type": c["classification_type"],
            "rank": c["rank"],
        })

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
        # 5. gt_squad presence (V2: includes created_at/removed_at for cutoff)
        [{
            "team_id": TEAM_ID,
            "rider_id": RIDER_ID,
            "created_at": squad_created_at,
            "removed_at": squad_removed_at,
        }],
        # 6. gt_role_assignments latest
        [{"team_id": TEAM_ID, "rider_id": RIDER_ID, "role": role, "applied_at": role_applied_at}],
        # 7. gt_daily_classifications
        normalized_classif,
        # 8. remontada_boosts (None = no active boost → multiplier defaults to 1.0)
        None,
        # 9. rider_xp_daily upsert
        [],
        # 10. teams select
        {"id": TEAM_ID, "cumulative_xp": starting_cumulative_xp, "level": 1, "league_id": LEAGUE_ID},
        # 11. teams update
        [],
        # 12. teams (league snapshot)
        [{"id": TEAM_ID, "cumulative_xp": 150}],
    )


# ---------------------------------------------------------------------------
# Role multipliers
# ---------------------------------------------------------------------------


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
        [{"team_id": TEAM_ID, "rider_id": RIDER_ID, "created_at": BEFORE_CUTOFF, "removed_at": None}],
        [{"team_id": TEAM_ID, "rider_id": RIDER_ID, "role": "stage_hunter", "applied_at": "2026-05-10T09:00:00+02:00"}],
        [],  # gt_daily_classifications
        None,  # remontada
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


# ---------------------------------------------------------------------------
# Classification bonuses (V2: restricted to matching roles only)
# ---------------------------------------------------------------------------


async def test_gc_leader_gets_gc_classif_bonus_with_match_multiplier():
    """Rank 3 GC → base bonus (10+1-3)=8, role matches → ×1.5 → 12 classif pts.

    Total: 100 (pcs) × 1.5 (role) + 12 (classif) = 162.
    """
    import scoring

    sb = _base_mocks(
        role="gc_leader",
        classif_rows=[
            {"classification_type": "gc",     "rank": 3},
            {"classification_type": "points", "rank": 7},  # no bonus (>5)
            {"classification_type": "kom",    "rank": 4},  # no bonus (>3)
        ],
    )
    await scoring.calculate_daily_scores(sb, race_slugs=[GIRO_SLUG])

    payload = sb._last_upsert_payload("rider_xp_daily")
    assert payload["xp_gained"] == 162.0


async def test_sprinter_gets_points_classif_bonus_with_match_multiplier():
    """Sprinter ranked 2 in points → base 4, match ×1.5 → 6 classif pts.

    Total: 100 × 1.5 + 6 = 156.
    """
    import scoring

    sb = _base_mocks(
        role="sprinter",
        classif_rows=[{"classification_type": "points", "rank": 2}],
    )
    await scoring.calculate_daily_scores(sb, race_slugs=[GIRO_SLUG])

    payload = sb._last_upsert_payload("rider_xp_daily")
    assert payload["xp_gained"] == 156.0


async def test_climber_gets_kom_classif_bonus_with_match_multiplier():
    """Climber ranked 1 in KOM → base 3, match ×1.5 → 4.5 classif pts.

    Total: 100 × 1.5 + 4.5 = 154.5.
    """
    import scoring

    sb = _base_mocks(
        role="climber",
        classif_rows=[{"classification_type": "kom", "rank": 1}],
    )
    await scoring.calculate_daily_scores(sb, race_slugs=[GIRO_SLUG])

    payload = sb._last_upsert_payload("rider_xp_daily")
    assert payload["xp_gained"] == 154.5


async def test_domestique_gets_no_classif_bonus():
    """V2: domestique gets 0 classification bonus regardless of ranking.

    Rank 5 GC → base 6, but role domestique has no matching ctype → 0.
    Total: 100 × 1.0 + 0 = 100.
    """
    import scoring

    sb = _base_mocks(
        role="domestique",
        classif_rows=[{"classification_type": "gc", "rank": 5}],
    )
    await scoring.calculate_daily_scores(sb, race_slugs=[GIRO_SLUG])

    payload = sb._last_upsert_payload("rider_xp_daily")
    assert payload["xp_gained"] == 100.0


async def test_stage_hunter_gets_no_classif_bonus():
    """V2: stage_hunter has no matching classification type → 0 bonus.

    Rank 2 in points → base 4, but stage_hunter doesn't match → 0.
    Total: 100 × 1.5 (stage mult) + 0 = 150.
    """
    import scoring

    sb = _base_mocks(
        role="stage_hunter",
        classif_rows=[{"classification_type": "points", "rank": 2}],
    )
    await scoring.calculate_daily_scores(sb, race_slugs=[GIRO_SLUG])

    payload = sb._last_upsert_payload("rider_xp_daily")
    assert payload["xp_gained"] == 150.0


async def test_tt_specialist_gets_no_classif_bonus():
    """V2: tt_specialist has no matching classification type → 0 bonus."""
    import scoring

    sb = _base_mocks(
        role="tt_specialist",
        classif_rows=[{"classification_type": "gc", "rank": 1}],
    )
    await scoring.calculate_daily_scores(sb, race_slugs=[GIRO_SLUG])

    payload = sb._last_upsert_payload("rider_xp_daily")
    assert payload["xp_gained"] == 100.0


async def test_classif_outside_top_n_is_ignored():
    """Rank 11 in GC (top 10) → no bonus contribution."""
    import scoring

    sb = _base_mocks(
        role="gc_leader",
        classif_rows=[{"classification_type": "gc", "rank": 11}],
    )
    await scoring.calculate_daily_scores(sb, race_slugs=[GIRO_SLUG])

    payload = sb._last_upsert_payload("rider_xp_daily")
    assert payload["xp_gained"] == 150.0  # just the role multiplier


# ---------------------------------------------------------------------------
# 11:00 CET cutoff filtering
# ---------------------------------------------------------------------------


async def test_rider_added_after_cutoff_gets_no_multiplier():
    """Rider created_at after 11:00 CET on race day → not in squad for scoring."""
    import scoring

    sb = _base_mocks(
        role="gc_leader",
        squad_created_at=AFTER_CUTOFF,
    )
    await scoring.calculate_daily_scores(sb, race_slugs=[GIRO_SLUG])

    payload = sb._last_upsert_payload("rider_xp_daily")
    assert payload["xp_gained"] == 100.0  # no multiplier


async def test_rider_removed_before_cutoff_gets_no_multiplier():
    """Rider removed_at before 11:00 CET on race day → excluded from squad."""
    import scoring

    sb = _base_mocks(
        role="gc_leader",
        squad_created_at=BEFORE_CUTOFF,
        squad_removed_at="2026-05-11T08:00:00+02:00",  # removed 8am CET, before 11am cutoff
    )
    await scoring.calculate_daily_scores(sb, race_slugs=[GIRO_SLUG])

    payload = sb._last_upsert_payload("rider_xp_daily")
    assert payload["xp_gained"] == 100.0  # no multiplier


async def test_role_changed_after_cutoff_uses_previous_role():
    """Role assignment after cutoff is ignored — uses last role before cutoff."""
    import scoring

    sb = _base_mocks(
        role="gc_leader",
        role_applied_at=AFTER_CUTOFF,
    )
    await scoring.calculate_daily_scores(sb, race_slugs=[GIRO_SLUG])

    payload = sb._last_upsert_payload("rider_xp_daily")
    # Role assignment was after cutoff → gt_roles dict has no entry for this rider
    # → role defaults to None → multiplier defaults to 1.0
    assert payload["xp_gained"] == 100.0


# ---------------------------------------------------------------------------
# Idempotency + edge cases
# ---------------------------------------------------------------------------


async def test_idempotent_rerun_no_team_xp_delta():
    """Running with the same xp already in rider_xp_daily → teams update writes no delta."""
    import scoring

    # First run — capture total xp and starting cumulative_xp.
    sb1 = _base_mocks(
        role="gc_leader",
        classif_rows=[{"classification_type": "gc", "rank": 1}],
        starting_cumulative_xp=0.0,
    )
    await scoring.calculate_daily_scores(sb1, race_slugs=[GIRO_SLUG])
    first_xp = sb1._last_upsert_payload("rider_xp_daily")["xp_gained"]
    # 100 × 1.5 (role) + (10+1-1) × 1.5 (gc rank 1 match) = 150 + 15 = 165
    assert first_xp == 165.0
    assert sb1.updates["teams"][-1]["cumulative_xp"] == 165.0

    # Second run — prev rider_xp_daily already contains 165 for this team.
    sb2 = _base_mocks(
        role="gc_leader",
        classif_rows=[{"classification_type": "gc", "rank": 1}],
        prev_xp=[{"team_id": TEAM_ID, "xp_gained": first_xp}],
        starting_cumulative_xp=165.0,
    )
    await scoring.calculate_daily_scores(sb2, race_slugs=[GIRO_SLUG])
    # Fresh compute still yields 165 → delta=0 → update writes same 165.
    assert sb2._last_upsert_payload("rider_xp_daily")["xp_gained"] == 165.0
    teams_update_xp = sb2.updates["teams"][-1]["cumulative_xp"]
    assert teams_update_xp == 165.0  # unchanged


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
        [],  # gt_daily_classifications empty
        None,  # remontada_boosts (no active boost)
        [],  # rider_xp_daily upsert
        {"id": TEAM_ID, "cumulative_xp": 0, "level": 1, "league_id": LEAGUE_ID},
        [],
        [{"id": TEAM_ID, "cumulative_xp": 100}],
    )
    await scoring.calculate_daily_scores(sb, race_slugs=[GIRO_SLUG])

    payload = sb._last_upsert_payload("rider_xp_daily")
    assert payload["xp_gained"] == 100.0
