"""
Daily scoring job — WattHunter PCS Sync Microservice.

For each contracted rider with pcs_points > 0 (from race_results):
  1. Apply per-rider policy matching → XP gained
  2. Calculate revenue → add to treasury
  3. Upsert into rider_xp_daily (keyed by team_id, rider_id, race_slug)
  4. Update teams.cumulative_xp, teams.treasury, and teams.level
  5. Insert treasury_log entry (with dedup guard)
  6. Snapshot team_ranking_daily for movement tracking

NEVER hardcode CONVERSION_RATE — always read from env (CLAUDE.md rule).
"""
from __future__ import annotations
import os
import logging
from datetime import date, datetime
from supabase import Client

logger = logging.getLogger(__name__)

# Read at import time so the module-level constant is set correctly.
# 1500 €/point PCS — intentionally below salary rate (2000) to create "pépite" dynamic.
CONVERSION_RATE = int(os.getenv("CONVERSION_RATE_EUR_PER_PCS", "1500"))

# Level thresholds — must match apps/web/lib/levels.ts
LEVEL_THRESHOLDS = [0, 50, 150, 300, 500, 700, 1000, 1400, 1900, 2500]


def compute_level(xp: int) -> int:
    """Compute team level from cumulative XP."""
    for i in range(len(LEVEL_THRESHOLDS) - 1, -1, -1):
        if xp >= LEVEL_THRESHOLDS[i]:
            return i + 1
    return 1


def calculate_rider_bonus(pcs_points: int, locked_salary: int, conversion_rate: int) -> int:
    """
    Beta economy: bonus = max(0, pts × conversion_rate - locked_salary).
    Positive only — a rider never costs more than their salary.
    """
    revenue = pcs_points * conversion_rate
    return max(0, revenue - locked_salary)


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
      - Calculate revenue → treasury
      - Upsert rider_xp_daily (keyed by team_id, rider_id, race_slug)
      - Update team cumulative_xp, treasury, and level
      - Insert treasury_log entry with dedup check
      - Snapshot team_ranking_daily

    Returns a summary dict with teams_processed count and any errors.
    """
    # Re-read CONVERSION_RATE from env at call time to pick up any runtime changes.
    conversion_rate = int(os.getenv("CONVERSION_RATE_EUR_PER_PCS", "1500"))

    today = date.today().isoformat()
    processed = 0
    errors = []

    # --- Step 1: Get race results ---
    # Task 1: filter by race_slugs if provided, else fallback to today's date
    if race_slugs:
        history = supabase.table("race_results").select(
            "rider_id, race_slug, pcs_points"
        ).in_("race_slug", race_slugs).gt("pcs_points", 0).execute()
    else:
        history = supabase.table("race_results").select(
            "rider_id, race_slug, pcs_points"
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
        })

    # --- Step 2: Get all active/notice contracts with rider info for policy matching ---
    contracts = supabase.table("contracts").select(
        "id, team_id, rider_id, locked_salary, "
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

    # --- Step 4: Calculate XP + revenue per team and persist ---
    for team_id, team_clist in team_contracts.items():
        total_xp = 0.0
        total_revenue = 0

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

            contract_salary = contract.get("locked_salary", 0)

            for entry in race_entries:
                raw_points = entry["pcs_points"]
                race_slug = entry["race_slug"]
                xp = raw_points * (1 + bonus)
                revenue = calculate_rider_bonus(raw_points, contract_salary, conversion_rate)

                # Upsert rider_xp_daily (conflict key: team_id + rider_id + race_slug)
                try:
                    supabase.table("rider_xp_daily").upsert({
                        "team_id": team_id,
                        "rider_id": rider_id,
                        "contract_id": contract["id"],
                        "date": today,
                        "raw_pcs_points": raw_points,
                        "policy_bonus": bonus,
                        "xp_gained": int(xp),
                        "race_slug": race_slug,
                        "revenue_earned": revenue,
                    }, on_conflict="team_id,rider_id,race_slug").execute()
                except Exception as e:
                    logger.error(f"rider_xp_daily upsert failed for rider {rider_id} race {race_slug}: {e}")
                    errors.append(str(e))
                    continue

                total_xp += xp
                total_revenue += revenue

        if total_xp == 0 and total_revenue == 0:
            continue

        try:
            # Fetch current team values
            team_row = supabase.table("teams").select(
                "id, cumulative_xp, treasury, level, league_id"
            ).eq("id", team_id).single().execute()

            if not team_row.data:
                logger.warning(f"Team {team_id} not found — skipping treasury update")
                continue

            new_xp = team_row.data["cumulative_xp"] + int(total_xp)
            new_treasury = team_row.data["treasury"] + total_revenue

            # Task 3: auto level-up
            current_level = team_row.data.get("level", 1)
            new_level = compute_level(new_xp)

            update_data: dict = {
                "cumulative_xp": new_xp,
                "treasury": new_treasury,
            }
            if new_level != current_level:
                update_data["level"] = new_level
                logger.info(f"Team {team_id} level up: {current_level} → {new_level} (XP: {new_xp})")

            supabase.table("teams").update(update_data).eq("id", team_id).execute()

            # Track league for snapshot
            if team_row.data.get("league_id"):
                league_ids_seen.add(team_row.data["league_id"])

            # Insert treasury_log with dedup: only one rider_revenue per team per day
            existing_log = supabase.table("treasury_log").select("id").eq(
                "team_id", team_id
            ).eq("type", "rider_revenue").gte(
                "created_at", f"{today}T00:00:00"
            ).execute()

            if not existing_log.data:
                supabase.table("treasury_log").insert({
                    "team_id": team_id,
                    "type": "rider_revenue",
                    "amount": total_revenue,
                    "description": f"Rider revenue {today}",
                }).execute()

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
