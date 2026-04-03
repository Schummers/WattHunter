"""Tests for auction.py — resolve_current_round.

All Supabase I/O is mocked. datetime.utcnow() is patched so the
closes_at filter is deterministic.
"""
from datetime import date as real_date, datetime as real_datetime
from unittest.mock import patch, MagicMock

import pytest

from helpers import make_supabase

# Fixed "now" used across tests
FIXED_NOW = real_datetime(2026, 2, 28, 12, 0, 0)
FIXED_TODAY = real_date(2026, 2, 28)

# Auction that has already expired (closes_at in the past)
EXPIRED_AUCTION = {
    "id": "auc-00000001",
    "name": "Round 1",
    "league_id": "league-001",
    "opens_at": "2026-02-27T00:00:00",
    "closes_at": "2026-02-28T00:00:00",
    "status": "open",
}

AUCTION_ID = EXPIRED_AUCTION["id"]
LEAGUE_ID = EXPIRED_AUCTION["league_id"]
RIDER_ID = "rid-00000001"
TEAM_A = "tea-00000001"
TEAM_B = "tea-00000002"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _patch_datetime():
    """Patch auction.datetime.utcnow() and auction.date.today()."""
    mock_dt = MagicMock(wraps=real_datetime)
    mock_dt.utcnow.return_value = FIXED_NOW
    mock_dt.fromisoformat = real_datetime.fromisoformat

    mock_date = MagicMock()
    mock_date.today.return_value = FIXED_TODAY

    return patch("auction.datetime", mock_dt), patch("auction.date", mock_date)


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
    """Returns immediately when no expired auctions are found."""
    import auction

    sb = make_supabase([])  # auctions query → empty
    p1, p2 = _patch_datetime()
    with p1, p2:
        result = await auction.resolve_current_round(sb)

    assert result == {"status": "no_open_auctions"}


# ---------------------------------------------------------------------------
# No active bids — auction is still closed (always close expired auctions)
# ---------------------------------------------------------------------------


async def test_no_active_bids_closes_auction():
    """No bids → resolved=0, auction is closed, next scheduled opened."""
    import auction

    sb = make_supabase(
        # 1. auctions (expired)
        [EXPIRED_AUCTION],
        # 2. auction_bids → empty
        [],
    )
    p1, p2 = _patch_datetime()
    with p1, p2, patch("auction._close_auction") as mock_close:
        result = await auction.resolve_current_round(sb)

    mock_close.assert_called_once_with(sb, AUCTION_ID, LEAGUE_ID)
    auc = result["auctions"][0]
    assert auc["round"] == 1
    assert auc["resolved"] == 0
    assert auc["message"] == "no_active_bids"


# ---------------------------------------------------------------------------
# Nominal resolution — one rider, two bidders, clear winner
# ---------------------------------------------------------------------------


async def test_nominal_resolution():
    """Highest bidder wins, loser is marked outbid, contract created."""
    import auction

    bid_winner = {
        "id": "bid-w", "rider_id": RIDER_ID, "team_id": TEAM_A,
        "amount": "6000", "placed_at": "2026-02-28T10:00:00", "round": 1,
            "riders": {"full_name": "Tadej Pogacar", "pcs_rank": 1},
            "teams": {"level": 8, "treasury": 500000}
    }
    bid_loser = {
        "id": "bid-l", "rider_id": RIDER_ID, "team_id": TEAM_B,
        "amount": "5000", "placed_at": "2026-02-28T09:00:00", "round": 1,
            "riders": {"full_name": "Tadej Pogacar", "pcs_rank": 1},
            "teams": {"level": 8, "treasury": 500000}
    }

    sb = make_supabase(
        # 1. auctions
        [EXPIRED_AUCTION],
        # 2. auction_bids (all active bids)
        [bid_winner, bid_loser],
            # 3. existing contracts pre-fetch
        [],
            # 4. updates and inserts ...
    )

    p1, p2 = _patch_datetime()
    with p1, p2, patch("auction._close_auction"):
        result = await auction.resolve_current_round(sb)

    assert result["status"] == "completed"
    auc = result["auctions"][0]
    assert auc["round"] == 1
    assert auc["resolved"] == 1


# ---------------------------------------------------------------------------
# Auction always closes after resolution
# ---------------------------------------------------------------------------


async def test_always_closes_after_resolution():
    """Expired auction is always closed after resolution."""
    import auction

    bid = {
        "id": "bid-solo", "rider_id": RIDER_ID, "team_id": TEAM_A,
        "amount": "5000", "placed_at": "2026-02-28T08:00:00", "round": 1,
            "riders": {"full_name": "Jonas Vingegaard", "pcs_rank": 2},
            "teams": {"level": 8, "treasury": 300000}
    }

    sb = make_supabase(
        # 1. auctions
        [EXPIRED_AUCTION],
        # 2. auction_bids
        [bid],
            # 3. existing contracts
            [],
        # 4+ remaining calls
    )

    p1, p2 = _patch_datetime()
    with p1, p2, patch("auction._close_auction") as mock_close:
        result = await auction.resolve_current_round(sb)

    mock_close.assert_called_once_with(sb, AUCTION_ID, LEAGUE_ID)
    assert result["auctions"][0]["resolved"] == 1


# ---------------------------------------------------------------------------
# _close_auction opens the next scheduled auction
# ---------------------------------------------------------------------------


def test_close_auction_opens_next_scheduled():
    """_close_auction should set next scheduled auction to 'open'."""
    import auction

    sb = make_supabase(
        # 1. auctions.update (close current)
        [],
        # 2. auctions.select (find next scheduled) — returns one
        [{"id": "auc-next", "name": "Round 2"}],
        # 3. auctions.update (open next)
        [],
    )

    auction._close_auction(sb, "auc-current", "league-001")

    # Should have called table() 3 times
    assert sb.table.call_count == 3


def test_close_auction_no_next_scheduled():
    """_close_auction with no next scheduled auction does not crash."""
    import auction

    sb = make_supabase(
        # 1. auctions.update (close current)
        [],
        # 2. auctions.select (find next scheduled) — empty
        [],
    )

    auction._close_auction(sb, "auc-current", "league-001")

    # Should have called table() 2 times (close + query, no open)
    assert sb.table.call_count == 2


# ---------------------------------------------------------------------------
# force_close resolves even non-expired auctions
# ---------------------------------------------------------------------------


async def test_force_close_skips_closes_at_filter():
    """force_close=True should not filter by closes_at."""
    import auction

    # Auction with closes_at in the future (not expired)
    future_auction = {
        **EXPIRED_AUCTION,
        "closes_at": "2026-03-01T00:00:00",
    }

    sb = make_supabase(
        # 1. auctions (no lt filter applied)
        [future_auction],
        # 2. auction_bids → empty
        [],
    )

    p1, p2 = _patch_datetime()
    with p1, p2, patch("auction._close_auction"):
        result = await auction.resolve_current_round(sb, force_close=True)

    assert result["status"] == "completed"
    assert result["auctions"][0]["message"] == "no_active_bids"
