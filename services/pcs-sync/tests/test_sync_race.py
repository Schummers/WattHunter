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
# 6b. test_startlist_purges_stale_riders
# ---------------------------------------------------------------------------


async def test_startlist_purges_stale_riders():
    """Full re-scrape (>= PURGE_MIN_RATIO of stored rows) → stale riders removed."""
    import sync_race

    fake_startlist = [
        {"rider_url": "rider/one", "team_name": "Team Alpha"},
        {"rider_url": "rider/two", "team_name": "Team Beta"},
    ]

    mock_startlist = MagicMock()
    mock_startlist.return_value.startlist.return_value = fake_startlist

    sb = make_supabase(
        [  # riders select — both entries match
            {"id": "r1", "pcs_slug": "rider/one"},
            {"id": "r2", "pcs_slug": "rider/two"},
        ],
        [],  # upsert rider/one
        [],  # upsert rider/two
        [  # existing race_startlists rows — r3 is no longer on the startlist
            {"rider_id": "r1"},
            {"rider_id": "r2"},
            {"rider_id": "r3"},
        ],
        [],  # delete stale rows
    )

    with _patch_fetch_html(), patch("sync_race.RaceStartlist", mock_startlist):
        result = await sync_race.import_startlist(
            sb, page=MagicMock(),
            race_slug=RACE_SLUG, race_name=RACE_NAME, race_date=RACE_DATE,
        )

    assert result["imported"] == 2
    assert result["removed"] == 1  # r3 purged (2 imported >= 0.5 * 3 stored)


async def test_startlist_purge_skipped_on_partial_scrape():
    """Partial scrape (< PURGE_MIN_RATIO of stored rows) → purge skipped, nothing removed."""
    import sync_race

    fake_startlist = [
        {"rider_url": "rider/one", "team_name": "Team Alpha"},
    ]

    mock_startlist = MagicMock()
    mock_startlist.return_value.startlist.return_value = fake_startlist

    sb = make_supabase(
        [{"id": "r1", "pcs_slug": "rider/one"}],  # riders select
        [],  # upsert rider/one
        [  # existing rows: 3 stored, only 1 imported → 1 < 0.5 * 3 → skip purge
            {"rider_id": "r1"},
            {"rider_id": "r2"},
            {"rider_id": "r3"},
        ],
    )

    with _patch_fetch_html(), patch("sync_race.RaceStartlist", mock_startlist):
        result = await sync_race.import_startlist(
            sb, page=MagicMock(),
            race_slug=RACE_SLUG, race_name=RACE_NAME, race_date=RACE_DATE,
        )

    assert result["imported"] == 1
    assert result["removed"] == 0  # valid rows preserved despite truncated scrape


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
    mock_stage_instance.youth.return_value = []

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
    mock_stage_instance.youth.return_value = []

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
    mock_stage_instance.youth.return_value = []

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


# ---------------------------------------------------------------------------
# 10. import_daily_classifications — youth classification
# ---------------------------------------------------------------------------


async def test_import_daily_classifications_includes_youth():
    """youth classification is scraped + upserted alongside gc/points/kom."""
    import sync_race

    mock_stage_instance = MagicMock()
    mock_stage_instance.gc.return_value = []
    mock_stage_instance.points.return_value = []
    mock_stage_instance.kom.return_value = []
    mock_stage_instance.youth.return_value = [
        {"rider_url": "rider/young", "rank": 1},
        {"rider_url": "rider/young2", "rank": 2},
    ]
    mock_stage = MagicMock(return_value=mock_stage_instance)

    stage_url = "race/giro-d-italia/2026/stage-4"
    sb = make_supabase([
        {"id": "rid-y1", "pcs_slug": "rider/young"},
        {"id": "rid-y2", "pcs_slug": "rider/young2"},
    ])

    with _patch_fetch_html(), patch("sync_race.Stage", mock_stage):
        result = await sync_race.import_daily_classifications(
            sb, page=MagicMock(),
            race_slug="race/giro-d-italia/2026", stage_url=stage_url,
        )

    assert result["youth"] == 2
    classif_rows = sb.upserts["gt_daily_classifications"]
    youth_rows = [r for r in classif_rows if r["classification_type"] == "youth"]
    assert len(youth_rows) == 2
    assert all(r["race_slug"] == stage_url for r in youth_rows)


