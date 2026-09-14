import sys,unicodedata
from pathlib import Path
from dotenv import load_dotenv
P=Path("/Users/jonathanschummers/AI OS/cycling/watthunter/services/pcs-sync")
load_dotenv(P/".env"); sys.path.append(str(P)); sys.path.append(str(Path(__file__).parent))
from db_utils import _fetch_all
from sync import get_supabase
from expected import EXPECTED
def norm(s):
    s=(s or "").lower()
    for a,b in (("ø","o"),("ł","l"),("đ","d"),("ß","ss"),("æ","ae")): s=s.replace(a,b)
    s=unicodedata.normalize("NFKD",s).encode("ascii","ignore").decode()
    return frozenset(t for t in s.replace("-"," ").split() if t)
sb=get_supabase()
tot_ok=tot_bad=0
for st,names in sorted(EXPECTED.items()):
    slug=f"race/vuelta-a-espana/2026/stage-{st}"
    rows=_fetch_all(lambda: sb.table("race_results").select("rank,riders(full_name)").eq("race_slug",slug).order("rank"))
    db={r["rank"]:((r.get("riders") or {}).get("full_name") or "") for r in rows}
    bad=[]
    for i,exp in enumerate(names,1):
        got=db.get(i)
        if got is None: continue          # coureur hors pool, non importe
        if norm(got)!=norm(exp): bad.append((i,exp,got))
    checked=sum(1 for i in range(1,len(names)+1) if i in db)
    tot_ok+=checked-len(bad); tot_bad+=len(bad)
    flag="OK " if not bad else "KO "
    print(f"{flag}stage-{st:<2} : {checked} rangs verifies (sur top {len(names)}), {len(bad)} ecart(s)")
    for i,exp,got in bad: print(f"      #{i:<3} capture={exp:<28} base={got}")
print(f"\nTOTAL : {tot_ok} rangs conformes, {tot_bad} ecarts")
