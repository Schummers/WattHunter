"""Read-only Giro reconciliation: verify treasury == sum of credited bonuses,
and flag old-vs-new points/kom double-counts at the cutover (Spec C grandfather)."""
from __future__ import annotations

OLD_POINTS_LABELS = {"Wear ciclamino", "Wear maglia ciclamino"}
NEW_POINTS_LABEL = "Win the points classification"


def find_points_double_counts(completions: list[dict]) -> list[tuple]:
    """Flag (team_id, rider_id, race_slug) that have BOTH an old points-jersey
    completion and the new 'Win the points classification' for the same GT."""
    by_key: dict[tuple, set[str]] = {}
    for c in completions:
        key = (c["team_id"], c["rider_id"], c["race_slug"])
        by_key.setdefault(key, set()).add(c["goal_label"])
    flags = []
    for key, labels in by_key.items():
        if labels & OLD_POINTS_LABELS and NEW_POINTS_LABEL in labels:
            flags.append(key)
    return sorted(flags)


async def reconcile_team_treasury(supabase, league_id: str) -> list[dict]:
    """For each team in a league, compare the sum of bonus-type treasury_log credits
    to the sum of sponsor_bonuses.final_bonus + sponsor_goal_completions.final_reward.
    Returns [{team_id, expected, logged, delta}]. READ-ONLY (no writes)."""
    teams = supabase.table("teams").select("id").eq("league_id", league_id).execute().data or []
    report = []
    for t in teams:
        tid = t["id"]
        sb = supabase.table("sponsor_bonuses").select("final_bonus").eq("team_id", tid).execute().data or []
        sg = supabase.table("sponsor_goal_completions").select("final_reward").eq("team_id", tid).execute().data or []
        expected = sum(r.get("final_bonus") or 0 for r in sb) + sum(r.get("final_reward") or 0 for r in sg)
        logs = supabase.table("treasury_log").select("amount, type").eq("team_id", tid).execute().data or []
        logged = sum(
            r.get("amount") or 0 for r in logs
            if r.get("type") in ("sponsor_bonus", "gt_goal_bonus")
        )
        report.append({"team_id": tid, "expected": expected, "logged": logged,
                       "delta": logged - expected})
    return report
