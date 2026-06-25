"""Unit tests for goal_evaluator.py — Spec C additions.

Covers:
- gt_reward_multiplier: GT ×2.0, 1-week ×1.0
- SPONSOR_GOAL_SETS structure (keys, labels, rewards, evaluators, goal counts)
- eval_win_points_classification: reads ctx["final_classifications"]["points"]
- eval_win_kom_classification: reads ctx["final_classifications"]["kom"]
- eval_wear_youth_jersey: reads ctx["classifications"] by "youth" type
- eval_wear_kom_jersey: reads ctx["classifications"] by "kom" type
- Idempotency via goal_key (unit-level intent)
"""
from __future__ import annotations

import sys
import os

# pcs-sync root (parent of tests/) — needed for all module imports
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
# tests/ dir — needed for helpers.py
sys.path.insert(0, os.path.dirname(__file__))

import pytest
from goal_evaluator import (
    SPONSOR_GOAL_SETS,
    EVALUATORS,
    gt_reward_multiplier,
    eval_win_points_classification,
    eval_win_kom_classification,
    eval_wear_youth_jersey,
    eval_wear_kom_jersey,
    eval_gc_podium,
    eval_gc_top5,
    eval_win_stage,
    eval_win_2_stages,
    suppress_tier_group_duplicates,
)
from helpers import make_supabase

# ---------------------------------------------------------------------------
# Shared test rider/team IDs (RFC-4122 valid UUIDs — version nibble 4)
# ---------------------------------------------------------------------------
TEAM_ID = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaa1"
RIDER_A = "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbb1"
RIDER_B = "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbb2"
STAGE_1 = "race/giro-d-italia/2026/stage-1"
STAGE_2 = "race/giro-d-italia/2026/stage-2"


# ---------------------------------------------------------------------------
# gt_reward_multiplier
# ---------------------------------------------------------------------------

class TestGtRewardMultiplier:
    def test_giro_returns_2(self):
        assert gt_reward_multiplier("race/giro-d-italia/2026") == 2.0

    def test_tour_returns_2(self):
        assert gt_reward_multiplier("race/tour-de-france/2026") == 2.0

    def test_vuelta_returns_2(self):
        assert gt_reward_multiplier("race/vuelta-a-espana/2026") == 2.0

    def test_paris_nice_returns_1(self):
        assert gt_reward_multiplier("race/paris-nice/2026") == 1.0

    def test_tirreno_adriatico_returns_1(self):
        assert gt_reward_multiplier("race/tirreno-adriatico/2026") == 1.0

    def test_stage_slug_within_giro_returns_2(self):
        # Even a stage-level slug is a GT slug
        assert gt_reward_multiplier("race/giro-d-italia/2026/stage-5") == 2.0


# ---------------------------------------------------------------------------
# SPONSOR_GOAL_SETS structure
# ---------------------------------------------------------------------------

class TestSponsorGoalSetsStructure:
    """Structural invariants — every goal dict must have required fields."""

    def test_all_expected_sponsors_present(self):
        expected = {"ineos", "decathlon", "soudal", "lidl-trek", "visma", "redbull-bora"}
        assert set(SPONSOR_GOAL_SETS.keys()) == expected

    def test_every_goal_has_non_empty_key(self):
        for sponsor, goals in SPONSOR_GOAL_SETS.items():
            for g in goals:
                assert "key" in g and g["key"], (
                    f"{sponsor} goal missing key: {g}"
                )
                assert isinstance(g["key"], str) and len(g["key"]) > 0

    def test_keys_are_unique_within_each_sponsor(self):
        for sponsor, goals in SPONSOR_GOAL_SETS.items():
            keys = [g["key"] for g in goals]
            assert len(keys) == len(set(keys)), (
                f"{sponsor} has duplicate goal keys: {keys}"
            )

    def test_every_goal_has_label_reward_evaluator(self):
        for sponsor, goals in SPONSOR_GOAL_SETS.items():
            for g in goals:
                assert "label" in g and g["label"], f"{sponsor}/{g.get('key')} missing label"
                assert "reward" in g and g["reward"] > 0, f"{sponsor}/{g.get('key')} missing reward"
                assert "evaluator" in g and g["evaluator"], f"{sponsor}/{g.get('key')} missing evaluator"

    def test_every_evaluator_key_exists_in_evaluators_map(self):
        for sponsor, goals in SPONSOR_GOAL_SETS.items():
            for g in goals:
                ev_key = g["evaluator"]
                assert ev_key in EVALUATORS, (
                    f"{sponsor}/{g['key']}: evaluator '{ev_key}' not in EVALUATORS"
                )

    # --- Per-sponsor goal counts (as per gt-goals.ts) ---

    def test_ineos_has_6_goals(self):
        # GC(4) + CLM(2) = 6
        assert len(SPONSOR_GOAL_SETS["ineos"]) == 6

    def test_decathlon_has_8_goals(self):
        # GC(4) + Sprint(4) = 8
        assert len(SPONSOR_GOAL_SETS["decathlon"]) == 8

    def test_soudal_has_8_goals(self):
        # Sprint(4) + SH(4) = 8
        assert len(SPONSOR_GOAL_SETS["soudal"]) == 8

    def test_lidl_trek_has_8_goals(self):
        # Sprint(4) + SH(4) = 8
        assert len(SPONSOR_GOAL_SETS["lidl-trek"]) == 8

    def test_visma_has_8_goals(self):
        # GC(4) + Sprint(4) = 8
        assert len(SPONSOR_GOAL_SETS["visma"]) == 8

    def test_redbull_bora_has_8_goals(self):
        # GC(4) + SH(4) = 8
        assert len(SPONSOR_GOAL_SETS["redbull-bora"]) == 8

    def test_ineos_contains_gc_and_clm_categories(self):
        cats = {g["category"] for g in SPONSOR_GOAL_SETS["ineos"]}
        assert "gc" in cats
        assert "tt" in cats
        assert "sprint" not in cats

    def test_soudal_contains_sprint_and_sh_categories(self):
        cats = {g["category"] for g in SPONSOR_GOAL_SETS["soudal"]}
        assert "sprint" in cats
        assert "stage_hunter" in cats
        assert "gc" not in cats

    def test_redbull_bora_contains_gc_and_sh_categories(self):
        cats = {g["category"] for g in SPONSOR_GOAL_SETS["redbull-bora"]}
        assert "gc" in cats
        assert "stage_hunter" in cats
        assert "sprint" not in cats

    def test_win_a_stage_is_role_disambiguated_for_dual_sponsors(self):
        """soudal/lidl-trek carry BOTH sprinter and stage_hunter 'Win a stage' /
        'Win 2 stages' goals; the keys MUST stay distinct. The goal_key backfill
        migration relies on this disambiguation (legacy goal_index → role key)."""
        for slug in ("soudal", "lidl-trek"):
            keys = {g["key"] for g in SPONSOR_GOAL_SETS[slug]}
            assert {"sprint_win_stage", "sh_win_stage"} <= keys, slug
            assert {"sprint_win_2_stages", "sh_win_2_stages"} <= keys, slug
            # Both share the label "Win a stage" but never the key.
            win_stage_labels = [g["label"] for g in SPONSOR_GOAL_SETS[slug]
                                if g["key"] in ("sprint_win_stage", "sh_win_stage")]
            assert win_stage_labels == ["Win a stage", "Win a stage"], slug


