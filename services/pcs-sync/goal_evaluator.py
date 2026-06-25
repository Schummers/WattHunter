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

from db_utils import _fetch_all
from sponsor_bonus import expand_sponsor_nationality, is_classic_league

logger = logging.getLogger(__name__)

_PARIS_TZ = ZoneInfo("Europe/Paris")

GT_RACE_PREFIXES = ("giro-d-italia", "tour-de-france", "vuelta-a-espana")

# Spec A Q14: sprinter stage-win goals only count on flat profiles.
FLAT_PROFILES = {"p1", "p2", "p3"}


# ---------------------------------------------------------------------------
# Goal definitions — mirrors apps/web/lib/gt-goals.ts exactly
# ---------------------------------------------------------------------------

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
            return {
                "rider_id": winner_id,
                "stage_slug": stage_slug,
                "neutralized_stage_slugs": [stage_slug],
            }
    return None


def eval_win_2_stages(ctx: dict) -> Optional[dict]:
    """Any single eligible rider won >= 2 stages.
    For sprinter role, only flat-profile stages count (Spec A Q14)."""
    stage_wins = ctx["stage_wins"]
    eligible = ctx["eligible_riders_by_stage"]
    win_slugs: dict[str, list[str]] = {}
    for stage_slug, winner_id in stage_wins.items():
        if not _stage_counts_for_role(ctx, stage_slug):
            continue
        stage_eligible = eligible.get(stage_slug, set())
        if winner_id in stage_eligible:
            win_slugs.setdefault(winner_id, []).append(stage_slug)
    for rid, slugs in win_slugs.items():
        if len(slugs) >= 2:
            # No-cumul: the goal replaces the base bonus on every counted stage.
            return {"rider_id": rid, "stage_slug": None, "neutralized_stage_slugs": slugs}
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
# No-cumul rule — map a completed goal to the base-bonus race_slugs it consumes
# ---------------------------------------------------------------------------

def neutralized_slugs(goal: dict, result: dict, parent_slug: str) -> list[str]:
    """Base-bonus race_slugs that this completed one-time goal consumes (no-cumul).

    process_race_bonuses reads these from sponsor_goal_completions and skips
    emitting the matching base bonus, so a rider never receives both the goal
    and the base bonus on the same race (see GAME_RULES.md §18).

      - GC placement goals (gc_podium / gc_top5) → the final GC result `{parent}/gc`.
      - Stage-win goals → each counted stage, carried by the evaluator in
        result["neutralized_stage_slugs"] (sprinter profile gating already applied).
      - Classification / wear-jersey goals → nothing (no single-race base bonus).
    """
    if goal.get("category") == "gc" and goal.get("key") in ("gc_podium", "gc_top5"):
        return [f"{parent_slug}/gc"]
    return list(result.get("neutralized_stage_slugs", []))


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
    # Include league mode to skip classic-mode leagues (no sponsors/goals).
    ts_rows = _fetch_all(lambda: supabase.table("team_sponsors").select(
        "team_id, sponsor_id, sponsors(id, slug, tier, nationality), "
        "teams!inner(league_id, leagues!inner(mode))"
    ))

    t4_teams: list[dict] = []
    for row in ts_rows:
        team_data = row.get("teams") or {}
        league_data = team_data.get("leagues") or {}
        if is_classic_league(league_data):
            logger.info(
                f"[GoalEval] Skipping team={row['team_id'][:8]} "
                f"— classic-mode league (no sponsor goals)"
            )
            continue
        sponsor = row.get("sponsors") or {}
        if sponsor.get("tier") != 4:
            continue
        slug = sponsor.get("slug", "")
        if slug not in SPONSOR_GOAL_SETS:
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
        "team_id, sponsor_id, goal_key"
    ).eq("race_slug", parent_slug).execute()

    # Idempotency: (team_id, sponsor_id, goal_key). goal_key is NOT NULL post-migration.
    existing_by_key: set[tuple[str, str, str]] = set()
    for e in (existing_resp.data or []):
        gk = e.get("goal_key")
        if gk:
            existing_by_key.add((e["team_id"], e["sponsor_id"], gk))

    # --- Evaluate each team ---
    for team_info in t4_teams:
        team_id = team_info["team_id"]
        sponsor_slug = team_info["sponsor_slug"]
        sponsor_id = team_info["sponsor_id"]
        sponsor_nat = team_info["sponsor_nationality"]

        goals = SPONSOR_GOAL_SETS.get(sponsor_slug, [])

        # All squad riders for this team = union of per-stage squads, each taken
        # at that stage's 11:00 CET cutoff. Do NOT seed from date.today(): when
        # this evaluator runs retroactively (e.g. `evaluate-goals` days later),
        # today's cutoff would admit riders added to the squad AFTER the race —
        # the temporal-squad bug family. The per-stage union below is the only
        # temporally-correct membership source.
        all_squad_riders: set[str] = set()
        for s_slug in all_stage_slugs:
            for (tid, rid), _ in stage_squad[s_slug].items():
                if tid == team_id:
                    all_squad_riders.add(rid)

        completed: dict[int, dict] = {}

        for goal_idx, goal in enumerate(goals):
            eval_key = goal["evaluator"]
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
            goal_key = goal["key"]

            # Idempotency check — already credited for this (team, sponsor, goal_key).
            if (team_id, sponsor_id, goal_key) in existing_by_key:
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
                    "goal_key": goal_key,
                    "neutralized_stage_slugs": neutralized_slugs(goal, result, parent_slug),
                }

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
