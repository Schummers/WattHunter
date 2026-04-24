from unittest.mock import MagicMock
from remontada import get_gt_identifier, get_stage_number, snapshot_league_ranking

def test_gt_identifier_giro():
    assert get_gt_identifier("race/giro-d-italia/2026/stage-5") == "giro-d-italia"

def test_gt_identifier_tour():
    assert get_gt_identifier("race/tour-de-france/2026/stage-1") == "tour-de-france"

def test_gt_identifier_vuelta():
    assert get_gt_identifier("race/vuelta-a-espana/2026/gc") == "vuelta-a-espana"

def test_gt_identifier_non_gt_returns_none():
    assert get_gt_identifier("race/paris-nice/2026/stage-3") is None

def test_gt_identifier_empty_returns_none():
    assert get_gt_identifier("") is None

def test_stage_number_simple():
    assert get_stage_number("race/giro-d-italia/2026/stage-5") == 5

def test_stage_number_double_digit():
    assert get_stage_number("race/tour-de-france/2026/stage-21") == 21

def test_stage_number_gc_slug_returns_none():
    assert get_stage_number("race/vuelta-a-espana/2026/gc") is None

def test_stage_number_unrecognized_returns_none():
    assert get_stage_number("race/giro-d-italia/2026/prologue") is None


def _mock_teams_resp(teams):
    client = MagicMock()
    resp = MagicMock()
    resp.data = teams
    (client.table.return_value
        .select.return_value
        .eq.return_value
        .order.return_value
        .execute.return_value) = resp
    return client


def test_snapshot_orders_by_xp_desc():
    client = _mock_teams_resp([
        {"id": "t1", "cumulative_xp": 500},
        {"id": "t2", "cumulative_xp": 780},
        {"id": "t3", "cumulative_xp": 225},
    ])
    # Supabase mock returns the list as-is; helper sorts defensively.
    snap = snapshot_league_ranking(client, "league-uuid")
    assert snap == [("t2", 1), ("t1", 2), ("t3", 3)]


def test_snapshot_empty_league():
    client = _mock_teams_resp([])
    snap = snapshot_league_ranking(client, "league-uuid")
    assert snap == []


from remontada import detect_overtakes

def test_detect_no_overtakes_when_unchanged():
    before = [("a", 1), ("b", 2), ("c", 3)]
    after = [("a", 1), ("b", 2), ("c", 3)]
    assert detect_overtakes(before, after) == []

def test_detect_simple_overtake_hors_podium():
    # b was 2nd, c was 3rd. c moved to 2nd, b to 3rd. c is overtaker of b.
    # But c ends up at rank 2 — IN podium — so not eligible (overtaker must END hors-podium).
    # Eligibility rule: overtaker's NEW rank must be >= 4.
    before = [("a", 1), ("b", 2), ("c", 3)]
    after = [("a", 1), ("c", 2), ("b", 3)]
    assert detect_overtakes(before, after) == []

def test_detect_overtake_behind_podium():
    # 4-team league: team d (rank 4) overtakes team c (rank 3).
    # d ends up at rank 3 — IN podium — so not eligible.
    before = [("a", 1), ("b", 2), ("c", 3), ("d", 4)]
    after = [("a", 1), ("b", 2), ("d", 3), ("c", 4)]
    assert detect_overtakes(before, after) == []

def test_detect_overtake_deep_field():
    # 5-team league: team e (rank 5) overtakes team d (rank 4). e ends at rank 4 — still hors-podium.
    before = [("a", 1), ("b", 2), ("c", 3), ("d", 4), ("e", 5)]
    after = [("a", 1), ("b", 2), ("c", 3), ("e", 4), ("d", 5)]
    assert detect_overtakes(before, after) == [("e", "d")]

def test_detect_overtake_multi_leap():
    # team e (rank 5) leaps past d (rank 4) AND c (rank 3) in one scoring event, ending at rank 3.
    # e ends at podium — not eligible.
    before = [("a", 1), ("b", 2), ("c", 3), ("d", 4), ("e", 5)]
    after = [("a", 1), ("b", 2), ("e", 3), ("c", 4), ("d", 5)]
    assert detect_overtakes(before, after) == []

def test_detect_overtake_multi_leap_staying_hors_podium():
    # 6-team league: team f (rank 6) leaps past e (rank 5) AND d (rank 4), ending at rank 4.
    # f ends at rank 4 — hors-podium — eligible. Both (f, e) and (f, d) are triggers.
    before = [("a", 1), ("b", 2), ("c", 3), ("d", 4), ("e", 5), ("f", 6)]
    after = [("a", 1), ("b", 2), ("c", 3), ("f", 4), ("d", 5), ("e", 6)]
    # f passed both d and e; both pairs recorded.
    assert sorted(detect_overtakes(before, after)) == [("f", "d"), ("f", "e")]

