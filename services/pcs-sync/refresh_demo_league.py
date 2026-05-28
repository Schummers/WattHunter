"""Refresh the demo league in Supabase by wipe-and-replacing it with an
anonymized snapshot of a real source league.

Idempotent and safe to re-run. Best-effort transaction semantics: we wipe
in FK-children-first order, then insert. On any error, the demo league
will be empty until the next successful run (acceptable for v1).

Usage:
  python3 refresh_demo_league.py --source-league-id <uuid>
  python3 refresh_demo_league.py --source-league-id <uuid> --dry-run
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from supabase import Client, create_client

from demo_constants import (
    DEMO_LEAGUE_ID,
    DEMO_TEAM_IDS,
    DEMO_TEAM_NAMES,
    DEMO_USER_IDS,
    DEMO_VISITOR_TEAM_INDEX,
    as_dict,
)


load_dotenv()


WIPE_ORDER_TEAM_SCOPED = [
    "treasury_log",
    "sponsor_bonuses",
    "sponsor_goal_completions",
    "round_validations",
    "auction_bids",
    "team_xp_adjustments",
    "team_strategies",
    "team_sponsors",
    "team_ranking_daily",
    "rider_xp_daily",
    "gt_tactic_activations",
    "gt_role_assignments",
    "gt_squad",
    "remontada_boosts",
]

WIPE_ORDER_LEAGUE_SCOPED = [
    "draft_bids",
    "gt_emergency_bids",
    "contracts",
    "auctions",
    "remontada_boost_triggers",
    "league_members",
    "teams",
]


def assert_constants_in_sync() -> None:
    """Best-effort parity check between TS and Python constants.

    The authoritative gate is pytest + vitest (each runs in CI). This is
    a runtime sanity check; if pnpm isn't on PATH, log and continue.
    """
    repo_root = Path(__file__).resolve().parents[2]
    try:
        out = subprocess.check_output(
            ["pnpm", "--filter", "web", "tsx", "scripts/dump-demo-constants.ts"],
            cwd=repo_root,
            text=True,
            stderr=subprocess.DEVNULL,
        )
    except (FileNotFoundError, subprocess.CalledProcessError) as exc:
        print(f"WARNING: skipping TS<>Python constants check ({exc!s})")
        return
    try:
        ts = json.loads(out)
    except json.JSONDecodeError as exc:
        print(f"WARNING: could not parse dump-demo-constants.ts output: {exc}")
        return
    py = as_dict()
    if ts != py:
        raise SystemExit(
            f"Demo constants drift between TS and Python:\n  TS={ts}\n  PY={py}"
        )


def make_client() -> Client:
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    return create_client(url, key)


def assert_target_is_demo(client: Client) -> None:
    res = (
        client.table("leagues")
        .select("id, is_demo")
        .eq("id", DEMO_LEAGUE_ID)
        .single()
        .execute()
    )
    if not res.data or not res.data.get("is_demo"):
        raise SystemExit(
            f"Refusing to refresh: league {DEMO_LEAGUE_ID} is not marked is_demo=true. "
            "Apply the seed migration first."
        )


def fetch_source_team_ranking(client: Client, source_league_id: str) -> list[str]:
    """Returns source team IDs ordered by cumulative_xp DESC (cap 8)."""
    res = (
        client.table("teams")
        .select("id, cumulative_xp")
        .eq("league_id", source_league_id)
        .order("cumulative_xp", desc=True)
        .limit(8)
        .execute()
    )
    rows = res.data or []
    if len(rows) < 2:
        raise SystemExit(
            f"Source league {source_league_id} has only {len(rows)} team(s); need at least 2."
        )
    if len(rows) < 8:
        print(f"WARNING: source league has {len(rows)} teams (< 8). Empty slots will be skipped.")
    return [row["id"] for row in rows]


def build_team_id_mapping(source_team_ids: list[str]) -> dict[str, str]:
    """source team i (rank i+1) → DEMO_TEAM_IDS[i]."""
    return {src: DEMO_TEAM_IDS[i] for i, src in enumerate(source_team_ids)}


def build_user_id_mapping(
    client: Client,
    source_league_id: str,
    team_id_mapping: dict[str, str],
) -> dict[str, str]:
    """source user_id (from league_members) → DEMO_USER_IDS[i]."""
    res = (
        client.table("league_members")
        .select("user_id, team_id")
        .eq("league_id", source_league_id)
        .execute()
    )
    mapping: dict[str, str] = {}
    for row in res.data or []:
        src_team = row["team_id"]
        if src_team in team_id_mapping:
            idx = DEMO_TEAM_IDS.index(team_id_mapping[src_team])
            mapping[row["user_id"]] = DEMO_USER_IDS[idx]
    return mapping


def wipe_demo(client: Client) -> None:
    """Delete all child rows for DEMO_TEAM_IDS / DEMO_LEAGUE_ID, in FK order."""
    for table in WIPE_ORDER_TEAM_SCOPED:
        client.table(table).delete().in_("team_id", list(DEMO_TEAM_IDS)).execute()
    for table in WIPE_ORDER_LEAGUE_SCOPED:
        client.table(table).delete().eq("league_id", DEMO_LEAGUE_ID).execute()


def insert_demo_data(
    client: Client,
    source_league_id: str,
    team_id_mapping: dict[str, str],
    user_id_mapping: dict[str, str],
) -> None:
    """Fetch source rows, rewrite team_id/user_id/league_id, insert in dependency order."""

    # 1. Teams.
    src_teams = (
        client.table("teams")
        .select("*")
        .in_("id", list(team_id_mapping.keys()))
        .execute()
        .data
        or []
    )
    new_teams: list[dict[str, Any]] = []
    for t in src_teams:
        idx = DEMO_TEAM_IDS.index(team_id_mapping[t["id"]])
        new_teams.append(
            {
                **t,
                "id": team_id_mapping[t["id"]],
                "user_id": DEMO_USER_IDS[idx],
                "league_id": DEMO_LEAGUE_ID,
                "name": DEMO_TEAM_NAMES[idx],
                "short_name": DEMO_TEAM_NAMES[idx][:3].upper(),
            }
        )
    if new_teams:
        client.table("teams").insert(new_teams).execute()

    # 2. league_members.
    src_members = (
        client.table("league_members")
        .select("*")
        .eq("league_id", source_league_id)
        .execute()
        .data
        or []
    )
    new_members: list[dict[str, Any]] = []
    for m in src_members:
        if m["team_id"] in team_id_mapping and m["user_id"] in user_id_mapping:
            new_members.append(
                {
                    **m,
                    "league_id": DEMO_LEAGUE_ID,
                    "team_id": team_id_mapping[m["team_id"]],
                    "user_id": user_id_mapping[m["user_id"]],
                }
            )
    if new_members:
        client.table("league_members").insert(new_members).execute()

    # 3. auctions (keep original UUIDs — non-PII).
    src_auctions = (
        client.table("auctions")
        .select("*")
        .eq("league_id", source_league_id)
        .execute()
        .data
        or []
    )
    for a in src_auctions:
        client.table("auctions").insert({**a, "league_id": DEMO_LEAGUE_ID}).execute()

    # 4. league-scoped helpers.
    _replicate_league_scoped(client, "contracts", source_league_id, team_id_mapping)
    _replicate_league_scoped(client, "draft_bids", source_league_id, team_id_mapping)
    _replicate_league_scoped(client, "gt_emergency_bids", source_league_id, team_id_mapping)

    # 5. team-scoped helpers.
    for table in (
        "auction_bids",
        "treasury_log",
        "team_strategies",
        "team_sponsors",
        "team_ranking_daily",
        "team_xp_adjustments",
        "rider_xp_daily",
        "sponsor_bonuses",
        "sponsor_goal_completions",
        "round_validations",
        "gt_squad",
        "gt_role_assignments",
        "gt_tactic_activations",
    ):
        _replicate_team_scoped(client, table, team_id_mapping)

    # 6. Update public.users display_name for the 8 ghost rows.
    for i, uid in enumerate(DEMO_USER_IDS):
        client.table("users").update({"display_name": DEMO_TEAM_NAMES[i]}).eq("id", uid).execute()

    # 7. Update league row (force-set name/code/status/commissioner).
    client.table("leagues").update(
        {
            "name": "WattHunter Demo League",
            "invite_code": "DEMO00",
            "status": "active",
            "commissioner_id": DEMO_USER_IDS[0],
            "is_demo": True,
        }
    ).eq("id", DEMO_LEAGUE_ID).execute()


def _replicate_league_scoped(
    client: Client,
    table: str,
    source_league_id: str,
    team_id_mapping: dict[str, str],
) -> None:
    rows = (
        client.table(table)
        .select("*")
        .eq("league_id", source_league_id)
        .execute()
        .data
        or []
    )
    new_rows = []
    for r in rows:
        team_id = r.get("team_id")
        if team_id and team_id not in team_id_mapping:
            continue
        rewritten = {**r, "league_id": DEMO_LEAGUE_ID}
        if team_id:
            rewritten["team_id"] = team_id_mapping[team_id]
        new_rows.append(rewritten)
    if new_rows:
        client.table(table).insert(new_rows).execute()


def _replicate_team_scoped(
    client: Client,
    table: str,
    team_id_mapping: dict[str, str],
) -> None:
    rows = (
        client.table(table)
        .select("*")
        .in_("team_id", list(team_id_mapping.keys()))
        .execute()
        .data
        or []
    )
    new_rows = [{**r, "team_id": team_id_mapping[r["team_id"]]} for r in rows]
    if new_rows:
        client.table(table).insert(new_rows).execute()


def invalidate_cache() -> None:
    host = os.environ.get("WATTHUNTER_HOST")
    secret = os.environ.get("REVALIDATE_SECRET")
    if not host or not secret:
        print("WARNING: WATTHUNTER_HOST or REVALIDATE_SECRET missing — skipping cache invalidation.")
        return
    import urllib.request

    req = urllib.request.Request(
        f"{host}/api/admin/revalidate-demo",
        method="POST",
        headers={"Authorization": f"Bearer {secret}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            print(f"Cache invalidation → {resp.status}")
    except Exception as exc:
        print(f"WARNING: cache invalidation failed: {exc}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-league-id", required=True)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    assert_constants_in_sync()
    client = make_client()
    assert_target_is_demo(client)

    src_team_ids = fetch_source_team_ranking(client, args.source_league_id)
    team_id_mapping = build_team_id_mapping(src_team_ids)
    user_id_mapping = build_user_id_mapping(client, args.source_league_id, team_id_mapping)

    visitor_team_id = team_id_mapping[src_team_ids[DEMO_VISITOR_TEAM_INDEX]]
    print(f"Visitor team: {visitor_team_id} (source rank-{DEMO_VISITOR_TEAM_INDEX + 1})")
    print(f"Team mapping: {json.dumps(team_id_mapping, indent=2)}")

    if args.dry_run:
        print("--dry-run: no writes.")
        return

    wipe_demo(client)
    insert_demo_data(client, args.source_league_id, team_id_mapping, user_id_mapping)
    invalidate_cache()
    print("Demo refresh complete.")


if __name__ == "__main__":
    main()