# ---------------------------------------------------------------------------
# 11. import_gc_results — has_points flag (Task 4)
# ---------------------------------------------------------------------------


async def test_import_gc_results_reports_has_points():
    """import_gc_results flags whether the GC carries real PCS points (GT complete signal)."""
    import sync_race

    gc_entries = [{"rider_url": PCS_SLUG_MATCH, "rank": 1, "pcs_points": 400}]
    mock_stage_instance = MagicMock()
    mock_stage_instance.gc.return_value = gc_entries
    mock_stage = MagicMock(return_value=mock_stage_instance)
    sb = make_supabase([{"id": RIDER_ID, "pcs_slug": PCS_SLUG_MATCH}], [])

    with _patch_fetch_html(), patch("sync_race.Stage", mock_stage):
        result = await sync_race.import_gc_results(
            sb, page=MagicMock(),
            race_slug="race/giro-d-italia/2026", race_name="Giro", race_date="2026-05-28",
        )
    assert result["has_points"] is True


async def test_import_gc_results_has_points_false_when_zero():
    import sync_race

    gc_entries = [{"rider_url": PCS_SLUG_MATCH, "rank": 1, "pcs_points": 0}]
    mock_stage_instance = MagicMock()
    mock_stage_instance.gc.return_value = gc_entries
    mock_stage = MagicMock(return_value=mock_stage_instance)
    sb = make_supabase([{"id": RIDER_ID, "pcs_slug": PCS_SLUG_MATCH}], [])

    with _patch_fetch_html(), patch("sync_race.Stage", mock_stage):
        result = await sync_race.import_gc_results(
            sb, page=MagicMock(),
            race_slug="race/giro-d-italia/2026", race_name="Giro", race_date="2026-05-15",
        )
    assert result["has_points"] is False


# ---------------------------------------------------------------------------
# 12. import_final_classifications (Task 4)
# ---------------------------------------------------------------------------


async def test_import_final_classifications_stores_rank_per_jersey():
    """Final Points/KOM/Youth standings are upserted into the dedicated gt_final_classifications
    table (NOT race_results) with the rank + classification_type."""
    import sync_race

    def _stage_factory(url, html=None, update_html=False):
        inst = MagicMock()
        inst.points.return_value = [{"rider_url": PCS_SLUG_MATCH, "rank": 1}]
        inst.kom.return_value = [{"rider_url": PCS_SLUG_MATCH, "rank": 2}]
        inst.youth.return_value = [{"rider_url": PCS_SLUG_MATCH, "rank": 3}]
        return inst

    sb = make_supabase(
        [{"id": RIDER_ID, "pcs_slug": PCS_SLUG_MATCH}],  # riders lookup
    )

    with _patch_fetch_html(), patch("sync_race.Stage", side_effect=_stage_factory):
        counts = await sync_race.import_final_classifications(
            sb, page=MagicMock(),
            race_slug="race/giro-d-italia/2026", race_name="Giro", race_date="2026-05-28",
        )

    assert counts == {"points": 1, "kom": 1, "youth": 1}
    # MUST land in gt_final_classifications, NOT race_results (no pollution of other consumers).
    assert "race_results" not in sb.upserts
    rows = sb.upserts["gt_final_classifications"]
    by_slug = {r["race_slug"]: r for r in rows}
    assert by_slug["race/giro-d-italia/2026/points"]["rank"] == 1
    assert by_slug["race/giro-d-italia/2026/points"]["classification_type"] == "points"
    assert by_slug["race/giro-d-italia/2026/kom"]["rank"] == 2
    assert by_slug["race/giro-d-italia/2026/youth"]["rank"] == 3