# ---------------------------------------------------------------------------
# Helper: build ctx for final-classification evaluators
# ---------------------------------------------------------------------------

def _make_final_ctx(
    final_classifications: dict,
    eligible_riders: set | None = None,
) -> dict:
    """Minimal ctx for eval_win_*_classification functions."""
    return {
        "final_classifications": final_classifications,
        "eligible_riders": eligible_riders if eligible_riders is not None else {RIDER_A},
    }


def _make_classif_ctx(
    classifications: dict,
    eligible_riders_by_stage: dict | None = None,
) -> dict:
    """Minimal ctx for eval_wear_*_jersey functions."""
    return {
        "classifications": classifications,
        "eligible_riders_by_stage": eligible_riders_by_stage if eligible_riders_by_stage is not None else {},
    }


# ---------------------------------------------------------------------------
# eval_win_points_classification
# ---------------------------------------------------------------------------

class TestEvalWinPointsClassification:
    def test_rank1_eligible_rider_returns_result(self):
        ctx = _make_final_ctx(
            final_classifications={
                "points": [{"rider_id": RIDER_A, "rank": 1}],
                "kom": [],
                "youth": [],
            },
            eligible_riders={RIDER_A},
        )
        result = eval_win_points_classification(ctx)
        assert result is not None
        assert result["rider_id"] == RIDER_A
        assert result["stage_slug"] is None

    def test_rank1_non_eligible_rider_returns_none(self):
        ctx = _make_final_ctx(
            final_classifications={
                "points": [{"rider_id": RIDER_B, "rank": 1}],
                "kom": [],
                "youth": [],
            },
            eligible_riders={RIDER_A},  # RIDER_B not eligible
        )
        result = eval_win_points_classification(ctx)
        assert result is None

    def test_rank2_eligible_rider_returns_none(self):
        ctx = _make_final_ctx(
            final_classifications={
                "points": [
                    {"rider_id": RIDER_A, "rank": 2},
                    {"rider_id": RIDER_B, "rank": 1},
                ],
                "kom": [],
                "youth": [],
            },
            eligible_riders={RIDER_A},  # RIDER_A is rank 2, not rank 1
        )
        result = eval_win_points_classification(ctx)
        assert result is None

    def test_empty_final_classifications_returns_none(self):
        ctx = _make_final_ctx(
            final_classifications={"points": [], "kom": [], "youth": []},
            eligible_riders={RIDER_A},
        )
        result = eval_win_points_classification(ctx)
        assert result is None

    def test_missing_points_key_returns_none(self):
        ctx = _make_final_ctx(
            final_classifications={"kom": [], "youth": []},
        )
        result = eval_win_points_classification(ctx)
        assert result is None


# ---------------------------------------------------------------------------
# eval_win_kom_classification
# ---------------------------------------------------------------------------

class TestEvalWinKomClassification:
    def test_rank1_eligible_rider_returns_result(self):
        ctx = _make_final_ctx(
            final_classifications={
                "points": [],
                "kom": [{"rider_id": RIDER_A, "rank": 1}],
                "youth": [],
            },
            eligible_riders={RIDER_A},
        )
        result = eval_win_kom_classification(ctx)
        assert result is not None
        assert result["rider_id"] == RIDER_A
        assert result["stage_slug"] is None

    def test_rank1_non_eligible_rider_returns_none(self):
        ctx = _make_final_ctx(
            final_classifications={
                "points": [],
                "kom": [{"rider_id": RIDER_B, "rank": 1}],
                "youth": [],
            },
            eligible_riders={RIDER_A},
        )
        result = eval_win_kom_classification(ctx)
        assert result is None

    def test_empty_kom_list_returns_none(self):
        ctx = _make_final_ctx(
            final_classifications={"points": [], "kom": [], "youth": []},
        )
        result = eval_win_kom_classification(ctx)
        assert result is None

    def test_multiple_riders_rank1_eligible_wins(self):
        # rank 1 eligible rider wins over rank 2 non-eligible
        ctx = _make_final_ctx(
            final_classifications={
                "points": [],
                "kom": [
                    {"rider_id": RIDER_B, "rank": 2},
                    {"rider_id": RIDER_A, "rank": 1},
                ],
                "youth": [],
            },
            eligible_riders={RIDER_A},
        )
        result = eval_win_kom_classification(ctx)
        assert result is not None
        assert result["rider_id"] == RIDER_A

    def test_missing_kom_key_returns_none(self):
        ctx = _make_final_ctx(
            final_classifications={"points": [], "youth": []},
        )
        result = eval_win_kom_classification(ctx)
        assert result is None


# ---------------------------------------------------------------------------
# eval_wear_youth_jersey
# ---------------------------------------------------------------------------

