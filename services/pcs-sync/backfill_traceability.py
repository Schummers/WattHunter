"""Recompute gt_role_mult and gt_classif_bonus for existing rider_xp_daily rows.
Idempotent: safe to run multiple times. Does NOT change xp_gained.

USAGE: only needed if scoring ran BEFORE the GT-tactics deployment that
populates the new traceability columns. In a fresh deployment this script
is a no-op.

This is a stub — implementation deferred until backfill is actually
required. The intended approach:

1. Fetch rider_xp_daily rows where gt_role_mult=1.0 AND gt_classif_bonus=0
2. For each row, look up the role at the time of scoring from gt_role_assignments
   (latest applied_at <= the stage cutoff time, or use the rider's effective
   role for that GT phase)
3. Recompute role_mult using scoring.py helpers (factor out of scoring.py
   into a shared module first if needed)
4. Recompute classif_bonus from gt_daily_classifications
5. UPDATE the row (preserving xp_gained — only the breakdown columns change)

When implementing, re-export the role-mult and classif-bonus helpers from
scoring.py into a shared module (e.g., gt_scoring_helpers.py) so this
script and the main pipeline both import from a single source of truth.
"""
from __future__ import annotations
import sys


def main() -> int:
    print("backfill_traceability: stub — implementation deferred.")
    print("Run only after a deployment where rider_xp_daily rows were scored")
    print("before the GT-tactics traceability columns were populated.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
