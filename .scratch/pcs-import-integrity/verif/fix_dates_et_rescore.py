"""Repare race_results.race_date des etapes de la Vuelta 2026, puis rescore etape par etape.

Incident 2026-09-14 : cloture_vuelta.py a passe race_date="2026-09-13" aux 20
etapes. Le moteur calcule le cutoff des roles (11:00 le jour de l'etape) depuis
race_results.race_date, donc chaque etape a ete scoree avec les roles du 13/09.
Les vraies dates sont dans stage_profiles (verifiees contre Wikipedia :
etape 1 = 2026-08-22, etape 21 = 2026-09-13).

Ecrit en prod. Idempotent.
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


async def main() -> None:
    sb = get_supabase()

    print("=== 1. dates depuis stage_profiles ===")
    dates = {
        r["race_slug"]: r["race_date"]
        for r in sb.table("stage_profiles").select("race_slug,race_date")
        .like("race_slug", f"{RACE}/stage-%").execute().data
    }
    for st in STAGES:
        slug = f"{RACE}/stage-{st}"
        d = dates.get(slug)
        if not d:
            raise SystemExit(f"pas de date dans stage_profiles pour {slug}")
        res = sb.table("race_results").update({"race_date": d}).eq("race_slug", slug).execute()
        print(f"  stage-{st:<2} race_date -> {d}  ({len(res.data)} lignes)", flush=True)
    # gc / points / kom / youth restent au 2026-09-13 : c'est leur vraie date.

    print("\n=== 2. rescore, une etape par appel ===")
    for st in STAGES[:-1]:
        r = await calculate_daily_scores(sb, race_slugs=[f"{RACE}/stage-{st}"])
        print(f"  stage-{st:<2} teams={r.get('teams_processed')} errors={r.get('errors')}", flush=True)
    closing = [f"{RACE}/stage-21", f"{RACE}/gc", f"{RACE}/points", f"{RACE}/kom", f"{RACE}/youth"]
    r = await calculate_daily_scores(sb, race_slugs=closing)
    print(f"  cloture  teams={r.get('teams_processed')} errors={r.get('errors')}", flush=True)
    print("\nTERMINE")


asyncio.run(main())
