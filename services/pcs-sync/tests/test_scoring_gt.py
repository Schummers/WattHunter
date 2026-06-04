"""Tests for GT scoring path — role multipliers + daily classif bonus."""
from __future__ import annotations

from helpers import make_supabase


TEAM_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1"
RIDER_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1"
RIDER_ID_2 = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2"
CONTRACT_ID = "cccccccc-cccc-cccc-cccc-ccccccccccc1"
CONTRACT_ID_2 = "cccccccc-cccc-cccc-cccc-ccccccccccc2"
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
    breakaway_kms: float | None = None,
    profile_icon: str | None = "p4",
):
    """Build a Supabase mock covering the full GT scoring flow (role multipliers only).

    profile_icon defaults to "p4" (mountain): a real stage always carries a profile,
    and scoring now fails loud on an unseeded squad stage (SC-4). "p4" is neutral for
    every role except sprinter (which the sprinter-specific tests set explicitly).

    Response order mirrors the supabase.table() calls made by calculate_daily_scores:
      1. race_results select
      2. rider_xp_daily select (prev — for idempotency delta)
      3. contracts select
      4. team_strategies select
      5. gt_squad select (with created_at, removed_at for cutoff filtering)
      6. gt_role_assignments select
      7. gt_daily_classifications select
      8. gt_tactic_activations select (Task 7 prefetch — populate-only, no scoring effect)
      9. rider_xp_daily upsert
     10. teams select (per-team update)
     11. teams update
     12. teams select (league ranking snapshot)
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
            "breakaway_kms": breakaway_kms,
            "profile_icon": profile_icon,
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
        # 8. gt_tactic_activations (Task 7 — populate-only, no activations yet)
        [],
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

    sb = _base_mocks(role="sprinter", profile_icon="p1")
    await scoring.calculate_daily_scores(sb, race_slugs=[GIRO_SLUG])

    payload = sb._last_upsert_payload("rider_xp_daily")
    assert payload["xp_gained"] == 150.0  # 100 × 1.5 (sprinter on p1 stage)


async def test_sprinter_no_multiplier_on_mountain_profile():
    """Sprinter on a mountain stage (p4/p5) → ×1.0 (Spec A A4)."""
    import scoring

    sb = _base_mocks(role="sprinter", profile_icon="p4")
    await scoring.calculate_daily_scores(sb, race_slugs=[GIRO_SLUG])

    payload = sb._last_upsert_payload("rider_xp_daily")
    assert payload["xp_gained"] == 100.0


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


async def test_stage_hunter_in_breakaway_gets_1_5x_plus_distance():
    """Stage hunter in the break (≥30 km): ×1.5 on the result + 1 pt/10 km additive (Spec A A3)."""
    import scoring

    sb = _base_mocks(role="stage_hunter", breakaway_kms=120.0)
    await scoring.calculate_daily_scores(sb, race_slugs=[GIRO_SLUG])

    payload = sb._last_upsert_payload("rider_xp_daily")
    # 100 × 1.5 + floor(120/10)=12 → 162
    assert payload["xp_gained"] == 162.0
    assert payload["gt_role_mult"] == 1.5
    assert payload["gt_distance_bonus"] == 12.0


async def test_stage_hunter_not_in_breakaway_gets_no_multiplier():
    """Stage hunter outside the break → ×1.0, no distance bonus (Spec A A3)."""
    import scoring

    sb = _base_mocks(role="stage_hunter", breakaway_kms=None)
    await scoring.calculate_daily_scores(sb, race_slugs=[GIRO_SLUG])

    payload = sb._last_upsert_payload("rider_xp_daily")
    assert payload["xp_gained"] == 100.0
    assert payload["gt_role_mult"] == 1.0
    assert payload["gt_distance_bonus"] == 0.0


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
            "breakaway_kms": None,
            "profile_icon": None,
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
        [],  # gt_tactic_activations (Task 7 — no activations yet)
        {"id": TEAM_ID, "cumulative_xp": 0, "level": 1, "league_id": LEAGUE_ID},
        [],
        [{"id": TEAM_ID, "cumulative_xp": 100}],
    )
    await scoring.calculate_daily_scores(sb, race_slugs=[gc_slug])

    payload = sb._last_upsert_payload("rider_xp_daily")
    assert payload["xp_gained"] == 100.0


async def test_stage_hunter_breakaway_no_bonus_on_gc():
    """Stage hunter with breakaway_kms on a /gc slug → ×1.0, no distance bonus (Spec A A2/A5)."""
    import scoring

    gc_slug = "race/giro-d-italia/2026/gc"
    sb = make_supabase(
        [{
            "rider_id": RIDER_ID,
            "race_slug": gc_slug,
            "pcs_points": 100,
            "race_date": "2026-05-28",
            "is_itt": False,
            "breakaway_kms": 120.0,
            "profile_icon": None,
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
        [],  # gt_tactic_activations
        {"id": TEAM_ID, "cumulative_xp": 0, "level": 1, "league_id": LEAGUE_ID},
        [],
        [{"id": TEAM_ID, "cumulative_xp": 100}],
    )
    await scoring.calculate_daily_scores(sb, race_slugs=[gc_slug])

    payload = sb._last_upsert_payload("rider_xp_daily")
    assert payload["xp_gained"] == 100.0
    assert payload["gt_distance_bonus"] == 0.0
    assert payload["gt_role_mult"] == 1.0


async def test_gc_leader_no_multiplier_on_gc_final():
    """GC final (/gc) → ×1.0 even for gc_leader (Spec A A2, no double-boost)."""
    import scoring

    gc_slug = "race/giro-d-italia/2026/gc"
    sb = make_supabase(
        [{"rider_id": RIDER_ID, "race_slug": gc_slug, "pcs_points": 100,
          "race_date": "2026-05-28", "is_itt": False,
          "breakaway_kms": None, "profile_icon": None}],
        [],
        [{"id": CONTRACT_ID, "team_id": TEAM_ID, "rider_id": RIDER_ID,
          "purchased_at": "2026-01-01T00:00:00Z", "release_date": None, "released_at": None,
          "riders": {"specialty": "GC", "nationality": "BE", "real_team": "Soudal", "birthdate": "1998-01-01"}}],
        [],
        [{"team_id": TEAM_ID, "rider_id": RIDER_ID, "created_at": BEFORE_CUTOFF, "removed_at": None}],
        [{"team_id": TEAM_ID, "rider_id": RIDER_ID, "role": "gc_leader", "applied_at": "2026-05-10T09:00:00+02:00"}],
        [],
        [],
        {"id": TEAM_ID, "cumulative_xp": 0, "level": 1, "league_id": LEAGUE_ID},
        [],
        [{"id": TEAM_ID, "cumulative_xp": 100}],
    )
    await scoring.calculate_daily_scores(sb, race_slugs=[gc_slug])

    payload = sb._last_upsert_payload("rider_xp_daily")
    assert payload["xp_gained"] == 100.0  # was 150 under the old ×1.5 GC boost


async def test_domestique_no_multiplier():
    import scoring

    sb = _base_mocks(role="domestique")
    await scoring.calculate_daily_scores(sb, race_slugs=[GIRO_SLUG])

    payload = sb._last_upsert_payload("rider_xp_daily")
    assert payload["xp_gained"] == 100.0


async def test_non_gt_race_no_multiplier():
    """Outside stage-race slugs (e.g. monuments / one-day races), roles are irrelevant
    even if the rider is in a squad — Spec A A9 narrowed the gate to stage-races only,
    so this test now uses a one-day monument slug (Milano-Sanremo) instead of Paris-Nice
    (which became a 1-week stage-race in P3b)."""
    import scoring

    classics_slug = "race/milano-sanremo/2026"
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
    """Rank 3 GC → base bonus (10+1-3)=8, role matches → ×2.0 → 16 classif pts.

    Total: 100 (pcs) × 1.5 (role) + 16 (classif) = 166.
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
    assert payload["xp_gained"] == 166.0


