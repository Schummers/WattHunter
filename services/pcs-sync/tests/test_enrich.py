"""Tests for enrich.py — rider enrichment from individual PCS pages."""
from __future__ import annotations

import pytest
from conftest import make_supabase


def test_assign_specialty_gc():
    """Highest among GC/OneDay/TT/Sprint wins."""
    from enrich import assign_specialty
    points = {"gc": 3000, "one_day_races": 1500, "time_trial": 800, "sprint": 200, "climber": 5000, "hills": 4000}
    assert assign_specialty(points) == "GC"


def test_assign_specialty_oneday():
    from enrich import assign_specialty
    points = {"gc": 500, "one_day_races": 2000, "time_trial": 300, "sprint": 100}
    assert assign_specialty(points) == "OneDay"


def test_assign_specialty_tt():
    from enrich import assign_specialty
    points = {"gc": 100, "one_day_races": 200, "time_trial": 3000, "sprint": 100}
    assert assign_specialty(points) == "TT"


def test_assign_specialty_sprint():
    from enrich import assign_specialty
    points = {"gc": 100, "one_day_races": 200, "time_trial": 300, "sprint": 5000}
    assert assign_specialty(points) == "Sprint"


def test_assign_specialty_empty():
    """No matching keys -> all_rounder."""
    from enrich import assign_specialty
    assert assign_specialty({}) == "all_rounder"
    assert assign_specialty({"climber": 5000, "hills": 3000}) == "all_rounder"


def test_assign_specialty_ignores_climber_hills():
    """Climber and Hills are ignored even if highest."""
    from enrich import assign_specialty
    points = {"gc": 100, "one_day_races": 50, "climber": 9999, "hills": 8888}
    assert assign_specialty(points) == "GC"


def test_parse_rider_data():
    """parse_rider_data extracts the right fields from Rider.parse() output."""
    from enrich import parse_rider_data

    raw = {
        "name": "Tadej Pogacar",
        "birthdate": "1998-09-21",
        "place_of_birth": "Komenda",
        "height": 176,
        "weight": 66,
        "image_url": "https://www.procyclingstats.com/images/riders/tadej-pogacar.jpg",
        "nationality": "SI",
    }
    specialty_points = {"gc": 5000, "one_day_races": 3000, "time_trial": 1500, "sprint": 200}
    teams = [
        {"team_name": "UAE Team Emirates", "team_url": "team/uae-team-emirates-2026", "season": 2026},
        {"team_name": "UAE Team Emirates", "team_url": "team/uae-team-emirates-2025", "season": 2025},
    ]
    season_points = [{"season": 2024, "points": 4500}, {"season": 2025, "points": 5200}]

    result = parse_rider_data(raw, specialty_points, teams, season_points)

    assert result["photo_url"] == raw["image_url"]
    assert result["birthdate"] == "1998-09-21"
    assert result["birth_place"] == "Komenda"
    assert result["height_cm"] == 176
    assert result["weight_kg"] == 66
    assert result["specialty"] == "GC"
    assert len(result["teams"]) == 2
    assert len(result["season_points"]) == 2


def test_parse_height_meters():
    """PCS returns height as meters float (1.76) — should convert to 176 cm."""
    from enrich import _parse_height_cm
    assert _parse_height_cm(1.76) == 176
    assert _parse_height_cm("1.76") == 176
    assert _parse_height_cm(176) == 176
    assert _parse_height_cm(None) is None


def test_parse_weight_float():
    """PCS may return weight as float — should convert to int."""
    from enrich import _parse_weight_kg
    assert _parse_weight_kg(66) == 66
    assert _parse_weight_kg("66.5") == 66
    assert _parse_weight_kg(None) is None


def test_build_parser_accepts_enrich_riders():
    """CLI parser should accept 'enrich-riders' command with --start and --end."""
    from run_pipeline import build_parser
    parser = build_parser()

    args = parser.parse_args(["enrich-riders"])
    assert args.command == "enrich-riders"
    assert args.start == 1
    assert args.end == 600

    args2 = parser.parse_args(["enrich-riders", "--start", "401", "--end", "600"])
    assert args2.start == 401
    assert args2.end == 600


# --- Race program parsing tests ---

PCS_PROGRAM_HTML = """
<html><body>
<div class="mt20">
<h4>Program</h4><ul class="list dashed flex pad2">
<li><div class="bold mr5">21.03</div><div class="ellipsis"><span class="flag it"></span> <a href="race/milano-sanremo/2026/startlist">Milano-Sanremo</a></div></li>
<li><div class="bold mr5">04.07</div><div class="ellipsis"><span class="flag fr"></span> <a href="race/tour-de-france/2026/startlist">Tour de France</a></div></li>
<li><div class="bold mr5">26.04</div><div class="ellipsis"><span class="flag be"></span> <a href="race/liege-bastogne-liege/2026/startlist">Liège-Bastogne-Liège</a></div></li>
</ul>
</div>
</body></html>
"""


def test_parse_race_program_empty_html():
    """Empty/minimal HTML returns empty list."""
    from enrich import parse_race_program
    assert parse_race_program("<html><body></body></html>") == []


def test_parse_race_program_pcs_structure():
    """Parses races from the real PCS Program section structure."""
    from enrich import parse_race_program
    result = parse_race_program(PCS_PROGRAM_HTML, current_year=2026)
    assert len(result) == 3
    assert result[0]["race_slug"] == "race/milano-sanremo/2026"
    assert result[0]["race_name"] == "Milano-Sanremo"
    assert result[0]["race_date"] == "2026-03-21"
    assert result[1]["race_slug"] == "race/tour-de-france/2026"
    assert result[1]["race_date"] == "2026-07-04"
    assert result[2]["race_slug"] == "race/liege-bastogne-liege/2026"
    assert result[2]["race_date"] == "2026-04-26"


def test_parse_race_program_strips_startlist():
    """Race slug should not contain /startlist suffix."""
    from enrich import parse_race_program
    result = parse_race_program(PCS_PROGRAM_HTML)
    for entry in result:
        assert not entry["race_slug"].endswith("/startlist")


def test_parse_race_program_deduplicates():
    """Same race slug should not appear twice."""
    from enrich import parse_race_program
    html = """
    <html><body>
    <div class="mt20">
    <h4>Program</h4><ul class="list dashed flex pad2">
    <li><div class="bold mr5">21.03</div><div class="ellipsis"><a href="race/tour-de-france/2026/startlist">Tour de France</a></div></li>
    <li><div class="bold mr5">04.07</div><div class="ellipsis"><a href="race/tour-de-france/2026/startlist">Tour de France</a></div></li>
    </ul>
    </div>
    </body></html>
    """
    result = parse_race_program(html)
    assert len(result) == 1