async def test_import_final_classifications_continues_on_jersey_failure():
    """A fetch failure on one jersey must not abort the others (per-jersey resilience)."""
    import sync_race

    def _stage_factory(url, html=None, update_html=False):
        if "/kom" in url:
            raise RuntimeError("network error")
        inst = MagicMock()
        inst.points.return_value = [{"rider_url": PCS_SLUG_MATCH, "rank": 1}]
        inst.youth.return_value = [{"rider_url": PCS_SLUG_MATCH, "rank": 3}]
        return inst

    sb = make_supabase([{"id": RIDER_ID, "pcs_slug": PCS_SLUG_MATCH}])

    with _patch_fetch_html(), patch("sync_race.Stage", side_effect=_stage_factory):
        counts = await sync_race.import_final_classifications(
            sb, page=MagicMock(),
            race_slug="race/giro-d-italia/2026", race_name="Giro", race_date="2026-05-28",
        )

    assert counts == {"points": 1, "kom": 0, "youth": 1}


# ---------------------------------------------------------------------------
# 12. import_stage_profiles — Spec A P3a
# ---------------------------------------------------------------------------


async def test_import_stage_profiles_upserts_one_row_per_stage():
    """Race.stages() → one stage_profiles row per stage, profile_icon + date carried through."""
    import sync_race

    fake_stages = [
        {"stage_url": "race/tour-de-france/2026/stage-1", "profile_icon": "p1",
         "date": "07-04", "stage_name": "Stage 1"},
        {"stage_url": "race/tour-de-france/2026/stage-2", "profile_icon": "p3",
         "date": "07-05", "stage_name": "Stage 2"},
        {"stage_url": "race/tour-de-france/2026/stage-3", "profile_icon": "p5",
         "date": "07-06", "stage_name": "Stage 3"},
    ]

    mock_race_instance = MagicMock()
    mock_race_instance.is_one_day_race.return_value = False
    mock_race_instance.stages.return_value = fake_stages
    mock_race = MagicMock(return_value=mock_race_instance)

    sb = make_supabase()  # only stage_profiles upserts will happen

    with _patch_fetch_html(), patch("sync_race.Race", mock_race):
        result = await sync_race.import_stage_profiles(
            sb, page=MagicMock(),
            race_slug="race/tour-de-france/2026",
            race_name="Tour de France",
        )

    assert result == {"imported": 3, "skipped": 0, "total_stages": 3}
    upserts = sb.upserts["stage_profiles"]
    by_slug = {r["race_slug"]: r for r in upserts}
    assert by_slug["race/tour-de-france/2026/stage-1"]["profile_icon"] == "p1"
    assert by_slug["race/tour-de-france/2026/stage-1"]["race_date"] == "2026-07-04"
    assert by_slug["race/tour-de-france/2026/stage-2"]["profile_icon"] == "p3"
    assert by_slug["race/tour-de-france/2026/stage-3"]["profile_icon"] == "p5"


async def test_import_stage_profiles_one_day_race_returns_empty():
    """One-day races (no stages) → no upserts, total_stages=0."""
    import sync_race

    mock_race_instance = MagicMock()
    mock_race_instance.is_one_day_race.return_value = True
    mock_race_instance.stages.return_value = []
    mock_race = MagicMock(return_value=mock_race_instance)

    sb = make_supabase()

    with _patch_fetch_html(), patch("sync_race.Race", mock_race):
        result = await sync_race.import_stage_profiles(
            sb, page=MagicMock(),
            race_slug="race/milano-sanremo/2026",
            race_name="Milano-Sanremo",
        )

    assert result == {"imported": 0, "skipped": 0, "total_stages": 0}
    assert "stage_profiles" not in sb.upserts


