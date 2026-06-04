"""Phase-2 validation audit — pipeline idempotence / no-cumul ordering guards.

Covers:
- ID-3: goals MUST be evaluated before base bonuses (no-cumul §17). A swap would
  silently let base bonuses be credited before neutralization is known → double-pay.
- ID-1: `sponsor_bonus.process_race_bonuses` fetches league/GT-wide tables
  (contracts, team_sponsors, gt_squad) with bare `.execute()` and no pagination.
  PostgREST caps at 1000 rows by default, so these truncate silently as the data
  grows — the exact class of bug already fixed once in goal_evaluator.py
  (`_fetch_all`). Marked xfail until the fix lands (out of scope for this pass).
"""
from __future__ import annotations

import inspect

import pytest

import run_pipeline
import sponsor_bonus


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

@pytest.mark.xfail(
    strict=True,
    reason="ID-1 (confirmed P0): process_race_bonuses fetches contracts/"
    "team_sponsors/gt_squad with bare .execute() and no pagination, "
    "truncating silently past 1000 rows. Fix = route them through a "
    "_fetch_all helper (deferred to the correction pass).",
)
def test_sponsor_bonus_fetches_are_paginated() -> None:
    src = inspect.getsource(sponsor_bonus)
    assert "_fetch_all" in src or ".range(" in src, (
        "sponsor_bonus.py uses no pagination primitive — large-table fetches "
        "will truncate at the PostgREST 1000-row cap."
    )
