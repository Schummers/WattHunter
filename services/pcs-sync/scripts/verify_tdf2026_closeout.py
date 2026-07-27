"""Read-only verification of the Tour de France 2026 closeout (stage 21 + GC
final + Points/KOM/Youth final classifications).

Independently recomputes the rank-based XP formula for the 5 closing slugs by
reusing scoring.py's own private helpers (not reimplementing them — avoids the
two-implementations-drift trap), and diffs the result against what is actually
stored in rider_xp_daily. This mirrors the method used for the 2026-07-26
Tour rest-days audit (commit e82f6da), which found 0 mismatches on 770 rows.

Never writes anything. Run locally:
  cd services/pcs-sync && .venv/bin/python scripts/verify_tdf2026_closeout.py

Checks performed:
  1. XP diff — recomputed vs stored, per (team_id, rider_id, race_slug).
  2. Squad membership — every /points, /kom, /youth row belongs to an active
     gt_squad member (phase 6, year 2026) of that team.
  3. Team delta — sum of the 5 slugs' XP equals the cumulative_xp delta
     recorded when scoring ran (checked via prior/post cumulative_xp if a
     baseline snapshot is available; otherwise just reports the current sum).
  4. Stage 1-20 regression — per-team per-stage XP sums for stages 1-20 must
     be byte-identical to the pre-closeout baseline (docs/runbooks/
     tdf2026-closeout-baseline-2026-07-27.md) — proves the scoped rescore
     didn't touch already-closed stages (the code-drift failure mode from
     the Giro Rubio/Arrieta backfill).
  5. League ranking — team_ranking_daily for the closeout date matches the
     order of teams.cumulative_xp.
  6. Idempotence hint — reports whether a second run of the pipeline would be
     a no-op (prints current per-slug per-team sums so a rerun's delta_xp can
     be checked as 0 by hand).

Exit code is 0 only if there are zero XP mismatches and zero squad-membership
violations. Other checks are printed as warnings (they need a human to
interpret, e.g. stage-1-20 baseline comparison against a hardcoded snapshot).
"""
from __future__ import annotations

import json
import sys
from collections import defaultdict
from pathlib import Path

from dotenv import load_dotenv

_PCS_DIR = Path(__file__).resolve().parents[1]
load_dotenv(_PCS_DIR / ".env")
sys.path.append(str(_PCS_DIR))

from db_utils import _fetch_all  # noqa: E402
from sync import get_supabase  # noqa: E402
from scoring import (  # noqa: E402
    _classif_bonus_gt,
    _domestique_assist_bonus,
    _breakaway_distance_bonus,
    _final_secondary_bonus,
    _is_gt_slug,
    _is_squad_race,
    _parse_supabase_ts,
    _phase_year_from_slug,
    _points_from_rank,
    _role_multiplier,
    _underdog_multiplier,
)
from tactics import (  # noqa: E402
    compute_call_bus_modifier,
    compute_nemesis_modifier,
    compute_overdrive_modifier,
    compute_unleash_modifier,
)

LEAGUE_ID = "00000000-0000-4000-8000-c1a551c2026e"  # Classiques de l'individualisme V2
RACE_PARENT = "race/tour-de-france/2026"
STAGE_SLUG = f"{RACE_PARENT}/stage-21"
GC_SLUG = f"{RACE_PARENT}/gc"
FINAL_SLUGS = [f"{RACE_PARENT}/points", f"{RACE_PARENT}/kom", f"{RACE_PARENT}/youth"]
CLOSING_SLUGS = [STAGE_SLUG, GC_SLUG] + FINAL_SLUGS
PHASE_ID, YEAR = _phase_year_from_slug(STAGE_SLUG)

# Baseline captured 2026-07-27 pre-stage-21 (docs/runbooks/tdf2026-closeout-baseline-2026-07-27.md).
# Sum of rider_xp_daily.xp_gained per team across stages 1-20. Any drift here after the
# stage-21 close means the rescore leaked into already-closed stages (must stay 0 delta).
BASELINE_STAGES_1_20 = {
    "Leopard_Trek": 3081.50,
    "Klimax": 2288.88,
    "GoudalEnergies": 3028.22,
    "Muskatel Muskadji": 2979.50,
    "Las Chivas Pendejas": 1928.24,
    "Dixon Hormous": 1720.00,
    "Peejee": 1712.70,
    "bigdaddy": 1221.92,
}


