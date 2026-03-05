"""Tests for sync_race.py — import_race_results, get_stage_urls,
update_global_ranking, import_season_rankings, import_startlist.

All Supabase I/O and procyclingstats library calls are mocked.
No real DB or network calls are made.
"""
from __future__ import annotations

from unittest.mock import patch, MagicMock, AsyncMock

import pytest

from helpers import make_supabase


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

RIDER_ID = "aaaa-0000-0000-0001"
RACE_SLUG = "race/tour-de-france-2026"
RACE_NAME = "Tour de France 2026"
RACE_DATE = "2026-07-01"
STAGE_URL = "race/tour-de-france-2026/stage-1"

PCS_SLUG_MATCH = "rider/tadej-pogacar"
PCS_SLUG_NO_MATCH = "rider/some-unknown-rider"


# ---------------------------------------------------------------------------
# Helper: async fetch_html mock
# ---------------------------------------------------------------------------

def _patch_fetch_html(html: str = "<html/>"):
    """Patch sync_race.fetch_html to return html without any I/O."""
    mock = AsyncMock(return_value=html)
    return patch("sync_race.fetch_html", mock)


# ---------------------------------------------------------------------------
# 1. test_one_day_race_imports_results
# ---------------------------------------------------------------------------


async def test_one_day_race_imports_results():
    """import_race_results(): one matching rider → imported=1, skipped=1."""
    import sync_race

    # Two result entries: one whose rider_url is in our DB, one that isn't
    fake_results = [
        {"rider_url": PCS_SLUG_MATCH, "points": 100, "rank": 1},
        {"rider_url": PCS_SLUG_NO_MATCH, "points": 60, "rank": 2},
    ]

    mock_stage = MagicMock()
    mock_stage.return_value.results.return_value = fake_results

    # Supabase: first table() call → riders with one matching slug
    # second table() call → upsert race_results
    sb = make_supabase(
        [{"id": RIDER_ID, "pcs_slug": PCS_SLUG_MATCH}],  # riders select
        [],  # race_results upsert
    )

    with _patch_fetch_html(), patch("sync_race.Stage", mock_stage):
        result = await sync_race.import_race_results(
            sb, page=MagicMock(), race_slug=RACE_SLUG,
            race_name=RACE_NAME, race_date=RACE_DATE,
        )

    assert result["imported"] == 1
    assert result["skipped"] == 1
    assert result["total_in_race"] == 2
    assert result["errors"] == []


# ---------------------------------------------------------------------------
# 2. test_stage_race_fetches_stages
# ---------------------------------------------------------------------------


async def test_stage_race_fetches_stages():
    """get_stage_urls(): multi-stage race → returns list of 2 stage dicts."""
    import sync_race

    fake_stages = [
        {"stage_url": f"{RACE_SLUG}/stage-1", "name": "Stage 1"},
        {"stage_url": f"{RACE_SLUG}/stage-2", "name": "Stage 2"},
    ]

    mock_race = MagicMock()
    mock_race.return_value.is_one_day_race.return_value = False
    mock_race.return_value.stages.return_value = fake_stages

    with _patch_fetch_html(), patch("sync_race.Race", mock_race):
        stages = await sync_race.get_stage_urls(page=MagicMock(), race_slug=RACE_SLUG)

    assert len(stages) == 2
    assert stages[0]["stage_url"] == f"{RACE_SLUG}/stage-1"
    assert stages[1]["stage_url"] == f"{RACE_SLUG}/stage-2"


# ---------------------------------------------------------------------------
# 3. test_one_day_race_returns_empty_stages
# ---------------------------------------------------------------------------


async def test_one_day_race_returns_empty_stages():
    """get_stage_urls(): one-day race → returns empty list."""
    import sync_race

    mock_race = MagicMock()
    mock_race.return_value.is_one_day_race.return_value = True

    with _patch_fetch_html(), patch("sync_race.Race", mock_race):
        stages = await sync_race.get_stage_urls(page=MagicMock(), race_slug=RACE_SLUG)

    assert stages == []


