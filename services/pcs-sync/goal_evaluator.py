"""
Stage-Race Goal Evaluator — WattHunter PCS Sync Microservice.

Evaluates T4 sponsor one-time goals after each GT or 1-week stage race.
Called from Pipeline B (post-race) after scoring + base sponsor bonuses.

Goals are defined in apps/web/lib/gt-goals.ts (canonical source).
This file mirrors the definitions and evaluates them against race data.

Spec C changes:
- SPONSOR_GOAL_SETS dict mirrors gt-goals.ts with stable `key` fields.
- evaluate_sponsor_goals is the new generalized entry point (GT + 1-week).
- evaluate_gt_goals is kept as a backward-compatible alias.
- GT ×2 multiplier applied via gt_reward_multiplier(parent_slug); 1-week = ×1.
- Idempotency uses (team_id, sponsor_id, goal_key, race_slug) instead of goal_index.
- goal_index still written for backward display compat.
- eval_win_points_classification and new eval_win_kom_classification read gt_final_classifications.
- eval_wear_youth_jersey now active (was SKIP); eval_wear_kom_jersey added.
- gt_daily_classifications fetch includes all classification_types (gc/points/kom/youth).
"""
from __future__ import annotations

import logging
import re
from datetime import date, datetime
from typing import Optional
from zoneinfo import ZoneInfo

from sponsor_bonus import expand_sponsor_nationality

logger = logging.getLogger(__name__)

_PARIS_TZ = ZoneInfo("Europe/Paris")

GT_RACE_PREFIXES = ("giro-d-italia", "tour-de-france", "vuelta-a-espana")

# Spec A Q14: sprinter stage-win goals only count on flat profiles.
FLAT_PROFILES = {"p1", "p2", "p3"}


# ---------------------------------------------------------------------------
# Goal definitions — mirrors apps/web/lib/gt-goals.ts exactly
# ---------------------------------------------------------------------------

# Legacy dict — kept for backward compat with any callers that import GT_GOALS directly.
GT_GOALS: dict[str, list[dict]] = {
    "ineos": [
        {"label": "Podium GC final", "reward": 150_000, "role": "gc_leader", "tiered_with": 1, "eval": "gc_podium"},
        {"label": "Top 5 GC final", "reward": 75_000, "role": "gc_leader", "tiered_with": 0, "eval": "gc_top5"},
        {"label": "Wear maglia rosa", "reward": 50_000, "role": "gc_leader", "eval": "wear_gc_jersey"},
        {"label": "Wear maglia bianca", "reward": 40_000, "role": "gc_leader", "eval": "wear_youth_jersey"},
        {"label": "Win an ITT", "reward": 50_000, "role": "tt_specialist", "eval": "win_itt"},
        {"label": "2 riders in top 10 of an ITT", "reward": 25_000, "role": None, "eval": "two_riders_itt_top10"},
    ],
    "decathlon": [
        {"label": "Podium GC final", "reward": 150_000, "role": "gc_leader", "tiered_with": 1, "eval": "gc_podium"},
        {"label": "Top 5 GC final", "reward": 75_000, "role": "gc_leader", "tiered_with": 0, "eval": "gc_top5"},
        {"label": "Wear maglia rosa", "reward": 50_000, "role": "gc_leader", "eval": "wear_gc_jersey"},
        {"label": "Wear maglia bianca", "reward": 40_000, "role": "gc_leader", "eval": "wear_youth_jersey"},
        {"label": "Win a stage", "reward": 50_000, "role": "sprinter", "eval": "win_stage"},
        {"label": "Wear ciclamino", "reward": 40_000, "role": "sprinter", "eval": "wear_points_jersey"},
    ],
    "soudal": [
        {"label": "Win points classification", "reward": 150_000, "role": "sprinter", "eval": "win_points_classification"},
        {"label": "Win 2 stages", "reward": 75_000, "role": "sprinter", "tiered_with": 2, "eval": "win_2_stages"},
        {"label": "Win a stage", "reward": 50_000, "role": "sprinter", "tiered_with": 1, "eval": "win_stage"},
        {"label": "Wear ciclamino", "reward": 50_000, "role": "sprinter", "eval": "wear_points_jersey"},
        {"label": "2 different riders win a stage", "reward": 75_000, "role": None, "eval": "two_riders_win_stage"},
        {"label": "Win a stage", "reward": 60_000, "role": "stage_hunter", "eval": "win_stage"},
    ],
    "lidl-trek": [
        {"label": "Win points classification", "reward": 150_000, "role": "sprinter", "eval": "win_points_classification"},
        {"label": "Win 2 stages", "reward": 75_000, "role": "sprinter", "tiered_with": 2, "eval": "win_2_stages"},
        {"label": "Win a stage", "reward": 50_000, "role": "sprinter", "tiered_with": 1, "eval": "win_stage"},
        {"label": "Wear ciclamino", "reward": 50_000, "role": "sprinter", "eval": "wear_points_jersey"},
        {"label": "2 different riders win a stage", "reward": 75_000, "role": None, "eval": "two_riders_win_stage"},
        {"label": "Win a stage", "reward": 60_000, "role": "stage_hunter", "eval": "win_stage"},
    ],
}

