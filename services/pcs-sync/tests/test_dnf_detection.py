from __future__ import annotations
import pytest
from dnf_detection import extract_dnf_rider_slugs, match_dnf_to_squad


def test_extract_dnf_rider_slugs_returns_dnf_only():
    stage_data = [
        {"rider_url": "rider/tadej-pogacar", "rank": 1},
        {"rider_url": "rider/marc-soler", "rank": "DNF"},
        {"rider_url": "rider/jay-vine", "rank": "DNF"},
        {"rider_url": "rider/matteo-moschetti", "rank": "DNS"},
    ]
    result = extract_dnf_rider_slugs(stage_data)
    assert result == ["rider/marc-soler", "rider/jay-vine"]


def test_extract_dnf_rider_slugs_empty():
    assert extract_dnf_rider_slugs([]) == []


def test_extract_dnf_rider_slugs_no_dnf():
    stage_data = [{"rider_url": "rider/remco-evenepoel", "rank": 1}]
    assert extract_dnf_rider_slugs(stage_data) == []


def test_extract_dnf_rider_slugs_skips_missing_rider_url():
    stage_data = [{"rider_url": "", "rank": "DNF"}, {"rank": "DNF"}]
    assert extract_dnf_rider_slugs(stage_data) == []


def test_match_dnf_to_squad_matches_by_slug():
    dnf_slugs = ["rider/marc-soler", "rider/jay-vine"]
    squad_rows = [
        {"id": "abc-1", "rider_id": "r1", "rider_name": "Marc Soler", "pcs_slug": "rider/marc-soler", "team_id": "t1"},
        {"id": "abc-2", "rider_id": "r2", "rider_name": "Remco Evenepoel", "pcs_slug": "rider/remco-evenepoel", "team_id": "t2"},
        {"id": "abc-3", "rider_id": "r3", "rider_name": "Jay Vine", "pcs_slug": "rider/jay-vine", "team_id": "t3"},
    ]
    result = match_dnf_to_squad(dnf_slugs, squad_rows)
    assert len(result) == 2
    assert result[0]["id"] == "abc-1"
    assert result[1]["id"] == "abc-3"


def test_match_dnf_to_squad_case_insensitive():
    dnf_slugs = ["RIDER/MARC-SOLER"]
    squad_rows = [{"id": "abc-1", "rider_id": "r1", "rider_name": "Marc Soler", "pcs_slug": "rider/marc-soler", "team_id": "t1"}]
    result = match_dnf_to_squad(dnf_slugs, squad_rows)
    assert len(result) == 1


def test_match_dnf_to_squad_no_match():
    dnf_slugs = ["rider/unknown-rider"]
    squad_rows = [{"id": "abc-1", "rider_id": "r1", "rider_name": "Marc Soler", "pcs_slug": "rider/marc-soler", "team_id": "t1"}]
    result = match_dnf_to_squad(dnf_slugs, squad_rows)
    assert result == []
