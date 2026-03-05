"""
Daily scoring job — WattHunter PCS Sync Microservice.

For each contracted rider with pcs_points > 0 today (from race_results):
  1. Apply team policy multipliers → XP gained
  2. Calculate revenue → add to treasury
  3. Upsert into rider_xp_daily
  4. Update teams.cumulative_xp and teams.treasury
  5. Insert treasury_log entry (with dedup guard)

NEVER hardcode CONVERSION_RATE — always read from env (CLAUDE.md rule).
"""
from __future__ import annotations
import os
import logging
from datetime import date
from supabase import Client

logger = logging.getLogger(__name__)

# Read at import time so the module-level constant is set correctly.
# The env var MUST be present in production; 500 is the placeholder from CLAUDE.md.
CONVERSION_RATE = int(os.getenv("CONVERSION_RATE_EUR_PER_PCS", "500"))


def calculate_rider_bonus(pcs_points: int, locked_salary: int, conversion_rate: int) -> int:
    """
    Beta economy: bonus = max(0, pts × conversion_rate - locked_salary).
    Positive only — a rider never costs more than their salary.
    """
    revenue = pcs_points * conversion_rate
    return max(0, revenue - locked_salary)


async def calculate_daily_scores(supabase: Client) -> dict:
    """
    For each contracted rider with pcs_points > 0 in race_results today:
      - Apply policy multipliers → XP
      - Calculate revenue → treasury
      - Upsert rider_xp_daily
      - Update team cumulative_xp and treasury
      - Insert treasury_log entry with dedup check

    Returns a summary dict with teams_processed count and any errors.
    """
    # Re-read CONVERSION_RATE from env at call time to pick up any runtime changes.
    conversion_rate = int(os.getenv("CONVERSION_RATE_EUR_PER_PCS", "500"))

    today = date.today().isoformat()
    processed = 0
    errors = []

    # --- Step 1: Get today's race results (riders who scored points today) ---
    history = supabase.table("race_results").select(
        "rider_id, pcs_points"
    ).eq("race_date", today).gt("pcs_points", 0).execute()

    if not history.data:
        return {
            "status": "completed",
            "processed": 0,
            "message": "No race results today",
        }

    rider_points: dict[str, int] = {
        h["rider_id"]: h["pcs_points"] for h in history.data
    }

    # --- Step 2: Get all active/notice contracts ---
    contracts = supabase.table("contracts").select(
        "id, team_id, rider_id, locked_salary"
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

    # --- Step 3: Get XP bonus from active policies per team ---
    # team_policies links a team to a policy; policies.xp_bonus is the multiplier bonus
    policies = supabase.table("team_policies").select(
        "team_id, policy_id, policies(xp_bonus)"
    ).eq("is_active", True).execute()

    team_bonus: dict[str, float] = {}
    for p in policies.data or []:
        team_id = p["team_id"]
        bonus = float((p.get("policies") or {}).get("xp_bonus", 0) or 0)
        team_bonus[team_id] = team_bonus.get(team_id, 0.0) + bonus

    # --- Step 4: Calculate XP + revenue per team and persist ---
    for team_id, team_clist in team_contracts.items():
        total_xp = 0.0
        total_revenue = 0

        for contract in team_clist:
            rider_id = contract["rider_id"]
            raw_points = rider_points.get(rider_id, 0)
            if raw_points == 0:
                continue

            bonus = team_bonus.get(team_id, 0.0)
            xp = raw_points * (1 + bonus)
            contract_salary = contract.get("locked_salary", 0)
            revenue = calculate_rider_bonus(raw_points, contract_salary, conversion_rate)

            # Upsert rider_xp_daily (conflict key: team_id + rider_id + date)
            try:
                supabase.table("rider_xp_daily").upsert({
                    "team_id": team_id,
                    "rider_id": rider_id,
                    "contract_id": contract["id"],
                    "date": today,
                    "raw_pcs_points": raw_points,
                    "policy_bonus": bonus,
                    "xp_gained": int(xp),
                }, on_conflict="team_id,rider_id,date").execute()
            except Exception as e:
                logger.error(f"rider_xp_daily upsert failed for rider {rider_id}: {e}")
                errors.append(str(e))
                continue

            total_xp += xp
            total_revenue += revenue

        if total_xp == 0 and total_revenue == 0:
            # No riders on this team scored today
            continue

        try:
            # Fetch current team values
            team_row = supabase.table("teams").select(
                "id, cumulative_xp, treasury"
            ).eq("id", team_id).single().execute()

            if not team_row.data:
                logger.warning(f"Team {team_id} not found — skipping treasury update")
                continue

            new_xp = team_row.data["cumulative_xp"] + int(total_xp)
            new_treasury = team_row.data["treasury"] + total_revenue

            supabase.table("teams").update({
                "cumulative_xp": new_xp,
                "treasury": new_treasury,
            }).eq("id", team_id).execute()

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
                    "description": f"Revenus coureurs du {today}",
                }).execute()

            processed += 1

        except Exception as e:
            logger.error(f"Failed to update team {team_id}: {e}")
            errors.append(str(e))

    return {
        "status": "completed",
        "teams_processed": processed,
        "errors": errors,
    }
