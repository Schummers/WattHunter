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

    # update_global_ranking now takes a browser and creates its own contexts
    mock_browser = MagicMock()
    mock_context = MagicMock()
    mock_page = MagicMock()
    mock_browser.new_context = AsyncMock(return_value=mock_context)
    mock_context.new_page = AsyncMock(return_value=mock_page)
    mock_context.close = AsyncMock()
    mock_page.goto = AsyncMock()
    mock_page.wait_for_timeout = AsyncMock()
    mock_page.content = AsyncMock(return_value="<html></html>")

    with patch("sync_race.Ranking", mock_ranking), \
         patch("sync_race.asyncio.sleep", new_callable=AsyncMock):
        result = await sync_race.update_global_ranking(sb, mock_browser, pages=1)

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


# ---------------------------------------------------------------------------
# 7. test_import_race_results_sets_is_itt_for_itt_stage
# ---------------------------------------------------------------------------


async def test_import_race_results_sets_is_itt_for_itt_stage():
    """ITT stage → race_results upsert payload has is_itt=True."""
    import sync_race

    fake_results = [{"rider_url": PCS_SLUG_MATCH, "pcs_points": 30, "rank": 1}]

    mock_stage_instance = MagicMock()
    mock_stage_instance.results.return_value = fake_results
    # stage_type is a method on procyclingstats.Stage
    mock_stage_instance.stage_type.return_value = "ITT"

    mock_stage = MagicMock(return_value=mock_stage_instance)

    sb = make_supabase(
        [{"id": RIDER_ID, "pcs_slug": PCS_SLUG_MATCH}],  # riders select
        [],                                              # race_results upsert
    )

    with _patch_fetch_html(), patch("sync_race.Stage", mock_stage):
        result = await sync_race.import_race_results(
            sb, page=MagicMock(),
            race_slug="race/paris-nice/2026",
            race_name="Paris-Nice",
            race_date="2026-03-08",
            stage_url="race/paris-nice/2026/stage-3",
        )

    assert result["imported"] == 1
    payload = sb._last_upsert_payload("race_results")
    assert payload["is_itt"] is True


async def test_import_race_results_flag_false_for_non_itt_stage():
    """Regular road stage → is_itt=False in upsert payload."""
    import sync_race

    fake_results = [{"rider_url": PCS_SLUG_MATCH, "pcs_points": 20, "rank": 5}]

    mock_stage_instance = MagicMock()
    mock_stage_instance.results.return_value = fake_results
    mock_stage_instance.stage_type.return_value = "Road stage"

    mock_stage = MagicMock(return_value=mock_stage_instance)

    sb = make_supabase(
        [{"id": RIDER_ID, "pcs_slug": PCS_SLUG_MATCH}],
        [],
    )

    with _patch_fetch_html(), patch("sync_race.Stage", mock_stage):
        await sync_race.import_race_results(
            sb, page=MagicMock(),
            race_slug=RACE_SLUG, race_name=RACE_NAME, race_date=RACE_DATE,
            stage_url=STAGE_URL,
        )

    payload = sb._last_upsert_payload("race_results")
    assert payload["is_itt"] is False


# ---------------------------------------------------------------------------
# 8. import_daily_classifications — gc/points/kom upserts
# ---------------------------------------------------------------------------


async def test_import_daily_classifications_upserts_three_types():
    """Each of gc/points/kom is upserted with rider_id + rank."""
    import sync_race

    mock_stage_instance = MagicMock()
    mock_stage_instance.gc.return_value = [
        {"rider_url": "rider/a", "rank": 1},
        {"rider_url": "rider/b", "rank": 2},
    ]
    mock_stage_instance.points.return_value = [{"rider_url": "rider/a", "rank": 3}]
    mock_stage_instance.kom.return_value = [{"rider_url": "rider/b", "rank": 1}]

    mock_stage = MagicMock(return_value=mock_stage_instance)

    stage_url = "race/giro-d-italia/2026/stage-4"
    sb = make_supabase(
        [
            {"id": "rid-a", "pcs_slug": "rider/a"},
            {"id": "rid-b", "pcs_slug": "rider/b"},
        ],
    )

    with _patch_fetch_html(), patch("sync_race.Stage", mock_stage):
        result = await sync_race.import_daily_classifications(
            sb, page=MagicMock(),
            race_slug="race/giro-d-italia/2026",
            stage_url=stage_url,
        )

    assert result["gc"] == 2
    assert result["points"] == 1
    assert result["kom"] == 1

    classif_rows = sb.upserts["gt_daily_classifications"]
    assert len(classif_rows) == 4
    types = [r["classification_type"] for r in classif_rows]
    assert types.count("gc") == 2
    assert types.count("points") == 1
    assert types.count("kom") == 1
    assert all(r["race_slug"] == stage_url for r in classif_rows)
    assert all(r["stage"] == "stage-4" for r in classif_rows)


