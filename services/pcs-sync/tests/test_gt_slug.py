from gt_slug import get_gt_identifier, get_stage_number


def test_get_gt_identifier_matches_three_grand_tours():
    assert get_gt_identifier("race/giro-d-italia/2026/stage-5") == "giro-d-italia"
    assert get_gt_identifier("race/tour-de-france/2026/stage-1") == "tour-de-france"
    assert get_gt_identifier("race/vuelta-a-espana/2026/gc") == "vuelta-a-espana"


def test_get_gt_identifier_returns_none_for_non_gt():
    assert get_gt_identifier("race/paris-nice/2026/stage-3") is None
    assert get_gt_identifier("") is None


def test_get_stage_number_parses_stage():
    assert get_stage_number("race/giro-d-italia/2026/stage-5") == 5
    assert get_stage_number("race/giro-d-italia/2026/stage-21") == 21


def test_get_stage_number_none_for_gc_or_empty():
    assert get_stage_number("race/giro-d-italia/2026/gc") is None
    assert get_stage_number("") is None