async def test_sprinter_gets_points_classif_bonus_with_match_multiplier():
    """Sprinter ranked 2 in points → base 4, match ×2.0 → 8 classif pts.

    Total: 100 × 1.5 (on p1 stage) + 8 = 158.
    """
    import scoring

    sb = _base_mocks(
        role="sprinter",
        profile_icon="p1",
        classif_rows=[{"classification_type": "points", "rank": 2}],
    )
    await scoring.calculate_daily_scores(sb, race_slugs=[GIRO_SLUG])

    payload = sb._last_upsert_payload("rider_xp_daily")
    assert payload["xp_gained"] == 158.0


async def test_climber_gets_kom_classif_bonus_with_match_multiplier():
    """Climber ranked 1 in KOM → base 3, match ×2.0 → 6 classif pts.

    Total: 100 × 1.5 + 6 = 156.
    """
    import scoring

    sb = _base_mocks(
        role="climber",
        classif_rows=[{"classification_type": "kom", "rank": 1}],
    )
    await scoring.calculate_daily_scores(sb, race_slugs=[GIRO_SLUG])

    payload = sb._last_upsert_payload("rider_xp_daily")
    assert payload["xp_gained"] == 156.0


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
    """V2: stage_hunter matches no classification → 0 bonus; outside the break → ×1.0.

    points rank 2 → no match → 0. Total: 100 × 1.0 + 0 = 100.
    """
    import scoring

    sb = _base_mocks(
        role="stage_hunter",
        classif_rows=[{"classification_type": "points", "rank": 2}],
    )
    await scoring.calculate_daily_scores(sb, race_slugs=[GIRO_SLUG])

    payload = sb._last_upsert_payload("rider_xp_daily")
    assert payload["xp_gained"] == 100.0


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


