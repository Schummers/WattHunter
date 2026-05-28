"""Smoke: --dry-run prints the plan, makes no writes."""
from __future__ import annotations

import sys
from unittest.mock import MagicMock

import refresh_demo_league as r


def test_dry_run_no_writes(monkeypatch, capsys) -> None:
    fake_client = MagicMock()

    # `assert_target_is_demo` path: leagues.select.eq.single.execute → is_demo=true
    fake_client.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = {
        "id": r.DEMO_LEAGUE_ID,
        "is_demo": True,
    }

    # `fetch_source_team_ranking` path: teams.select.eq.order.limit.execute → 8 rows
    fake_client.table.return_value.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value.data = [
        {"id": f"src-{i}", "cumulative_xp": 1000 - i * 100} for i in range(8)
    ]

    # `build_user_id_mapping` path: league_members.select.eq.execute → []
    fake_client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []

    monkeypatch.setattr(r, "assert_constants_in_sync", lambda: None)
    monkeypatch.setattr(r, "make_client", lambda: fake_client)
    monkeypatch.setattr(sys, "argv", ["refresh_demo_league.py", "--source-league-id", "src-league", "--dry-run"])

    r.main()
    captured = capsys.readouterr()
    assert "Visitor team:" in captured.out
    assert "--dry-run: no writes." in captured.out
