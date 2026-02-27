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

from email_notify import send_round_recap

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

            # Per-team email data: team_id -> {won: [...], lost: [...]}
            team_email_data: dict[str, dict] = {}

            for rider_id, rbids in rider_bids.items():
                try:
                    # Sort: highest amount first; tiebreak: earliest placed_at
                    rbids.sort(key=lambda b: (-int(b["amount"]), b["placed_at"]))
                    winner = rbids[0]
                    losers = rbids[1:]

                    # Fetch rider name for email recap
                    rider_name_resp = supabase.table("riders").select(
                        "full_name, monthly_salary"
                    ).eq("id", rider_id).single().execute()
                    rider_full_name = (
                        rider_name_resp.data.get("full_name", rider_id)
                        if rider_name_resp.data
                        else rider_id
                    )

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

                    new_treasury = 0
                    winner_team_name = winner["team_id"]
                    if team_resp.data:
                        new_treasury = team_resp.data["treasury"] - int(winner["amount"])
                        winner_team_name = team_resp.data.get("name", winner["team_id"])
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

                    # Accumulate winner email data
                    wdata = team_email_data.setdefault(
                        winner["team_id"],
                        {"won": [], "lost": [], "treasury": new_treasury, "team_name": winner_team_name},
                    )
                    wdata["won"].append({
                        "rider_name": rider_full_name,
                        "team": winner_team_name,
                        "amount": int(winner["amount"]),
                    })
                    wdata["treasury"] = new_treasury  # update after each deduction

                    # Accumulate loser email data
                    for loser in losers:
                        ldata = team_email_data.setdefault(
                            loser["team_id"],
                            {"won": [], "lost": [], "treasury": 0, "team_name": loser["team_id"]},
                        )
                        ldata["lost"].append({
                            "rider_name": rider_full_name,
                            "team": winner_team_name,
                            "my_amount": int(loser["amount"]),
                            "winning_amount": int(winner["amount"]),
                        })

                    resolved_count += 1

                except Exception as e:
                    logger.error(
                        f"Auction {auction_id} round {current_round} rider {rider_id}: {e}"
                    )

            # --- Send round recap emails ---
            _send_round_recap_emails(
                supabase=supabase,
                auction_name=auction.get("name", auction_id),
                current_round=current_round,
                team_email_data=team_email_data,
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


def _send_round_recap_emails(
    supabase: Client,
    auction_name: str,
    current_round: int,
    team_email_data: dict[str, dict],
) -> None:
    """
    Fetch player emails for all teams involved in this round and send recap emails.

    Looks up each team's user_id, then fetches the corresponding auth user email
    via the admin API.  Failures are logged and swallowed so resolution continues.
    """
    if not team_email_data:
        return

    team_ids = list(team_email_data.keys())

    try:
        teams_resp = supabase.table("teams").select(
            "id, name, user_id"
        ).in_("id", team_ids).execute()
    except Exception as e:
        logger.error("Failed to fetch team user_ids for email: %s", e)
        return

    for team in (teams_resp.data or []):
        team_id = team["id"]
        user_id = team.get("user_id")
        team_name = team.get("name", team_id)

        if not user_id:
            continue

        # Fetch auth user email via Supabase admin API
        try:
            user_resp = supabase.auth.admin.get_user_by_id(user_id)
            to_email = user_resp.user.email if user_resp and user_resp.user else None
            player_name = (
                (user_resp.user.user_metadata or {}).get("full_name")
                or to_email
                or team_name
            ) if user_resp and user_resp.user else team_name
        except Exception as e:
            logger.warning("Could not fetch email for user %s: %s", user_id, e)
            continue

        if not to_email:
            logger.warning("No email found for user %s (team %s)", user_id, team_id)
            continue

        edata = team_email_data.get(team_id, {})
        # Patch team_name into email data if it was not set during resolution
        if not edata.get("team_name"):
            edata["team_name"] = team_name

        try:
            send_round_recap(
                to_email=to_email,
                player_name=str(player_name),
                auction_name=auction_name,
                current_round=current_round,
                won=edata.get("won", []),
                lost=edata.get("lost", []),
                treasury=edata.get("treasury", 0),
            )
        except Exception as e:
            logger.error("send_round_recap failed for %s: %s", to_email, e)
