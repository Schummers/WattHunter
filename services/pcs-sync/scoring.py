"""
Daily scoring job — WattHunter PCS Sync Microservice.

For each contracted rider with pcs_points > 0 (from race_results):
  1. Apply per-rider policy matching → XP gained
  2. Upsert into rider_xp_daily (keyed by team_id, rider_id, race_slug)
  3. Update teams.cumulative_xp and teams.level
  4. Snapshot team_ranking_daily for movement tracking

Treasury is handled separately by confirmPhaseSetup server action and sponsor_bonus.py.
"""
from __future__ import annotations
import logging
from datetime import date, datetime
from supabase import Client

logger = logging.getLogger(__name__)

# Level thresholds — must match apps/web/lib/levels.ts (8 levels)
LEVEL_THRESHOLDS = [0, 25, 150, 350, 600, 900, 1500, 2000]


def compute_level(xp: float) -> int:
    """Compute team level from cumulative XP."""
    for i in range(len(LEVEL_THRESHOLDS) - 1, -1, -1):
        if xp >= LEVEL_THRESHOLDS[i]:
            return i + 1
    return 1


def _rider_matches_policy(
    policy_slug: str,
    config: dict,
    rider: dict,
) -> bool:
    """Check if a rider matches a policy's config criteria."""
    if policy_slug == "specialist":
        return (rider.get("specialty") or "").lower() == (config.get("specialty") or "").lower()
    elif policy_slug == "national_pride":
        return (rider.get("nationality") or "").lower() == (config.get("nationality") or "").lower()
    elif policy_slug == "team_chemistry":
        return (rider.get("real_team") or "").lower() == (config.get("team") or "").lower()
    elif policy_slug == "young_blood":
        max_age = config.get("max_age", 25)
        birthdate = rider.get("birthdate")
        if not birthdate:
            return False
        try:
            birth = datetime.fromisoformat(str(birthdate)).date()
            today = date.today()
            age = today.year - birth.year - ((today.month, today.day) < (birth.month, birth.day))
            return age <= max_age
        except (ValueError, TypeError):
            return False
    elif policy_slug == "road_warriors":
        birthdate = rider.get("birthdate")
        if not birthdate:
            return False
        try:
            birth = datetime.fromisoformat(str(birthdate)).date()
            today = date.today()
            age = today.year - birth.year - ((today.month, today.day) < (birth.month, birth.day))
            return age > 32
        except (ValueError, TypeError):
            return False
    return False


def _compute_rider_bonus(
    rider_info: dict,
    team_policies: list[dict],
) -> float:
    """Sum xp_bonus for all policies that match this rider."""
    total = 0.0
    for policy in team_policies:
        slug = policy.get("slug", "")
        xp_bonus = float(policy.get("xp_bonus", 0) or 0)
        config = policy.get("config") or {}
        if _rider_matches_policy(slug, config, rider_info):
            total += xp_bonus
    return total


