"""Read-only DRY-RUN of the Vuelta 2026 rescore (issue 05, scoring-vuelta-refonte).

Recomputes the NEW-formula XP (underdog fix, issue 01 + event terms, issue 03)
for the already-scored Vuelta 2026 stages (1 ITT, 2, 4 — stage 3 cancelled),
for EVERY team holding contracts (code-drift gotcha: diff ALL teams, memory
`giro_xp_backfill_rescore_drift`), and diffs against what rider_xp_daily stores.

Never writes anything. Also dumps a pre-rescore snapshot (stored rider_xp_daily
rows for the Vuelta slugs + teams.cumulative_xp) to a JSON file next to the
`.scratch` issue folder, so the real rescore has its mandatory baseline.

Run locally:
  cd services/pcs-sync && .venv/bin/python scripts/dryrun_vuelta2026_rescore.py

Role/squad state is taken AS OF each stage's 11:00 Europe/Paris cutoff (the
same rule the rescore itself must apply via calculate_daily_scores(role_cutoff=…)).
"""
from __future__ import annotations

import json
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from dotenv import load_dotenv

_PCS_DIR = Path(__file__).resolve().parents[1]
load_dotenv(_PCS_DIR / ".env")
sys.path.append(str(_PCS_DIR))

from db_utils import _fetch_all  # noqa: E402
from sync import get_supabase  # noqa: E402
from scoring import (  # noqa: E402
    _breakaway_distance_bonus,
    _classif_bonus_gt,
    _domestique_assist_bonus,
    _event_bonus,
    _parse_supabase_ts,
    _phase_year_from_slug,
    _points_from_rank,
    _role_multiplier,
    _underdog_multiplier,
    _rider_matches_strategy,
)
from tactics import (  # noqa: E402
    compute_nemesis_modifier,
    compute_overdrive_modifier,
    compute_unleash_modifier,
)

RACE_PARENT = "race/vuelta-a-espana/2026"
STAGE_SLUGS = [f"{RACE_PARENT}/stage-{n}" for n in (1, 2, 4)]
STAGE_DATES = {  # 11:00 Europe/Paris cutoff per stage (Vuelta 2026: start 22/08, stage 3 cancelled)
    f"{RACE_PARENT}/stage-1": "2026-08-22",
    f"{RACE_PARENT}/stage-2": "2026-08-23",
    f"{RACE_PARENT}/stage-4": "2026-08-25",
}
PHASE_ID, YEAR = _phase_year_from_slug(STAGE_SLUGS[0])
SNAPSHOT_PATH = (
    _PCS_DIR.parent.parent / ".scratch" / "scoring-vuelta-refonte"
    / "snapshot-pre-rescore.json"
)
_PARIS = ZoneInfo("Europe/Paris")


def _first(join):
    if isinstance(join, list):
        return join[0] if join else {}
    return join or {}


