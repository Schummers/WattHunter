"""
Auction resolution job — WattHunter PCS Sync Microservice.

Each auction row represents one round. Resolution flow:
  - Only resolve auctions where closes_at < now() (expired).
  - Resolve ALL active bids for the expired auction.
  - Highest bid per rider wins; tiebreak = earliest placed_at.
  - Winner: status → 'won', contract created, first month salary debited.
  - Losers: status → 'outbid'.
  - After resolution: auction.status → 'closed', next scheduled auction → 'open'.

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

# Phase calendar (mirrors apps/web/lib/phases.ts AUCTION_PHASES)
# No gaps — each phase starts with 3 auction round days, then racing.
_PHASES = [
    (1, 1, 15, 3, 1),   # Season Start: Jan 15 – Mar 1
    (2, 3, 2, 4, 1),    # Classics Part 1: Mar 2 – Apr 1
    (3, 4, 2, 5, 1),    # Classics Part 2: Apr 2 – May 1
    (4, 5, 2, 6, 1),    # Giro d'Italia: May 2 – Jun 1
    (5, 6, 2, 7, 1),    # Pre-Tour: Jun 2 – Jul 1
    (6, 7, 2, 7, 27),   # Tour de France: Jul 2 – Jul 27
    (7, 7, 28, 8, 18),  # Post-Tour: Jul 28 – Aug 18
    (8, 8, 19, 9, 15),  # La Vuelta: Aug 19 – Sep 15
    (9, 9, 16, 10, 18), # End of Season: Sep 16 – Oct 18
]

def _get_current_phase_id(d: date | None = None) -> int:
    """Return current phase ID (1-9) based on calendar date."""
    from datetime import date as real_date
    if d is None:
        d = real_date.today()
    year = d.year
    for pid, sm, sd, em, ed in _PHASES:
        start = real_date(year, sm, sd)
        end = real_date(year, em, ed)
        if start <= d <= end:
            return pid
    return _PHASES[-1][0]  # fallback: last phase


def _log_treasury_debit(
    supabase: Client,
    team_id: str,
    amount: int,
    description: str,
    rider_id: str,
) -> None:
    """Insert a treasury_log entry for a debit. All treasury_log writes go through this helper."""
    supabase.table("treasury_log").insert({
        "team_id": team_id,
        "type": "auction_purchase",
        "amount": -amount,
        "description": description,
        "rider_id": rider_id,
    }).execute()


async def resolve_current_round(
    supabase: Client,
    force_round: int | None = None,
    force_close: bool = False,
) -> dict:
    """
    Resolve expired auctions.

    Args:
        supabase: Supabase client with service role key.
        force_round: Ignored (kept for CLI compat). Each auction row = 1 round.
        force_close: Close the auction after resolution regardless of expiry.

    Algorithm:
      1. Find all auctions with status = 'open' AND closes_at < now().
         If force_close, find all open auctions regardless of closes_at.
      2. For each expired auction:
         a. Fetch all active bids.
         b. Group by rider_id.
         c. Winning bid = highest amount; tiebreak = earliest placed_at.
         d. Mark winner as 'won', losers as 'outbid'.
         e. Create a contract with locked_salary = winner amount.
         f. Debit first month's salary from team treasury.
         g. Insert treasury_log entry with amount = -locked_salary.
         h. Mark rider.is_active_in_game = True.
      3. Close the auction and open the next scheduled one.

    Returns a summary dict with per-auction results.
    """
    today = date.today()
    now_iso = datetime.utcnow().isoformat()

    # --- Fetch expired open auctions ---
    query = supabase.table("auctions").select("*").eq("status", "open")
    if not force_close:
        query = query.lt("closes_at", now_iso)
    auctions_resp = query.execute()

    if not auctions_resp.data:
        return {"status": "no_open_auctions"}

    results = []

    for auction in auctions_resp.data:
        auction_id = auction["id"]
        league_id = auction.get("league_id")
        current_round = 1  # Each auction row = 1 round

        try:
            # --- Fetch ALL active bids for this auction ---
            bids_resp = supabase.table("auction_bids").select(
                "id, rider_id, team_id, amount, placed_at, round"
            ).eq("auction_id", auction_id).eq("status", "active").execute()

            if not bids_resp.data:
                logger.info(
                    f"Auction {auction_id}: no active bids — closing"
                )
                _close_auction(supabase, auction_id, league_id)
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

                    # Level gating — verify rider is accessible at team's level
                    from sync import rank_max_for_level
                    team_data = supabase.table("teams").select(
                        "level"
                    ).eq("id", winner["team_id"]).single().execute()
                    rider_data = supabase.table("riders").select(
                        "pcs_rank"
                    ).eq("id", rider_id).single().execute()

                    team_level = team_data.data.get("level", 1) if team_data.data else 1
                    rider_pcs_rank = rider_data.data.get("pcs_rank") if rider_data.data else None

                    if rider_pcs_rank is not None:
                        pool_min = rank_max_for_level(team_level)
                        if rider_pcs_rank < pool_min:
                            logger.warning(
                                f"  {rider_name}: PCS rank {rider_pcs_rank} below pool min {pool_min} "
                                f"for team level {team_level} — cancelling all bids"
                            )
                            supabase.table("auction_bids").update(
                                {"status": "cancelled"}
                            ).eq("id", winner["id"]).execute()
                            for loser in losers:
                                supabase.table("auction_bids").update(
                                    {"status": "cancelled"}
                                ).eq("id", loser["id"]).execute()
                            continue

                    # Check for existing active contract for this rider in this league
                    existing = supabase.table("contracts").select("id").eq(
                        "rider_id", rider_id
                    ).eq("league_id", league_id).in_(
                        "status", ["active", "notice"]
                    ).execute()

                    if existing.data:
                        logger.warning(
                            f"  {rider_name}: already has active contract in league — skipping"
                        )
                        supabase.table("auction_bids").update(
                            {"status": "cancelled"}
                        ).eq("id", winner["id"]).execute()
                        for loser in losers:
                            supabase.table("auction_bids").update(
                                {"status": "cancelled"}
                            ).eq("id", loser["id"]).execute()
                        continue

                    # Create contract with first salary marked as paid
                    supabase.table("contracts").insert({
                        "team_id": winner["team_id"],
                        "rider_id": rider_id,
                        "league_id": league_id,
                        "locked_salary": locked_salary,
                        "status": "active",
                        "purchased_at": datetime.utcnow().isoformat(),
                        "last_salary_paid": today.isoformat(),
                        "phase_recruited_id": _get_current_phase_id(today),
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
                    _log_treasury_debit(
                        supabase,
                        team_id=winner["team_id"],
                        amount=locked_salary,
                        description=f"Auction {auction.get('name', '')} — {rider_name} — salary {locked_salary} EUR/month",
                        rider_id=rider_id,
                    )

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
                        f"Auction {auction_id} rider {rider_id}: {e}"
                    )

            # Always close an expired auction after resolution
            _close_auction(supabase, auction_id, league_id)

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


def _close_auction(supabase: Client, auction_id: str, league_id: str | None = None) -> None:
    """Close an auction and open the next scheduled one in the same league."""
    supabase.table("auctions").update({
        "status": "closed",
        "resolved_at": datetime.utcnow().isoformat(),
    }).eq("id", auction_id).execute()
    logger.info(f"Auction {auction_id} closed.")

    # Open the next scheduled auction in the same league
    if league_id:
        next_auction = supabase.table("auctions").select("id, name").eq(
            "league_id", league_id
        ).eq("status", "scheduled").order("opens_at").limit(1).execute()

        if next_auction.data:
            next_id = next_auction.data[0]["id"]
            next_name = next_auction.data[0]["name"]
            supabase.table("auctions").update({"status": "open"}).eq("id", next_id).execute()
            logger.info(f"Next auction {next_name} ({next_id}) opened.")
