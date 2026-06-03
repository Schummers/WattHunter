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

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

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
)

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