# ---------------------------------------------------------------------------
# Canonical goal sets — Spec C mirror of apps/web/lib/gt-goals.ts
#
# Each goal dict: key, label, reward (1-week base; ×2 applied for GT),
#                  role, category, tier_group (opt), evaluator (EVALUATORS key).
# ---------------------------------------------------------------------------

_GC_SET = [
    {"key": "gc_podium",           "label": "Podium GC",                    "reward": 30_000,  "role": "gc_leader",    "category": "gc",           "tier_group": "gc_placement", "evaluator": "gc_podium"},
    {"key": "gc_top5",             "label": "Top 5 GC",                     "reward": 20_000,  "role": "gc_leader",    "category": "gc",           "tier_group": "gc_placement", "evaluator": "gc_top5"},
    {"key": "gc_race_leader_jersey","label": "Wear the Race Leader jersey",  "reward": 15_000,  "role": "gc_leader",    "category": "gc",           "evaluator": "wear_gc_jersey"},
    {"key": "gc_youth_jersey",     "label": "Wear the young rider jersey",   "reward": 10_000,  "role": "gc_leader",    "category": "gc",           "evaluator": "wear_youth_jersey"},
]

_SPRINT_SET = [
    {"key": "sprint_points_classification", "label": "Win the points classification", "reward": 30_000, "role": "sprinter", "category": "sprint", "evaluator": "win_points_classification"},
    {"key": "sprint_win_2_stages",           "label": "Win 2 stages",                 "reward": 20_000, "role": "sprinter", "category": "sprint", "tier_group": "sprint_stages", "evaluator": "win_2_stages"},
    {"key": "sprint_win_stage",              "label": "Win a stage",                  "reward": 10_000, "role": "sprinter", "category": "sprint", "tier_group": "sprint_stages", "evaluator": "win_stage"},
    {"key": "sprint_points_jersey",          "label": "Wear the points jersey",       "reward": 10_000, "role": "sprinter", "category": "sprint", "evaluator": "wear_points_jersey"},
]

_CLM_SET = [
    {"key": "clm_win_itt",          "label": "Win an ITT",                    "reward": 15_000, "role": "tt_specialist", "category": "tt", "evaluator": "win_itt"},
    {"key": "clm_2_riders_itt_top10","label": "2 riders in top 10 of an ITT", "reward": 10_000, "role": None,            "category": "tt", "evaluator": "two_riders_itt_top10"},
]

_SH_SET = [
    {"key": "sh_kom_classification", "label": "Win the KOM classification", "reward": 20_000, "role": "climber",       "category": "stage_hunter", "evaluator": "win_kom_classification"},
    {"key": "sh_win_2_stages",        "label": "Win 2 stages",              "reward": 20_000, "role": "stage_hunter",  "category": "stage_hunter", "tier_group": "sh_stages", "evaluator": "win_2_stages"},
    {"key": "sh_win_stage",           "label": "Win a stage",               "reward": 10_000, "role": "stage_hunter",  "category": "stage_hunter", "tier_group": "sh_stages", "evaluator": "win_stage"},
    {"key": "sh_kom_jersey",          "label": "Wear the KOM jersey",        "reward": 10_000, "role": "climber",       "category": "stage_hunter", "evaluator": "wear_kom_jersey"},
]

SPONSOR_GOAL_SETS: dict[str, list[dict]] = {
    "ineos":       _GC_SET + _CLM_SET,
    "decathlon":   _GC_SET + _SPRINT_SET,
    "soudal":      _SPRINT_SET + _SH_SET,
    "lidl-trek":   _SPRINT_SET + _SH_SET,
    "visma":       _GC_SET + _SPRINT_SET,
    "redbull-bora": _GC_SET + _SH_SET,
}


# ---------------------------------------------------------------------------
# GT ×2 multiplier
# ---------------------------------------------------------------------------

