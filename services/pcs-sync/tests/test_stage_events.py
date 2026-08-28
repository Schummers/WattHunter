"""Tests for stage_events.py — KOM crossings + intermediate sprints (issue 02)."""
from __future__ import annotations

from unittest.mock import MagicMock

from helpers import make_supabase

import stage_events


STAGE_SLUG = "race/vuelta-a-espana/2026/stage-2"
RIDER_A = "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbb1"
RIDER_B = "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbb2"

# Minimal stage-page skeleton mirroring the PCS structure Stage.climbs() relies
# on: a resultTabs nav whose "Points" link points (data-id) to a resTab holding a
# `.today` section with one `<h4>Sprint | ...</h4>` + ranking table.
SPRINT_HTML = """
<html><body>
<ul class="tabs tabnav resultTabs">
  <li><a data-id="0">Stage</a></li>
  <li><a data-id="3">Points</a></li>
</ul>
<div class="resTab" data-id="3">
  <div class="today">
    <h4>Sprint | Fuente del Maestre (102.6 km)</h4>
    <table><tbody>
      <tr><td>1</td><td><a href="rider/mads-pedersen">PEDERSEN Mads</a></td></tr>
      <tr><td>2</td><td><a href="/rider/jasper-philipsen?foo=1">PHILIPSEN Jasper</a></td></tr>
      <tr><td>xx</td><td><a href="rider/broken-row">BROKEN Row</a></td></tr>
    </tbody></table>
    <h4>KOM Sprint (2) Alto de X (50 km)</h4>
    <table><tbody>
      <tr><td>1</td><td><a href="rider/should-not-appear">NOT A SPRINT</a></td></tr>
    </tbody></table>
  </div>
</div>
</body></html>
"""


def test_parse_intermediate_sprints_basic():
    sprints = stage_events.parse_intermediate_sprints(SPRINT_HTML)
    assert len(sprints) == 1  # the KOM h4 in the same tab is ignored
    sprint = sprints[0]
    assert sprint["event_name"] == "Fuente del Maestre (102.6 km)"
    # Unparseable rank row dropped; hrefs normalized (leading slash + query stripped).
    assert sprint["rank"] == [
        {"rider_url": "rider/mads-pedersen", "rank": 1},
        {"rider_url": "rider/jasper-philipsen", "rank": 2},
    ]


def test_parse_intermediate_sprints_no_points_tab():
    assert stage_events.parse_intermediate_sprints("<html><body>nothing</body></html>") == []


def _stage_with_climbs(climbs):
    stage = MagicMock()
    stage.climbs.return_value = climbs
    return stage


def test_import_stage_events_upserts_kom_and_sprint_rows():
    stage = _stage_with_climbs([
        {"climb_name": "Puerto de X (HC)", "category": "HC", "rank": [
            {"rider_url": "rider/mads-pedersen", "rank": 1},
            {"rider_url": "rider/out-of-pool", "rank": 2},   # unmapped → skipped
        ]},
        {"climb_name": "Alto weird", "category": "Cat. 1", "rank": [
            {"rider_url": "rider/jasper-philipsen", "rank": 3},
        ]},
    ])
    sb = make_supabase()  # queue empty: upserts recorded, reads return []
    result = stage_events.import_stage_events(
        sb,
        stage_slug=STAGE_SLUG,
        stage=stage,
        html=SPRINT_HTML,
        rider_map={"rider/mads-pedersen": RIDER_A, "rider/jasper-philipsen": RIDER_B},
    )

    assert result["kom_events"] == 2
    assert result["sprint_events"] == 1
    assert result["imported"] == 4      # 2 kom + 2 sprint mapped rows
    assert result["skipped_unmapped"] == 1
    assert result["errors"] == []

    payloads = sb.upserts["stage_event_results"]
    koms = [p for p in payloads if p["event_type"] == "kom"]
    sprints = [p for p in payloads if p["event_type"] == "sprint"]
    assert {(p["category"], p["rank"]) for p in koms} == {("HC", 1), ("1", 3)}
    assert all(p["category"] is None for p in sprints)
    assert all(p["race_slug"] == STAGE_SLUG for p in payloads)


def test_import_stage_events_itt_yields_nothing():
    """An ITT page has no climbs tab and no sprints — zero events, no crash."""
    stage = _stage_with_climbs([])
    sb = make_supabase()
    result = stage_events.import_stage_events(
        sb, stage_slug=STAGE_SLUG, stage=stage,
        html="<html><body/></html>", rider_map={},
    )
    assert result["kom_events"] == 0
    assert result["sprint_events"] == 0
    assert result["imported"] == 0
    assert "stage_event_results" not in sb.upserts


def test_import_stage_events_survives_lib_failure():
    """Stage.climbs() raising must not crash the import (sprints still parsed)."""
    stage = MagicMock()
    stage.climbs.side_effect = RuntimeError("boom")
    sb = make_supabase()
    result = stage_events.import_stage_events(
        sb, stage_slug=STAGE_SLUG, stage=stage, html=SPRINT_HTML,
        rider_map={"rider/mads-pedersen": RIDER_A, "rider/jasper-philipsen": RIDER_B},
    )
    assert result["kom_events"] == 0
    assert result["sprint_events"] == 1
    assert result["imported"] == 2