async def test_gc_leader_gets_youth_classif_bonus_1_5x():
    """gc_leader matches youth at ×1.5: rank 1 youth base (5+1-1)=5 × 1.5 = 7.5."""
    import scoring

    sb = _base_mocks(
        role="gc_leader",
        classif_rows=[{"classification_type": "youth", "rank": 1}],
    )
    await scoring.calculate_daily_scores(sb, race_slugs=[GIRO_SLUG])

    payload = sb._last_upsert_payload("rider_xp_daily")
    assert payload["xp_gained"] == 157.5  # 100 × 1.5 + 7.5


# ---------------------------------------------------------------------------
# 11:00 CET cutoff filtering
# ---------------------------------------------------------------------------


async def test_rider_added_after_cutoff_gets_no_xp():
    """Rider created_at after 11:00 CET on race day → not in squad → 0 XP on GT stage."""
    import scoring

    sb = _base_mocks(
        role="gc_leader",
        squad_created_at=AFTER_CUTOFF,
    )
    result = await scoring.calculate_daily_scores(sb, race_slugs=[GIRO_SLUG])

    # Non-squad rider on GT stage earns 0 XP — no upsert, no team update.
    assert result["teams_processed"] == 0
    assert sb.upserts.get("rider_xp_daily", []) == []