def gt_reward_multiplier(parent_slug: str) -> float:
    """Return 2.0 for Grand Tours, 1.0 for 1-week races."""
    from scoring import _is_gt_slug
    return 2.0 if _is_gt_slug(parent_slug) else 1.0


# ---------------------------------------------------------------------------
# Timestamp parsing (reused from scoring.py)
# ---------------------------------------------------------------------------

def _parse_ts(ts: str) -> datetime:
    from datetime import timezone as _tz
    s = ts.replace("+00:00", "").replace("Z", "")
    if "." in s:
        base, frac = s.split(".", 1)
        s = base + "." + (frac + "000000")[:6]
    return datetime.fromisoformat(s).replace(tzinfo=_tz.utc)


# ---------------------------------------------------------------------------
# Pagination helper — Supabase PostgREST caps responses at 1000 rows by default.
# GT pipelines fetch entire grand tours (1500+ rows across stages), so we must
# paginate. Without this, late-stage results (e.g. ITT stage 10) get truncated
# and goals silently fail to credit.
# ---------------------------------------------------------------------------

def _fetch_all(query_factory, page_size: int = 1000) -> list[dict]:
    """Run a Supabase query repeatedly with .range() until all rows fetched.

    Args:
        query_factory: callable returning a fresh, unrun query builder.
        page_size: rows per page (matches PostgREST default cap).

    Returns:
        Flat list of all rows.
    """
    all_rows: list[dict] = []
    offset = 0
    while True:
        resp = query_factory().range(offset, offset + page_size - 1).execute()
        rows = resp.data or []
        all_rows.extend(rows)
        if len(rows) < page_size:
            break
        offset += page_size
    return all_rows


def _gt_cutoff_for_date(race_date: date) -> datetime:
    return datetime(race_date.year, race_date.month, race_date.day, 11, 0, 0, tzinfo=_PARIS_TZ)


# ---------------------------------------------------------------------------
# Role resolution per stage date
# ---------------------------------------------------------------------------

def _resolve_roles_at_cutoff(
    role_assignments: list[dict],
    cutoff: datetime,
) -> dict[tuple[str, str], str]:
    """Return {(team_id, rider_id): role} for assignments valid at cutoff."""
    roles: dict[tuple[str, str], str] = {}
    sorted_rows = sorted(role_assignments, key=lambda r: r["applied_at"], reverse=True)
    for r in sorted_rows:
        applied = _parse_ts(r["applied_at"])
        if applied > cutoff:
            continue
        key = (r["team_id"], r["rider_id"])
        if key not in roles:
            roles[key] = r["role"]
    return roles


def _squad_at_cutoff(
    squad_rows: list[dict],
    cutoff: datetime,
) -> dict[tuple[str, str], bool]:
    """Return {(team_id, rider_id): True} for squad members valid at cutoff."""
    members: dict[tuple[str, str], bool] = {}
    for r in squad_rows:
        created = _parse_ts(r["created_at"])
        removed = _parse_ts(r["removed_at"]) if r.get("removed_at") else None
        if created <= cutoff and (removed is None or removed > cutoff):
            members[(r["team_id"], r["rider_id"])] = True
    return members


# ---------------------------------------------------------------------------
# Profile-gating helper (Spec A Q14)
# ---------------------------------------------------------------------------

def _stage_counts_for_role(ctx: dict, stage_slug: str) -> bool:
    """Sprinter stage-win goals only count on flat profiles (p1/p2/p3).
    Other roles are not gated. Spec A Q14."""
    if ctx.get("role") != "sprinter":
        return True
    profile = (ctx.get("stage_profiles", {}) or {}).get(stage_slug)
    return profile in FLAT_PROFILES


# ---------------------------------------------------------------------------
# Individual goal evaluators
# ---------------------------------------------------------------------------

def _riders_with_role(team_id: str, role: Optional[str], squad_members, roles_map) -> set[str]:
    """Return rider_ids in the team's squad matching the given role (None = any squad rider)."""
    riders = set()
    for (tid, rid), _ in squad_members.items():
        if tid != team_id:
            continue
        if role is None or roles_map.get((tid, rid)) == role:
            riders.add(rid)
    return riders


def eval_gc_podium(ctx: dict) -> Optional[dict]:
    """GC final rank <= 3 for a rider with the matching role."""
    gc_results = ctx["gc_results"]
    eligible = ctx["eligible_riders"]
    for rid in eligible:
        rank = gc_results.get(rid)
        if rank is not None and rank <= 3:
            return {"rider_id": rid, "stage_slug": None}
    return None