def test_detect_small_league_under_four_players():
    # Rule: mechanic inactive when league has <4 players (no hors-podium possible).
    before = [("a", 1), ("b", 2), ("c", 3)]
    after = [("a", 1), ("c", 2), ("b", 3)]
    assert detect_overtakes(before, after) == []


from remontada import record_overtake

def _mock_upsert_client():
    client = MagicMock()
    # trigger insert returns a mock "inserted" response by default
    client.table.return_value.insert.return_value.execute.return_value = MagicMock(data=[{}])
    client.table.return_value.upsert.return_value.execute.return_value = MagicMock(data=[{}])
    return client

def test_record_overtake_inserts_trigger_and_upserts_boost():
    client = _mock_upsert_client()
    record_overtake(
        client,
        league_id="league-1",
        gt_identifier="giro-d-italia",
        overtaker_team_id="team-a",
        overtaken_team_id="team-b",
        triggered_at_stage=3,
    )
    # Assert: one insert on triggers, one upsert on boosts.
    insert_call = client.table.call_args_list[0]
    assert insert_call.args == ("remontada_boost_triggers",)
    # Simpler assertion: at least one call was on remontada_boosts.
    table_names = [c.args[0] for c in client.table.call_args_list]
    assert "remontada_boost_triggers" in table_names
    assert "remontada_boosts" in table_names

def test_record_overtake_skips_when_trigger_exists():
    # Supabase insert into triggers with unique constraint raises on conflict.
    # Our helper catches 23505 (unique_violation) and returns False without touching boosts.
    client = MagicMock()
    from postgrest.exceptions import APIError

    # APIError needs a dict-shaped message; simulate unique violation.
    err = APIError({"code": "23505", "message": "duplicate key"})
    client.table.return_value.insert.return_value.execute.side_effect = err

    applied = record_overtake(
        client,
        league_id="league-1",
        gt_identifier="giro-d-italia",
        overtaker_team_id="team-a",
        overtaken_team_id="team-b",
        triggered_at_stage=3,
    )
    assert applied is False
    # Boost upsert should NOT have been called.
    table_names = [c.args[0] for c in client.table.call_args_list]
    assert "remontada_boosts" not in table_names


from remontada import get_active_multiplier

def _mock_boost_lookup(boost_row):
    client = MagicMock()
    resp = MagicMock()
    resp.data = boost_row  # dict or None
    (client.table.return_value
        .select.return_value
        .eq.return_value
        .eq.return_value
        .maybe_single.return_value
        .execute.return_value) = resp
    return client

def test_multiplier_returns_default_when_no_boost():
    client = _mock_boost_lookup(None)
    mult = get_active_multiplier(client, team_id="t-1", gt_identifier="giro-d-italia", stage_number=5)
    assert mult == 1.0

def test_multiplier_returns_2x_when_stage_within_window():
    # triggered at stage 3, expires after stage 6 → active for stages 4, 5, 6.
    client = _mock_boost_lookup({
        "triggered_at_stage": 3,
        "expires_after_stage": 6,
        "multiplier": 2.0,
    })
    assert get_active_multiplier(client, team_id="t-1", gt_identifier="giro-d-italia", stage_number=5) == 2.0

def test_multiplier_returns_default_when_stage_before_trigger():
    # Boost triggered at stage 5; we're scoring stage 4 (earlier). Should be 1.0.
    client = _mock_boost_lookup({
        "triggered_at_stage": 5,
        "expires_after_stage": 8,
        "multiplier": 2.0,
    })
    assert get_active_multiplier(client, team_id="t-1", gt_identifier="giro-d-italia", stage_number=4) == 1.0

def test_multiplier_returns_default_when_stage_after_expiry():
    client = _mock_boost_lookup({
        "triggered_at_stage": 3,
        "expires_after_stage": 6,
        "multiplier": 2.0,
    })
    assert get_active_multiplier(client, team_id="t-1", gt_identifier="giro-d-italia", stage_number=7) == 1.0

def test_multiplier_boundary_on_trigger_stage_is_default():
    # Spec: boost applies to the NEXT 3 stages after trigger, not the trigger stage itself.
    client = _mock_boost_lookup({
        "triggered_at_stage": 3,
        "expires_after_stage": 6,
        "multiplier": 2.0,
    })
    assert get_active_multiplier(client, team_id="t-1", gt_identifier="giro-d-italia", stage_number=3) == 1.0
