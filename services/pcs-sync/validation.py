"""
Treasury validation — WattHunter PCS Sync.

Compares teams.treasury against sum(treasury_log.amount) and logs warnings on divergence.
"""
from __future__ import annotations

import logging
from supabase import Client

logger = logging.getLogger(__name__)


async def validate_treasury(supabase: Client) -> dict:
    """
    For each team, compare teams.treasury with sum(treasury_log.amount).
    Log WARNING if they diverge. Returns a summary dict.
    """
    teams = supabase.table("teams").select("id, name, treasury").execute()
    if not teams.data:
        return {"status": "no_teams", "checked": 0, "divergences": []}

    divergences = []

    for team in teams.data:
        team_id = team["id"]
        team_name = team["name"]
        stored_treasury = team["treasury"]

        logs = supabase.table("treasury_log").select(
            "amount"
        ).eq("team_id", team_id).execute()

        expected_treasury = sum(row["amount"] for row in (logs.data or []))

        # Account for initial treasury (200_000) which has no log entry
        # The starting treasury is set at team creation, not via treasury_log
        # So expected = initial + sum(logs)
        # We can't know the exact initial amount, so we compare the delta
        delta = stored_treasury - expected_treasury

        # If delta != initial treasury (200_000), something is wrong
        # But since initial treasury could vary, just check if delta is consistent
        # Simpler approach: just report if stored != expected + 200_000
        initial_treasury = 200_000
        expected_with_initial = initial_treasury + expected_treasury

        if stored_treasury != expected_with_initial:
            diff = stored_treasury - expected_with_initial
            logger.warning(
                f"Treasury mismatch for team '{team_name}' ({team_id}): "
                f"stored={stored_treasury}, expected={expected_with_initial}, "
                f"delta={diff}"
            )
            divergences.append({
                "team_id": team_id,
                "team_name": team_name,
                "stored": stored_treasury,
                "expected": expected_with_initial,
                "delta": diff,
            })

    checked = len(teams.data)
    if not divergences:
        logger.info(f"Treasury validation OK — {checked} teams checked, no divergences")
    else:
        logger.warning(f"Treasury validation: {len(divergences)} divergences out of {checked} teams")

    return {
        "status": "completed",
        "checked": checked,
        "divergences": divergences,
    }
