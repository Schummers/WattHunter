"""One-shot rescore for Tour de France 2026 — Stage 1 (TTT scored via GC).

Stage 1 is a team time trial. Per a one-time playtest decision, the GC standing after
stage 1 is used as the individual stage-1 result (deposited by migration
20260705000000_tdf2026_stage1_gc_as_result.sql) and scored as a normal GT stage flagged
is_itt=TRUE. This script turns those inputs into XP via the deterministic scoring pipeline.

role_cutoff freezes squad membership + role assignments to the stage-1 state
(2026-07-05T00:00:00Z): all draft roles set on 2026-07-04 count, but the day-2 role edits
made on 2026-07-05 do NOT retroactively rescore stage 1.

No sponsor goals / base bonuses are evaluated here (XP only), matching the stage's intent.

Run locally:  cd services/pcs-sync && .venv/bin/python scripts/rescore_tdf2026_stage1.py
"""
from __future__ import annotations

import asyncio
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

_PCS_DIR = Path(__file__).resolve().parents[1]
load_dotenv(_PCS_DIR / ".env")
sys.path.append(str(_PCS_DIR))
from scoring import calculate_daily_scores  # noqa: E402
from sync import get_supabase  # noqa: E402

SLUG = "race/tour-de-france/2026/stage-1"
# Freeze squad + roles at end of stage-1 day (excludes 2026-07-05 day-2 role edits).
ROLE_CUTOFF = datetime(2026, 7, 5, 0, 0, 0, tzinfo=timezone.utc)


async def main() -> None:
    supabase = get_supabase()
    result = await calculate_daily_scores(
        supabase, race_slugs=[SLUG], role_cutoff=ROLE_CUTOFF
    )
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
