"""Tests for enrich.py — rider enrichment from individual PCS pages."""
from __future__ import annotations

import pytest
from conftest import make_supabase


def test_assign_specialty_gc():
    """Highest among GC/OneDay/TT/Sprint wins."""
    from enrich import assign_specialty
    points = {"GC": 3000, "One day races": 1500, "Time trial": 800, "Sprint": 200, "Climber": 5000, "Hills": 4000}
    assert assign_specialty(points) == "GC"


def test_assign_specialty_oneday():
    from enrich import assign_specialty
    points = {"GC": 500, "One day races": 2000, "Time trial": 300, "Sprint": 100}
    assert assign_specialty(points) == "OneDay"


def test_assign_specialty_tt():
    from enrich import assign_specialty
    points = {"GC": 100, "One day races": 200, "Time trial": 3000, "Sprint": 100}
    assert assign_specialty(points) == "TT"


def test_assign_specialty_sprint():
    from enrich import assign_specialty
    points = {"GC": 100, "One day races": 200, "Time trial": 300, "Sprint": 5000}
    assert assign_specialty(points) == "Sprint"


def test_assign_specialty_empty():
    """No matching keys -> all_rounder."""
    from enrich import assign_specialty
    assert assign_specialty({}) == "all_rounder"
    assert assign_specialty({"Climber": 5000, "Hills": 3000}) == "all_rounder"


def test_assign_specialty_ignores_climber_hills():
    """Climber and Hills are ignored even if highest."""
    from enrich import assign_specialty
    points = {"GC": 100, "One day races": 50, "Climber": 9999, "Hills": 8888}
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
    specialty_points = {"GC": 5000, "One day races": 3000, "Time trial": 1500, "Sprint": 200}
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
