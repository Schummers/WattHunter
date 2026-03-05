"""Tests for sync_top500 — scrapes PCS global ranking and upserts riders."""
from __future__ import annotations

from unittest.mock import MagicMock, AsyncMock, patch
import pytest


def test_rank_max_for_level():
    """Level thresholds: L1=500, L5=150, L10=10."""
    from sync import rank_max_for_level

    assert rank_max_for_level(1) == 500
    assert rank_max_for_level(2) == 400
    assert rank_max_for_level(3) == 300
    assert rank_max_for_level(4) == 200
    assert rank_max_for_level(5) == 150
    assert rank_max_for_level(6) == 100
    assert rank_max_for_level(7) == 75
    assert rank_max_for_level(8) == 50
    assert rank_max_for_level(9) == 25
    assert rank_max_for_level(10) == 10


def test_format_rider_name():
    """PCS names: 'DE KLEIJN Arvid' → 'Arvid De Kleijn'."""
    from sync import format_rider_name

    assert format_rider_name("POGAČAR Tadej") == "Tadej Pogačar"
    assert format_rider_name("DE KLEIJN Arvid") == "Arvid De Kleijn"
    assert format_rider_name("VAN DER HOORN Taco") == "Taco Van Der Hoorn"
    assert format_rider_name("Unknown") == "Unknown"