def eval_gc_top5(ctx: dict) -> Optional[dict]:
    gc_results = ctx["gc_results"]
    eligible = ctx["eligible_riders"]
    for rid in eligible:
        rank = gc_results.get(rid)
        if rank is not None and rank <= 5:
            return {"rider_id": rid, "stage_slug": None}
    return None


def eval_wear_gc_jersey(ctx: dict) -> Optional[dict]:
    """Any eligible rider held GC rank 1 on at least one stage."""
    classif = ctx["classifications"]
    eligible = ctx["eligible_riders_by_stage"]
    for stage_slug, entries in classif.items():
        stage_eligible = eligible.get(stage_slug, set())
        for e in entries:
            if e["classification_type"] == "gc" and e["rank"] == 1 and e["rider_id"] in stage_eligible:
                return {"rider_id": e["rider_id"], "stage_slug": stage_slug}
    return None


def eval_wear_points_jersey(ctx: dict) -> Optional[dict]:
    """Any eligible rider held points rank 1 on at least one stage."""
    classif = ctx["classifications"]
    eligible = ctx["eligible_riders_by_stage"]
    for stage_slug, entries in classif.items():
        stage_eligible = eligible.get(stage_slug, set())
        for e in entries:
            if e["classification_type"] == "points" and e["rank"] == 1 and e["rider_id"] in stage_eligible:
                return {"rider_id": e["rider_id"], "stage_slug": stage_slug}
    return None


def eval_wear_youth_jersey(ctx: dict) -> Optional[dict]:
    """Any eligible rider held youth rank 1 on at least one stage."""
    for stage_slug, entries in ctx["classifications"].items():
        elig = ctx["eligible_riders_by_stage"].get(stage_slug, set())
        for e in entries:
            if e["classification_type"] == "youth" and e["rank"] == 1 and e["rider_id"] in elig:
                return {"rider_id": e["rider_id"], "stage_slug": stage_slug}
    return None


def eval_wear_kom_jersey(ctx: dict) -> Optional[dict]:
    """Any eligible rider held KOM rank 1 on at least one stage."""
    for stage_slug, entries in ctx["classifications"].items():
        elig = ctx["eligible_riders_by_stage"].get(stage_slug, set())
        for e in entries:
            if e["classification_type"] == "kom" and e["rank"] == 1 and e["rider_id"] in elig:
                return {"rider_id": e["rider_id"], "stage_slug": stage_slug}
    return None


def eval_win_stage(ctx: dict) -> Optional[dict]:
    """Any eligible rider won a stage (rank 1).
    For sprinter role, only flat-profile stages count (Spec A Q14)."""
    stage_wins = ctx["stage_wins"]
    eligible = ctx["eligible_riders_by_stage"]
    for stage_slug, winner_id in stage_wins.items():
        if not _stage_counts_for_role(ctx, stage_slug):
            continue
        stage_eligible = eligible.get(stage_slug, set())
        if winner_id in stage_eligible:
            return {"rider_id": winner_id, "stage_slug": stage_slug}
    return None


def eval_win_2_stages(ctx: dict) -> Optional[dict]:
    """Any single eligible rider won >= 2 stages.
    For sprinter role, only flat-profile stages count (Spec A Q14)."""
    stage_wins = ctx["stage_wins"]
    eligible = ctx["eligible_riders_by_stage"]
    win_counts: dict[str, int] = {}
    for stage_slug, winner_id in stage_wins.items():
        if not _stage_counts_for_role(ctx, stage_slug):
            continue
        stage_eligible = eligible.get(stage_slug, set())
        if winner_id in stage_eligible:
            win_counts[winner_id] = win_counts.get(winner_id, 0) + 1
    for rid, count in win_counts.items():
        if count >= 2:
            return {"rider_id": rid, "stage_slug": None}
    return None


def eval_two_riders_win_stage(ctx: dict) -> Optional[dict]:
    """>= 2 distinct squad riders each won at least one stage."""
    stage_wins = ctx["stage_wins"]
    squad_riders = ctx["all_squad_riders"]
    winners = set()
    for _slug, winner_id in stage_wins.items():
        if winner_id in squad_riders:
            winners.add(winner_id)
    if len(winners) >= 2:
        return {"rider_id": None, "stage_slug": None}
    return None


def eval_win_itt(ctx: dict) -> Optional[dict]:
    """Any eligible rider won an ITT stage (rank 1, is_itt=True)."""
    itt_results = ctx["itt_results"]
    eligible = ctx["eligible_riders_by_stage"]
    for stage_slug, results in itt_results.items():
        stage_eligible = eligible.get(stage_slug, set())
        for r in results:
            if r["rank"] == 1 and r["rider_id"] in stage_eligible:
                return {"rider_id": r["rider_id"], "stage_slug": stage_slug}
    return None


