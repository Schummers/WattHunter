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
