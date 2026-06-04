"""One-shot rescore for the Rubio (Muscat) + Arrieta (Peejee) XP backfill.

Re-runs calculate_daily_scores() directly (NO scraping / BrowserSession) for the
Giro 2026 stages affected by migration 20260604020000. The migration deposits the
inputs (squad membership, role assignments, missing GC result); this script turns
them into XP via the deterministic, idempotent scoring pipeline.

calculate_daily_scores derives its 11:00-CET cutoff from the FIRST slug's race_date,
so slugs must be grouped by shared date (one stage per call; finals gc+kom share 05-31).

Run locally:  cd services/pcs-sync && .venv/bin/python scripts/rescore_rubio_arrieta_giro.py
"""
from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

from dotenv import load_dotenv

_PCS_DIR = Path(__file__).resolve().parents[1]
# sync.py reads SUPABASE_* from os.getenv at import time, so load the .env first.
load_dotenv(_PCS_DIR / ".env")
sys.path.append(str(_PCS_DIR))
from scoring import calculate_daily_scores  # noqa: E402
from sync import get_supabase  # noqa: E402

GIRO = "race/giro-d-italia/2026"

# Each inner list shares a single race_date (required by the cutoff logic).
RESCORE_GROUPS: list[list[str]] = [
    [f"{GIRO}/stage-5"],              # Arrieta (Peejee) stage win -> +80
    [f"{GIRO}/stage-14"],             # Rubio 5 pts -> +7.5
    [f"{GIRO}/stage-17"],             # Rubio 18 pts -> +27
    [f"{GIRO}/stage-19"],             # Rubio 8 pts -> +12, KOM daily 3rd -> +2
    [f"{GIRO}/stage-20"],             # Rubio 1 pt -> +1.5, KOM daily 3rd -> +2
    [f"{GIRO}/gc", f"{GIRO}/kom"],    # finals (05-31): GC 23rd -> +55, KOM final 3rd -> +20
]


async def main() -> None:
    supabase = get_supabase()
    for group in RESCORE_GROUPS:
        print(f"\n--- Rescoring {group} ---")
        result = await calculate_daily_scores(supabase, race_slugs=group)
        print(json.dumps(result, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
