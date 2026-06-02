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