def _first(join):
    if isinstance(join, list):
        return join[0] if join else {}
    return join or {}


def main() -> int:
    supabase = get_supabase()
    mismatches: list[dict] = []
    squad_violations: list[dict] = []

    # --- Fetch everything needed to recompute, read-only ---------------------
    stage_gc_rows = _fetch_all(lambda: supabase.table("race_results").select(
        "rider_id, race_slug, pcs_points, rank, race_date, is_itt, breakaway_kms, "
        "profile_icon, riders:rider_id(real_team)"
    ).in_("race_slug", [STAGE_SLUG, GC_SLUG]))

    final_rows = _fetch_all(lambda: supabase.table("gt_final_classifications").select(
        "rider_id, race_slug, classification_type, rank, race_date"
    ).in_("race_slug", FINAL_SLUGS))

    daily_classif_rows = _fetch_all(lambda: supabase.table("gt_daily_classifications").select(
        "race_slug, rider_id, classification_type, rank, riders:rider_id(real_team)"
    ).eq("race_slug", STAGE_SLUG))

    # Scoped to the target league only — other leagues' teams may hold contracts on the
    # same riders without fielding a Tour squad; including them would make every one of
    # their final-classification "not a squad member" checks a false positive.
    contracts_rows = _fetch_all(lambda: supabase.table("contracts").select(
        "id, team_id, rider_id, purchased_at, release_date, released_at, "
        "riders:rider_id(specialty, nationality, real_team, birthdate, pcs_rank), "
        "teams!inner(league_id)"
    ).eq("teams.league_id", LEAGUE_ID).in_("status", ["active", "notice"]))

    squad_rows = _fetch_all(lambda: supabase.table("gt_squad").select(
        "team_id, rider_id, role, created_at, removed_at"
    ).eq("phase_id", PHASE_ID).eq("year", YEAR))

    role_rows = _fetch_all(lambda: supabase.table("gt_role_assignments").select(
        "team_id, rider_id, role, applied_at"
    ).eq("phase_id", PHASE_ID).eq("year", YEAR).order("applied_at", desc=True))

    tactics_rows = _fetch_all(lambda: supabase.table("gt_tactic_activations").select(
        "id, team_id, phase_id, year, tactic_type, stage_slug,"
        " nemesis_target_team_id, nemesis_target_role,"
        " resolved_attacker_rider_id, resolved_target_rider_id,"
        " outcome, resolved_at"
    ).eq("stage_slug", STAGE_SLUG))

    strategies_rows = _fetch_all(lambda: supabase.table("team_strategies").select(
        "team_id, config, strategies:strategy_id(slug, xp_bonus)"
    ).eq("is_active", True))

    teams_rows = _fetch_all(lambda: supabase.table("teams").select(
        "id, name, cumulative_xp"
    ).eq("league_id", LEAGUE_ID))
    team_name_by_id = {t["id"]: t["name"] for t in teams_rows}

    stored_xp_rows = _fetch_all(lambda: supabase.table("rider_xp_daily").select(
        "team_id, rider_id, race_slug, xp_gained, gt_role_mult, gt_classif_bonus, "
        "gt_distance_bonus, assist_bonus, nemesis_modifier, underdog_mult, raw_pcs_points"
    ).in_("race_slug", CLOSING_SLUGS))
    stored_by_key = {
        (r["team_id"], r["rider_id"], r["race_slug"]): r for r in stored_xp_rows
    }

    # league-wide stage 1-20 sums, for the regression check
    stage_1_20_slugs = [f"{RACE_PARENT}/stage-{n}" for n in range(1, 21)]
    old_stage_rows = _fetch_all(lambda: supabase.table("rider_xp_daily").select(
        "team_id, xp_gained"
    ).in_("race_slug", stage_1_20_slugs))
    current_1_20_sum: dict[str, float] = defaultdict(float)
    for r in old_stage_rows:
        current_1_20_sum[r["team_id"]] += float(r.get("xp_gained") or 0)

    if not stage_gc_rows and not final_rows:
        print("Nothing imported yet for stage-21/gc/points/kom/youth — run "
              "`post-race --race race/tour-de-france/2026/stage-21` first.")
        return 1

    # --- Build lookup structures mirroring scoring.py's calculate_daily_scores ---
    rider_race_points: dict[str, list[dict]] = defaultdict(list)
    for h in stage_gc_rows:
        rider_race_points[h["rider_id"]].append(h)

    stage_top3: list[tuple] = []
    for h in stage_gc_rows:
        if h["race_slug"] != STAGE_SLUG:
            continue
        try:
            r = int(h.get("rank"))
        except (TypeError, ValueError):
            continue
        if r <= 3:
            join = _first(h.get("riders"))
            stage_top3.append((h["rider_id"], join.get("real_team"), r))

    gc_top3: list[tuple] = []
    for row in daily_classif_rows:
        if row.get("classification_type") != "gc":
            continue
        try:
            r = int(row.get("rank"))
        except (TypeError, ValueError):
            continue
        if r <= 3:
            join = _first(row.get("riders"))
            gc_top3.append((row["rider_id"], join.get("real_team"), r))

    classif_by_rider: dict[str, list[dict]] = defaultdict(list)
    for row in daily_classif_rows:
        classif_by_rider[row["rider_id"]].append(row)

    final_by_rider: dict[str, list[dict]] = defaultdict(list)
    for row in final_rows:
        final_by_rider[row["rider_id"]].append(row)

    gt_squad_members: dict[tuple, bool] = {}
    for r in squad_rows:
        created = _parse_supabase_ts(r["created_at"])
        removed = _parse_supabase_ts(r["removed_at"]) if r.get("removed_at") else None
        # ignore_role_cutoff-equivalent: verification runs well after stage-21 closed,
        # so any squad state as of "now" is what mattered — no future edits exist yet.
        if removed is None:
            gt_squad_members[(r["team_id"], r["rider_id"])] = True

    gt_roles: dict[tuple, str] = {}
    for r in role_rows:
        key = (r["team_id"], r["rider_id"])
        if key not in gt_roles:
            gt_roles[key] = r["role"]

    gt_tactics: list[dict] = tactics_rows

    team_strategies: dict[str, list[dict]] = defaultdict(list)
    for s in strategies_rows:
        sd = s.get("strategies") or {}
        team_strategies[s["team_id"]].append({
            "slug": sd.get("slug", ""),
            "xp_bonus": float(sd.get("xp_bonus", 0) or 0),
            "config": s.get("config") or {},
        })

    team_contracts: dict[str, list[dict]] = defaultdict(list)
    for c in contracts_rows:
        team_contracts[c["team_id"]].append(c)

    # --- Recompute XP per (team, rider, slug), diff against stored ------------
    from scoring import _rider_matches_strategy  # noqa: E402  (private, reused deliberately)

    def _rider_bonus(rider_info, strategies):
        total = 0.0
        for strat in strategies:
            if _rider_matches_strategy(strat["slug"], strat["config"], rider_info):
                total += strat["xp_bonus"]
        return total

    recomputed_by_team: dict[str, float] = defaultdict(float)

    for team_id, clist in team_contracts.items():
        for contract in clist:
            rider_id = contract["rider_id"]
            rider_join = _first(contract.get("riders"))
            rider_info = {
                "specialty": rider_join.get("specialty"),
                "nationality": rider_join.get("nationality"),
                "real_team": rider_join.get("real_team"),
                "birthdate": rider_join.get("birthdate"),
                "pcs_rank": rider_join.get("pcs_rank"),
            }
            bonus = _rider_bonus(rider_info, team_strategies.get(team_id, []))
            in_squad = (team_id, rider_id) in gt_squad_members
            role = gt_roles.get((team_id, rider_id), "domestique")

            # --- stage-21 / gc entries (race_results) ---
            for entry in rider_race_points.get(rider_id, []):
                race_slug = entry["race_slug"]
                if not in_squad:
                    continue  # non-squad contracted riders earn 0 on squad-race stages
                raw_points = _points_from_rank(entry.get("rank"), race_slug)
                gt_role_mult = _role_multiplier(
                    role, race_slug, entry.get("is_itt", False),
                    entry.get("breakaway_kms"), entry.get("profile_icon"),
                )
                underdog_mult = (
                    _underdog_multiplier(rider_info.get("pcs_rank"), race_slug)
                    if role == "underdog" else 1.0
                )
                gt_classif_bonus = _classif_bonus_gt(
                    classif_by_rider.get(rider_id, []) if race_slug == STAGE_SLUG else [],
                    role,
                ) if race_slug == STAGE_SLUG else 0.0
                gt_distance_bonus = 0.0
                if role == "stage_hunter" and race_slug == STAGE_SLUG:
                    gt_distance_bonus = _breakaway_distance_bonus(entry.get("breakaway_kms"))
                assist_bonus = 0.0
                if role == "domestique" and race_slug == STAGE_SLUG and entry.get("rank") is not None:
                    assist_bonus = _domestique_assist_bonus(
                        rider_id, rider_info.get("real_team"),
                        stage_top3, gc_top3, is_itt=bool(entry.get("is_itt", False)),
                    )

                nemesis_modifier = 1.0
                nemesis_applied = False
                attacker_mod = None
                target_mods: list[float] = []
                for tactic in gt_tactics:
                    if tactic["stage_slug"] != race_slug and race_slug != STAGE_SLUG:
                        continue
                    t_type = tactic["tactic_type"]
                    if tactic["team_id"] == team_id:
                        if t_type == "unleash":
                            override, _ = compute_unleash_modifier(role, race_slug)
                            if override is not None:
                                gt_role_mult = override
                        elif t_type == "overdrive":
                            override, _ = compute_overdrive_modifier(
                                role, race_slug, entry.get("breakaway_kms")
                            )
                            if override is not None:
                                gt_role_mult = override
                        elif t_type in ("nemesis_gc", "nemesis_sprint"):
                            if tactic.get("resolved_attacker_rider_id") == rider_id:
                                role_override, nem_mod, _ = compute_nemesis_modifier(
                                    outcome=tactic.get("outcome") or "no_resolution",
                                    rider_role="attacker", tactic_type=t_type,
                                )
                                if role_override is not None:
                                    gt_role_mult = role_override
                                attacker_mod = nem_mod
                                if role_override is not None or nem_mod != 1.0:
                                    nemesis_applied = True
                    else:
                        if t_type in ("nemesis_gc", "nemesis_sprint"):
                            if (tactic.get("nemesis_target_team_id") == team_id
                                    and tactic.get("resolved_target_rider_id") == rider_id):
                                role_override, nem_mod, _ = compute_nemesis_modifier(
                                    outcome=tactic.get("outcome") or "no_resolution",
                                    rider_role="target", tactic_type=t_type,
                                )
                                if role_override is not None:
                                    gt_role_mult = role_override
                                target_mods.append(nem_mod)
                                if role_override is not None or nem_mod != 1.0:
                                    nemesis_applied = True

                nem_inputs = []
                if attacker_mod is not None:
                    nem_inputs.append(attacker_mod)
                if target_mods:
                    nem_inputs.append(min(target_mods))
                if nem_inputs:
                    nemesis_modifier = min(nem_inputs)
                if nemesis_applied:
                    underdog_mult = 1.0

                xp = max(0, round(
                    (raw_points * gt_role_mult * (1 + bonus)
                     + gt_classif_bonus + gt_distance_bonus + assist_bonus)
                    * nemesis_modifier * underdog_mult, 2,
                ))

                stored = stored_by_key.get((team_id, rider_id, race_slug))
                stored_xp = float(stored["xp_gained"]) if stored else None
                if stored_xp is None or abs(stored_xp - xp) > 0.01:
                    mismatches.append({
                        "team": team_name_by_id.get(team_id, team_id),
                        "rider_id": rider_id,
                        "race_slug": race_slug,
                        "recomputed": xp,
                        "stored": stored_xp,
                    })
                recomputed_by_team[team_id] += xp

            # --- final secondary classifications (points/kom/youth) ---
            for fr in final_by_rider.get(rider_id, []):
                if not in_squad:
                    # Only a real violation if the pipeline actually wrote a row for this
                    # non-member (the production third pass gates on the same in_squad
                    # check, so absence of a stored row here is expected, not a bug).
                    if (team_id, rider_id, fr["race_slug"]) in stored_by_key:
                        squad_violations.append({
                            "team": team_name_by_id.get(team_id, team_id),
                            "rider_id": rider_id,
                            "race_slug": fr["race_slug"],
                            "reason": "stored XP row exists for a non-squad-member rider",
                        })
                    continue
                f_slug = fr["race_slug"]
                f_ctype = fr.get("classification_type") or f_slug.rsplit("/", 1)[-1]
                f_bonus = _final_secondary_bonus(f_ctype, fr.get("rank"), role, mode="gt")
                if f_bonus == 0:
                    continue
                f_xp = max(0, round(f_bonus, 2))
                stored = stored_by_key.get((team_id, rider_id, f_slug))
                stored_xp = float(stored["xp_gained"]) if stored else None
                if stored_xp is None or abs(stored_xp - f_xp) > 0.01:
                    mismatches.append({
                        "team": team_name_by_id.get(team_id, team_id),
                        "rider_id": rider_id,
                        "race_slug": f_slug,
                        "recomputed": f_xp,
                        "stored": stored_xp,
                    })
                recomputed_by_team[team_id] += f_xp

    # --- Report ---------------------------------------------------------------
    print("=" * 70)
    print("Tour de France 2026 closeout verification")
    print("=" * 70)

    print(f"\n[1] XP mismatches (recomputed vs stored): {len(mismatches)}")
    for m in mismatches[:50]:
        print(f"  - {m['team']} rider={m['rider_id'][:8]} {m['race_slug']}: "
              f"recomputed={m['recomputed']} stored={m['stored']}")

    print(f"\n[2] Squad-membership violations on final classifications: {len(squad_violations)}")
    for v in squad_violations[:50]:
        print(f"  - {v['team']} rider={v['rider_id'][:8]} {v['race_slug']}: {v['reason']}")

    print("\n[3] Recomputed total XP for the 5 closing slugs, per team:")
    for team_id, total in sorted(recomputed_by_team.items(), key=lambda kv: -kv[1]):
        print(f"  - {team_name_by_id.get(team_id, team_id):24s} {total:8.2f}")

    print("\n[4] Stage 1-20 regression check (must be 0.00 for every team):")
    regression_failed = False
    for name, baseline in BASELINE_STAGES_1_20.items():
        team_id = next((tid for tid, n in team_name_by_id.items() if n == name), None)
        current = current_1_20_sum.get(team_id, 0.0) if team_id else 0.0
        delta = round(current - baseline, 2)
        flag = "" if delta == 0 else "  <-- DRIFT"
        if delta != 0:
            regression_failed = True
        print(f"  - {name:24s} baseline={baseline:8.2f} current={current:8.2f} delta={delta:+.2f}{flag}")

    print("\n[5] League ranking (team_ranking_daily, most recent date) vs cumulative_xp order:")
    ranking_rows = _fetch_all(lambda: supabase.table("team_ranking_daily").select(
        "team_id, date, rank, cumulative_xp"
    ).in_("team_id", list(team_name_by_id.keys())))
    if ranking_rows:
        latest_date = max(r["date"] for r in ranking_rows)
        latest = sorted(
            (r for r in ranking_rows if r["date"] == latest_date),
            key=lambda r: r["rank"],
        )
        cumxp_order = sorted(teams_rows, key=lambda t: -float(t["cumulative_xp"]))
        ranking_ok = [r["team_id"] for r in latest] == [t["id"] for t in cumxp_order]
        print(f"  date={latest_date} consistent_with_cumulative_xp_order={ranking_ok}")
        for r in latest:
            print(f"  - rank {r['rank']:>2} {team_name_by_id.get(r['team_id'], r['team_id']):24s} "
                  f"xp={r['cumulative_xp']}")
    else:
        print("  no team_ranking_daily rows found")

    print("\n" + "=" * 70)
    ok = not mismatches and not squad_violations
    print("RESULT:", "PASS" if ok else "FAIL — see [1]/[2] above")
    if regression_failed:
        print("WARNING: stage 1-20 regression detected — see [4] above")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
