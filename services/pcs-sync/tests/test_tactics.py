"""Unit tests for GT Tactic modifier computation."""
from __future__ import annotations
import pytest
from tactics import (
    compute_unleash_modifier,
    compute_overdrive_modifier,
    compute_call_bus_modifier,
    compute_nemesis_modifier,
)

# --- Unleash ---

def test_unleash_promotes_domestique_to_stage_hunter_role_mult():
    """Domestique with Unleash active → role_mult 1.5."""
    mult, applied = compute_unleash_modifier(role="domestique", race_slug="race/giro/2026/stage-3")
    assert mult == 1.5
    assert applied == "unleash"

def test_unleash_does_not_affect_existing_stage_hunters():
    """Stage Hunter is not boosted by Unleash (already 1.5)."""
    mult, applied = compute_unleash_modifier(role="stage_hunter", race_slug="race/giro/2026/stage-3")
    assert mult is None  # no override
    assert applied is None

def test_unleash_does_not_apply_to_gc_results():
    """Unleash applies only to stage results, not /gc."""
    mult, applied = compute_unleash_modifier(role="domestique", race_slug="race/giro/2026/gc")
    assert mult is None
    assert applied is None

# --- Overdrive ---

def test_overdrive_promotes_breakaway_stage_hunter_to_2x():
    mult, applied = compute_overdrive_modifier(
        role="stage_hunter", race_slug="race/giro/2026/stage-3", breakaway_kms=120.0
    )
    assert mult == 2.0
    assert applied == "overdrive"

def test_overdrive_no_effect_when_stage_hunter_not_in_break():
    mult, applied = compute_overdrive_modifier(
        role="stage_hunter", race_slug="race/giro/2026/stage-3", breakaway_kms=10.0
    )
    assert mult is None
    assert applied is None

def test_overdrive_does_not_apply_to_domestiques():
    mult, applied = compute_overdrive_modifier(
        role="domestique", race_slug="race/giro/2026/stage-3", breakaway_kms=120.0
    )
    assert mult is None
    assert applied is None

# --- Call the Bus ---

def test_call_bus_includes_bench_riders_as_domestiques():
    """Bench rider gets role_mult 1.0 (was excluded entirely without Bus)."""
    include, applied = compute_call_bus_modifier(in_squad=False, race_slug="race/giro/2026/stage-3")
    assert include is True
    assert applied == "call_the_bus"

def test_call_bus_no_op_for_squad_riders():
    include, applied = compute_call_bus_modifier(in_squad=True, race_slug="race/giro/2026/stage-3")
    assert include is False
    assert applied is None

# --- Nemesis ---

def test_nemesis_attacker_won_overrides_role_mult_to_2():
    """Attacker gets gt_role_mult=2.0 (replaces 1.5), nemesis_modifier=1.0."""
    role_mult, nem_mod, applied = compute_nemesis_modifier(
        outcome="attacker_won",
        rider_role="attacker",
        tactic_type="nemesis_gc",
    )
    assert role_mult == 2.0
    assert nem_mod == 1.0
    assert applied == "nemesis_gc"

def test_nemesis_attacker_won_target_loses_50pct():
    """Target keeps role_mult=1.5, nemesis_modifier=0.5."""
    role_mult, nem_mod, applied = compute_nemesis_modifier(
        outcome="attacker_won",
        rider_role="target",
        tactic_type="nemesis_gc",
    )
    assert role_mult is None  # no override
    assert nem_mod == 0.5
    assert applied == "nemesis_gc"

def test_nemesis_target_won_attacker_loses_25pct():
    role_mult, nem_mod, applied = compute_nemesis_modifier(
        outcome="target_won",
        rider_role="attacker",
        tactic_type="nemesis_gc",
    )
    assert role_mult is None
    assert nem_mod == 0.75
    assert applied == "nemesis_gc"

def test_nemesis_target_won_target_gets_25pct_bonus():
    role_mult, nem_mod, applied = compute_nemesis_modifier(
        outcome="target_won",
        rider_role="target",
        tactic_type="nemesis_gc",
    )
    assert role_mult is None
    assert nem_mod == 1.25
    assert applied == "nemesis_gc"

def test_nemesis_no_resolution_no_effect():
    role_mult, nem_mod, applied = compute_nemesis_modifier(
        outcome="no_resolution",
        rider_role="attacker",
        tactic_type="nemesis_gc",
    )
    assert role_mult is None
    assert nem_mod == 1.0
    assert applied == "nemesis_gc"  # still tracked


def test_tactic_usage_limits_seed_values():
    """The seed migration must populate exactly 10 rows (5 tactics × 2 kinds)
    with the locked-in numbers (Spec A A9)."""
    # We assert the EXPECTED values that the migration seeds. If they ever
    # change in the migration, this test forces a parallel update.
    expected = {
        ("gt",       "unleash"):        2,
        ("gt",       "overdrive"):      2,
        ("gt",       "call_the_bus"):   3,
        ("gt",       "nemesis_gc"):     1,
        ("gt",       "nemesis_sprint"): 1,
        ("one_week", "unleash"):        1,
        ("one_week", "overdrive"):      1,
        ("one_week", "call_the_bus"):   2,
        ("one_week", "nemesis_gc"):     1,
        ("one_week", "nemesis_sprint"): 1,
    }

    # Parse the migration file to extract the INSERT VALUES tuples — keeps the
    # test self-contained (no DB round-trip).
    import re
    from pathlib import Path
    sql = Path(__file__).resolve().parents[3].joinpath(
        "supabase/migrations/20260604000100_tactic_usage_limits.sql"
    ).read_text()
    seeds = re.findall(
        r"\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*(\d+)\s*\)", sql
    )
    seen = {(k, t): int(n) for k, t, n in seeds if k in ("gt", "one_week")}
    assert seen == expected, f"seed drift: {seen}"