async def test_import_stage_profiles_skips_stage_with_missing_profile():
    """A stage row with profile_icon=None is skipped (not upserted with NULL — CHECK violation)."""
    import sync_race

    fake_stages = [
        {"stage_url": "race/x/2026/stage-1", "profile_icon": "p1", "date": "03-08"},
        {"stage_url": "race/x/2026/stage-2", "profile_icon": None,  "date": "03-09"},
        {"stage_url": "race/x/2026/stage-3", "profile_icon": "",    "date": "03-10"},
    ]

    mock_race_instance = MagicMock()
    mock_race_instance.is_one_day_race.return_value = False
    mock_race_instance.stages.return_value = fake_stages
    mock_race = MagicMock(return_value=mock_race_instance)

    sb = make_supabase()

    with _patch_fetch_html(), patch("sync_race.Race", mock_race):
        result = await sync_race.import_stage_profiles(
            sb, page=MagicMock(),
            race_slug="race/x/2026",
            race_name="X",
        )

    assert result == {"imported": 1, "skipped": 2, "total_stages": 3}
    upserts = sb.upserts["stage_profiles"]
    assert len(upserts) == 1
    assert upserts[0]["race_slug"] == "race/x/2026/stage-1"


async def test_import_stage_profiles_detects_itt_ttt_from_stage_name():
    """The stage name returned by Race.stages() carries the PCS '(ITT)' /
    '(TTT)' marker for time trials. The importer must parse it into the
    `stage_type` column so place_tactic v4 can gate Nemesis/Overdrive on TTs.
    Road stages without a marker default to 'RR'."""
    import sync_race

    fake_stages = [
        {"stage_url": "race/tour-de-france/2026/stage-1",
         "profile_icon": "p3", "date": "07-04",
         "stage_name": "Stage 1 (TTT) | Barcelona - Barcelona"},
        {"stage_url": "race/tour-de-france/2026/stage-5",
         "profile_icon": "p1", "date": "07-08",
         "stage_name": "Stage 5 | Lannemezan - Pau"},
        {"stage_url": "race/tour-de-france/2026/stage-16",
         "profile_icon": "p2", "date": "07-21",
         "stage_name": "Stage 16 (ITT) | Évian Les-Bains - Thonon Les-Bains"},
    ]

    mock_race_instance = MagicMock()
    mock_race_instance.is_one_day_race.return_value = False
    mock_race_instance.stages.return_value = fake_stages
    mock_race = MagicMock(return_value=mock_race_instance)

    sb = make_supabase()

    with _patch_fetch_html(), patch("sync_race.Race", mock_race):
        await sync_race.import_stage_profiles(
            sb, page=MagicMock(),
            race_slug="race/tour-de-france/2026",
            race_name="Tour de France",
        )

    by_slug = {r["race_slug"]: r for r in sb.upserts["stage_profiles"]}
    assert by_slug["race/tour-de-france/2026/stage-1"]["stage_type"] == "TTT"
    assert by_slug["race/tour-de-france/2026/stage-5"]["stage_type"] == "RR"
    assert by_slug["race/tour-de-france/2026/stage-16"]["stage_type"] == "ITT"


async def test_import_stage_profiles_defaults_stage_type_to_rr_when_marker_missing():
    """Existing test fixtures (and any future stage where PCS omits the marker)
    must default to 'RR' — never None — because the DB column is NOT NULL."""
    import sync_race

    fake_stages = [
        {"stage_url": "race/x/2026/stage-1", "profile_icon": "p2", "date": "03-08"},
        # No stage_name at all
    ]
    mock_race_instance = MagicMock()
    mock_race_instance.is_one_day_race.return_value = False
    mock_race_instance.stages.return_value = fake_stages
    mock_race = MagicMock(return_value=mock_race_instance)

    sb = make_supabase()

    with _patch_fetch_html(), patch("sync_race.Race", mock_race):
        await sync_race.import_stage_profiles(
            sb, page=MagicMock(), race_slug="race/x/2026", race_name="X",
        )

    payload = sb._last_upsert_payload("stage_profiles")
    assert payload["stage_type"] == "RR"