class TestEvalWearYouthJersey:
    def test_eligible_rider_held_youth_rank1_on_stage(self):
        ctx = _make_classif_ctx(
            classifications={
                STAGE_1: [
                    {"classification_type": "youth", "rank": 1, "rider_id": RIDER_A},
                ],
            },
            eligible_riders_by_stage={STAGE_1: {RIDER_A}},
        )
        result = eval_wear_youth_jersey(ctx)
        assert result is not None
        assert result["rider_id"] == RIDER_A
        assert result["stage_slug"] == STAGE_1

    def test_non_eligible_rider_youth_rank1_returns_none(self):
        ctx = _make_classif_ctx(
            classifications={
                STAGE_1: [
                    {"classification_type": "youth", "rank": 1, "rider_id": RIDER_B},
                ],
            },
            eligible_riders_by_stage={STAGE_1: {RIDER_A}},  # RIDER_B not eligible
        )
        result = eval_wear_youth_jersey(ctx)
        assert result is None

    def test_eligible_rider_youth_rank2_returns_none(self):
        ctx = _make_classif_ctx(
            classifications={
                STAGE_1: [
                    {"classification_type": "youth", "rank": 2, "rider_id": RIDER_A},
                ],
            },
            eligible_riders_by_stage={STAGE_1: {RIDER_A}},
        )
        result = eval_wear_youth_jersey(ctx)
        assert result is None

    def test_ignores_non_youth_classification_types(self):
        ctx = _make_classif_ctx(
            classifications={
                STAGE_1: [
                    {"classification_type": "gc", "rank": 1, "rider_id": RIDER_A},
                    {"classification_type": "points", "rank": 1, "rider_id": RIDER_A},
                ],
            },
            eligible_riders_by_stage={STAGE_1: {RIDER_A}},
        )
        result = eval_wear_youth_jersey(ctx)
        assert result is None

    def test_finds_youth_on_any_stage(self):
        ctx = _make_classif_ctx(
            classifications={
                STAGE_1: [
                    {"classification_type": "gc", "rank": 1, "rider_id": RIDER_A},
                ],
                STAGE_2: [
                    {"classification_type": "youth", "rank": 1, "rider_id": RIDER_A},
                ],
            },
            eligible_riders_by_stage={
                STAGE_1: {RIDER_A},
                STAGE_2: {RIDER_A},
            },
        )
        result = eval_wear_youth_jersey(ctx)
        assert result is not None
        assert result["stage_slug"] == STAGE_2

    def test_empty_classifications_returns_none(self):
        ctx = _make_classif_ctx(classifications={})
        result = eval_wear_youth_jersey(ctx)
        assert result is None


# ---------------------------------------------------------------------------
# eval_wear_kom_jersey
# ---------------------------------------------------------------------------

class TestEvalWearKomJersey:
    def test_eligible_rider_held_kom_rank1_on_stage(self):
        ctx = _make_classif_ctx(
            classifications={
                STAGE_1: [
                    {"classification_type": "kom", "rank": 1, "rider_id": RIDER_A},
                ],
            },
            eligible_riders_by_stage={STAGE_1: {RIDER_A}},
        )
        result = eval_wear_kom_jersey(ctx)
        assert result is not None
        assert result["rider_id"] == RIDER_A
        assert result["stage_slug"] == STAGE_1

    def test_non_eligible_rider_kom_rank1_returns_none(self):
        ctx = _make_classif_ctx(
            classifications={
                STAGE_1: [
                    {"classification_type": "kom", "rank": 1, "rider_id": RIDER_B},
                ],
            },
            eligible_riders_by_stage={STAGE_1: {RIDER_A}},
        )
        result = eval_wear_kom_jersey(ctx)
        assert result is None

    def test_eligible_rider_kom_rank2_returns_none(self):
        ctx = _make_classif_ctx(
            classifications={
                STAGE_1: [
                    {"classification_type": "kom", "rank": 2, "rider_id": RIDER_A},
                ],
            },
            eligible_riders_by_stage={STAGE_1: {RIDER_A}},
        )
        result = eval_wear_kom_jersey(ctx)
        assert result is None

    def test_ignores_non_kom_classification_types(self):
        ctx = _make_classif_ctx(
            classifications={
                STAGE_1: [
                    {"classification_type": "gc", "rank": 1, "rider_id": RIDER_A},
                    {"classification_type": "youth", "rank": 1, "rider_id": RIDER_A},
                ],
            },
            eligible_riders_by_stage={STAGE_1: {RIDER_A}},
        )
        result = eval_wear_kom_jersey(ctx)
        assert result is None

    def test_finds_kom_on_any_stage(self):
        ctx = _make_classif_ctx(
            classifications={
                STAGE_1: [
                    {"classification_type": "points", "rank": 1, "rider_id": RIDER_A},
                ],
                STAGE_2: [
                    {"classification_type": "kom", "rank": 1, "rider_id": RIDER_A},
                ],
            },
            eligible_riders_by_stage={
                STAGE_1: {RIDER_A},
                STAGE_2: {RIDER_A},
            },
        )
        result = eval_wear_kom_jersey(ctx)
        assert result is not None
        assert result["stage_slug"] == STAGE_2

    def test_empty_classifications_returns_none(self):
        ctx = _make_classif_ctx(classifications={})
        result = eval_wear_kom_jersey(ctx)
        assert result is None


# ---------------------------------------------------------------------------
# Idempotency via goal_key (unit-level intent)
# ---------------------------------------------------------------------------

class TestGoalKeyIdempotencyIntent:
    """Verify that SPONSOR_GOAL_SETS goal dicts carry a stable goal_key suitable
    for idempotency checks in evaluate_gt_goals.

    The full integration path (DB roundtrip) is covered by the fact that
    evaluate_gt_goals uses `existing_by_key: set[tuple[str,str,str]]` and
    skips completions where (team_id, sponsor_id, goal_key) already exists.
    Here we verify the key precondition: every Spec-C goal has a non-empty `key`.
    """

    def test_all_spec_c_goals_carry_stable_key(self):
        """Every goal in SPONSOR_GOAL_SETS has a non-empty, unique string key."""
        for sponsor, goals in SPONSOR_GOAL_SETS.items():
            keys = [g.get("key") for g in goals]
            assert all(isinstance(k, str) and k for k in keys), (
                f"{sponsor} has goals with missing/empty key"
            )
            assert len(keys) == len(set(keys)), (
                f"{sponsor} has duplicate keys: {keys}"
            )

    def test_spec_c_goals_have_no_legacy_tiered_with_field(self):
        """Spec-C goals use tier_group, not the legacy tiered_with integer index."""
        for sponsor, goals in SPONSOR_GOAL_SETS.items():
            for g in goals:
                assert "tiered_with" not in g, (
                    f"{sponsor}/{g['key']} still has legacy tiered_with field"
                )

    def test_tier_group_goals_are_consistent(self):
        """Goals with tier_group share the same group value within a sponsor."""
        for sponsor, goals in SPONSOR_GOAL_SETS.items():
            tg_rewards: dict[str, list[int]] = {}
            for g in goals:
                tg = g.get("tier_group")
                if tg:
                    tg_rewards.setdefault(tg, []).append(g["reward"])
            # Each tier_group must have at least 2 members and differing rewards
            for tg, rewards in tg_rewards.items():
                assert len(rewards) >= 2, (
                    f"{sponsor} tier_group '{tg}' has only 1 member"
                )
                assert len(set(rewards)) > 1, (
                    f"{sponsor} tier_group '{tg}' has identical rewards — tiering won't work: {rewards}"
                )