async def calculate_daily_scores(
    supabase: Client,
    race_slugs: list[str] | None = None,
) -> dict:
    """
    For each contracted rider with pcs_points > 0 in race_results:
      - Filter by race_slugs if provided, otherwise by today's date (backward compat)
      - Apply per-rider policy matching → XP
      - Upsert rider_xp_daily (keyed by team_id, rider_id, race_slug)
      - Update team cumulative_xp and level
      - Snapshot team_ranking_daily

    Returns a summary dict with teams_processed count and any errors.
    """
    today = date.today().isoformat()
    processed = 0
    errors = []

    # --- Step 1: Get race results ---
    # Task 1: filter by race_slugs if provided, else fallback to today's date
    if race_slugs:
        history = supabase.table("race_results").select(
            "rider_id, race_slug, pcs_points, race_date"
        ).in_("race_slug", race_slugs).gt("pcs_points", 0).execute()
    else:
        history = supabase.table("race_results").select(
            "rider_id, race_slug, pcs_points, race_date"
        ).eq("race_date", today).gt("pcs_points", 0).execute()

    if not history.data:
        return {
            "status": "completed",
            "processed": 0,
            "message": "No race results found",
        }

    # Build rider_id → list of (race_slug, pcs_points) for per-race upserts
    rider_race_points: dict[str, list[dict]] = {}
    for h in history.data:
        rider_race_points.setdefault(h["rider_id"], []).append({
            "race_slug": h["race_slug"],
            "pcs_points": h["pcs_points"],
            "race_date": h.get("race_date"),
        })

    # Pre-fetch existing rider_xp_daily for these race_slugs to compute deltas (idempotency).
    # On first run prev=0 → delta=total (same as before).
    # On re-run prev=total → delta=0 → teams unchanged (no double-count).
    prev_team_xp: dict[str, float] = {}
    if race_slugs:
        prev_resp = supabase.table("rider_xp_daily").select(
            "team_id, xp_gained"
        ).in_("race_slug", race_slugs).execute()
        for row in (prev_resp.data or []):
            tid = row["team_id"]
            prev_team_xp[tid] = prev_team_xp.get(tid, 0.0) + float(row.get("xp_gained") or 0)

    # --- Step 2: Get all active/notice contracts with rider info for policy matching ---
    contracts = supabase.table("contracts").select(
        "id, team_id, rider_id, purchased_at, release_date, released_at, "
        "riders:rider_id(specialty, nationality, real_team, birthdate)"
    ).in_("status", ["active", "notice"]).execute()

    if not contracts.data:
        return {
            "status": "completed",
            "processed": 0,
            "message": "No active contracts",
        }

    # Group contracts by team for efficient processing
    team_contracts: dict[str, list[dict]] = {}
    for c in contracts.data:
        team_id = c["team_id"]
        team_contracts.setdefault(team_id, []).append(c)

    # --- Step 3: Get policies with slug and config for per-rider matching ---
    policies = supabase.table("team_policies").select(
        "team_id, config, policies(slug, xp_bonus)"
    ).eq("is_active", True).execute()

    # Build per-team policy list: [{slug, xp_bonus, config}, ...]
    team_policies: dict[str, list[dict]] = {}
    for p in policies.data or []:
        team_id = p["team_id"]
        policy_data = p.get("policies") or {}
        entry = {
            "slug": policy_data.get("slug", ""),
            "xp_bonus": float(policy_data.get("xp_bonus", 0) or 0),
            "config": p.get("config") or {},
        }
        team_policies.setdefault(team_id, []).append(entry)

    # Track all league_ids for snapshot step
    league_ids_seen: set[str] = set()

    # --- Step 4: Calculate XP per team and persist ---
    for team_id, team_clist in team_contracts.items():
        total_xp = 0.0

        for contract in team_clist:
            rider_id = contract["rider_id"]
            race_entries = rider_race_points.get(rider_id)
            if not race_entries:
                continue

            # Extract rider info for policy matching
            rider_join = contract.get("riders") or {}
            if isinstance(rider_join, list):
                rider_join = rider_join[0] if rider_join else {}
            rider_info = {
                "specialty": rider_join.get("specialty"),
                "nationality": rider_join.get("nationality"),
                "real_team": rider_join.get("real_team"),
                "birthdate": rider_join.get("birthdate"),
            }

            # Task 2: per-rider policy bonus
            policies_for_team = team_policies.get(team_id, [])
            bonus = _compute_rider_bonus(rider_info, policies_for_team)

            for entry in race_entries:
                # Contract-date guard: only score races during contract period
                race_date_str = entry.get("race_date")
                if race_date_str:
                    race_dt = date.fromisoformat(str(race_date_str))
                    purchased_at_raw = contract.get("purchased_at")
                    if purchased_at_raw:
                        purchased_dt = date.fromisoformat(str(purchased_at_raw)[:10])
                        if race_dt < purchased_dt:
                            continue
                    # Prefer released_at (set by current code); fall back to legacy release_date
                    released_raw = contract.get("released_at") or contract.get("release_date")
                    if released_raw:
                        release_dt = date.fromisoformat(str(released_raw)[:10])
                        if race_dt > release_dt:
                            continue

                raw_points = entry["pcs_points"]
                race_slug = entry["race_slug"]
                xp = raw_points * (1 + bonus)

                # Upsert rider_xp_daily (conflict key: team_id + rider_id + race_slug)
                try:
                    supabase.table("rider_xp_daily").upsert({
                        "team_id": team_id,
                        "rider_id": rider_id,
                        "contract_id": contract["id"],
                        "date": entry.get("race_date", today),
                        "raw_pcs_points": raw_points,
                        "policy_bonus": bonus,
                        "xp_gained": round(xp, 2),
                        "race_slug": race_slug,
                    }, on_conflict="team_id,rider_id,race_slug").execute()
                except Exception as e:
                    logger.error(f"rider_xp_daily upsert failed for rider {rider_id} race {race_slug}: {e}")
                    errors.append(str(e))
                    continue

                total_xp += xp

        if total_xp == 0:
            continue

        try:
            # Fetch current team values
            team_row = supabase.table("teams").select(
                "id, cumulative_xp, level, league_id"
            ).eq("id", team_id).single().execute()

            if not team_row.data:
                logger.warning(f"Team {team_id} not found — skipping XP update")
                continue

            prev_xp = round(prev_team_xp.get(team_id, 0.0), 2)
            delta_xp = round(total_xp - prev_xp, 2)
            new_xp = team_row.data["cumulative_xp"] + delta_xp

            # Task 3: auto level-up
            current_level = team_row.data.get("level", 1)
            new_level = compute_level(new_xp)

            update_data: dict = {
                "cumulative_xp": new_xp,
            }
            if new_level != current_level:
                update_data["level"] = new_level
                logger.info(f"Team {team_id} level up: {current_level} → {new_level} (XP: {new_xp})")

            supabase.table("teams").update(update_data).eq("id", team_id).execute()

            # Track league for snapshot
            if team_row.data.get("league_id"):
                league_ids_seen.add(team_row.data["league_id"])

            processed += 1

        except Exception as e:
            logger.error(f"Failed to update team {team_id}: {e}")
            errors.append(str(e))

    # --- Step 5: Snapshot team_ranking_daily for movement tracking ---
    for league_id in league_ids_seen:
        try:
            league_teams = supabase.table("teams").select(
                "id, cumulative_xp"
            ).eq("league_id", league_id).order(
                "cumulative_xp", desc=True
            ).execute()

            for rank, team in enumerate(league_teams.data or [], start=1):
                supabase.table("team_ranking_daily").upsert({
                    "team_id": team["id"],
                    "date": today,
                    "rank": rank,
                    "cumulative_xp": team["cumulative_xp"],
                }, on_conflict="team_id,date").execute()

        except Exception as e:
            logger.error(f"Failed to snapshot league {league_id}: {e}")
            errors.append(str(e))

    return {
        "status": "completed",
        "teams_processed": processed,
        "errors": errors,
    }
