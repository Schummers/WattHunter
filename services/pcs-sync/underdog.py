"""Underdog eligibility recompute (Spec B B0).

Recomputes teams.underdog_eligible + the underdog_eligibility snapshot for every
league, by calling the recompute_underdog_eligibility RPC. Run at each phase/GT start.
"""
from __future__ import annotations


def recompute_eligibility(supabase, phase_id: int, year: int) -> dict:
    """Call the recompute RPC for the given phase + year. Returns the RPC payload."""
    resp = supabase.rpc(
        "recompute_underdog_eligibility",
        {"p_phase_id": phase_id, "p_year": year},
    ).execute()
    return resp.data
