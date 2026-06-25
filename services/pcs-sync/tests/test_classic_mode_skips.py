"""Tests for classic-mode league detection and skip logic.

Classic-mode leagues have no sponsors and no sponsor goals.
The sponsor_bonus and goal_evaluator pipelines must skip them.
"""
from __future__ import annotations

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from sponsor_bonus import is_classic_league


def test_classic_league_detected():
    assert is_classic_league({"mode": "classic"}) is True
    assert is_classic_league({"mode": "manager"}) is False
    assert is_classic_league({}) is False


def test_classic_league_none_mode():
    assert is_classic_league({"mode": None}) is False


def test_classic_league_other_modes():
    assert is_classic_league({"mode": "draft"}) is False
    assert is_classic_league({"mode": ""}) is False