# ---------------------------------------------------------------------------
# Helper: build stage-win ctx shapes
# ---------------------------------------------------------------------------

def _make_stage_win_ctx(
    role: str,
    stage_slug: str,
    winner_id: str,
    profile: str | None,
    eligible_riders_by_stage: dict | None = None,
) -> dict:
    """Minimal ctx for eval_win_stage and eval_win_2_stages.

    Mirrors the ctx dict built in evaluate_gt_goals:
      stage_wins: {stage_slug: winner_rider_id}
      eligible_riders_by_stage: {stage_slug: set(rider_ids)}
      role: str
      stage_profiles: {stage_slug: profile_icon}
    """
    stage_wins = {stage_slug: winner_id}
    elig = (
        eligible_riders_by_stage
        if eligible_riders_by_stage is not None
        else {stage_slug: {winner_id}}
    )
    stage_profiles = {}
    if profile is not None:
        stage_profiles[stage_slug] = profile
    return {
        "stage_wins": stage_wins,
        "eligible_riders_by_stage": elig,
        "role": role,
        "stage_profiles": stage_profiles,
    }


# ---------------------------------------------------------------------------
# Task 9 — Sprinter profile gating (Spec A Q14)
# ---------------------------------------------------------------------------

class TestSprinterProfileGating:
    """eval_win_stage: sprinter role is gated to flat profiles (p1/p2/p3)."""

    def test_sprinter_win_stage_gated_to_flat_profile(self):
        """Sprinter winning a mountain stage (p5) → None."""
        ctx = _make_stage_win_ctx(
            role="sprinter",
            stage_slug=STAGE_1,
            winner_id=RIDER_A,
            profile="p5",
        )
        result = eval_win_stage(ctx)
        assert result is None

    def test_sprinter_win_stage_counts_on_flat(self):
        """Sprinter winning a flat stage (p1) → returns the rider."""
        ctx = _make_stage_win_ctx(
            role="sprinter",
            stage_slug=STAGE_1,
            winner_id=RIDER_A,
            profile="p1",
        )
        result = eval_win_stage(ctx)
        assert result is not None
        assert result["rider_id"] == RIDER_A
        assert result["stage_slug"] == STAGE_1

    def test_sprinter_win_stage_counts_on_p2(self):
        """Sprinter winning a p2 stage → returns the rider."""
        ctx = _make_stage_win_ctx(
            role="sprinter",
            stage_slug=STAGE_1,
            winner_id=RIDER_A,
            profile="p2",
        )
        result = eval_win_stage(ctx)
        assert result is not None
        assert result["rider_id"] == RIDER_A

    def test_sprinter_win_stage_counts_on_p3(self):
        """Sprinter winning a p3 stage → returns the rider."""
        ctx = _make_stage_win_ctx(
            role="sprinter",
            stage_slug=STAGE_1,
            winner_id=RIDER_A,
            profile="p3",
        )
        result = eval_win_stage(ctx)
        assert result is not None
        assert result["rider_id"] == RIDER_A

    def test_sprinter_win_stage_missing_profile_returns_none(self):
        """Sprinter winning a stage with unknown/missing profile → None (safe default)."""
        ctx = _make_stage_win_ctx(
            role="sprinter",
            stage_slug=STAGE_1,
            winner_id=RIDER_A,
            profile=None,  # not in stage_profiles
        )
        result = eval_win_stage(ctx)
        assert result is None

    def test_stage_hunter_win_stage_not_gated(self):
        """stage_hunter role is not gated — mountain stage win counts."""
        ctx = _make_stage_win_ctx(
            role="stage_hunter",
            stage_slug=STAGE_1,
            winner_id=RIDER_A,
            profile="p5",  # mountain — irrelevant for stage_hunter
        )
        result = eval_win_stage(ctx)
        assert result is not None
        assert result["rider_id"] == RIDER_A
        assert result["stage_slug"] == STAGE_1

    def test_gc_leader_win_stage_not_gated(self):
        """gc_leader role is not gated either."""
        ctx = _make_stage_win_ctx(
            role="gc_leader",
            stage_slug=STAGE_1,
            winner_id=RIDER_A,
            profile="p6",
        )
        result = eval_win_stage(ctx)
        assert result is not None
        assert result["rider_id"] == RIDER_A

    def test_sprinter_win_2_stages_only_counts_flat(self):
        """eval_win_2_stages: sprinter — two mountain-stage wins → None (neither counts)."""
        ctx = {
            "stage_wins": {
                STAGE_1: RIDER_A,
                STAGE_2: RIDER_A,
            },
            "eligible_riders_by_stage": {
                STAGE_1: {RIDER_A},
                STAGE_2: {RIDER_A},
            },
            "role": "sprinter",
            "stage_profiles": {
                STAGE_1: "p5",
                STAGE_2: "p4",
            },
        }
        result = eval_win_2_stages(ctx)
        assert result is None

    def test_sprinter_win_2_stages_one_flat_one_mountain_returns_none(self):
        """Only 1 flat stage — can't reach 2 — should return None."""
        ctx = {
            "stage_wins": {
                STAGE_1: RIDER_A,
                STAGE_2: RIDER_A,
            },
            "eligible_riders_by_stage": {
                STAGE_1: {RIDER_A},
                STAGE_2: {RIDER_A},
            },
            "role": "sprinter",
            "stage_profiles": {
                STAGE_1: "p1",  # flat — counts
                STAGE_2: "p5",  # mountain — doesn't count
            },
        }
        result = eval_win_2_stages(ctx)
        assert result is None

    def test_sprinter_win_2_stages_both_flat_returns_rider(self):
        """2 flat-stage wins → returns the rider."""
        ctx = {
            "stage_wins": {
                STAGE_1: RIDER_A,
                STAGE_2: RIDER_A,
            },
            "eligible_riders_by_stage": {
                STAGE_1: {RIDER_A},
                STAGE_2: {RIDER_A},
            },
            "role": "sprinter",
            "stage_profiles": {
                STAGE_1: "p1",
                STAGE_2: "p2",
            },
        }
        result = eval_win_2_stages(ctx)
        assert result is not None
        assert result["rider_id"] == RIDER_A


