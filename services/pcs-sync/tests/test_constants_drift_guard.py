"""Phase-2 validation audit — cross-source drift guards.

These tests fail loudly when a game constant drifts between its sources of
truth (TypeScript front, Python pipeline, duplicated module-level constants).
They were added during the 2026-06 prod-wave review (Spec A/B/C) where the
biggest latent risk identified was silent divergence between
`apps/web/lib/gt-goals.ts` and `services/pcs-sync/goal_evaluator.py`.

Findings covered: CO-2 (goals TS↔Python), CO-3 (breakaway threshold
duplication), CO-4 (level / finals / underdog constants).
"""
from __future__ import annotations

import re
from pathlib import Path

import goal_evaluator
import scoring
import tactics

REPO_ROOT = Path(__file__).resolve().parents[3]
GT_GOALS_TS = REPO_ROOT / "apps" / "web" / "lib" / "gt-goals.ts"


# ---------------------------------------------------------------------------
# CO-2 — gt-goals.ts  ↔  goal_evaluator.SPONSOR_GOAL_SETS
# ---------------------------------------------------------------------------

_GOAL_OBJ = re.compile(
    r'\{\s*key:\s*"(?P<key>[^"]+)",\s*'
    r'label:\s*"(?P<label>[^"]+)",\s*'
    r'reward:\s*(?P<reward>[0-9_]+),\s*'
    r'role:\s*(?P<role>null|"[^"]+"),\s*'
    r'category:\s*"(?P<category>[^"]+)"'
    r'(?:,\s*tierGroup:\s*"(?P<tier>[^"]+)")?\s*\}'
)


def _parse_ts_goals(src: str) -> dict[str, dict]:
    """key -> normalized goal dict, parsed from the TS source."""
    out: dict[str, dict] = {}
    for m in _GOAL_OBJ.finditer(src):
        role = None if m["role"] == "null" else m["role"].strip('"')
        out[m["key"]] = {
            "label": m["label"],
            "reward": int(m["reward"].replace("_", "")),
            "role": role,
            "category": m["category"],
            "tier_group": m["tier"],  # None when the optional group is absent
        }
    return out


def _parse_ts_sponsor_sets(src: str) -> dict[str, list[str]]:
    """sponsorSlug -> ordered list of goal keys, reconstructed from spreads."""
    # 1. const X_GOALS: GtGoal[] = [ ... ]  → array-name -> [keys]
    arrays: dict[str, list[str]] = {}
    for m in re.finditer(r"const (\w+): GtGoal\[\] = \[(.*?)\];", src, re.S):
        arrays[m.group(1)] = re.findall(r'key:\s*"([^"]+)"', m.group(2))
    # 2. { sponsorSlug: "ineos", goals: [...GC_GOALS, ...CLM_GOALS] }
    sets: dict[str, list[str]] = {}
    for m in re.finditer(
        r'\{\s*sponsorSlug:\s*"([^"]+)",\s*goals:\s*\[(.*?)\]\s*\}', src, re.S
    ):
        slug, body = m.group(1), m.group(2)
        keys: list[str] = []
        for arr in re.findall(r"\.\.\.(\w+)", body):
            keys.extend(arrays.get(arr, []))
        sets[slug] = keys
    return sets


def _python_goals_by_key() -> dict[str, dict]:
    out: dict[str, dict] = {}
    for goals in goal_evaluator.SPONSOR_GOAL_SETS.values():
        for g in goals:
            out[g["key"]] = {
                "label": g["label"],
                "reward": g["reward"],
                "role": g.get("role"),
                "category": g["category"],
                "tier_group": g.get("tier_group"),
            }
    return out


def test_gt_goals_ts_python_field_parity() -> None:
    """Every goal key must have identical label/reward/role/category/tierGroup
    on both the TS and Python sides (CO-2)."""
    ts = _parse_ts_goals(GT_GOALS_TS.read_text(encoding="utf-8"))
    py = _python_goals_by_key()

    assert ts, "Parsed zero goals from gt-goals.ts — parser or file changed"
    assert set(ts) == set(py), (
        "Goal-key set drift between gt-goals.ts and goal_evaluator.py.\n"
        f"  only in TS: {sorted(set(ts) - set(py))}\n"
        f"  only in PY: {sorted(set(py) - set(ts))}"
    )
    for key in sorted(ts):
        assert ts[key] == py[key], (
            f"Goal '{key}' drifted between TS and Python:\n"
            f"  TS = {ts[key]}\n  PY = {py[key]}"
        )


def test_gt_goals_ts_python_sponsor_composition() -> None:
    """Each sponsor must expose the same ordered goal keys on both sides (CO-2)."""
    ts_sets = _parse_ts_sponsor_sets(GT_GOALS_TS.read_text(encoding="utf-8"))
    py_sets = {
        slug: [g["key"] for g in goals]
        for slug, goals in goal_evaluator.SPONSOR_GOAL_SETS.items()
    }
    assert set(ts_sets) == set(py_sets), (
        "Sponsor-slug set drift between gt-goals.ts and goal_evaluator.py.\n"
        f"  only in TS: {sorted(set(ts_sets) - set(py_sets))}\n"
        f"  only in PY: {sorted(set(py_sets) - set(ts_sets))}"
    )
    for slug in sorted(ts_sets):
        assert ts_sets[slug] == py_sets[slug], (
            f"Sponsor '{slug}' goal composition drifted:\n"
            f"  TS = {ts_sets[slug]}\n  PY = {py_sets[slug]}"
        )


# ---------------------------------------------------------------------------
# CO-3 — BREAKAWAY_THRESHOLD_KM duplicated in scoring.py and tactics.py
# ---------------------------------------------------------------------------

def test_breakaway_threshold_scoring_tactics_match() -> None:
    """tactics.py mirrors scoring.BREAKAWAY_THRESHOLD_KM by hand (no shared
    module to avoid a circular import). Guard the two against silent drift."""
    assert scoring.BREAKAWAY_THRESHOLD_KM == tactics.BREAKAWAY_THRESHOLD_KM == 30.0


# ---------------------------------------------------------------------------
# CO-4 — internal scoring constants match the documented Spec A/B values
# ---------------------------------------------------------------------------

def test_level_thresholds_stretched_l7_l8() -> None:
    """Spec A A1 — L7=2600, L8=5000 (stretched curve)."""
    assert scoring.LEVEL_THRESHOLDS == [0, 25, 150, 350, 600, 1200, 2600, 5000]


def test_final_secondary_scale_values() -> None:
    """Spec A A2 — secondary jersey finals: 80/20/10 (GT), 40/10/5 (1-week)."""
    assert scoring.FINAL_SECONDARY_SCALE["gt"] == [80, 20, 10]
    assert scoring.FINAL_SECONDARY_SCALE["one_week"] == [40, 10, 5]


def test_sprint_profiles_flat_and_hilly_only() -> None:
    """Spec A A4 — sprinter role multiplier gated to p1/p2/p3."""
    assert scoring.SPRINT_PROFILES == ("p1", "p2", "p3")
