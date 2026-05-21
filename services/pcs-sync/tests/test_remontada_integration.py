"""Integration-style test: simulate a stage scoring run that triggers a Remontada overtake.
Uses in-memory fakes for supabase tables (no DB roundtrip)."""
from unittest.mock import MagicMock, patch
import pytest

import remontada as _remontada
from remontada import detect_overtakes, record_overtake, snapshot_league_ranking


# Re-enable the feature flag for these tests — Remontada is disabled by default
# since 2026-05-21 (see docs/GAME_RULES.md §12.1).
@pytest.fixture(autouse=True)
def _enable_remontada(monkeypatch):
    monkeypatch.setattr(_remontada, "REMONTADA_ENABLED", True)


def test_end_to_end_overtake_records_trigger_and_boost():
    """4-team league: team D at rank 4 overtakes team C at rank 3 during Giro stage 5.
    D ends at rank 3 → IN podium → NOT eligible (see detect_overtakes rule).
    Use 5-team league instead: E (rank 5) overtakes D (rank 4), E ends at rank 4."""

    # Fake supabase: collects calls for later inspection.
    calls = []

    def fake_table(name):
        handle = MagicMock()
        def _record(method):
            def inner(*args, **kwargs):
                calls.append((name, method, args, kwargs))
                resp = MagicMock()
                resp.data = [{}]
                return MagicMock(execute=MagicMock(return_value=resp))
            return inner
        handle.insert = MagicMock(side_effect=_record("insert"))
        handle.upsert = MagicMock(side_effect=_record("upsert"))
        return handle

    supabase = MagicMock()
    supabase.table = MagicMock(side_effect=fake_table)

    before = [("a", 1), ("b", 2), ("c", 3), ("d", 4), ("e", 5)]
    after = [("a", 1), ("b", 2), ("c", 3), ("e", 4), ("d", 5)]
    overtakes = detect_overtakes(before, after)
    assert overtakes == [("e", "d")]

    for overtaker, overtaken in overtakes:
        record_overtake(
            supabase,
            league_id="lg-1",
            gt_identifier="giro-d-italia",
            overtaker_team_id=overtaker,
            overtaken_team_id=overtaken,
            triggered_at_stage=5,
        )

    table_names = [c[0] for c in calls]
    assert "remontada_boost_triggers" in table_names
    assert "remontada_boosts" in table_names