async def test_rider_removed_before_cutoff_gets_no_xp():
    """Rider removed_at before 11:00 CET on race day → excluded from squad → 0 XP."""
    import scoring

    sb = _base_mocks(
        role="gc_leader",
        squad_created_at=BEFORE_CUTOFF,
        squad_removed_at="2026-05-11T08:00:00+02:00",  # removed 8am CET, before 11am cutoff
    )
    result = await scoring.calculate_daily_scores(sb, race_slugs=[GIRO_SLUG])

    # Non-squad rider on GT stage earns 0 XP — no upsert, no team update.
    assert result["teams_processed"] == 0
    assert sb.upserts.get("rider_xp_daily", []) == []


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
    # 100 × 1.5 (role) + (10+1-1) × 2.0 (gc rank 1 match) = 150 + 20 = 170
    assert first_xp == 170.0
    assert sb1.updates["teams"][-1]["cumulative_xp"] == 170.0

    # Second run — prev rider_xp_daily already contains 170 for this team.
    sb2 = _base_mocks(
        role="gc_leader",
        classif_rows=[{"classification_type": "gc", "rank": 1}],
        prev_xp=[{"team_id": TEAM_ID, "xp_gained": first_xp}],
        starting_cumulative_xp=170.0,
    )
    await scoring.calculate_daily_scores(sb2, race_slugs=[GIRO_SLUG])
    # Fresh compute still yields 170 → delta=0 → update writes same 170.
    assert sb2._last_upsert_payload("rider_xp_daily")["xp_gained"] == 170.0
    teams_update_xp = sb2.updates["teams"][-1]["cumulative_xp"]
    assert teams_update_xp == 170.0  # unchanged


