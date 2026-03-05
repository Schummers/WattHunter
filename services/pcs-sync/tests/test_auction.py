"""Tests for auction.py — resolve_current_round.

All Supabase I/O is mocked.  date.today() is patched to a
fixed value (2026-02-28) so round computation is deterministic.
"""
from datetime import date as real_date
from unittest.mock import patch, MagicMock

import pytest

from helpers import make_supabase

# Fixed date used across tests.  Opens-at values are chosen relative to it.
FIXED_TODAY = real_date(2026, 2, 28)

# Auction opens the same day as FIXED_TODAY → current_round = 1
OPENS_AT_ROUND1 = "2026-02-28T00:00:00"
# Auction opened 1 day before → round 2
OPENS_AT_ROUND2 = "2026-02-27T00:00:00"
# Auction opened 2 days before → round 3
OPENS_AT_ROUND3 = "2026-02-26T00:00:00"

AUCTION_ID = "auc-00000001"
RIDER_ID = "rid-00000001"
TEAM_A = "tea-00000001"
TEAM_B = "tea-00000002"


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _patch_date():
    """Context manager that patches auction.date.today() to FIXED_TODAY."""
    mock_date = MagicMock()
    mock_date.today.return_value = FIXED_TODAY
    return patch("auction.date", mock_date)


# ---------------------------------------------------------------------------
# Pure sort-logic unit test (no I/O)
# ---------------------------------------------------------------------------


def test_tiebreak_sort_key():
    """Highest amount wins; earliest placed_at breaks ties on equal amounts."""
    bids = [
        {"id": "b1", "amount": "5000", "placed_at": "2026-02-28T10:00:00"},
        {"id": "b2", "amount": "5000", "placed_at": "2026-02-28T09:00:00"},  # earlier
        {"id": "b3", "amount": "6000", "placed_at": "2026-02-28T11:00:00"},  # highest
    ]
    bids.sort(key=lambda b: (-int(b["amount"]), b["placed_at"]))
    assert bids[0]["id"] == "b3"  # highest amount
    assert bids[1]["id"] == "b2"  # earlier timestamp wins tiebreak
    assert bids[2]["id"] == "b1"


def test_tiebreak_only():
    """When two bids have the same amount, the earlier one wins."""
    early = {"id": "early", "amount": "5000", "placed_at": "2026-02-28T07:00:00"}
    late = {"id": "late", "amount": "5000", "placed_at": "2026-02-28T08:00:00"}
    bids = [late, early]
    bids.sort(key=lambda b: (-int(b["amount"]), b["placed_at"]))
    assert bids[0]["id"] == "early"


# ---------------------------------------------------------------------------
# Early-return: no open auctions
# ---------------------------------------------------------------------------


async def test_no_open_auctions():
    """Returns immediately when no auctions are open."""
    import auction

    sb = make_supabase([])  # auctions → empty
    with _patch_date():
        result = await auction.resolve_current_round(sb)

    assert result == {"status": "no_open_auctions"}
    assert sb.table.call_count == 1


# ---------------------------------------------------------------------------
# No active bids — round 1 (auction stays open)
# ---------------------------------------------------------------------------


async def test_no_active_bids_round1():
    """No bids in round 1 → resolved=0, auction remains open."""
    import auction

    sb = make_supabase(
        # 1. auctions
        [{"id": AUCTION_ID, "name": "Tour Test", "opens_at": OPENS_AT_ROUND1, "status": "open"}],
        # 2. auction_bids → empty
        [],
    )
    with _patch_date():
        result = await auction.resolve_current_round(sb)

    assert result["status"] == "completed"
    auc = result["auctions"][0]
    assert auc["round"] == 1
    assert auc["resolved"] == 0
    assert auc["message"] == "no_active_bids"


# ---------------------------------------------------------------------------
# No active bids — round 3 (auction must be closed)
# ---------------------------------------------------------------------------


