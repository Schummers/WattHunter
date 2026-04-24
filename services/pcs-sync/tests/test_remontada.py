from remontada import get_gt_identifier, get_stage_number

def test_gt_identifier_giro():
    assert get_gt_identifier("race/giro-d-italia/2026/stage-5") == "giro-d-italia"

def test_gt_identifier_tour():
    assert get_gt_identifier("race/tour-de-france/2026/stage-1") == "tour-de-france"

def test_gt_identifier_vuelta():
    assert get_gt_identifier("race/vuelta-a-espana/2026/gc") == "vuelta-a-espana"

def test_gt_identifier_non_gt_returns_none():
    assert get_gt_identifier("race/paris-nice/2026/stage-3") is None

def test_gt_identifier_empty_returns_none():
    assert get_gt_identifier("") is None

def test_stage_number_simple():
    assert get_stage_number("race/giro-d-italia/2026/stage-5") == 5

def test_stage_number_double_digit():
    assert get_stage_number("race/tour-de-france/2026/stage-21") == 21

def test_stage_number_gc_slug_returns_none():
    assert get_stage_number("race/vuelta-a-espana/2026/gc") is None

def test_stage_number_unrecognized_returns_none():
    assert get_stage_number("race/giro-d-italia/2026/prologue") is None
