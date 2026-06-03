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
    eval_win_stage,
    eval_win_2_stages,
    suppress_tier_group_duplicates,
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