async def test_import_daily_classifications_skips_unknown_riders():
    """Riders not in our DB are skipped silently."""
    import sync_race

    mock_stage_instance = MagicMock()
    mock_stage_instance.gc.return_value = [
        {"rider_url": "rider/known", "rank": 1},
        {"rider_url": "rider/unknown", "rank": 2},
    ]
    mock_stage_instance.points.return_value = []
    mock_stage_instance.kom.return_value = []

    mock_stage = MagicMock(return_value=mock_stage_instance)

    sb = make_supabase([{"id": "rid-k", "pcs_slug": "rider/known"}])

    with _patch_fetch_html(), patch("sync_race.Stage", mock_stage):
        result = await sync_race.import_daily_classifications(
            sb, page=MagicMock(),
            race_slug="race/giro-d-italia/2026",
            stage_url="race/giro-d-italia/2026/stage-4",
        )

    assert result["gc"] == 1
    assert result["points"] == 0
    assert result["kom"] == 0


async def test_import_daily_classifications_swallows_classif_error():
    """If one of gc/points/kom throws, others still upsert."""
    import sync_race

    mock_stage_instance = MagicMock()
    mock_stage_instance.gc.side_effect = RuntimeError("boom")
    mock_stage_instance.points.return_value = [{"rider_url": "rider/a", "rank": 1}]
    mock_stage_instance.kom.return_value = []

    mock_stage = MagicMock(return_value=mock_stage_instance)

    sb = make_supabase([{"id": "rid-a", "pcs_slug": "rider/a"}])

    with _patch_fetch_html(), patch("sync_race.Stage", mock_stage):
        result = await sync_race.import_daily_classifications(
            sb, page=MagicMock(),
            race_slug="race/giro-d-italia/2026",
            stage_url="race/giro-d-italia/2026/stage-4",
        )

    assert result["gc"] == 0
    assert result["points"] == 1
    assert result["kom"] == 0


# ---------------------------------------------------------------------------
# 9. test_import_race_results_captures_breakaway_and_profile
# ---------------------------------------------------------------------------


async def test_import_race_results_captures_breakaway_and_profile():
    """Stage results carry breakaway_kms (per rider) + the stage profile_icon into the payload."""
    import sync_race

    fake_results = [
        {"rider_url": PCS_SLUG_MATCH, "pcs_points": 50, "rank": 1, "breakaway_kms": 142.0}
    ]
    mock_stage_instance = MagicMock()
    mock_stage_instance.results.return_value = fake_results
    mock_stage_instance.stage_type.return_value = "Road stage"
    mock_stage_instance.profile_icon.return_value = "p1"
    mock_stage = MagicMock(return_value=mock_stage_instance)

    sb = make_supabase([{"id": RIDER_ID, "pcs_slug": PCS_SLUG_MATCH}], [])

    with _patch_fetch_html(), patch("sync_race.Stage", mock_stage):
        await sync_race.import_race_results(
            sb, page=MagicMock(),
            race_slug="race/paris-nice/2026", race_name="Paris-Nice",
            race_date="2026-03-08", stage_url="race/paris-nice/2026/stage-2",
        )

    payload = sb._last_upsert_payload("race_results")
    assert payload["breakaway_kms"] == 142.0
    assert payload["profile_icon"] == "p1"


async def test_import_race_results_profile_and_breakaway_none_when_unavailable():
    """Missing breakaway_kms key → None; empty profile_icon → None (no crash)."""
    import sync_race

    fake_results = [{"rider_url": PCS_SLUG_MATCH, "pcs_points": 10, "rank": 8}]
    mock_stage_instance = MagicMock()
    mock_stage_instance.results.return_value = fake_results
    mock_stage_instance.stage_type.return_value = "Road stage"
    mock_stage_instance.profile_icon.return_value = None
    mock_stage = MagicMock(return_value=mock_stage_instance)

    sb = make_supabase([{"id": RIDER_ID, "pcs_slug": PCS_SLUG_MATCH}], [])

    with _patch_fetch_html(), patch("sync_race.Stage", mock_stage):
        await sync_race.import_race_results(
            sb, page=MagicMock(),
            race_slug=RACE_SLUG, race_name=RACE_NAME, race_date=RACE_DATE,
            stage_url=STAGE_URL,
        )

    payload = sb._last_upsert_payload("race_results")
    assert payload["breakaway_kms"] is None
    assert payload["profile_icon"] is None