def eval_two_riders_itt_top10(ctx: dict) -> Optional[dict]:
    """>= 2 distinct squad riders in top 10 of the same ITT stage."""
    itt_results = ctx["itt_results"]
    squad_riders = ctx["all_squad_riders"]
    for stage_slug, results in itt_results.items():
        top10_squad = set()
        for r in results:
            if r["rank"] <= 10 and r["rider_id"] in squad_riders:
                top10_squad.add(r["rider_id"])
        if len(top10_squad) >= 2:
            return {"rider_id": None, "stage_slug": stage_slug}
    return None


def eval_win_points_classification(ctx: dict) -> Optional[dict]:
    """Eligible rider is rank 1 in the FINAL points classification (gt_final_classifications)."""
    for e in ctx["final_classifications"].get("points", []):
        if e["rank"] == 1 and e["rider_id"] in ctx["eligible_riders"]:
            return {"rider_id": e["rider_id"], "stage_slug": None}
    return None


def eval_win_kom_classification(ctx: dict) -> Optional[dict]:
    """Eligible rider is rank 1 in the FINAL KOM classification (gt_final_classifications)."""
    for e in ctx["final_classifications"].get("kom", []):
        if e["rank"] == 1 and e["rider_id"] in ctx["eligible_riders"]:
            return {"rider_id": e["rider_id"], "stage_slug": None}
    return None


EVALUATORS = {
    "gc_podium": eval_gc_podium,
    "gc_top5": eval_gc_top5,
    "wear_gc_jersey": eval_wear_gc_jersey,
    "wear_points_jersey": eval_wear_points_jersey,
    "wear_youth_jersey": eval_wear_youth_jersey,
    "wear_kom_jersey": eval_wear_kom_jersey,
    "win_stage": eval_win_stage,
    "win_2_stages": eval_win_2_stages,
    "two_riders_win_stage": eval_two_riders_win_stage,
    "win_itt": eval_win_itt,
    "two_riders_itt_top10": eval_two_riders_itt_top10,
    "win_points_classification": eval_win_points_classification,
    "win_kom_classification": eval_win_kom_classification,
}


# ---------------------------------------------------------------------------
# Tier-group best-of suppression (Task 10)
# ---------------------------------------------------------------------------

def suppress_tier_group_duplicates(goals: list[dict], completed: dict) -> dict:
    """Within a (tier_group, rider_id), keep only the highest-reward completed goal.
    Goals without tier_group, or completions with rider_id None, are always kept.
    `completed` maps goal_idx -> result (result has 'rider_id')."""
    best: dict[tuple, int] = {}   # (tier_group, rider_id) -> goal_idx of current best
    keep: dict[int, dict] = {}
    for goal_idx, result in completed.items():
        goal = goals[goal_idx]
        tg = goal.get("tier_group")
        rid = result.get("rider_id")
        if not tg or rid is None:
            keep[goal_idx] = result
            continue
        key = (tg, rid)
        if key not in best or goal["reward"] > goals[best[key]]["reward"]:
            best[key] = goal_idx
    for key, goal_idx in best.items():
        keep[goal_idx] = completed[goal_idx]
    return keep


# ---------------------------------------------------------------------------
# Main pipeline function
# ---------------------------------------------------------------------------

