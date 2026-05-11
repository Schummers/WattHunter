from __future__ import annotations
import pytest
from resolve_gt_rescue import pick_winners


def _bid(bid_id, rider_id, amount, created_at="2026-05-11T10:00:00"):
    return {"id": bid_id, "rider_id": rider_id, "amount": amount, "created_at": created_at, "team_id": "t1"}


def test_single_bid_per_rider_wins():
    bids = [_bid("b1", "r1", 10000), _bid("b2", "r2", 8000)]
    winners, losers = pick_winners(bids)
    assert len(winners) == 2
    assert len(losers) == 0
    assert {w["id"] for w in winners} == {"b1", "b2"}


def test_highest_amount_wins():
    bids = [
        _bid("b1", "r1", 15000),  # winner
        _bid("b2", "r1", 10000),  # loser
        _bid("b3", "r1", 8000),   # loser
    ]
    winners, losers = pick_winners(bids)
    assert len(winners) == 1
    assert winners[0]["id"] == "b1"
    assert len(losers) == 2


def test_tiebreak_earliest_created_at():
    bids = [
        _bid("b1", "r1", 10000, "2026-05-11T09:00:00"),  # earlier → wins
        _bid("b2", "r1", 10000, "2026-05-11T11:00:00"),  # later → loses
    ]
    # bids is already sorted amount DESC, created_at ASC (same amount, b1 is earlier)
    winners, losers = pick_winners(bids)
    assert winners[0]["id"] == "b1"
    assert len(losers) == 1


def test_mixed_riders():
    bids = [
        _bid("b1", "r1", 20000),   # r1 winner
        _bid("b2", "r2", 15000),   # r2 winner
        _bid("b3", "r1", 12000),   # r1 loser
        _bid("b4", "r2", 10000),   # r2 loser
    ]
    winners, losers = pick_winners(bids)
    assert {w["id"] for w in winners} == {"b1", "b2"}
    assert {l["id"] for l in losers} == {"b3", "b4"}


def test_empty_bids():
    winners, losers = pick_winners([])
    assert winners == []
    assert losers == []