# ---------------------------------------------------------------------------
# No-cumul rule — neutralized_stage_slugs (P0, blocks Tour 2026 double-pay)
#
# Win evaluators must report which base-bonus race_slugs the goal consumes, so
# process_race_bonuses can skip emitting those base bonuses. neutralized_slugs()
# is the single source of truth mapping a completed goal → the slugs to neutralize.
# ---------------------------------------------------------------------------

STAGE_3 = "race/giro-d-italia/2026/stage-3"


class TestNeutralizedStageSlugs:
    def test_win_stage_reports_its_stage_slug(self):
        ctx = _make_stage_win_ctx(
            role="stage_hunter", stage_slug=STAGE_1, winner_id=RIDER_A, profile="p5",
        )
        result = eval_win_stage(ctx)
        assert result is not None
        assert result["neutralized_stage_slugs"] == [STAGE_1]

    def test_win_2_stages_reports_both_counted_slugs(self):
        ctx = {
            "stage_wins": {STAGE_1: RIDER_A, STAGE_2: RIDER_A},
            "eligible_riders_by_stage": {STAGE_1: {RIDER_A}, STAGE_2: {RIDER_A}},
            "role": "stage_hunter",
            "stage_profiles": {STAGE_1: "p2", STAGE_2: "p1"},
        }
        result = eval_win_2_stages(ctx)
        assert result is not None
        assert sorted(result["neutralized_stage_slugs"]) == sorted([STAGE_1, STAGE_2])

    def test_win_2_stages_excludes_non_counted_sprinter_stage(self):
        """A sprinter who wins 2 flat + 1 mountain: the goal counts only the 2 flat
        stages, so the mountain stage's base bonus must stay (not neutralized)."""
        ctx = {
            "stage_wins": {STAGE_1: RIDER_A, STAGE_2: RIDER_A, STAGE_3: RIDER_A},
            "eligible_riders_by_stage": {
                STAGE_1: {RIDER_A}, STAGE_2: {RIDER_A}, STAGE_3: {RIDER_A},
            },
            "role": "sprinter",
            "stage_profiles": {STAGE_1: "p1", STAGE_2: "p2", STAGE_3: "p5"},
        }
        result = eval_win_2_stages(ctx)
        assert result is not None
        assert STAGE_3 not in result["neutralized_stage_slugs"]
        assert sorted(result["neutralized_stage_slugs"]) == sorted([STAGE_1, STAGE_2])

    def test_neutralized_slugs_gc_podium_targets_gc_race(self):
        from goal_evaluator import neutralized_slugs
        goal = {"key": "gc_podium", "category": "gc"}
        result = {"rider_id": RIDER_A, "stage_slug": None}
        assert neutralized_slugs(goal, result, "race/giro-d-italia/2026") == [
            "race/giro-d-italia/2026/gc"
        ]

    def test_neutralized_slugs_gc_top5_targets_gc_race(self):
        from goal_evaluator import neutralized_slugs
        goal = {"key": "gc_top5", "category": "gc"}
        result = {"rider_id": RIDER_A, "stage_slug": None}
        assert neutralized_slugs(goal, result, "race/giro-d-italia/2026") == [
            "race/giro-d-italia/2026/gc"
        ]

    def test_neutralized_slugs_stage_win_passes_through(self):
        from goal_evaluator import neutralized_slugs
        goal = {"key": "sh_win_stage", "category": "stage_hunter"}
        result = {
            "rider_id": RIDER_A, "stage_slug": STAGE_1,
            "neutralized_stage_slugs": [STAGE_1],
        }
        assert neutralized_slugs(goal, result, "race/giro-d-italia/2026") == [STAGE_1]

    def test_neutralized_slugs_classification_goal_is_noop(self):
        """sh_kom_classification / wear-jersey goals consume no stage base bonus."""
        from goal_evaluator import neutralized_slugs
        goal = {"key": "sh_kom_classification", "category": "stage_hunter"}
        result = {"rider_id": RIDER_A, "stage_slug": None}  # no neutralized field
        assert neutralized_slugs(goal, result, "race/giro-d-italia/2026") == []


# ---------------------------------------------------------------------------
# Task 10 — suppress_tier_group_duplicates
# ---------------------------------------------------------------------------

