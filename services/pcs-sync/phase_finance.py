"""
Phase finance job — WattHunter Economy (8-phase WT calendar model).

Replaces monthly_finance.py. Runs once per WT phase for all teams in active
leagues. No /30 division — full monthly_budget amount per phase.

Steps per team:
  1. +sponsor income (full monthly_budget from team's sponsor, fallback 250K Lotto)
     → treasury_log type: "phase_sponsor_base"
  2. -salaries (sum of locked_salary from active contracts)
     → treasury_log type: "phase_salary"
  3. Update team.treasury
  4. Bankruptcy check — if treasury < -10 000, release best scorers (highest XP first)
     → treasury_log type: "bankruptcy_release"
     → 5 000 EUR release fee per released rider
  5. Treasury validation

Design doc: docs/plans/2026-04-02-game-simplification-backlog.md
"""
from __future__ import annotations

import logging
from datetime import date
from supabase import Client

logger = logging.getLogger(__name__)

DEFAULT_SPONSOR_INCOME = 250_000  # Lotto T1 fallback when no sponsor assigned
BANKRUPTCY_THRESHOLD = -10_000    # Tolerance buffer before auto-release cascade
RELEASE_FEE = 5_000               # Flat fee per released rider (voluntary or bankruptcy)


def calculate_phase_salaries(contracts: list[dict]) -> int:
    """Sum of locked_salary for all contracts — full amount per phase."""
    return sum(c.get("locked_salary", 0) for c in contracts)


def get_release_order(contracts: list[dict]) -> list[dict]:
    """Order contracts by total_xp descending — best scorer released first."""
    return sorted(contracts, key=lambda c: -c.get("total_xp", 0))


def _get_sponsor_income(supabase: Client, team_id: str) -> tuple[int, str]:
    """
    Fetch sponsor for a team and return (income, description).
    Uses full monthly_budget — one payment per phase.
    Falls back to DEFAULT_SPONSOR_INCOME if no sponsor assigned.
    """
    sponsors = supabase.table("team_sponsors").select(
        "sponsor_id, sponsors(name, monthly_budget)"
    ).eq("team_id", team_id).execute()

    if not sponsors.data:
        return DEFAULT_SPONSOR_INCOME, "Default sponsor (Lotto)"

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
        return DEFAULT_SPONSOR_INCOME, "Default sponsor (Lotto)"

    return total, ", ".join(names)


async def run_phase_finance(supabase: Client) -> dict:
    """
    Phase finance cycle for all teams in active leagues:
      1. +sponsor income (full monthly_budget or fallback 250K)
      2. -salaries (full locked_salary per phase)
      3. Bankruptcy check → release best scorers
    """
    today = date.today().isoformat()
    results = []

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
            # Step 1: Sponsor income
            sponsor_income, sponsor_desc = _get_sponsor_income(supabase, team_id)
            treasury += sponsor_income
            supabase.table("treasury_log").insert({
                "team_id": team_id,
                "type": "phase_sponsor_base",
                "amount": sponsor_income,
                "description": f"Phase sponsor — {sponsor_desc} ({today})",
            }).execute()

            # Step 2: Salary deduction
            contracts = supabase.table("contracts").select(
                "id, rider_id, locked_salary, status"
            ).eq("team_id", team_id).eq(
                "status", "active"
            ).execute()

            total_salary = calculate_phase_salaries(contracts.data or [])
            treasury -= total_salary

            if total_salary > 0:
                supabase.table("treasury_log").insert({
                    "team_id": team_id,
                    "type": "phase_salary",
                    "amount": -total_salary,
                    "description": f"Phase salaries ({len(contracts.data or [])} riders) — {today}",
                }).execute()

            # Step 3: Update treasury
            supabase.table("teams").update({
                "treasury": treasury,
            }).eq("id", team_id).execute()

            # Step 4: Bankruptcy check
            released = []
            if treasury < BANKRUPTCY_THRESHOLD and contracts.data:
                xp_data = supabase.table("rider_xp_daily").select(
                    "rider_id, xp_gained"
                ).eq("team_id", team_id).execute()

                rider_xp: dict[str, int] = {}
                for row in (xp_data.data or []):
                    rid = row["rider_id"]
                    rider_xp[rid] = rider_xp.get(rid, 0) + row["xp_gained"]

                enriched = [
                    {**c, "total_xp": rider_xp.get(c["rider_id"], 0)}
                    for c in contracts.data
                ]

                release_order = get_release_order(enriched)

                for contract in release_order:
                    if treasury >= BANKRUPTCY_THRESHOLD:
                        break

                    supabase.table("contracts").update({
                        "status": "released",
                        "released_at": today,
                    }).eq("id", contract["id"]).execute()

                    refund = contract["locked_salary"] - RELEASE_FEE
                    treasury += refund
                    released.append(contract["rider_id"])

                    supabase.table("treasury_log").insert({
                        "team_id": team_id,
                        "type": "bankruptcy_release",
                        "amount": refund,
                        "description": f"Bankruptcy — released rider {contract['rider_id']} (salary refund {contract['locked_salary']} - fee {RELEASE_FEE})",
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
            logger.error(f"Phase finance failed for team {team_id}: {e}")
            results.append({"team_id": team_id, "error": str(e)})

    # Step 5: Treasury validation
    from validation import validate_treasury
    validation = await validate_treasury(supabase)
    if validation.get("divergences"):
        logger.warning(
            f"Treasury validation found {len(validation['divergences'])} divergences"
        )

    return {"status": "completed", "teams": results, "validation": validation}
