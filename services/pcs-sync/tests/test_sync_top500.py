"""Tests for sync_top500 — scrapes PCS global ranking and upserts riders."""
from __future__ import annotations

from unittest.mock import MagicMock, AsyncMock, patch
import pytest


def test_rank_min_for_level():
    """Pool min values matching apps/web/lib/levels.ts poolMin."""
    from sync import rank_min_for_level, rank_max_for_level

    # rank_min_for_level is the canonical name
    assert rank_min_for_level(1) == 351
    assert rank_min_for_level(2) == 251
    assert rank_min_for_level(3) == 176
    assert rank_min_for_level(4) == 101
    assert rank_min_for_level(5) == 76
    assert rank_min_for_level(6) == 51
    assert rank_min_for_level(7) == 26
    assert rank_min_for_level(8) == 11
    assert rank_min_for_level(9) == 4
    assert rank_min_for_level(10) == 1

    # rank_max_for_level is an alias for backward compat
    assert rank_max_for_level(1) == rank_min_for_level(1)


def test_format_rider_name():
    """PCS names: 'DE KLEIJN Arvid' → 'Arvid De Kleijn'."""
    from sync import format_rider_name

    assert format_rider_name("POGAČAR Tadej") == "Tadej Pogačar"
    assert format_rider_name("DE KLEIJN Arvid") == "Arvid De Kleijn"
    assert format_rider_name("VAN DER HOORN Taco") == "Taco Van Der Hoorn"
    assert format_rider_name("Unknown") == "Unknown"
