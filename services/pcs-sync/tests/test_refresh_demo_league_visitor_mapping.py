"""Verify that the rank-2 source team always maps to DEMO_TEAM_IDS[1]."""
from __future__ import annotations

import pytest

from refresh_demo_league import build_team_id_mapping, fetch_source_team_ranking
from demo_constants import DEMO_TEAM_IDS, DEMO_VISITOR_TEAM_INDEX


def test_visitor_team_index_is_rank_2() -> None:
    source_team_ids = [f"src-{i}" for i in range(8)]
    mapping = build_team_id_mapping(source_team_ids)
    visitor_src = source_team_ids[DEMO_VISITOR_TEAM_INDEX]
    assert mapping[visitor_src] == DEMO_TEAM_IDS[1]
    assert DEMO_VISITOR_TEAM_INDEX == 1


def test_short_source_team_list_aborts() -> None:
    class FakeRes:
        data = [{"id": "only-one", "cumulative_xp": 100}]

    class FakeQuery:
        def select(self, *_, **__): return self
        def eq(self, *_, **__): return self
        def order(self, *_, **__): return self
        def limit(self, *_, **__): return self
        def execute(self): return FakeRes()

    class FakeClient:
        def table(self, _): return FakeQuery()

    with pytest.raises(SystemExit):
        fetch_source_team_ranking(FakeClient(), "src-league")  # type: ignore[arg-type]
