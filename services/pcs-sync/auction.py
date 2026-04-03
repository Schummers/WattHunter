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
_PHASES = [
    (1, 1, 15, 3, 1),   # Season Start: Jan 15 – Mar 1
    (2, 3, 5, 4, 1),    # Classics Part 1: Mar 5 – Apr 1
    (3, 4, 5, 5, 1),    # Classics Part 2: Apr 5 – May 1
    (4, 5, 5, 6, 1),    # Giro d'Italia: May 5 – Jun 1
    (5, 6, 5, 7, 1),    # Pre-Tour: Jun 5 – Jul 1
    (6, 7, 4, 7, 27),   # Tour de France: Jul 4 – Jul 27
    (7, 7, 31, 8, 18),  # Post-Tour: Jul 31 – Aug 18
    (8, 8, 22, 9, 15),  # La Vuelta: Aug 22 – Sep 15
    (9, 9, 19, 10, 18), # End of Season: Sep 19 – Oct 18
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
                "id, rider_id, team_id, amount, placed_at, round, "
                "riders(full_name, pcs_rank), teams(level, treasury)"
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

            # Pre-fetch existing contracts in this league for these riders to avoid N+1 query
            rider_ids = list(rider_bids.keys())
            existing_contracts_resp = supabase.table("contracts").select("rider_id").eq(
                "league_id", league_id
            ).in_("rider_id", rider_ids).in_("status", ["active", "notice"]).execute()
            riders_with_contracts = {c["rider_id"] for c in (existing_contracts_resp.data or [])}

            resolved_count = 0

            won_ids = []
            outbid_ids = []
            cancelled_ids = []

            new_contracts = []
            treasury_logs = []

            # Map of team_id -> team_treasury (we'll update memory and batch update later)
            team_treasuries = {}
            # Map of rider_id -> bool to mark as active
            activated_riders = set()

            from sync import rank_max_for_level

            for rider_id, rbids in rider_bids.items():
                try:
                    # Sort: highest amount first; tiebreak: earliest placed_at
                    rbids.sort(key=lambda b: (-int(b["amount"]), b["placed_at"]))
                    winner = rbids[0]
                    losers = rbids[1:]

                    rider_info = winner.get("riders") or {}
                    team_info = winner.get("teams") or {}

                    rider_name = rider_info.get("full_name") or rider_id
                    rider_pcs_rank = rider_info.get("pcs_rank")
                    team_level = team_info.get("level") or 1

                    locked_salary = int(winner["amount"])
                    team_id = winner["team_id"]

                    loser_ids = [l["id"] for l in losers]

                    # Level gating — verify rider is accessible at team's level
                    if rider_pcs_rank is not None:
                        pool_min = rank_max_for_level(team_level)
                        if rider_pcs_rank < pool_min:
                            logger.warning(
                                f"  {rider_name}: PCS rank {rider_pcs_rank} below pool min {pool_min} "
                                f"for team level {team_level} — cancelling all bids"
                            )
                            cancelled_ids.append(winner["id"])
                            cancelled_ids.extend(loser_ids)
                            continue

                    # Check for existing active contract for this rider in this league
                    if rider_id in riders_with_contracts:
                        logger.warning(
                            f"  {rider_name}: already has active contract in league — skipping"
                        )
                        cancelled_ids.append(winner["id"])
                        cancelled_ids.extend(loser_ids)
                        continue

                    # Valid winner
                    won_ids.append(winner["id"])
                    outbid_ids.extend(loser_ids)

                    # Prepare contract insertion
                    new_contracts.append({
                        "team_id": team_id,
                        "rider_id": rider_id,
                        "league_id": league_id,
                        "locked_salary": locked_salary,
                        "status": "active",
                        "purchased_at": datetime.utcnow().isoformat(),
                        "last_salary_paid": today.isoformat(),
                        "phase_recruited_id": _get_current_phase_id(today),
                    })

                    # Calculate new treasury
                    current_treasury = team_treasuries.get(team_id, team_info.get("treasury", 200000))
                    new_treasury = current_treasury - locked_salary
                    team_treasuries[team_id] = new_treasury

                    # Prepare treasury log
                    treasury_logs.append({
                        "team_id": team_id,
                        "type": "auction_purchase",
                        "amount": -locked_salary,
                        "description": f"Auction {auction.get('name', '')} — {rider_name} — salary {locked_salary} EUR/month",
                        "rider_id": rider_id,
                    })

                    activated_riders.add(rider_id)

                    logger.info(
                        f"  {rider_name}: won by team {team_id} "
                        f"at {locked_salary} EUR/mois (treasury: {current_treasury} → {new_treasury})"
                    )

                    resolved_count += 1

                except Exception as e:
                    logger.error(
                        f"Auction {auction_id} rider {rider_id}: {e}"
                    )

            # --- Bulk Execute Updates and Inserts ---
            if won_ids:
                supabase.table("auction_bids").update({"status": "won"}).in_("id", won_ids).execute()
            if outbid_ids:
                supabase.table("auction_bids").update({"status": "outbid"}).in_("id", outbid_ids).execute()
            if cancelled_ids:
                supabase.table("auction_bids").update({"status": "cancelled"}).in_("id", cancelled_ids).execute()

            if new_contracts:
                supabase.table("contracts").insert(new_contracts).execute()

            for t_id, new_t_val in team_treasuries.items():
                supabase.table("teams").update({"treasury": new_t_val}).eq("id", t_id).execute()

            if treasury_logs:
                supabase.table("treasury_log").insert(treasury_logs).execute()

            if activated_riders:
                # We can't do a bulk update with different values easily, but here they all get True
                # Actually, Supabase doesn't support bulk update with 'in_' nicely if the list is too long, but it's fine for our size.
                # However, python client for supabase supports updating by id using in_
                supabase.table("riders").update({"is_active_in_game": True}).in_("id", list(activated_riders)).execute()

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