async def test_rider_not_in_squad_gets_no_xp():
    """A contracted rider absent from gt_squad earns 0 XP on a GT stage."""
    import scoring

    sb = make_supabase(
        [{
            "rider_id": RIDER_ID,
            "race_slug": GIRO_SLUG,
            "pcs_points": 100,
            "race_date": "2026-05-11",
            "is_itt": False,
            "profile_icon": "p4",
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
        [],  # gt_tactic_activations
    )
    result = await scoring.calculate_daily_scores(sb, race_slugs=[GIRO_SLUG])

    # Non-squad rider on GT stage earns 0 XP — no upsert, no team update.
    assert result["teams_processed"] == 0
    assert sb.upserts.get("rider_xp_daily", []) == []


async def test_squad_rider_no_stage_points_gets_classif_bonus():
    """GC leader in GT squad with 0 stage points but rank 3 GC → classif bonus only.

    A second rider (domestique) scores stage points to prevent early return.
    RIDER_ID has no race_results entry → skipped by main loop → caught by second pass.

    xp = (10+1-3) × 2.0 = 16.0  (gc_leader matches gc, V2 ×2)
    """
    import scoring

    sb = make_supabase(
        # 1. race_results: only RIDER_ID_2 scores stage points
        [{"rider_id": RIDER_ID_2, "race_slug": GIRO_SLUG, "pcs_points": 50,
          "race_date": "2026-05-11", "is_itt": False, "profile_icon": "p4"}],
        # 2. prev rider_xp_daily
        [],
        # 3. contracts: both riders
        [
            {"id": CONTRACT_ID, "team_id": TEAM_ID, "rider_id": RIDER_ID,
             "purchased_at": "2026-01-01T00:00:00Z", "release_date": None, "released_at": None,
             "riders": {"specialty": "GC", "nationality": "CO", "real_team": "INEOS", "birthdate": "1997-01-13"}},
            {"id": CONTRACT_ID_2, "team_id": TEAM_ID, "rider_id": RIDER_ID_2,
             "purchased_at": "2026-01-01T00:00:00Z", "release_date": None, "released_at": None,
             "riders": {"specialty": "Sprint", "nationality": "BE", "real_team": "Soudal", "birthdate": "1998-01-01"}},
        ],
        # 4. team_strategies
        [],
        # 5. gt_squad: both riders
        [
            {"team_id": TEAM_ID, "rider_id": RIDER_ID, "created_at": BEFORE_CUTOFF, "removed_at": None},
            {"team_id": TEAM_ID, "rider_id": RIDER_ID_2, "created_at": BEFORE_CUTOFF, "removed_at": None},
        ],
        # 6. gt_role_assignments
        [
            {"team_id": TEAM_ID, "rider_id": RIDER_ID, "role": "gc_leader",
             "applied_at": "2026-05-10T09:00:00+02:00"},
            {"team_id": TEAM_ID, "rider_id": RIDER_ID_2, "role": "domestique",
             "applied_at": "2026-05-10T09:00:00+02:00"},
        ],
        # 7. gt_daily_classifications: RIDER_ID rank 3 GC (no stage result, but in classif)
        [{"race_slug": GIRO_SLUG, "rider_id": RIDER_ID, "classification_type": "gc", "rank": 3}],
        # 8. gt_tactic_activations
        [],
        # 9. rider_xp_daily upsert (RIDER_ID_2, main loop: 50 × 1.0 = 50)
        [],
        # 10. rider_xp_daily upsert (RIDER_ID second pass: classif only = 16.0) ← last upsert
        [],
        # 11. teams select
        {"id": TEAM_ID, "cumulative_xp": 0.0, "level": 1, "league_id": LEAGUE_ID},
        # 12. teams update
        [],
        # 13. teams select (league ranking)
        [{"id": TEAM_ID, "cumulative_xp": 62.0}],
    )
    await scoring.calculate_daily_scores(sb, race_slugs=[GIRO_SLUG])

    payloads = sb.upserts.get("rider_xp_daily", [])
    assert len(payloads) == 2, f"Expected 2 upserts, got {len(payloads)}"

    classif_only = next(p for p in payloads if p["rider_id"] == RIDER_ID)
    assert classif_only["xp_gained"] == 16.0
    assert classif_only["raw_pcs_points"] == 0
    assert classif_only["gt_classif_bonus"] == 16.0
    assert classif_only["gt_role_mult"] == 1.0


async def test_squad_rider_with_stage_points_classif_not_double_counted():
    """GC leader with stage points AND classif rank: bonus counted exactly once.

    100 × 1.5 (role) + 16 (gc rank 3, match ×2.0) = 166.0
    The second pass skips this rider (already in processed_in_team).
    """
    import scoring

    sb = _base_mocks(
        role="gc_leader",
        pcs_points=100,
        classif_rows=[{"classification_type": "gc", "rank": 3}],
    )
    await scoring.calculate_daily_scores(sb, race_slugs=[GIRO_SLUG])

    payload = sb._last_upsert_payload("rider_xp_daily")
    assert payload["xp_gained"] == 166.0  # not 182.0 (which would indicate double-count)


async def test_scoring_persists_traceability_columns():
    """Every scored GT row must populate gt_role_mult, gt_classif_bonus, nemesis_modifier,
    tactic_applied, gt_distance_bonus. When no tactics are active, values must reproduce
    the pre-tactic result.

    gc_leader + rank 3 GC: 100 × 1.5 + 16 (classif ×2) = 166, nemesis_modifier=1.0, tactic_applied=None.
    """
    import scoring

    sb = _base_mocks(
        role="gc_leader",
        pcs_points=100,
        classif_rows=[{"classification_type": "gc", "rank": 3}],
    )
    await scoring.calculate_daily_scores(sb, race_slugs=[GIRO_SLUG])

    payload = sb._last_upsert_payload("rider_xp_daily")

    # Existing xp invariant: 100 × 1.5 + (10+1-3) × 2.0 = 150 + 16 = 166
    assert payload["xp_gained"] == 166.0

    # Traceability columns
    assert payload["gt_role_mult"] == 1.5          # gc_leader on non-ITT GT stage
    assert payload["gt_classif_bonus"] == 16.0     # rank 3 GC with role-match ×2.0
    assert payload["gt_distance_bonus"] == 0.0     # no breakaway (gc_leader, not stage_hunter)
    assert payload["nemesis_modifier"] == 1.0      # no tactics active
    assert payload["tactic_applied"] is None       # no tactics active


# ---------------------------------------------------------------------------
# Final secondary classifications (Task 5 — Spec A A2)
# ---------------------------------------------------------------------------


async def test_final_points_jersey_scored_for_sprinter():
    """Sprinter wins the final Points jersey of a GT: 80 (rank 1, GT scale) × 2 = 160 XP.

    The finals row carries 0 PCS points (invisible to the main query); a second rider
    scores a stage point so calculate_daily_scores does not early-return on empty results.

    Mock-ordering: final_secondary_slugs is non-empty (race_slugs includes .../points),
    so gt_final_classifications prefetch fires at position 8 (after gt_daily_classifications,
    before gt_tactic_activations).
    """
    import scoring

    points_slug = "race/giro-d-italia/2026/points"
    sb = make_supabase(
        # 1. race_results (pcs_points>0 query): only RIDER_ID_2 scores a stage point.
        [{"rider_id": RIDER_ID_2, "race_slug": "race/giro-d-italia/2026/stage-21",
          "pcs_points": 10, "race_date": "2026-05-31", "is_itt": False,
          "breakaway_kms": None, "profile_icon": "p1"}],
        # 2. prev rider_xp_daily
        [],
        # 3. contracts
        [
            {"id": CONTRACT_ID, "team_id": TEAM_ID, "rider_id": RIDER_ID,
             "purchased_at": "2026-01-01T00:00:00Z", "release_date": None, "released_at": None,
             "riders": {"specialty": "Sprint", "nationality": "BE", "real_team": "x", "birthdate": "1998-01-01"}},
            {"id": CONTRACT_ID_2, "team_id": TEAM_ID, "rider_id": RIDER_ID_2,
             "purchased_at": "2026-01-01T00:00:00Z", "release_date": None, "released_at": None,
             "riders": {"specialty": "Sprint", "nationality": "BE", "real_team": "x", "birthdate": "1998-01-01"}},
        ],
        # 4. team_strategies
        [],
        # 5. gt_squad: both riders in squad
        [
            {"team_id": TEAM_ID, "rider_id": RIDER_ID, "created_at": BEFORE_CUTOFF, "removed_at": None},
            {"team_id": TEAM_ID, "rider_id": RIDER_ID_2, "created_at": BEFORE_CUTOFF, "removed_at": None},
        ],
        # 6. gt_role_assignments: RIDER_ID = sprinter
        [
            {"team_id": TEAM_ID, "rider_id": RIDER_ID, "role": "sprinter", "applied_at": "2026-05-10T09:00:00+02:00"},
            {"team_id": TEAM_ID, "rider_id": RIDER_ID_2, "role": "domestique", "applied_at": "2026-05-10T09:00:00+02:00"},
        ],
        # 7. gt_daily_classifications
        [],
        # 8. final-secondary prefetch (gt_final_classifications in_ final slugs): RIDER_ID rank 1 points
        [{"rider_id": RIDER_ID, "race_slug": points_slug, "classification_type": "points",
          "rank": 1, "race_date": "2026-05-31"}],
        # 9. gt_tactic_activations
        [],
        # 10. rider_xp_daily upsert (RIDER_ID_2, main loop: 10 × 1.0 = 10)
        [],
        # 11. rider_xp_daily upsert (RIDER_ID, third pass: points jersey = 160)
        [],
        # 12. teams select
        {"id": TEAM_ID, "cumulative_xp": 0.0, "level": 1, "league_id": LEAGUE_ID},
        # 13. teams update
        [],
        # 14. teams select (league ranking snapshot)
        [{"id": TEAM_ID, "cumulative_xp": 170.0}],
        # 15. team_ranking_daily upsert
        [],
    )
    await scoring.calculate_daily_scores(
        sb, race_slugs=["race/giro-d-italia/2026/stage-21", points_slug]
    )

    payloads = sb.upserts.get("rider_xp_daily", [])
    points_row = next(p for p in payloads if p["race_slug"] == points_slug)
    assert points_row["xp_gained"] == 160.0
    assert points_row["gt_classif_bonus"] == 160.0
    assert points_row["raw_pcs_points"] == 0


# ---------------------------------------------------------------------------
# Spec A A9 — 1-week Race Team squad gating + finals-secondary
# ---------------------------------------------------------------------------

# Note: the plan referenced a `make_supabase_for_gt(contracts=..., race_results=...,
# gt_squad=..., gt_roles=..., gt_final_classifications=...)` fixture that does not
# exist in this codebase. Helpers expose `make_supabase(*positional_responses)` which
# queues responses against successive `.table()` calls. The tests below adapt to that
# pattern, mirroring `test_rider_not_in_squad_gets_no_xp` (stage scoring) and
# `test_final_points_jersey_scored_for_sprinter` (finals-secondary).


class TestOneWeekSquadGating:
    """Squad scoring on a 1-week stage-race slug behaves like a GT
    (gate non-squad riders to 0, classif bonus + finals-secondary one_week)."""

    async def test_one_week_stage_gates_non_squad_riders(self):
        """A contracted rider NOT in the gt_squad of paris-nice must score 0 on the stage,
        while an in-squad sprinter on a p2 stage gets the ×1.5 multiplier."""
        import scoring

        paris_nice_slug = "race/paris-nice/2026/stage-3"
        rider_in_squad = RIDER_ID
        rider_not_in_squad = RIDER_ID_2

        sb = make_supabase(
            # 1. race_results
            [
                {"rider_id": rider_in_squad, "race_slug": paris_nice_slug,
                 "pcs_points": 40, "race_date": "2026-03-10", "is_itt": False,
                 "breakaway_kms": None, "profile_icon": "p2"},
                {"rider_id": rider_not_in_squad, "race_slug": paris_nice_slug,
                 "pcs_points": 30, "race_date": "2026-03-10", "is_itt": False,
                 "breakaway_kms": None, "profile_icon": "p2"},
            ],
            # 2. prev rider_xp_daily
            [],
            # 3. contracts — both riders contracted
            [
                {"id": CONTRACT_ID, "team_id": TEAM_ID, "rider_id": rider_in_squad,
                 "purchased_at": "2026-01-01T00:00:00Z", "release_date": None, "released_at": None,
                 "riders": {"specialty": "Sprint", "nationality": "BE", "real_team": "x", "birthdate": "1998-01-01"}},
                {"id": CONTRACT_ID_2, "team_id": TEAM_ID, "rider_id": rider_not_in_squad,
                 "purchased_at": "2026-01-01T00:00:00Z", "release_date": None, "released_at": None,
                 "riders": {"specialty": "Sprint", "nationality": "BE", "real_team": "x", "birthdate": "1998-01-01"}},
            ],
            # 4. team_strategies
            [],
            # 5. gt_squad — only rider_in_squad is in squad
            [{"team_id": TEAM_ID, "rider_id": rider_in_squad,
              "created_at": "2026-03-08T00:00:00+02:00", "removed_at": None}],
            # 6. gt_role_assignments — sprinter role for rider_in_squad
            [{"team_id": TEAM_ID, "rider_id": rider_in_squad,
              "role": "sprinter", "applied_at": "2026-03-08T00:00:00+02:00"}],
            # 7. gt_daily_classifications
            [],
            # 8. gt_tactic_activations (no /points slug, so finals prefetch skipped)
            [],
            # 9. rider_xp_daily upsert
            [],
            # 10. teams select
            {"id": TEAM_ID, "cumulative_xp": 0.0, "level": 1, "league_id": LEAGUE_ID},
            # 11. teams update
            [],
            # 12. teams snapshot
            [{"id": TEAM_ID, "cumulative_xp": 60.0}],
            # 13. team_ranking_daily upsert
            [],
        )

        await scoring.calculate_daily_scores(sb, race_slugs=[paris_nice_slug])

        upserts = sb.upserts.get("rider_xp_daily", [])
        rider_xp = {r["rider_id"]: r["xp_gained"] for r in upserts}

        # In-squad sprinter on p2 → ×1.5 sprinter multiplier on 40 pts = 60.
        assert rider_xp[rider_in_squad] == 60.0
        # Out-of-squad rider gated out (continue) → no upsert recorded.
        assert rider_not_in_squad not in rider_xp

    async def test_one_week_final_secondary_uses_40_10_5_scale(self):
        """Points/KOM/Youth finals on a 1-week race use [40, 10, 5], not [80, 20, 10].

        Sprinter wins the final Points jersey of paris-nice: 40 (rank 1, one_week scale) × 2 = 80.
        """
        import scoring

        points_slug = "race/paris-nice/2026/points"
        sb = make_supabase(
            # 1. race_results — RIDER_ID_2 scores a stage point so calculate_daily_scores
            # doesn't early-return on empty results.
            [{"rider_id": RIDER_ID_2, "race_slug": "race/paris-nice/2026/stage-7",
              "pcs_points": 10, "race_date": "2026-03-15", "is_itt": False,
              "breakaway_kms": None, "profile_icon": "p1"}],
            # 2. prev rider_xp_daily
            [],
            # 3. contracts — both riders contracted, both in squad
            [
                {"id": CONTRACT_ID, "team_id": TEAM_ID, "rider_id": RIDER_ID,
                 "purchased_at": "2026-01-01T00:00:00Z", "release_date": None, "released_at": None,
                 "riders": {"specialty": "Sprint", "nationality": "BE", "real_team": "x", "birthdate": "1998-01-01"}},
                {"id": CONTRACT_ID_2, "team_id": TEAM_ID, "rider_id": RIDER_ID_2,
                 "purchased_at": "2026-01-01T00:00:00Z", "release_date": None, "released_at": None,
                 "riders": {"specialty": "Sprint", "nationality": "BE", "real_team": "x", "birthdate": "1998-01-01"}},
            ],
            # 4. team_strategies
            [],
            # 5. gt_squad: both riders
            [
                {"team_id": TEAM_ID, "rider_id": RIDER_ID,
                 "created_at": "2026-03-08T00:00:00+02:00", "removed_at": None},
                {"team_id": TEAM_ID, "rider_id": RIDER_ID_2,
                 "created_at": "2026-03-08T00:00:00+02:00", "removed_at": None},
            ],
            # 6. gt_role_assignments
            [
                {"team_id": TEAM_ID, "rider_id": RIDER_ID, "role": "sprinter",
                 "applied_at": "2026-03-08T00:00:00+02:00"},
                {"team_id": TEAM_ID, "rider_id": RIDER_ID_2, "role": "domestique",
                 "applied_at": "2026-03-08T00:00:00+02:00"},
            ],
            # 7. gt_daily_classifications
            [],
            # 8. gt_final_classifications (prefetch — RIDER_ID wins the Points jersey)
            [{"rider_id": RIDER_ID, "race_slug": points_slug, "classification_type": "points",
              "rank": 1, "race_date": "2026-03-15"}],
            # 9. gt_tactic_activations
            [],
            # 10. rider_xp_daily upsert (RIDER_ID_2 stage point, RIDER_ID points jersey)
            [],
            # 11. teams select
            {"id": TEAM_ID, "cumulative_xp": 0.0, "level": 1, "league_id": LEAGUE_ID},
            # 12. teams update
            [],
            # 13. teams snapshot
            [{"id": TEAM_ID, "cumulative_xp": 90.0}],
            # 14. team_ranking_daily upsert
            [],
        )

        await scoring.calculate_daily_scores(
            sb, race_slugs=["race/paris-nice/2026/stage-7", points_slug]
        )

        upserts = sb.upserts.get("rider_xp_daily", [])
        points_row = next(p for p in upserts if p["race_slug"] == points_slug)
        # one_week scale rank 1 = 40 base × 2 (sprinter matched on 'points') = 80.
        assert points_row["xp_gained"] == 80.0
        assert points_row["gt_classif_bonus"] == 80.0