async def evaluate_sponsor_goals(supabase, parent_slug: str) -> dict:
    """Evaluate all T4 sponsor one-time goals for every team for a stage race.

    Handles both Grand Tours (×2 reward multiplier) and 1-week stage races (×1).
    Non-stage-race slugs (monuments, one-day races) are skipped immediately.

    Squad scoping mirrors scoring.py: uses _phase_year_from_slug(parent_slug) →
    phase_id + year filter on gt_squad / gt_role_assignments.  For GT slugs this
    maps to the correct phase_id (giro→4, tour→6, vuelta→8). For 1-week races
    scoring.py uses the same helper, falling back to phase_id=4; we do the same
    so goal evaluation is always consistent with what scoring credited.

    Args:
        supabase: Supabase client
        parent_slug: e.g. "race/giro-d-italia/2026" or "race/paris-nice/2026"

    Returns dict with goals_completed count and errors (or skipped key if
    the slug is not a stage race).
    """
    from scoring import _is_squad_race, _phase_year_from_slug

    if not _is_squad_race(parent_slug):
        return {
            "status": "skipped",
            "goals_completed": 0,
            "errors": [],
            "skipped": "not a stage race",
        }

    errors: list[str] = []
    goals_completed = 0

    race_name_match = re.match(r"^race/([a-z0-9-]+)/(\d{4})", parent_slug)
    if not race_name_match:
        return {"status": "error", "goals_completed": 0, "errors": ["Invalid race slug"]}

    year = int(race_name_match.group(2))

    # Mirror scoring.py: resolve phase_id via _phase_year_from_slug.
    # GTs: giro→4, tour→6, vuelta→8. 1-week races: fallback phase_id=4.
    # This is intentional — the query must match what scoring.py used when it
    # credited XP for this race's squad (see scoring.py lines 430, 451-464).
    phase_id, _year = _phase_year_from_slug(parent_slug)

    # GT ×2 multiplier for rewards; 1-week races get ×1.0
    base_gt_mult = gt_reward_multiplier(parent_slug)

    # --- Fetch teams with T4 sponsors ---
    ts_resp = supabase.table("team_sponsors").select(
        "team_id, sponsor_id, sponsors(id, slug, tier, nationality)"
    ).execute()

    t4_teams: list[dict] = []
    for row in (ts_resp.data or []):
        sponsor = row.get("sponsors") or {}
        if sponsor.get("tier") != 4:
            continue
        slug = sponsor.get("slug", "")
        # Accept sponsors that have a SPONSOR_GOAL_SETS entry OR a legacy GT_GOALS entry
        has_goals = slug in SPONSOR_GOAL_SETS or (slug in GT_GOALS and GT_GOALS[slug])
        if not has_goals:
            continue
        t4_teams.append({
            "team_id": row["team_id"],
            "sponsor_id": sponsor["id"],
            "sponsor_slug": slug,
            "sponsor_nationality": sponsor.get("nationality"),
        })

    if not t4_teams:
        return {"status": "completed", "goals_completed": 0, "errors": []}

    # --- Fetch race_results for all stages + GC (paginated, see _fetch_all) ---
    all_results: list[dict] = _fetch_all(lambda: supabase.table("race_results").select(
        "rider_id, race_slug, rank, stage, is_itt, race_date, profile_icon"
    ).like("race_slug", f"{parent_slug}%"))

    # Build stage_wins: {stage_slug: winner_rider_id}
    stage_wins: dict[str, str] = {}
    # Build itt_results: {stage_slug: [{rider_id, rank}]}
    itt_results: dict[str, list[dict]] = {}
    # Build gc_results: {rider_id: rank}
    gc_results: dict[str, int] = {}
    # Collect all stage slugs with dates
    stage_dates: dict[str, date] = {}
    # Build stage_profiles: {stage_slug: profile_icon} (Spec A Q14 — sprinter gating)
    stage_profiles: dict[str, str] = {}

    for r in all_results:
        slug = r["race_slug"]
        stage_val = r.get("stage")
        rank = r.get("rank")
        if rank is None:
            continue

        if stage_val == "gc":
            gc_results[r["rider_id"]] = rank
            continue

        if stage_val is not None:
            if r.get("race_date"):
                stage_dates[slug] = date.fromisoformat(str(r["race_date"])[:10])
            if rank == 1:
                stage_wins[slug] = r["rider_id"]
            # Capture profile_icon for each stage slug (same value for all rows in that stage)
            if r.get("profile_icon") and slug not in stage_profiles:
                stage_profiles[slug] = r["profile_icon"]
            if r.get("is_itt"):
                itt_results.setdefault(slug, []).append({
                    "rider_id": r["rider_id"],
                    "rank": rank,
                })

    # Determine last stage (highest stage number with data)
    stage_slugs_sorted = sorted(
        [s for s in stage_dates.keys()],
        key=lambda s: int(re.search(r"stage-(\d+)", s).group(1)) if re.search(r"stage-(\d+)", s) else 0,
    )
    last_stage_slug = stage_slugs_sorted[-1] if stage_slugs_sorted else None

    # --- Fetch gt_daily_classifications (paginated) — all types including youth/kom ---
    classif_rows = _fetch_all(lambda: supabase.table("gt_daily_classifications").select(
        "race_slug, rider_id, classification_type, rank"
    ).like("race_slug", f"{parent_slug}%"))

    classifications: dict[str, list[dict]] = {}
    for c in classif_rows:
        classifications.setdefault(c["race_slug"], []).append(c)

    # --- Fetch gt_final_classifications for points/kom/youth winners ---
    # 1-week finals are stored in the same table under {parent_slug}/{ctype}.
    final_classifications: dict[str, list[dict]] = {"points": [], "kom": [], "youth": []}
    for ctype in ("points", "kom", "youth"):
        rows = _fetch_all(lambda c=ctype: supabase.table("gt_final_classifications")
                          .select("rider_id, rank").eq("race_slug", f"{parent_slug}/{c}"))
        final_classifications[ctype] = rows

    # --- Fetch squad + role assignments (paginated) ---
    # Mirror scoring.py: filter by phase_id + year (same logic as calculate_daily_scores).
    squad_rows = _fetch_all(lambda: supabase.table("gt_squad").select(
        "team_id, rider_id, role, created_at, removed_at"
    ).eq("phase_id", phase_id).eq("year", year))

    role_rows = _fetch_all(lambda: supabase.table("gt_role_assignments").select(
        "team_id, rider_id, role, applied_at"
    ).eq("phase_id", phase_id).eq("year", year))

    # --- Fetch rider nationalities ---
    rider_ids = set()
    for row in squad_rows:
        rider_ids.add(row["rider_id"])
    if rider_ids:
        nat_resp = supabase.table("riders").select("id, nationality").in_(
            "id", list(rider_ids)
        ).execute()
        rider_nat: dict[str, str] = {r["id"]: r.get("nationality", "") for r in (nat_resp.data or [])}
    else:
        rider_nat = {}

    # --- Pre-compute per-stage squad + roles ---
    all_stage_slugs = list(stage_dates.keys())

    # For each stage, compute squad members and roles at that stage's cutoff
    stage_squad: dict[str, dict[tuple[str, str], bool]] = {}
    stage_roles: dict[str, dict[tuple[str, str], str]] = {}
    for s_slug in all_stage_slugs:
        s_date = stage_dates[s_slug]
        cutoff = _gt_cutoff_for_date(s_date)
        stage_squad[s_slug] = _squad_at_cutoff(squad_rows, cutoff)
        stage_roles[s_slug] = _resolve_roles_at_cutoff(role_rows, cutoff)

    # --- Pre-fetch existing goal_key completions for this race (new idempotency) ---
    existing_resp = supabase.table("sponsor_goal_completions").select(
        "team_id, sponsor_id, goal_key, goal_index"
    ).eq("race_slug", parent_slug).execute()

    # New-style dedup: (team_id, sponsor_id, goal_key) where goal_key is not None
    existing_by_key: set[tuple[str, str, str]] = set()
    # Legacy fallback dedup: (team_id, sponsor_id, goal_index) for rows without goal_key
    existing_by_index: set[tuple[str, str, int]] = set()
    for e in (existing_resp.data or []):
        gk = e.get("goal_key")
        if gk:
            existing_by_key.add((e["team_id"], e["sponsor_id"], gk))
        else:
            gi = e.get("goal_index")
            if gi is not None:
                existing_by_index.add((e["team_id"], e["sponsor_id"], gi))

    # --- Evaluate each team ---
    for team_info in t4_teams:
        team_id = team_info["team_id"]
        sponsor_slug = team_info["sponsor_slug"]
        sponsor_id = team_info["sponsor_id"]
        sponsor_nat = team_info["sponsor_nationality"]

        # Prefer SPONSOR_GOAL_SETS (Spec C) over legacy GT_GOALS
        use_spec_c = sponsor_slug in SPONSOR_GOAL_SETS
        goals = SPONSOR_GOAL_SETS[sponsor_slug] if use_spec_c else GT_GOALS.get(sponsor_slug, [])

        # All squad riders for this team (any stage)
        all_squad_riders: set[str] = set()
        for (tid, rid), _ in _squad_at_cutoff(squad_rows, _gt_cutoff_for_date(date.today())).items():
            if tid == team_id:
                all_squad_riders.add(rid)
        # Also include any rider who was in squad at any past stage cutoff
        for s_slug in all_stage_slugs:
            for (tid, rid), _ in stage_squad[s_slug].items():
                if tid == team_id:
                    all_squad_riders.add(rid)

        completed: dict[int, dict] = {}

        for goal_idx, goal in enumerate(goals):
            eval_key = goal.get("evaluator") or goal.get("eval")
            eval_fn = EVALUATORS.get(eval_key) if eval_key else None
            if not eval_fn:
                continue

            role = goal.get("role")

            # Build eligible riders per stage (role-gated)
            eligible_by_stage: dict[str, set[str]] = {}
            for s_slug in all_stage_slugs:
                eligible_by_stage[s_slug] = _riders_with_role(
                    team_id, role,
                    stage_squad.get(s_slug, {}),
                    stage_roles.get(s_slug, {}),
                )

            # For GC/final-classification goals, use the latest stage's roles
            latest_squad = stage_squad.get(last_stage_slug, {}) if last_stage_slug else {}
            latest_roles = stage_roles.get(last_stage_slug, {}) if last_stage_slug else {}
            eligible_gc = _riders_with_role(team_id, role, latest_squad, latest_roles)

            ctx = {
                "team_id": team_id,
                "gc_results": gc_results,
                "classifications": classifications,
                "final_classifications": final_classifications,
                "stage_wins": stage_wins,
                "itt_results": itt_results,
                "eligible_riders": eligible_gc,
                "eligible_riders_by_stage": eligible_by_stage,
                "all_squad_riders": all_squad_riders,
                "last_stage_slug": last_stage_slug,
                "role": role,
                "stage_profiles": stage_profiles,
            }

            result = eval_fn(ctx)
            if result is not None:
                completed[goal_idx] = result

        # Resolve tiered goals — keep highest-reward per (tier_group, rider_id)
        completed = suppress_tier_group_duplicates(goals, completed)

        # Insert new completions + credit treasury
        for goal_idx, result in completed.items():
            goal = goals[goal_idx]
            goal_key = goal.get("key")  # None for legacy GT_GOALS entries

            # Idempotency check — prefer key-based, fall back to index-based
            if goal_key and (team_id, sponsor_id, goal_key) in existing_by_key:
                continue
            if not goal_key and (team_id, sponsor_id, goal_idx) in existing_by_index:
                continue

            # Compute reward: base × GT-mult × nationality-mult
            base_1week = goal["reward"]
            reward_after_gt = int(base_1week * base_gt_mult)

            # Nationality multiplier
            multiplier = 1.0
            triggering_rider_id = result.get("rider_id")
            if triggering_rider_id and sponsor_nat:
                allowed = expand_sponsor_nationality(sponsor_nat)
                nat = rider_nat.get(triggering_rider_id, "")
                if nat and nat in allowed:
                    multiplier = 1.20  # Spec C: nationality bonus reduced 1.25 → 1.20

            final_reward = int(reward_after_gt * multiplier)

            try:
                insert_payload: dict = {
                    "team_id": team_id,
                    "sponsor_id": sponsor_id,
                    "goal_index": goal_idx,
                    "goal_label": goal["label"],
                    "race_slug": parent_slug,
                    "stage_slug": result.get("stage_slug"),
                    "rider_id": triggering_rider_id,
                    "base_reward": reward_after_gt,
                    "multiplier": float(multiplier),
                    "final_reward": final_reward,
                }
                if goal_key:
                    insert_payload["goal_key"] = goal_key

                supabase.table("sponsor_goal_completions").insert(insert_payload).execute()
            except Exception as exc:
                errors.append(f"insert goal completion team={team_id} goal={goal_idx}: {exc}")
                continue

            # Credit treasury (same path as before — direct UPDATE + treasury_log)
            try:
                team_resp = supabase.table("teams").select("id, treasury").eq("id", team_id).execute()
                team_data = team_resp.data
                current = (
                    team_data.get("treasury", 0) if isinstance(team_data, dict)
                    else (team_data[0].get("treasury", 0) if team_data else 0)
                )
                supabase.table("teams").update(
                    {"treasury": current + final_reward}
                ).eq("id", team_id).execute()

                supabase.table("treasury_log").insert({
                    "team_id": team_id,
                    "type": "gt_goal_bonus",
                    "amount": final_reward,
                    "description": (
                        f"Goal: {goal['label']} "
                        f"in {parent_slug} (×{multiplier})"
                    ),
                    "rider_id": triggering_rider_id,
                }).execute()

                goals_completed += 1
                logger.info(
                    f"[GoalEval] Awarded {goal['label']} → {final_reward}€ "
                    f"for team={team_id}"
                )
            except Exception as exc:
                errors.append(f"treasury credit team={team_id} goal={goal_idx}: {exc}")

    return {
        "status": "completed",
        "goals_completed": goals_completed,
        "errors": errors,
    }


async def evaluate_gt_goals(supabase, gt_parent_slug: str) -> dict:
    """Backward-compatible alias for evaluate_sponsor_goals.

    Kept so existing callers (run_pipeline evaluate-goals CLI, tests) continue
    to work without modification. New code should call evaluate_sponsor_goals.
    """
    return await evaluate_sponsor_goals(supabase, gt_parent_slug)
