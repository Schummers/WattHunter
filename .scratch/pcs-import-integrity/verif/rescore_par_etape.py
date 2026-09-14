"""Rescore de la Vuelta 2026, UNE etape par appel, comme la prod l'a fait au jour le jour.

Raison : calculate_daily_scores calcule un seul cutoff de roles/squad par appel,
a partir de la date du premier slug (scoring.py, "all slugs in one call share a
date"). Passer les 20 etapes d'un coup fige les roles d'un seul jour sur tout
le Grand Tour. Ecrit en prod (idempotent par slug).
"""
from __future__ import annotations
import asyncio, sys
from pathlib import Path
HERE = Path(__file__).resolve(); PCS = HERE.parents[3] / "services" / "pcs-sync"
sys.path.insert(0, str(PCS))
from dotenv import load_dotenv; load_dotenv(PCS / ".env")
from sync import get_supabase
from scoring import calculate_daily_scores

RACE = "race/vuelta-a-espana/2026"
STAGES = [s for s in range(1, 22) if s != 3]

async def main():
    sb = get_supabase()
    for st in STAGES[:-1]:
        r = await calculate_daily_scores(sb, race_slugs=[f"{RACE}/stage-{st}"])
        print(f"stage-{st:<2} teams={r.get('teams_processed')} errors={r.get('errors')}", flush=True)
    # Cloture : les 5 slugs partagent la date de l'etape 21 (comme le runbook TdF).
    closing = [f"{RACE}/stage-21", f"{RACE}/gc", f"{RACE}/points", f"{RACE}/kom", f"{RACE}/youth"]
    r = await calculate_daily_scores(sb, race_slugs=closing)
    print(f"cloture  teams={r.get('teams_processed')} errors={r.get('errors')}", flush=True)

asyncio.run(main())