class TestSuppressTierGroupDuplicates:
    """suppress_tier_group_duplicates: keep only highest-reward per (tier_group, rider_id)."""

    def _make_goals(self, specs: list[dict]) -> list[dict]:
        """Build minimal goal dicts from specs."""
        return [
            {
                "key": s["key"],
                "reward": s["reward"],
                "tier_group": s.get("tier_group"),
                "label": s["key"],
                "evaluator": "win_stage",
            }
            for s in specs
        ]

    def test_suppress_tier_group_keeps_highest(self):
        """Same tier_group + same rider: only the 30k goal_idx is kept."""
        goals = self._make_goals([
            {"key": "podium",  "reward": 30_000, "tier_group": "gc_placement"},  # idx 0
            {"key": "top5",    "reward": 20_000, "tier_group": "gc_placement"},  # idx 1
        ])
        completed = {
            0: {"rider_id": RIDER_A, "stage_slug": None},
            1: {"rider_id": RIDER_A, "stage_slug": None},
        }
        result = suppress_tier_group_duplicates(goals, completed)
        assert 0 in result, "highest-reward goal (idx 0, 30k) must be kept"
        assert 1 not in result, "lower-reward goal (idx 1, 20k) must be suppressed"

    def test_suppress_tier_group_different_riders_both_kept(self):
        """Same tier_group, different riders → both kept (no cross-rider suppression)."""
        goals = self._make_goals([
            {"key": "podium",  "reward": 30_000, "tier_group": "gc_placement"},  # idx 0
            {"key": "top5",    "reward": 20_000, "tier_group": "gc_placement"},  # idx 1
        ])
        completed = {
            0: {"rider_id": RIDER_A, "stage_slug": None},
            1: {"rider_id": RIDER_B, "stage_slug": None},
        }
        result = suppress_tier_group_duplicates(goals, completed)
        assert 0 in result, "RIDER_A's podium must be kept"
        assert 1 in result, "RIDER_B's top5 must be kept (different rider)"

    def test_no_tier_group_all_kept(self):
        """Goals with no tier_group are always kept regardless of rider."""
        goals = self._make_goals([
            {"key": "wear_gc",   "reward": 15_000},  # no tier_group, idx 0
            {"key": "wear_youth","reward": 10_000},   # no tier_group, idx 1
        ])
        completed = {
            0: {"rider_id": RIDER_A, "stage_slug": STAGE_1},
            1: {"rider_id": RIDER_A, "stage_slug": STAGE_1},
        }
        result = suppress_tier_group_duplicates(goals, completed)
        assert 0 in result
        assert 1 in result

    def test_rider_id_none_always_kept(self):
        """Completions with rider_id=None (team goals) are never suppressed."""
        goals = self._make_goals([
            {"key": "two_riders_win", "reward": 20_000, "tier_group": "multi_stage"},  # idx 0
            {"key": "win_stage",      "reward": 10_000, "tier_group": "multi_stage"},  # idx 1
        ])
        completed = {
            0: {"rider_id": None, "stage_slug": None},
            1: {"rider_id": None, "stage_slug": None},
        }
        result = suppress_tier_group_duplicates(goals, completed)
        assert 0 in result
        assert 1 in result

    def test_single_completion_in_tier_group_kept(self):
        """Only one goal in tier_group is completed — it must be kept."""
        goals = self._make_goals([
            {"key": "podium", "reward": 30_000, "tier_group": "gc_placement"},  # idx 0
            {"key": "top5",   "reward": 20_000, "tier_group": "gc_placement"},  # idx 1
        ])
        completed = {
            1: {"rider_id": RIDER_A, "stage_slug": None},  # only lower-reward completed
        }
        result = suppress_tier_group_duplicates(goals, completed)
        assert 1 in result

    def test_mixed_tier_groups_each_suppressed_independently(self):
        """Two different tier_groups — each resolves independently."""
        goals = self._make_goals([
            {"key": "gc_podium",   "reward": 30_000, "tier_group": "gc_placement"},    # idx 0
            {"key": "gc_top5",     "reward": 20_000, "tier_group": "gc_placement"},    # idx 1
            {"key": "sprint_2s",   "reward": 20_000, "tier_group": "sprint_stages"},   # idx 2
            {"key": "sprint_1s",   "reward": 10_000, "tier_group": "sprint_stages"},   # idx 3
        ])
        completed = {
            0: {"rider_id": RIDER_A, "stage_slug": None},
            1: {"rider_id": RIDER_A, "stage_slug": None},
            2: {"rider_id": RIDER_B, "stage_slug": None},
            3: {"rider_id": RIDER_B, "stage_slug": None},
        }
        result = suppress_tier_group_duplicates(goals, completed)
        # gc_placement: keep idx 0 (30k), suppress idx 1 (20k)
        assert 0 in result
        assert 1 not in result
        # sprint_stages: keep idx 2 (20k), suppress idx 3 (10k)
        assert 2 in result
        assert 3 not in result


# ---------------------------------------------------------------------------
# Task 11 — evaluate_sponsor_goals: non-stage-race skip + 1-week multiplier
# ---------------------------------------------------------------------------

class TestEvaluateSponsorGoalsSkipNonStageRace:
    """evaluate_sponsor_goals returns skipped for one-day/monument slugs."""

    def test_milano_sanremo_is_skipped(self):
        """race/milano-sanremo/2026 is a one-day race — _is_squad_race returns False."""
        import asyncio
        from goal_evaluator import evaluate_sponsor_goals

        # Pass a dummy supabase; the function must return before any DB calls.
        dummy_supabase = object()
        result = asyncio.run(
            evaluate_sponsor_goals(dummy_supabase, "race/milano-sanremo/2026")
        )
        assert result.get("skipped") == "not a stage race", (
            f"Expected skipped='not a stage race', got: {result}"
        )
        assert result.get("goals_completed") == 0
        assert result.get("errors") == []

    def test_empty_slug_is_skipped(self):
        """An empty string is not a stage race."""
        import asyncio
        from goal_evaluator import evaluate_sponsor_goals

        dummy_supabase = object()
        result = asyncio.run(evaluate_sponsor_goals(dummy_supabase, ""))
        assert result.get("skipped") == "not a stage race"

    def test_unknown_one_day_slug_is_skipped(self):
        """A plausible one-day slug not in the calendar is not a stage race."""
        import asyncio
        from goal_evaluator import evaluate_sponsor_goals

        dummy_supabase = object()
        result = asyncio.run(
            evaluate_sponsor_goals(dummy_supabase, "race/not-a-real-race/2026")
        )
        assert result.get("skipped") == "not a stage race"


class TestGtRewardMultiplierVsOneWeek:
    """Unit-level assertion: gt_reward_multiplier returns 1.0 for 1-week races.

    This verifies the multiplier invariant that drives evaluate_sponsor_goals
    reward computation: a base-10k goal at a 1-week race pays 10,000 (not 20,000).
    Full integration with DB mocking is impractical here (the _fetch_all helper
    uses .range() which requires a chainable mock). The multiplier is the only
    difference between a 1-week and a GT evaluation; correctness of the
    evaluate_sponsor_goals body for stage races is otherwise identical to
    evaluate_gt_goals (which has existing coverage).
    """

    def test_tirreno_adriatico_returns_1(self):
        """Tirreno-Adriatico is in the calendar as a stage-race, not a GT."""
        assert gt_reward_multiplier("race/tirreno-adriatico/2026") == 1.0

    def test_paris_nice_returns_1(self):
        assert gt_reward_multiplier("race/paris-nice/2026") == 1.0

    def test_tour_de_suisse_returns_1(self):
        assert gt_reward_multiplier("race/tour-de-suisse/2026") == 1.0

    def test_one_week_base_10k_goal_pays_10k(self):
        """Multiplier correctly scales a 10k base reward to 10k for 1-week races."""
        mult = gt_reward_multiplier("race/paris-nice/2026")
        base_reward = 10_000
        assert int(base_reward * mult) == 10_000

    def test_gt_base_10k_goal_pays_20k(self):
        """GT multiplier correctly scales a 10k base reward to 20k."""
        mult = gt_reward_multiplier("race/giro-d-italia/2026")
        base_reward = 10_000
        assert int(base_reward * mult) == 20_000


