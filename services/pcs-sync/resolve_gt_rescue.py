from __future__ import annotations
import logging
from datetime import date
from typing import Any

logger = logging.getLogger(__name__)


def pick_winners(bids: list[dict[str, Any]]) -> tuple[list[dict], list[dict]]:
    """
    Given a list of bids (all unresolved, same phase+league), return (winners, losers).
    Winner per rider = highest amount. Tie-break: earliest created_at.
    bids must already be sorted by amount DESC, created_at ASC.
    """
    seen: dict[str, str] = {}  # rider_id -> winning bid id
    for bid in bids:
        if bid["rider_id"] not in seen:
            seen[bid["rider_id"]] = bid["id"]

    winners = [b for b in bids if seen.get(b["rider_id"]) == b["id"]]
    losers = [b for b in bids if seen.get(b["rider_id"]) != b["id"]]
    return winners, losers


def resolve_gt_rescue(phase_id: int, league_id: str, supabase_admin) -> dict[str, Any]:
    """
    Resolve all unresolved gt_emergency_bids for a league+phase.
    - Picks winner per rider (highest bid, tie-break: earliest created_at)
    - Creates contract directly via service_role (bypasses cooldown)
    - Debits winner treasury + inserts treasury_log
    - Marks all bids resolved

    Returns summary: {"winners": [...], "losers_count": int, "errors": [...]}
    """
    # Fetch all unresolved bids, sorted for pick_winners
    resp = (
        supabase_admin
        .from_("gt_emergency_bids")
        .select("id, team_id, rider_id, amount, gt_identifier, gt_year, created_at")
        .eq("phase_id", phase_id)
        .eq("league_id", league_id)
        .eq("resolved", False)
        .order("amount", desc=True)
        .order("created_at", desc=False)
        .execute()
    )
    bids = resp.data or []

    if not bids:
        logger.info("No unresolved emergency bids found.")
        return {"winners": [], "losers_count": 0, "errors": []}

    winners, losers = pick_winners(bids)
    summary: dict[str, Any] = {"winners": [], "losers_count": len(losers), "errors": []}

    for bid in winners:
        rider_id = bid["rider_id"]
        team_id = bid["team_id"]
        amount = bid["amount"]

        try:
            # Fetch rider name for logs
            rider_resp = (
                supabase_admin.from_("riders")
                .select("name")
                .eq("id", rider_id)
                .single()
                .execute()
            )
            if not rider_resp.data:
                summary["errors"].append(f"Rider {rider_id} not found")
                continue
            rider_name = rider_resp.data["name"]

            # Create contract directly (service_role — no cooldown check, no place_bid validation)
            contract_resp = (
                supabase_admin.from_("contracts")
                .insert({
                    "team_id": team_id,
                    "rider_id": rider_id,
                    "league_id": league_id,
                    "locked_salary": amount,
                    "status": "active",
                    "purchased_at": date.today().isoformat(),
                })
                .execute()
            )
            if not contract_resp.data:
                summary["errors"].append(f"Failed to create contract for bid {bid['id']}")
                continue

            # Debit treasury
            supabase_admin.from_("treasury_log").insert({
                "team_id": team_id,
                "type": "gt_emergency_purchase",
                "amount": -amount,
                "description": f"GT Emergency — {rider_name}",
                "rider_id": rider_id,
            }).execute()

            # Direct treasury update (service_role — bypasses trigger protection)
            team_resp = (
                supabase_admin.from_("teams")
                .select("treasury")
                .eq("id", team_id)
                .single()
                .execute()
            )
            new_treasury = team_resp.data["treasury"] - amount
            supabase_admin.from_("teams").update({"treasury": new_treasury}).eq("id", team_id).execute()

            # Mark winner bid resolved
            supabase_admin.from_("gt_emergency_bids").update(
                {"resolved": True, "won": True}
            ).eq("id", bid["id"]).execute()

            summary["winners"].append({
                "bid_id": bid["id"],
                "rider": rider_name,
                "team_id": team_id,
                "amount": amount,
            })
            logger.info("Winner: team %s gets %s for %d€", team_id, rider_name, amount)

        except Exception as e:
            summary["errors"].append(f"Error processing bid {bid['id']}: {e}")
            logger.error("Error processing bid %s: %s", bid["id"], e)

    # Mark all losers resolved in one batch
    loser_ids = [b["id"] for b in losers]
    if loser_ids:
        supabase_admin.from_("gt_emergency_bids").update(
            {"resolved": True, "won": False}
        ).in_("id", loser_ids).execute()

    return summary
