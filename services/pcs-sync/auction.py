"""
Auction resolution job — WattHunter PCS Sync Microservice.

Implements 3-round sealed-bid auction resolution per PRD_02_MECHANICS.md.

Rules (from PRD):
  - 3 rounds of 24 h each (open window = 72 h total)
  - Each round: highest bid per rider wins; tiebreak = earliest placed_at timestamp
  - Winner: status → 'won', contract created, treasury debited
  - Losers: status → 'outbid'
  - After round 3: auction.status → 'closed'
  - Treasury deduction is logged in treasury_log (type='auction_purchase')
  - NEVER authorize a bid if treasury < total active bids (enforced at bid time in API;
    resolution here trusts the bid was valid when placed)
"""
import logging
from datetime import date, datetime
from supabase import Client

logger = logging.getLogger(__name__)


async def resolve_current_round(supabase: Client) -> dict:
    """
    Resolve the current auction round for all open auctions.

    Algorithm:
      1. Find all auctions with status = 'open'.
      2. Compute current_round = (today - opens_at).days + 1  (clamped 1-3).
      3. For each open auction:
         a. Fetch all active bids for current_round.
         b. Group by rider_id.
         c. Winning bid = highest amount; tiebreak = earliest placed_at.
         d. Mark winner as 'won', losers as 'outbid'.
         e. Create a contract for the winning team.
         f. Deduct winner["amount"] from team treasury.
         g. Insert treasury_log entry (type='auction_purchase', amount=-winner_amount).
         h. Mark rider.is_active_in_game = True.
      4. After round 3: close the auction (status='closed', resolved_at=now).

    Returns a summary dict with per-auction results.
    """
    today = date.today()

    # --- Fetch all open auctions ---
    auctions_resp = supabase.table("auctions").select("*").eq("status", "open").execute()

    if not auctions_resp.data:
        return {"status": "no_open_auctions"}

    results = []

    for auction in auctions_resp.data:
        auction_id = auction["id"]

        try:
            # Determine which round we are in
            opens_at_str = auction.get("opens_at", "")
            opens_date = datetime.fromisoformat(opens_at_str).date()
            current_round = (today - opens_date).days + 1

            if current_round < 1 or current_round > 3:
                logger.warning(
                    f"Auction {auction_id}: computed round {current_round} is out of "
                    f"range [1, 3] — skipping"
                )
                results.append({
                    "auction_id": auction_id,
                    "round": current_round,
                    "skipped": True,
                    "reason": "round_out_of_range",
                })
                continue

            # --- Fetch active bids for this round ---
            bids_resp = supabase.table("auction_bids").select(
                "id, rider_id, team_id, amount, placed_at"
            ).eq("auction_id", auction_id).eq(
                "round", current_round
            ).eq("status", "active").execute()

            if not bids_resp.data:
                logger.info(
                    f"Auction {auction_id} round {current_round}: no active bids"
                )
                # Still close if this is the final round
                if current_round == 3:
                    _close_auction(supabase, auction_id)
                results.append({
                    "auction_id": auction_id,
                    "round": current_round,
                    "resolved": 0,
                    "message": "no_active_bids",
                })
                continue

            # --- Group bids by rider_id ---
            rider_bids: dict[str, list[dict]] = {}
            for bid in bids_resp.data:
                rider_id = bid["rider_id"]
                rider_bids.setdefault(rider_id, []).append(bid)

            resolved_count = 0

            for rider_id, rbids in rider_bids.items():
                try:
                    # Sort: highest amount first; tiebreak: earliest placed_at
                    rbids.sort(key=lambda b: (-int(b["amount"]), b["placed_at"]))
                    winner = rbids[0]
                    losers = rbids[1:]

                    # Fetch rider salary (needed to lock contract salary)
                    rider_name_resp = supabase.table("riders").select(
                        "full_name, monthly_salary"
                    ).eq("id", rider_id).single().execute()

                    # Mark winner
                    supabase.table("auction_bids").update(
                        {"status": "won"}
                    ).eq("id", winner["id"]).execute()

                    # Mark losers
                    for loser in losers:
                        supabase.table("auction_bids").update(
                            {"status": "outbid"}
                        ).eq("id", loser["id"]).execute()

                    locked_salary = (
                        rider_name_resp.data["monthly_salary"]
                        if rider_name_resp.data
                        else 5_000  # SALARY_FLOOR fallback
                    )

                    # Create contract
                    supabase.table("contracts").insert({
                        "team_id": winner["team_id"],
                        "rider_id": rider_id,
                        "locked_salary": locked_salary,
                        "status": "active",
                        "purchased_at": datetime.utcnow().isoformat(),
                    }).execute()

                    # Deduct treasury — fetch current value first to avoid race condition
                    team_resp = supabase.table("teams").select(
                        "treasury, name"
                    ).eq("id", winner["team_id"]).single().execute()

                    if team_resp.data:
                        new_treasury = team_resp.data["treasury"] - int(winner["amount"])
                        supabase.table("teams").update(
                            {"treasury": new_treasury}
                        ).eq("id", winner["team_id"]).execute()

                    # Treasury log — amount is negative (expenditure)
                    supabase.table("treasury_log").insert({
                        "team_id": winner["team_id"],
                        "type": "auction_purchase",
                        "amount": -int(winner["amount"]),
                        "description": f"Enchere Round {current_round} — coureur {rider_id}",
                        "rider_id": rider_id,
                    }).execute()

                    # Mark rider as active in the game
                    supabase.table("riders").update(
                        {"is_active_in_game": True}
                    ).eq("id", rider_id).execute()

                    resolved_count += 1

                except Exception as e:
                    logger.error(
                        f"Auction {auction_id} round {current_round} rider {rider_id}: {e}"
                    )

            # Close auction after final round
            if current_round == 3:
                _close_auction(supabase, auction_id)

            results.append({
                "auction_id": auction_id,
                "round": current_round,
                "resolved": resolved_count,
            })

        except Exception as e:
            logger.error(f"Failed to process auction {auction_id}: {e}")
            results.append({
                "auction_id": auction_id,
                "error": str(e),
            })

    return {"status": "completed", "auctions": results}


def _close_auction(supabase: Client, auction_id: str) -> None:
    """Mark an auction as closed with the current UTC timestamp."""
    supabase.table("auctions").update({
        "status": "closed",
        "resolved_at": datetime.utcnow().isoformat(),
    }).eq("id", auction_id).execute()
    logger.info(f"Auction {auction_id} closed.")