# ---------------------------------------------------------------------------
# E2E idempotency test — evaluate_sponsor_goals must not double-credit
# ---------------------------------------------------------------------------
#
# Approach: full e2e mock (not focused dedup).  helpers.make_chain now supports
# .range() as a chainable method, so _fetch_all can run under the mock without
# AttributeError.  The test wires the exact table-call sequence produced by
# evaluate_sponsor_goals and verifies:
#   - Run 1: exactly 1 sponsor_goal_completions INSERT and 1 treasury_log INSERT
#   - Run 2: same mocks but sponsor_goal_completions existing-key SELECT returns
#            the row written in run 1 → 0 sponsor_goal_completions INSERTs,
#            0 treasury_log INSERTs (credit skipped)
#
# This is the project's #1 historical bug class (duplicate credits, 2026-05-20).
# ---------------------------------------------------------------------------

# Shared IDs for the e2e test
_E2E_TEAM_ID     = "cccccccc-cccc-4ccc-cccc-cccccccccc01"
_E2E_SPONSOR_ID  = "dddddddd-dddd-4ddd-dddd-dddddddddd01"
_E2E_RIDER_GC    = "eeeeeeee-eeee-4eee-eeee-eeeeeeeeee01"
_E2E_RACE_SLUG   = "race/paris-nice/2026"
_E2E_STAGE_SLUG  = "race/paris-nice/2026/stage-1"

# Minimal DB rows for a Decathlon T4 sponsor, one gc_leader rider, GC podium (rank 2).
# Decathlon is in SPONSOR_GOAL_SETS (_GC_SET + _SPRINT_SET).
# GC rank 2 triggers gc_podium (30k) + gc_top5 (20k); suppression keeps only gc_podium.
# No nationality on the sponsor → nationality multiplier stays 1.0.
# 1-week race → gt_reward_multiplier = 1.0 → final_reward = 30_000.

_E2E_TEAM_SPONSORS = [{
    "team_id": _E2E_TEAM_ID,
    "sponsor_id": _E2E_SPONSOR_ID,
    "sponsors": {
        "id": _E2E_SPONSOR_ID,
        "slug": "decathlon",
        "tier": 4,
        "nationality": None,
    },
}]

_E2E_RACE_RESULTS = [
    # GC final result
    {
        "rider_id": _E2E_RIDER_GC,
        "race_slug": _E2E_RACE_SLUG,
        "rank": 2,
        "stage": "gc",
        "is_itt": False,
        "race_date": None,
        "profile_icon": None,
    },
    # Stage 1 result (rank != 1 → no stage win recorded)
    {
        "rider_id": _E2E_RIDER_GC,
        "race_slug": _E2E_STAGE_SLUG,
        "rank": 5,
        "stage": "stage-1",
        "is_itt": False,
        "race_date": "2026-03-09",
        "profile_icon": "p2",
    },
]

_E2E_SQUAD = [{
    "team_id": _E2E_TEAM_ID,
    "rider_id": _E2E_RIDER_GC,
    "role": "gc_leader",
    "created_at": "2026-01-01T00:00:00Z",
    "removed_at": None,
}]

_E2E_ROLE_ASSIGNMENTS = [{
    "team_id": _E2E_TEAM_ID,
    "rider_id": _E2E_RIDER_GC,
    "role": "gc_leader",
    "applied_at": "2026-01-01T00:00:00Z",
}]

_E2E_RIDERS_NAT = [{"id": _E2E_RIDER_GC, "nationality": "FR"}]


def _make_run1_supabase():
    """Supabase mock for run 1: no prior completions → credit fires once."""
    return make_supabase(
        # 1. team_sponsors (T4 filter)
        _E2E_TEAM_SPONSORS,
        # 2. race_results — _fetch_all (1 page, < 1000 rows)
        _E2E_RACE_RESULTS,
        # 3. gt_daily_classifications — _fetch_all (empty → no jersey goals)
        [],
        # 4. gt_final_classifications "points" — _fetch_all
        [],
        # 5. gt_final_classifications "kom" — _fetch_all
        [],
        # 6. gt_final_classifications "youth" — _fetch_all
        [],
        # 7. gt_squad — _fetch_all
        _E2E_SQUAD,
        # 8. gt_role_assignments — _fetch_all
        _E2E_ROLE_ASSIGNMENTS,
        # 9. riders nationality (direct .execute(), no _fetch_all)
        _E2E_RIDERS_NAT,
        # 10. sponsor_goal_completions SELECT existing keys — EMPTY on first run
        [],
        # 11. sponsor_goal_completions INSERT (the new completion)
        [],
        # 12. teams SELECT (treasury lookup)
        [{"id": _E2E_TEAM_ID, "treasury": 500_000}],
        # 13. teams UPDATE
        [],
        # 14. treasury_log INSERT
        [],
    )


def _make_run2_supabase():
    """Supabase mock for run 2: prior completion exists → credit must be skipped."""
    return make_supabase(
        # 1. team_sponsors
        _E2E_TEAM_SPONSORS,
        # 2. race_results — _fetch_all
        _E2E_RACE_RESULTS,
        # 3. gt_daily_classifications — _fetch_all
        [],
        # 4. gt_final_classifications "points" — _fetch_all
        [],
        # 5. gt_final_classifications "kom" — _fetch_all
        [],
        # 6. gt_final_classifications "youth" — _fetch_all
        [],
        # 7. gt_squad — _fetch_all
        _E2E_SQUAD,
        # 8. gt_role_assignments — _fetch_all
        _E2E_ROLE_ASSIGNMENTS,
        # 9. riders nationality
        _E2E_RIDERS_NAT,
        # 10. sponsor_goal_completions SELECT — returns the row written in run 1
        [{
            "team_id": _E2E_TEAM_ID,
            "sponsor_id": _E2E_SPONSOR_ID,
            "goal_key": "gc_podium",
            "goal_index": 0,
        }],
        # No further table calls expected (credit path is skipped)
    )