def main() -> int:
    supabase = get_supabase()

    # --- Read everything -----------------------------------------------------
    result_rows = _fetch_all(lambda: supabase.table("race_results").select(
        "rider_id, race_slug, pcs_points, rank, race_date, is_itt, breakaway_kms, "
        "profile_icon, riders:rider_id(real_team)"
    ).in_("race_slug", STAGE_SLUGS))

    # NOTE: race_date in DB is authoritative — warn if it drifts from STAGE_DATES.
    for h in result_rows:
        expected = STAGE_DATES.get(h["race_slug"])
        if expected and h.get("race_date") and str(h["race_date"]) != expected:
            print(f"WARN: {h['race_slug']} race_date {h['race_date']} != assumed {expected}")
            STAGE_DATES[h["race_slug"]] = str(h["race_date"])
            break

    classif_rows = _fetch_all(lambda: supabase.table("gt_daily_classifications").select(
        "race_slug, rider_id, classification_type, rank, riders:rider_id(real_team)"
    ).in_("race_slug", STAGE_SLUGS))

    event_rows = _fetch_all(lambda: supabase.table("stage_event_results").select(
        "race_slug, rider_id, event_type, category, rank"
    ).in_("race_slug", STAGE_SLUGS))

    contracts_rows = _fetch_all(lambda: supabase.table("contracts").select(
        "id, team_id, rider_id, purchased_at, release_date, released_at, "
        "riders:rider_id(specialty, nationality, real_team, birthdate, pcs_rank)"
    ).in_("status", ["active", "notice"]))

    squad_rows = _fetch_all(lambda: supabase.table("gt_squad").select(
        "team_id, rider_id, role, created_at, removed_at"
    ).eq("phase_id", PHASE_ID).eq("year", YEAR))

    role_rows = _fetch_all(lambda: supabase.table("gt_role_assignments").select(
        "team_id, rider_id, role, applied_at"
    ).eq("phase_id", PHASE_ID).eq("year", YEAR).order("applied_at", desc=True))

    tactics_rows = _fetch_all(lambda: supabase.table("gt_tactic_activations").select(
        "id, team_id, tactic_type, stage_slug, nemesis_target_team_id,"
        " resolved_attacker_rider_id, resolved_target_rider_id, outcome"
    ).in_("stage_slug", STAGE_SLUGS))

    strategies_rows = _fetch_all(lambda: supabase.table("team_strategies").select(
        "team_id, config, strategies:strategy_id(slug, xp_bonus)"
    ).eq("is_active", True))

    teams_rows = _fetch_all(lambda: supabase.table("teams").select(
        "id, name, cumulative_xp, league_id"
    ))
    team_name = {t["id"]: t["name"] for t in teams_rows}

    stored_rows = _fetch_all(lambda: supabase.table("rider_xp_daily").select(
        "team_id, rider_id, race_slug, xp_gained, raw_pcs_points, gt_role_mult, "
        "gt_classif_bonus, gt_distance_bonus, assist_bonus, nemesis_modifier, "
        "underdog_mult, strategy_bonus"
    ).in_("race_slug", STAGE_SLUGS))
    stored_by_key = {(r["team_id"], r["rider_id"], r["race_slug"]): r for r in stored_rows}

    # --- Snapshot (mandatory pre-rescore baseline) ---------------------------
    SNAPSHOT_PATH.parent.mkdir(parents=True, exist_ok=True)
    SNAPSHOT_PATH.write_text(json.dumps({
        "taken_at": datetime.now(_PARIS).isoformat(),
        "race_slugs": STAGE_SLUGS,
        "rider_xp_daily": stored_rows,
        "teams_cumulative_xp": [
            {"id": t["id"], "name": t["name"], "cumulative_xp": t["cumulative_xp"]}
            for t in teams_rows
        ],
    }, indent=2, ensure_ascii=False))
    print(f"Snapshot written: {SNAPSHOT_PATH} ({len(stored_rows)} xp rows)")

    # --- Index ---------------------------------------------------------------
    results_by_rider = defaultdict(list)
    for h in result_rows:
        results_by_rider[h["rider_id"]].append(h)

    classif_by_key = defaultdict(list)
    gc_top3_by_slug = defaultdict(list)
    for row in classif_rows:
        classif_by_key[(row["race_slug"], row["rider_id"])].append(row)
        if row.get("classification_type") == "gc":
            try:
                r = int(row.get("rank"))
            except (TypeError, ValueError):
                continue
            if r <= 3:
                j = _first(row.get("riders"))
                gc_top3_by_slug[row["race_slug"]].append((row["rider_id"], j.get("real_team"), r))

    events_by_key = defaultdict(list)
    for row in event_rows:
        events_by_key[(row["race_slug"], row["rider_id"])].append(row)

    stage_top3_by_slug = defaultdict(list)
    for h in result_rows:
        try:
            r = int(h.get("rank"))
        except (TypeError, ValueError):
            continue
        if r <= 3:
            j = _first(h.get("riders"))
            stage_top3_by_slug[h["race_slug"]].append((h["rider_id"], j.get("real_team"), r))

    tactics_by_slug = defaultdict(list)
    for t in tactics_rows:
        tactics_by_slug[t["stage_slug"]].append(t)

    team_strategies = defaultdict(list)
    for s in strategies_rows:
        sd = s.get("strategies") or {}
        team_strategies[s["team_id"]].append({
            "slug": sd.get("slug", ""),
            "xp_bonus": float(sd.get("xp_bonus", 0) or 0),
            "config": s.get("config") or {},
        })

    team_contracts = defaultdict(list)
    for c in contracts_rows:
        team_contracts[c["team_id"]].append(c)

    # Per-stage cutoff → squad membership + latest role as of that instant.
    def _squad_and_roles(cutoff_dt):
        members = {}
        roles = {}
        for r in squad_rows:
            created = _parse_supabase_ts(r["created_at"])
            removed = _parse_supabase_ts(r["removed_at"]) if r.get("removed_at") else None
            if created <= cutoff_dt and (removed is None or removed > cutoff_dt):
                members[(r["team_id"], r["rider_id"])] = True
        for r in role_rows:  # already ordered applied_at desc
            applied = _parse_supabase_ts(r["applied_at"])
            if applied > cutoff_dt:
                continue
            key = (r["team_id"], r["rider_id"])
            if key not in roles:
                roles[key] = r["role"]
        return members, roles

    cutoffs = {}
    for slug, dstr in STAGE_DATES.items():
        y, m, d = (int(x) for x in dstr.split("-"))
        cutoffs[slug] = datetime(y, m, d, 11, 0, 0, tzinfo=_PARIS)

    # --- Recompute -----------------------------------------------------------
    new_by_key = {}
    for team_id, clist in team_contracts.items():
        for contract in clist:
            rider_id = contract["rider_id"]
            entries = results_by_rider.get(rider_id)
            if not entries:
                continue
            rj = _first(contract.get("riders"))
            rider_info = {
                "specialty": rj.get("specialty"), "nationality": rj.get("nationality"),
                "real_team": rj.get("real_team"), "birthdate": rj.get("birthdate"),
                "pcs_rank": rj.get("pcs_rank"),
            }
            bonus = 0.0
            for strat in team_strategies.get(team_id, []):
                if _rider_matches_strategy(strat["slug"], strat["config"], rider_info):
                    bonus += strat["xp_bonus"]

            for entry in entries:
                slug = entry["race_slug"]
                # contract window guard (same as scoring.py)
                rd = entry.get("race_date")
                if rd:
                    from datetime import date as _date
                    race_dt = _date.fromisoformat(str(rd))
                    pa = contract.get("purchased_at")
                    if pa and race_dt < _date.fromisoformat(str(pa)[:10]):
                        continue
                    rel = contract.get("released_at") or contract.get("release_date")
                    if rel and race_dt > _date.fromisoformat(str(rel)[:10]):
                        continue

                members, roles = _squad_and_roles(cutoffs[slug])
                if (team_id, rider_id) not in members:
                    continue
                role = roles.get((team_id, rider_id), "domestique")
                raw_points = _points_from_rank(entry.get("rank"), slug)
                gt_role_mult = _role_multiplier(
                    role, slug, entry.get("is_itt", False),
                    entry.get("breakaway_kms"), entry.get("profile_icon"),
                )
                underdog_mult = (
                    _underdog_multiplier(rider_info.get("pcs_rank"), slug)
                    if role == "underdog" else 1.0
                )
                gt_classif_bonus = _classif_bonus_gt(
                    classif_by_key.get((slug, rider_id), []), role)
                gt_distance_bonus = (
                    _breakaway_distance_bonus(entry.get("breakaway_kms"))
                    if role == "stage_hunter" else 0.0
                )
                kom_event_bonus, sprint_event_bonus = _event_bonus(
                    events_by_key.get((slug, rider_id), []), role)
                assist_bonus = 0.0
                if role == "domestique" and entry.get("rank") is not None:
                    assist_bonus = _domestique_assist_bonus(
                        rider_id, rider_info.get("real_team"),
                        stage_top3_by_slug.get(slug, []),
                        gc_top3_by_slug.get(slug, []),
                        is_itt=bool(entry.get("is_itt", False)),
                    )

                nemesis_modifier = 1.0
                nemesis_applied = False
                attacker_mod = None
                target_mods = []
                for tactic in tactics_by_slug.get(slug, []):
                    t_type = tactic["tactic_type"]
                    if tactic["team_id"] == team_id:
                        if t_type == "unleash":
                            override, _ = compute_unleash_modifier(role, slug)
                            if override is not None:
                                gt_role_mult = override
                        elif t_type == "overdrive":
                            override, _ = compute_overdrive_modifier(
                                role, slug, entry.get("breakaway_kms"))
                            if override is not None:
                                gt_role_mult = override
                        elif t_type in ("nemesis_gc", "nemesis_sprint"):
                            if tactic.get("resolved_attacker_rider_id") == rider_id:
                                ro, nm, _ = compute_nemesis_modifier(
                                    outcome=tactic.get("outcome") or "no_resolution",
                                    rider_role="attacker", tactic_type=t_type)
                                if ro is not None:
                                    gt_role_mult = ro
                                attacker_mod = nm
                                if ro is not None or nm != 1.0:
                                    nemesis_applied = True
                    elif t_type in ("nemesis_gc", "nemesis_sprint"):
                        if (tactic.get("nemesis_target_team_id") == team_id
                                and tactic.get("resolved_target_rider_id") == rider_id):
                            ro, nm, _ = compute_nemesis_modifier(
                                outcome=tactic.get("outcome") or "no_resolution",
                                rider_role="target", tactic_type=t_type)
                            if ro is not None:
                                gt_role_mult = ro
                            target_mods.append(nm)
                            if ro is not None or nm != 1.0:
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
                    (raw_points * gt_role_mult * underdog_mult * (1 + bonus)
                     + gt_classif_bonus + gt_distance_bonus + assist_bonus
                     + kom_event_bonus + sprint_event_bonus)
                    * nemesis_modifier, 2,
                ))
                new_by_key[(team_id, rider_id, slug)] = {
                    "xp": xp, "raw": raw_points, "role": role,
                    "underdog_mult": underdog_mult,
                    "classif": gt_classif_bonus, "kom": kom_event_bonus,
                    "sprint": sprint_event_bonus, "assist": assist_bonus,
                }

    # Classif-only riders (no result row) — second-pass equivalent.
    for (slug, rider_id), rows in classif_by_key.items():
        for team_id, clist in team_contracts.items():
            if not any(c["rider_id"] == rider_id for c in clist):
                continue
            if (team_id, rider_id, slug) in new_by_key:
                continue
            members, roles = _squad_and_roles(cutoffs[slug])
            if (team_id, rider_id) not in members:
                continue
            role = roles.get((team_id, rider_id), "domestique")
            cb = _classif_bonus_gt(rows, role)
            if cb == 0:
                continue
            new_by_key[(team_id, rider_id, slug)] = {
                "xp": max(0, round(cb, 2)), "raw": 0, "role": role,
                "underdog_mult": 1.0, "classif": cb, "kom": 0.0,
                "sprint": 0.0, "assist": 0.0,
            }

    # --- Diff ----------------------------------------------------------------
    all_keys = set(stored_by_key) | set(new_by_key)
    per_team_delta = defaultdict(float)
    changes = []
    for key in sorted(all_keys):
        stored = stored_by_key.get(key)
        new = new_by_key.get(key)
        old_xp = float(stored["xp_gained"]) if stored else 0.0
        new_xp = new["xp"] if new else 0.0
        delta = round(new_xp - old_xp, 2)
        if abs(delta) > 0.005:
            changes.append((key, old_xp, new_xp, delta, new))
        per_team_delta[key[0]] += delta

    print("\n" + "=" * 78)
    print("Vuelta 2026 rescore DRY-RUN — new formula (issues 01 + 03) vs stored")
    print("=" * 78)
    print(f"\nRows stored: {len(stored_by_key)} · recomputed: {len(new_by_key)} "
          f"· changed: {len(changes)}")

    print("\nPer-rider changes:")
    for (team_id, rider_id, slug), old_xp, new_xp, delta, new in changes:
        detail = ""
        if new:
            detail = (f" role={new['role']} raw={new['raw']} ud={new['underdog_mult']}"
                      f" classif={new['classif']} kom={new['kom']} sprint={new['sprint']}")
        print(f"  {team_name.get(team_id, team_id):22s} {slug.split('/')[-1]:8s} "
              f"rider={rider_id[:8]} {old_xp:8.2f} -> {new_xp:8.2f} ({delta:+.2f}){detail}")

    print("\nPer-team cumulative_xp delta (rescore would apply exactly this):")
    for team_id, delta in sorted(per_team_delta.items(), key=lambda kv: kv[1]):
        if abs(delta) < 0.005 and team_id not in {k[0] for k in all_keys}:
            continue
        print(f"  {team_name.get(team_id, team_id):24s} {delta:+10.2f}")

    zero_teams = [tid for tid, d in per_team_delta.items() if abs(d) < 0.005]
    print(f"\nTeams with ZERO delta: {len(zero_teams)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
