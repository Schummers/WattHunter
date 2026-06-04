"""Phase-2 validation audit — pipeline idempotence / no-cumul ordering guards.

Covers:
- ID-3: goals MUST be evaluated before base bonuses (no-cumul §17). A swap would
  silently let base bonuses be credited before neutralization is known → double-pay.
- ID-1: `sponsor_bonus.process_race_bonuses` fetches league/GT-wide tables
  (contracts, team_sponsors, gt_squad, race_results) with bare `.execute()` and
  no pagination. PostgREST caps at 1000 rows by default, so these truncate
  silently as the data grows — the exact class of bug already fixed once in
  goal_evaluator.py. FIXED: all such fetches now route through the shared
  `db_utils._fetch_all` helper.
"""
from __future__ import annotations

import inspect

import run_pipeline
import sponsor_bonus
from db_utils import _fetch_all


# ---------------------------------------------------------------------------
# ID-3 — goals before bonuses (no-cumul ordering)
# ---------------------------------------------------------------------------

def test_goals_evaluated_before_base_bonuses() -> None:
    """In run_post_race, evaluate_sponsor_goals must appear before
    process_race_bonuses so neutralized_stage_slugs are persisted first (§17)."""
    src = inspect.getsource(run_pipeline.run_post_race)
    goals_pos = src.find("evaluate_sponsor_goals(")
    bonus_pos = src.find("process_race_bonuses(")
    assert goals_pos != -1, "evaluate_sponsor_goals call not found in run_post_race"
    assert bonus_pos != -1, "process_race_bonuses call not found in run_post_race"
    assert goals_pos < bonus_pos, (
        "no-cumul ordering broken: process_race_bonuses runs before "
        "evaluate_sponsor_goals — base bonuses would be credited before "
        "neutralization is known (double-pay risk)."
    )


# ---------------------------------------------------------------------------
# ID-1 — pagination on GT/league-wide fetches in sponsor_bonus
# ---------------------------------------------------------------------------

def test_sponsor_bonus_fetches_are_paginated() -> None:
    src = inspect.getsource(sponsor_bonus)
    assert "_fetch_all" in src, (
        "sponsor_bonus.py uses no pagination primitive — large-table fetches "
        "will truncate at the PostgREST 1000-row cap."
    )
    # Normalise whitespace, then assert the four ID-1 read paths no longer end
    # in a bare .execute() (which truncates at the 1000-row PostgREST cap).
    flat = " ".join(src.split())
    regressions = [
        '.select("rider_id,race_slug,race_class,stage,rank,pcs_points,race_date") '
        '.in_("race_slug", race_slugs) .execute()',  # race_results
        '.in_("status", ["active", "notice"]) .execute()',  # contracts
        '.select("team_id,sponsor_id,sponsors(*)") .execute()',  # team_sponsors
        '.select("team_id,rider_id,created_at,removed_at") .eq("year", year) .execute()',  # gt_squad
    ]
    for pattern in regressions:
        assert pattern not in flat, (
            f"read path regressed to bare .execute() (truncates at 1000 rows): {pattern!r}"
        )


# ---------------------------------------------------------------------------
# ID-1 — _fetch_all consumes every page past the 1000-row PostgREST cap
# ---------------------------------------------------------------------------

class _PaginatingQuery:
    """Minimal fake Supabase query builder that honours .range() slicing."""

    def __init__(self, rows: list[dict]) -> None:
        self._rows = rows
        self._start = 0
        self._end = None

    # builder methods are no-ops that return self
    def select(self, *a, **k):
        return self

    def in_(self, *a, **k):
        return self

    def eq(self, *a, **k):
        return self

    def range(self, start: int, end: int):
        self._start = start
        self._end = end
        return self

    def execute(self):
        class _Resp:
            pass

        resp = _Resp()
        resp.data = self._rows[self._start : self._end + 1]
        return resp


def test_fetch_all_consumes_all_pages_past_cap() -> None:
    """2575 rows across 3 pages (1000 + 1000 + 575) must all come back."""
    rows = [{"i": i} for i in range(2575)]
    factory_calls = {"n": 0}

    def factory():
        factory_calls["n"] += 1
        return _PaginatingQuery(rows)

    fetched = _fetch_all(factory, page_size=1000)
    assert len(fetched) == 2575, "pagination dropped rows past the 1000-row cap"
    assert fetched[0]["i"] == 0 and fetched[-1]["i"] == 2574
    assert factory_calls["n"] == 3, "expected exactly 3 pages (1000+1000+575)"


def test_fetch_all_exact_multiple_terminates() -> None:
    """Exactly 2000 rows = 2 full pages, then a 3rd empty page stops the loop."""
    rows = [{"i": i} for i in range(2000)]
    fetched = _fetch_all(lambda: _PaginatingQuery(rows), page_size=1000)
    assert len(fetched) == 2000