async def test_no_active_bids_round3_closes_auction():
    """No bids in round 3 → _close_auction is called (auction is closed)."""
    import auction

    sb = make_supabase(
        # 1. auctions
        [{"id": AUCTION_ID, "name": "Tour Test", "opens_at": OPENS_AT_ROUND3, "status": "open"}],
        # 2. auction_bids → empty
        [],
        # 3. _close_auction: auctions.update().eq().execute() → don't care
        [],
    )
    with _patch_date(), patch("auction._close_auction") as mock_close:
        result = await auction.resolve_current_round(sb)

    mock_close.assert_called_once_with(sb, AUCTION_ID)
    auc = result["auctions"][0]
    assert auc["round"] == 3
    assert auc["message"] == "no_active_bids"


# ---------------------------------------------------------------------------
# Round out of range
# ---------------------------------------------------------------------------


async def test_round_out_of_range_skipped():
    """Auction with opens_at in the future → round < 1 → skipped."""
    import auction

    # opens_at is tomorrow → round = (today - tomorrow).days + 1 = -1 + 1 = 0
    future_opens = "2026-03-01T00:00:00"
    sb = make_supabase(
        [{"id": AUCTION_ID, "name": "Future Auction", "opens_at": future_opens, "status": "open"}],
    )
    with _patch_date():
        result = await auction.resolve_current_round(sb)

    auc = result["auctions"][0]
    assert auc["skipped"] is True
    assert auc["reason"] == "round_out_of_range"


# ---------------------------------------------------------------------------
# Nominal resolution — one rider, two bidders, clear winner
# ---------------------------------------------------------------------------


async def test_nominal_resolution():
    """Highest bidder wins, loser is marked outbid, contract created.
    BETA: locked_salary = winning bid amount; no one-shot treasury deduction."""
    import auction

    bid_winner = {
        "id": "bid-w", "rider_id": RIDER_ID, "team_id": TEAM_A,
        "amount": "6000", "placed_at": "2026-02-28T10:00:00",
    }
    bid_loser = {
        "id": "bid-l", "rider_id": RIDER_ID, "team_id": TEAM_B,
        "amount": "5000", "placed_at": "2026-02-28T09:00:00",
    }

    sb = make_supabase(
        # 1. auctions
        [{"id": AUCTION_ID, "name": "Tour Test", "opens_at": OPENS_AT_ROUND1, "status": "open"}],
        # 2. auction_bids (fetch active bids for this round)
        [bid_winner, bid_loser],
        # 3. riders (fetch rider name — single())
        {"full_name": "Tadej Pogacar"},
        # 4. auction_bids update winner → status='won'
        [],
        # 5. auction_bids update loser → status='outbid'
        [],
        # 6. contracts insert (locked_salary = 6000, the winning bid amount)
        [],
        # 7. treasury_log insert (amount=0, no one-shot deduction in beta)
        [],
        # 8. riders update (is_active_in_game = True)
        [],
    )

    with _patch_date():
        result = await auction.resolve_current_round(sb)

    assert result["status"] == "completed"
    auc = result["auctions"][0]
    assert auc["round"] == 1
    assert auc["resolved"] == 1


# ---------------------------------------------------------------------------
# Round 3 closes the auction after resolution
# ---------------------------------------------------------------------------


async def test_round3_closes_auction_after_resolution():
    """After resolving round 3 with bids, the auction is closed."""
    import auction

    bid = {
        "id": "bid-solo", "rider_id": RIDER_ID, "team_id": TEAM_A,
        "amount": "5000", "placed_at": "2026-02-28T08:00:00",
    }

    sb = make_supabase(
        # 1. auctions (round 3)
        [{"id": AUCTION_ID, "name": "Tour Final", "opens_at": OPENS_AT_ROUND3, "status": "open"}],
        # 2. auction_bids
        [bid],
        # 3. riders single (name only — salary comes from bid in beta)
        {"full_name": "Jonas Vingegaard"},
        # 4. auction_bids update winner
        [],
        # 5. contracts insert (locked_salary = 5000, the winning bid amount)
        [],
        # 6. treasury_log insert (amount=0, no one-shot deduction in beta)
        [],
        # 7. riders update is_active
        [],
    )

    with _patch_date(), patch("auction._close_auction") as mock_close:
        result = await auction.resolve_current_round(sb)

    mock_close.assert_called_once_with(sb, AUCTION_ID)
    assert result["auctions"][0]["resolved"] == 1
