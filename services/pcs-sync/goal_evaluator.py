"""
GT Goal Evaluator — WattHunter PCS Sync Microservice.

Evaluates T4 sponsor one-time goals after each GT stage.
Called from Pipeline B (post-race) after scoring + base sponsor bonuses.

Goals are defined in apps/web/lib/gt-goals.ts (canonical source).
This file mirrors the definitions and evaluates them against race data.
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

# ---------------------------------------------------------------------------
# Goal definitions — mirrors apps/web/lib/gt-goals.ts exactly
# ---------------------------------------------------------------------------

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
    """Maglia bianca — data not available in gt_daily_classifications. Skip."""
    logger.info("[GoalEval] Skipping 'Wear maglia bianca' — youth classification not tracked")
    return None


def eval_win_stage(ctx: dict) -> Optional[dict]:
    """Any eligible rider won a stage (rank 1)."""
    stage_wins = ctx["stage_wins"]
    eligible = ctx["eligible_riders_by_stage"]
    for stage_slug, winner_id in stage_wins.items():
        stage_eligible = eligible.get(stage_slug, set())
        if winner_id in stage_eligible:
            return {"rider_id": winner_id, "stage_slug": stage_slug}
    return None


def eval_win_2_stages(ctx: dict) -> Optional[dict]:
    """Any single eligible rider won >= 2 stages."""
    stage_wins = ctx["stage_wins"]
    eligible = ctx["eligible_riders_by_stage"]
    win_counts: dict[str, int] = {}
    for stage_slug, winner_id in stage_wins.items():
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
    """Eligible rider holds points rank 1 on the FINAL stage of the GT."""
    last_stage = ctx.get("last_stage_slug")
    if not last_stage:
        return None
    classif = ctx["classifications"].get(last_stage, [])
    eligible = ctx["eligible_riders_by_stage"].get(last_stage, set())
    for e in classif:
        if e["classification_type"] == "points" and e["rank"] == 1 and e["rider_id"] in eligible:
            return {"rider_id": e["rider_id"], "stage_slug": last_stage}
    return None


EVALUATORS = {
    "gc_podium": eval_gc_podium,
    "gc_top5": eval_gc_top5,
    "wear_gc_jersey": eval_wear_gc_jersey,
    "wear_points_jersey": eval_wear_points_jersey,
    "wear_youth_jersey": eval_wear_youth_jersey,
    "win_stage": eval_win_stage,
    "win_2_stages": eval_win_2_stages,
    "two_riders_win_stage": eval_two_riders_win_stage,
    "win_itt": eval_win_itt,
    "two_riders_itt_top10": eval_two_riders_itt_top10,
    "win_points_classification": eval_win_points_classification,
}


# ---------------------------------------------------------------------------
# Tiered goal resolution
# ---------------------------------------------------------------------------

def _resolve_tiered(goals: list[dict], completed: dict[int, dict]) -> dict[int, dict]:
    """Remove lower-reward tiered goals when both in a pair are completed."""
    suppressed: set[int] = set()
    visited: set[tuple[int, int]] = set()
    for idx, goal in enumerate(goals):
        partner = goal.get("tiered_with")
        if partner is None or idx not in completed or partner not in completed:
            continue
        pair = (min(idx, partner), max(idx, partner))
        if pair in visited:
            continue
        visited.add(pair)
        if goals[idx]["reward"] >= goals[partner]["reward"]:
            suppressed.add(partner)
        else:
            suppressed.add(idx)
    return {k: v for k, v in completed.items() if k not in suppressed}


# ---------------------------------------------------------------------------
# Main pipeline function
# ---------------------------------------------------------------------------

async def evaluate_gt_goals(supabase, gt_parent_slug: str) -> dict:
    """Evaluate all T4 sponsor GT goals for every team.

    Args:
        supabase: Supabase client
        gt_parent_slug: e.g. "race/giro-d-italia/2026"

    Returns dict with goals_completed count and errors.
    """
    errors: list[str] = []
    goals_completed = 0

    gt_name_match = re.match(r"^race/([a-z0-9-]+)/(\d{4})", gt_parent_slug)
    if not gt_name_match:
        return {"status": "error", "goals_completed": 0, "errors": ["Invalid GT slug"]}

    gt_name = gt_name_match.group(1)
    year = int(gt_name_match.group(2))

    gt_phase_map = {
        "giro-d-italia": 4,
        "tour-de-france": 5,
        "vuelta-a-espana": 7,
    }
    phase_id = gt_phase_map.get(gt_name, 4)

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
        if slug not in GT_GOALS or not GT_GOALS[slug]:
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
        "rider_id, race_slug, rank, stage, is_itt, race_date"
    ).like("race_slug", f"{gt_parent_slug}%"))

    # Build stage_wins: {stage_slug: winner_rider_id}
    stage_wins: dict[str, str] = {}
    # Build itt_results: {stage_slug: [{rider_id, rank}]}
    itt_results: dict[str, list[dict]] = {}
    # Build gc_results: {rider_id: rank}
    gc_results: dict[str, int] = {}
    # Collect all stage slugs with dates
    stage_dates: dict[str, date] = {}

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

    # --- Fetch gt_daily_classifications (paginated) ---
    classif_rows = _fetch_all(lambda: supabase.table("gt_daily_classifications").select(
        "race_slug, rider_id, classification_type, rank"
    ).like("race_slug", f"{gt_parent_slug}%"))

    classifications: dict[str, list[dict]] = {}
    for c in classif_rows:
        classifications.setdefault(c["race_slug"], []).append(c)

    # --- Fetch GT squad + role assignments (paginated) ---
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

    # --- Fetch existing completions to avoid double-crediting ---
    existing_resp = supabase.table("sponsor_goal_completions").select(
        "team_id, sponsor_id, goal_index"
    ).eq("race_slug", gt_parent_slug).execute()
    existing_completions: set[tuple[str, str, int]] = set()
    for e in (existing_resp.data or []):
        existing_completions.add((e["team_id"], e["sponsor_id"], e["goal_index"]))

    # --- Evaluate each team ---
    for team_info in t4_teams:
        team_id = team_info["team_id"]
        sponsor_slug = team_info["sponsor_slug"]
        sponsor_id = team_info["sponsor_id"]
        sponsor_nat = team_info["sponsor_nationality"]
        goals = GT_GOALS[sponsor_slug]

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
            eval_fn = EVALUATORS.get(goal["eval"])
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

            # For GC goals, use the latest stage's roles
            latest_squad = stage_squad.get(last_stage_slug, {}) if last_stage_slug else {}
            latest_roles = stage_roles.get(last_stage_slug, {}) if last_stage_slug else {}
            eligible_gc = _riders_with_role(team_id, role, latest_squad, latest_roles)

            ctx = {
                "team_id": team_id,
                "gc_results": gc_results,
                "classifications": classifications,
                "stage_wins": stage_wins,
                "itt_results": itt_results,
                "eligible_riders": eligible_gc,
                "eligible_riders_by_stage": eligible_by_stage,
                "all_squad_riders": all_squad_riders,
                "last_stage_slug": last_stage_slug,
            }

            result = eval_fn(ctx)
            if result is not None:
                completed[goal_idx] = result

        # Resolve tiered goals
        completed = _resolve_tiered(goals, completed)

        # Insert new completions + credit treasury
        for goal_idx, result in completed.items():
            if (team_id, sponsor_id, goal_idx) in existing_completions:
                continue

            goal = goals[goal_idx]
            base_reward = goal["reward"]

            # Nationality multiplier
            multiplier = 1.0
            triggering_rider_id = result.get("rider_id")
            if triggering_rider_id and sponsor_nat:
                allowed = expand_sponsor_nationality(sponsor_nat)
                nat = rider_nat.get(triggering_rider_id, "")
                if nat and nat in allowed:
                    multiplier = 1.25

            final_reward = int(base_reward * multiplier)

            try:
                supabase.table("sponsor_goal_completions").insert({
                    "team_id": team_id,
                    "sponsor_id": sponsor_id,
                    "goal_index": goal_idx,
                    "goal_label": goal["label"],
                    "race_slug": gt_parent_slug,
                    "stage_slug": result.get("stage_slug"),
                    "rider_id": triggering_rider_id,
                    "base_reward": base_reward,
                    "multiplier": float(multiplier),
                    "final_reward": final_reward,
                }).execute()
            except Exception as exc:
                errors.append(f"insert goal completion team={team_id} goal={goal_idx}: {exc}")
                continue

            # Credit treasury
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
                        f"GT Goal: {goal['label']} "
                        f"in {gt_parent_slug} (×{multiplier})"
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
