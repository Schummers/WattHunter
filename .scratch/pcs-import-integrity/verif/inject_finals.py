"""Injection manuelle des classements finaux KOM/Youth Vuelta 2026.
Fallback documenté (precedent: cutover Giro 2026-06-03) : PCS sert la page
stage-21 sur .../kom et .../youth, le scraper ne peut pas les lire.
Donnees extraites du DOM PCS (rank + slug coureur), pas d'OCR.
Dry-run par defaut ; --apply pour ecrire."""
import json, sys
from pathlib import Path
from dotenv import load_dotenv
P=Path("/Users/jonathanschummers/AI OS/cycling/watthunter/services/pcs-sync")
load_dotenv(P/".env"); sys.path.append(str(P))
from db_utils import _fetch_all
from sync import get_supabase

SC=Path(__file__).parent
PARENT="race/vuelta-a-espana/2026"; DATE="2026-09-13"
APPLY="--apply" in sys.argv
data=json.load(open(SC.parent/"finals-kom-youth.json"))
sb=get_supabase()
riders=_fetch_all(lambda: sb.table("riders").select("id,pcs_slug,full_name"))
by_slug={r["pcs_slug"]: r for r in riders}
total=0
for ctype in ("kom","youth"):
    slug=f"{PARENT}/{ctype}"
    mapped=[]; unmapped=[]
    for rank,rs in data[ctype]:
        r=by_slug.get(rs)
        (mapped if r else unmapped).append((rank,rs,r))
    print(f"\n=== {ctype}: {len(data[ctype])} lignes PCS -> {len(mapped)} mappees, {len(unmapped)} hors pool")
    for rank,rs,_ in unmapped: print(f"    hors pool  #{rank:<3} {rs}")
    for rank,rs,r in mapped[:5]: print(f"    #{rank:<3} {r['full_name']}")
    if APPLY:
        for rank,rs,r in mapped:
            sb.table("gt_final_classifications").upsert(
                {"race_slug":slug,"classification_type":ctype,"rider_id":r["id"],
                 "rank":int(rank),"race_date":DATE},
                on_conflict="race_slug,rider_id").execute()
        total+=len(mapped)
print("\nAPPLIED rows:" if APPLY else "\nDRY-RUN (rien ecrit). rows would be:", total or sum(len([1 for _,rs in data[c] if rs in by_slug]) for c in ("kom","youth")))
