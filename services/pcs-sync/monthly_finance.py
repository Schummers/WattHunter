"""
Monthly finance job — WattHunter Beta Economy.

Runs on the 1st of each month (or before each auction):
  1. Pay sponsor income to each team (from team_sponsors, fallback 200K)
  2. Deduct salaries (sum of locked_salary from active contracts)
  3. Check bankruptcy: if treasury < 0, release best scorers until solvent

Only processes teams in active leagues.
Sponsor income comes from team_sponsors (joined with sponsors.monthly_budget).
If no active sponsors, falls back to default 200K (L'Auto).

Design doc: docs/plans/2026-03-05-beta-economy-design.md
"""
from __future__ import annotations

import logging
import os
from datetime import date
from supabase import Client

logger = logging.getLogger(__name__)

DEFAULT_SPONSOR_AMOUNT = 200_000  # fallback when no sponsors active (L'Auto)


def calculate_monthly_salaries(contracts: list[dict]) -> int:
    """Sum of locked_salary for all active contracts."""
    return sum(c.get("locked_salary", 0) for c in contracts)


def get_release_order(contracts: list[dict]) -> list[dict]:
    """Order contracts by total_xp descending — best scorer released first."""
    return sorted(contracts, key=lambda c: -c.get("total_xp", 0))


def _get_sponsor_income(supabase: Client, team_id: str) -> tuple[int, str]:
    """
    Fetch active sponsors for a team and return (total_income, description).
    Falls back to DEFAULT_SPONSOR_AMOUNT if no active sponsors.
    """
    sponsors = supabase.table("team_sponsors").select(
        "sponsors(name, monthly_budget)"
    ).eq("team_id", team_id).eq("status", "active").execute()

    if not sponsors.data:
        return DEFAULT_SPONSOR_AMOUNT, "Default sponsor (L'Auto)"

    total = 0
    names = []
    for s in sponsors.data:
        sponsor_data = s.get("sponsors") or {}
        if isinstance(sponsor_data, list):
            sponsor_data = sponsor_data[0] if sponsor_data else {}
        budget = sponsor_data.get("monthly_budget", 0) or 0
        name = sponsor_data.get("name", "Unknown")
        total += budget
        names.append(name)

    if total == 0:
        return DEFAULT_SPONSOR_AMOUNT, "Default sponsor (L'Auto)"

    return total, ", ".join(names)


async def run_monthly_finance(supabase: Client) -> dict:
    """
    Monthly finance cycle for all teams in active leagues:
      1. +sponsor income (from team_sponsors or default 200K)
      2. -salaries
      3. Bankruptcy check → release best scorers
    """
    today = date.today().isoformat()
    results = []

    # Task 14: only process teams in active leagues
    teams = supabase.table("teams").select(
        "id, treasury, name, league_id, leagues(status)"
    ).execute()

    if not teams.data:
        return {"status": "no_teams"}

    active_teams = [
        t for t in teams.data
        if (t.get("leagues") or {}).get("status") == "active"
    ]

    if not active_teams:
        return {"status": "no_active_leagues", "total_teams": len(teams.data)}

    for team in active_teams:
        team_id = team["id"]
        treasury = team["treasury"]

        try:
            # 1. Sponsor payment (from team_sponsors)
            sponsor_income, sponsor_desc = _get_sponsor_income(supabase, team_id)
            treasury += sponsor_income
            supabase.table("treasury_log").insert({
                "team_id": team_id,
                "type": "sponsor_payment",
                "amount": sponsor_income,
                "description": f"Sponsor {today} — {sponsor_desc}",
            }).execute()

            # 2. Salary deduction (skip contracts already paid this month)
            contracts = supabase.table("contracts").select(
                "id, rider_id, locked_salary, last_salary_paid"
            ).eq("team_id", team_id).in_(
                "status", ["active", "notice"]
            ).execute()

            first_of_month = today[:8] + "01"  # e.g. "2026-03-01"
            unpaid_contracts = [
                c for c in (contracts.data or [])
                if not c.get("last_salary_paid") or c["last_salary_paid"] < first_of_month
            ]

            total_salary = calculate_monthly_salaries(unpaid_contracts)
            treasury -= total_salary

            if total_salary > 0:
                supabase.table("treasury_log").insert({
                    "team_id": team_id,
                    "type": "monthly_salary",
                    "amount": -total_salary,
                    "description": f"Salaries {today} ({len(unpaid_contracts)} riders)",
                }).execute()

                # Mark contracts as paid for this month
                for c in unpaid_contracts:
                    supabase.table("contracts").update({
                        "last_salary_paid": today,
                    }).eq("id", c["id"]).execute()

            # 3. Update treasury
            supabase.table("teams").update({
                "treasury": treasury,
            }).eq("id", team_id).execute()

            # 4. Bankruptcy check
            released = []
            if treasury < 0 and contracts.data:
                xp_data = supabase.table("rider_xp_daily").select(
                    "rider_id, xp_gained"
                ).eq("team_id", team_id).execute()

                rider_xp: dict[str, int] = {}
                for row in (xp_data.data or []):
                    rid = row["rider_id"]
                    rider_xp[rid] = rider_xp.get(rid, 0) + row["xp_gained"]

                enriched = []
                for c in contracts.data:
                    enriched.append({
                        **c,
                        "total_xp": rider_xp.get(c["rider_id"], 0),
                    })

                release_order = get_release_order(enriched)

                for contract in release_order:
                    if treasury >= 0:
                        break

                    supabase.table("contracts").update({
                        "status": "released",
                        "release_date": today,
                    }).eq("id", contract["id"]).execute()

                    treasury += contract["locked_salary"]
                    released.append(contract["rider_id"])

                    supabase.table("treasury_log").insert({
                        "team_id": team_id,
                        "type": "bankruptcy_release",
                        "amount": 0,
                        "description": f"Bankruptcy — released rider {contract['rider_id']}",
                        "rider_id": contract["rider_id"],
                    }).execute()

                    logger.warning(
                        f"Team {team_id}: bankruptcy release of rider {contract['rider_id']}"
                    )

                supabase.table("teams").update({
                    "treasury": treasury,
                }).eq("id", team_id).execute()

            results.append({
                "team_id": team_id,
                "sponsor": sponsor_income,
                "salaries": total_salary,
                "treasury_after": treasury,
                "released": released,
            })

        except Exception as e:
            logger.error(f"Monthly finance failed for team {team_id}: {e}")
            results.append({"team_id": team_id, "error": str(e)})

    # Treasury validation
    from validation import validate_treasury
    validation = await validate_treasury(supabase)
    if validation.get("divergences"):
        logger.warning(f"Treasury validation found {len(validation['divergences'])} divergences")

    return {"status": "completed", "teams": results, "validation": validation}