def _make_run3_supabase():
    """Supabase mock: a prior completion exists at the SAME goal_index (0) but a
    DIFFERENT goal_key. Dedup is key-based, so the gc_podium goal must STILL credit.

    This guards the exact #1 fix: the old goal_index-based suppression would have
    wrongly skipped this; key-based dedup must not. Same call sequence as run 1
    (credit path runs), only the existing-keys SELECT differs.
    """
    return make_supabase(
        _E2E_TEAM_SPONSORS,
        _E2E_RACE_RESULTS,
        [],                       # gt_daily_classifications
        [], [], [],               # gt_final_classifications points/kom/youth
        _E2E_SQUAD,
        _E2E_ROLE_ASSIGNMENTS,
        _E2E_RIDERS_NAT,
        # sponsor_goal_completions SELECT: different key at the same legacy index 0
        [{
            "team_id": _E2E_TEAM_ID,
            "sponsor_id": _E2E_SPONSOR_ID,
            "goal_key": "gc_youth_jersey",
            "goal_index": 0,
        }],
        [],                       # sponsor_goal_completions INSERT
        [{"id": _E2E_TEAM_ID, "treasury": 500_000}],  # teams SELECT
        [],                       # teams UPDATE
        [],                       # treasury_log INSERT
    )


class TestEvaluateSponsorGoalsE2EIdempotency:
    """Regression: evaluate_sponsor_goals must not double-credit treasury.

    This is the project's #1 historical bug class (2026-05-20 Giro incident).
    Full e2e approach: wires the exact table-call sequence and checks write counts.
    helpers.make_chain supports .range() so _fetch_all works under the mock.
    """

    def test_run1_credits_treasury_exactly_once(self):
        """First evaluation: exactly 1 atomic credit_goal_reward RPC call."""
        import asyncio
        from goal_evaluator import evaluate_sponsor_goals

        sb = _make_run1_supabase()
        result = asyncio.run(evaluate_sponsor_goals(sb, _E2E_RACE_SLUG))

        assert result["status"] == "completed", f"errors: {result.get('errors')}"
        assert result["goals_completed"] == 1, (
            f"Expected 1 completion (gc_podium after tier suppression), got: {result['goals_completed']}"
        )
        assert result["errors"] == []

        # Completion insert + treasury_log + relative credit now happen atomically
        # inside credit_goal_reward (no direct table writes from Python).
        assert sb.inserts.get("sponsor_goal_completions", []) == []
        assert sb.inserts.get("treasury_log", []) == []
        assert sb.updates.get("teams", []) == []

        # Exactly 1 atomic payout RPC carrying the right completion.
        payout_calls = [c for c in sb.rpc_calls if c["fn"] == "credit_goal_reward"]
        assert len(payout_calls) == 1, (
            f"Expected 1 credit_goal_reward call, got {len(payout_calls)}: {sb.rpc_calls}"
        )
        comp = payout_calls[0]["params"]["p_completion"]
        assert comp["goal_key"] == "gc_podium"
        assert comp["team_id"] == _E2E_TEAM_ID
        assert comp["final_reward"] == 30_000  # 30k base × 1.0 (1-week) × 1.0
        assert comp["description"]  # audit/treasury_log description present

    def test_run2_skips_credit_entirely(self):
        """Second evaluation: existing goal_key row → no inserts, no treasury credit."""
        import asyncio
        from goal_evaluator import evaluate_sponsor_goals

        sb = _make_run2_supabase()
        result = asyncio.run(evaluate_sponsor_goals(sb, _E2E_RACE_SLUG))

        assert result["status"] == "completed", f"errors: {result.get('errors')}"
        assert result["goals_completed"] == 0, (
            "Run 2 must credit 0 goals (all skipped by idempotency check)"
        )
        assert result["errors"] == []

        # CRITICAL: no sponsor_goal_completions insert on second run
        sgc_inserts = sb.inserts.get("sponsor_goal_completions", [])
        assert len(sgc_inserts) == 0, (
            f"DOUBLE-CREDIT BUG: sponsor_goal_completions was inserted {len(sgc_inserts)} time(s) on run 2"
        )

        # CRITICAL: no treasury_log insert on second run
        tlog_inserts = sb.inserts.get("treasury_log", [])
        assert len(tlog_inserts) == 0, (
            f"DOUBLE-CREDIT BUG: treasury_log was inserted {len(tlog_inserts)} time(s) on run 2"
        )

        # CRITICAL: no teams update on second run
        teams_updates = sb.updates.get("teams", [])
        assert len(teams_updates) == 0, (
            f"DOUBLE-CREDIT BUG: teams was updated {len(teams_updates)} time(s) on run 2"
        )

        # CRITICAL: the payout RPC must not even be reached on run 2 (pre-check skips)
        payout_calls = [c for c in sb.rpc_calls if c["fn"] == "credit_goal_reward"]
        assert len(payout_calls) == 0, (
            f"DOUBLE-CREDIT BUG: credit_goal_reward called {len(payout_calls)} time(s) on run 2"
        )

    def test_run3_different_key_same_index_still_credits(self):
        """A prior completion at the same goal_index but a different goal_key must
        NOT block a genuinely-earned goal. Dedup is key-based, not index-based."""
        import asyncio
        from goal_evaluator import evaluate_sponsor_goals

        sb = _make_run3_supabase()
        result = asyncio.run(evaluate_sponsor_goals(sb, _E2E_RACE_SLUG))

        assert result["status"] == "completed", f"errors: {result.get('errors')}"
        assert result["goals_completed"] == 1, (
            "gc_podium must still credit despite a different-key row at the same index"
        )
        payout_calls = [c for c in sb.rpc_calls if c["fn"] == "credit_goal_reward"]
        assert len(payout_calls) == 1
        comp = payout_calls[0]["params"]["p_completion"]
        assert comp["goal_key"] == "gc_podium"
        assert comp["final_reward"] == 30_000

    def test_run1_records_neutralized_gc_slug(self):
        """The persisted completion carries the base-bonus slug to neutralize
        (no-cumul rule). gc_podium → {parent}/gc."""
        import asyncio
        from goal_evaluator import evaluate_sponsor_goals

        sb = _make_run1_supabase()
        asyncio.run(evaluate_sponsor_goals(sb, _E2E_RACE_SLUG))

        payout_calls = [c for c in sb.rpc_calls if c["fn"] == "credit_goal_reward"]
        assert len(payout_calls) == 1
        comp = payout_calls[0]["params"]["p_completion"]
        assert comp["neutralized_stage_slugs"] == [f"{_E2E_RACE_SLUG}/gc"]
