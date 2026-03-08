"""
Auction resolution job — WattHunter PCS Sync Microservice.

Implements 3-round sealed-bid auction resolution per PRD_02_MECHANICS.md.

Rules (from PRD):
  - 3 rounds of 24 h each (open window = 72 h total)
  - Each round: highest bid per rider wins; tiebreak = earliest placed_at timestamp
  - Winner: status → 'won', contract created, first month salary debited from treasury
  - Losers: status → 'outbid'
  - After round 3: auction.status → 'closed'

Economy rules:
  - The winning bid amount becomes the rider's locked_salary (monthly salary).
  - The first month's salary is debited from treasury at auction time.
  - Subsequent monthly salaries are deducted by the monthly finance job.
  - treasury_log records the deduction with amount = -locked_salary.
  - NEVER authorize a bid if treasury < total active bids (enforced at bid time in API;
    resolution here trusts the bid was valid when placed)
"""
from __future__ import annotations

import logging
from datetime import date, datetime
from supabase import Client

logger = logging.getLogger(__name__)


async def resolve_current_round(
    supabase: Client,
    force_round: int | None = None,
    force_close: bool = False,
) -> dict:
    """
    Resolve the current auction round for all open auctions.

    Args:
        supabase: Supabase client with service role key.
        force_round: Override the date-based round computation (1-3).
        force_close: Close the auction after resolution regardless of round.

    Algorithm:
      1. Find all auctions with status = 'open'.
      2. Compute current_round = (today - opens_at).days + 1  (clamped 1-3).
         If force_round is set, use that instead.
      3. For each open auction:
         a. Fetch all active bids for current_round.
         b. Group by rider_id.
         c. Winning bid = highest amount; tiebreak = earliest placed_at.
         d. Mark winner as 'won', losers as 'outbid'.
         e. Create a contract with locked_salary = winner amount.
         f. Debit first month's salary from team treasury.
         g. Insert treasury_log entry with amount = -locked_salary.
         h. Mark rider.is_active_in_game = True.
      4. After round 3 (or if force_close): close the auction.

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
            if force_round is not None:
                current_round = force_round
            else:
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
                if current_round == 3 or force_close:
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

                    # Fetch rider name for logging
                    rider_name_resp = supabase.table("riders").select(
                        "full_name"
                    ).eq("id", rider_id).single().execute()
                    rider_name = rider_name_resp.data.get("full_name", rider_id) if rider_name_resp.data else rider_id

                    # Mark winner
                    supabase.table("auction_bids").update(
                        {"status": "won"}
                    ).eq("id", winner["id"]).execute()

                    # Mark losers
                    for loser in losers:
                        supabase.table("auction_bids").update(
                            {"status": "outbid"}
                        ).eq("id", loser["id"]).execute()

                    locked_salary = int(winner["amount"])

                    # Create contract with first salary marked as paid
                    supabase.table("contracts").insert({
                        "team_id": winner["team_id"],
                        "rider_id": rider_id,
                        "locked_salary": locked_salary,
                        "status": "active",
                        "purchased_at": datetime.utcnow().isoformat(),
                        "last_salary_paid": today.isoformat(),
                    }).execute()

                    # Debit first month's salary from team treasury
                    team_resp = supabase.table("teams").select(
                        "treasury"
                    ).eq("id", winner["team_id"]).single().execute()
                    current_treasury = team_resp.data["treasury"] if team_resp.data else 200000

                    new_treasury = current_treasury - locked_salary
                    supabase.table("teams").update({
                        "treasury": new_treasury,
                    }).eq("id", winner["team_id"]).execute()

                    # Log the treasury deduction
                    supabase.table("treasury_log").insert({
                        "team_id": winner["team_id"],
                        "type": "auction_purchase",
                        "amount": -locked_salary,
                        "description": f"Contrat Round {current_round} — {rider_name} — salaire {locked_salary} EUR/mois",
                        "rider_id": rider_id,
                    }).execute()

                    # Mark rider as active in the game
                    supabase.table("riders").update(
                        {"is_active_in_game": True}
                    ).eq("id", rider_id).execute()

                    logger.info(
                        f"  {rider_name}: won by team {winner['team_id']} "
                        f"at {locked_salary} EUR/mois (treasury: {current_treasury} → {new_treasury})"
                    )

                    resolved_count += 1

                except Exception as e:
                    logger.error(
                        f"Auction {auction_id} round {current_round} rider {rider_id}: {e}"
                    )

            # Close auction after final round or if forced
            if current_round == 3 or force_close:
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