# ---------------------------------------------------------------------------
# 4. test_updates_matching_riders
# ---------------------------------------------------------------------------


async def test_updates_matching_riders():
    """update_global_ranking(): only 1 of 2 ranking entries matches a rider → updated=1."""
    import sync_race

    fake_ranking = [
        {"rider_url": PCS_SLUG_MATCH, "points": 4500, "rank": 1},
        {"rider_url": PCS_SLUG_NO_MATCH, "points": 3000, "rank": 2},
    ]

    mock_ranking = MagicMock()
    mock_ranking.return_value.individual_ranking.return_value = fake_ranking

    # Supabase: riders select → one match; then riders update (for matched rider)
    sb = make_supabase(
        [{"id": RIDER_ID, "pcs_slug": PCS_SLUG_MATCH}],  # riders select
        [],  # riders update (matched entry)
    )

    with _patch_fetch_html(), patch("sync_race.Ranking", mock_ranking):
        result = await sync_race.update_global_ranking(sb, page=MagicMock())

    assert result["updated"] == 1
    assert result["total_in_ranking"] == 2
    assert result["errors"] == []


# ---------------------------------------------------------------------------
# 5. test_imports_3_seasons
# ---------------------------------------------------------------------------


async def test_imports_3_seasons():
    """import_season_rankings(): processes 3 seasons → seasons_processed=3."""
    import sync_race

    fake_ranking = [
        {"rider_url": PCS_SLUG_MATCH, "points": 2000, "rank": 5},
    ]

    mock_ranking = MagicMock()
    mock_ranking.return_value.individual_ranking.return_value = fake_ranking

    # Supabase per season: riders select + rider_season_rankings upsert
    # 3 seasons × 2 table calls = 6 calls total
    sb = make_supabase(
        [{"id": RIDER_ID, "pcs_slug": PCS_SLUG_MATCH}],  # season 1 — riders
        [],  # season 1 — upsert
        [{"id": RIDER_ID, "pcs_slug": PCS_SLUG_MATCH}],  # season 2 — riders
        [],  # season 2 — upsert
        [{"id": RIDER_ID, "pcs_slug": PCS_SLUG_MATCH}],  # season 3 — riders
        [],  # season 3 — upsert
    )

    with _patch_fetch_html(), patch("sync_race.Ranking", mock_ranking):
        result = await sync_race.import_season_rankings(
            sb, page=MagicMock(), seasons=[2024, 2025, 2026]
        )

    assert result["seasons_processed"] == 3
    assert result["errors"] == []


# ---------------------------------------------------------------------------
# 6. test_imports_startlist
# ---------------------------------------------------------------------------


async def test_imports_startlist():
    """import_startlist(): 2 startlist entries, 1 matches DB → imported=1, skipped=1."""
    import sync_race

    fake_startlist = [
        {"rider_url": PCS_SLUG_MATCH, "team_name": "Team Alpha"},
        {"rider_url": PCS_SLUG_NO_MATCH, "team_name": "Team Beta"},
    ]

    mock_startlist = MagicMock()
    mock_startlist.return_value.startlist.return_value = fake_startlist

    # Supabase: riders select + race_startlists upsert
    sb = make_supabase(
        [{"id": RIDER_ID, "pcs_slug": PCS_SLUG_MATCH}],  # riders select
        [],  # race_startlists upsert
    )

    with _patch_fetch_html(), patch("sync_race.RaceStartlist", mock_startlist):
        result = await sync_race.import_startlist(
            sb, page=MagicMock(),
            race_slug=RACE_SLUG, race_name=RACE_NAME, race_date=RACE_DATE,
        )

    assert result["imported"] == 1
    assert result["skipped"] == 1
    assert result["total_in_startlist"] == 2
    assert result["errors"] == []