async def test_import_stage_profiles_rewrites_canonical_pcs_slug_onto_input_slug():
    """When PCS returns a canonical race URL different from the input slug
    (e.g. Dauphiné → tour-auvergne-rhone-alpes), the upsert must use the
    input slug so the front and wt_calendar can look stages up consistently."""
    import sync_race

    # PCS canonical for Dauphiné 2026 is "tour-auvergne-rhone-alpes".
    fake_stages = [
        {"stage_url": "race/tour-auvergne-rhone-alpes/2026/stage-1",
         "profile_icon": "p2", "date": "06-07"},
        {"stage_url": "race/tour-auvergne-rhone-alpes/2026/stage-8",
         "profile_icon": "p5", "date": "06-14"},
    ]

    mock_race_instance = MagicMock()
    mock_race_instance.is_one_day_race.return_value = False
    mock_race_instance.stages.return_value = fake_stages
    mock_race = MagicMock(return_value=mock_race_instance)

    sb = make_supabase()

    with _patch_fetch_html(), patch("sync_race.Race", mock_race):
        result = await sync_race.import_stage_profiles(
            sb, page=MagicMock(),
            race_slug="race/dauphine/2026",
            race_name="Critérium du Dauphiné",
        )

    assert result == {"imported": 2, "skipped": 0, "total_stages": 2}
    by_slug = {r["race_slug"]: r for r in sb.upserts["stage_profiles"]}
    # Rows are keyed by the WattHunter slug, NOT the PCS canonical one.
    assert "race/dauphine/2026/stage-1" in by_slug
    assert "race/dauphine/2026/stage-8" in by_slug
    assert "race/tour-auvergne-rhone-alpes/2026/stage-1" not in by_slug
    assert by_slug["race/dauphine/2026/stage-1"]["profile_icon"] == "p2"
    assert by_slug["race/dauphine/2026/stage-8"]["profile_icon"] == "p5"


async def test_import_stage_profiles_falls_back_when_date_missing():
    """A stage without a `date` field → race_date=None in the payload; profile still imported."""
    import sync_race

    fake_stages = [
        {"stage_url": "race/x/2026/stage-1", "profile_icon": "p2"},  # no date key
    ]

    mock_race_instance = MagicMock()
    mock_race_instance.is_one_day_race.return_value = False
    mock_race_instance.stages.return_value = fake_stages
    mock_race = MagicMock(return_value=mock_race_instance)

    sb = make_supabase()

    with _patch_fetch_html(), patch("sync_race.Race", mock_race):
        result = await sync_race.import_stage_profiles(
            sb, page=MagicMock(),
            race_slug="race/x/2026",
            race_name="X",
        )

    assert result["imported"] == 1
    payload = sb._last_upsert_payload("stage_profiles")
    assert payload["profile_icon"] == "p2"
    assert payload["race_date"] is None


# ---------------------------------------------------------------------------
# Spec A A9 — import_final_classifications works for 1-week races
# ---------------------------------------------------------------------------


async def test_import_final_classifications_one_week_race():
    """1-week stage-races (Paris-Nice, etc.) have Points/KOM/Youth jerseys too.
    The importer reads the standings from {slug}/points|kom|youth and upserts
    into gt_final_classifications with the right scale-agnostic shape."""
    import sync_race

    rider_id = "11111111-2222-3333-4444-555555555555"
    pcs_slug = "rider/some-sprinter"

    def _stage_factory(url, html=None, update_html=False):
        inst = MagicMock()
        if "/points" in url:
            inst.points.return_value = [{"rider_url": pcs_slug, "rank": 1}]
            inst.kom.return_value = []
            inst.youth.return_value = []
        else:
            inst.points.return_value = []
            inst.kom.return_value = []
            inst.youth.return_value = []
        return inst

    sb = make_supabase(
        [{"id": rider_id, "pcs_slug": pcs_slug}],  # riders lookup
    )

    with _patch_fetch_html(), patch("sync_race.Stage", side_effect=_stage_factory):
        result = await sync_race.import_final_classifications(
            sb, page=MagicMock(),
            race_slug="race/paris-nice/2026",
            race_name="Paris-Nice",
            race_date="2026-03-15",
        )

    assert result == {"points": 1, "kom": 0, "youth": 0}
    upserts = sb.upserts["gt_final_classifications"]
    assert len(upserts) == 1
    assert upserts[0]["race_slug"] == "race/paris-nice/2026/points"
    assert upserts[0]["rider_id"] == rider_id
    assert upserts[0]["rank"] == 1
