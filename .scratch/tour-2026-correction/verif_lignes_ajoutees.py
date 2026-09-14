"""Ticket 03 — qui sont les coureurs que le reimport ajoute, et peuvent-ils scorer ?

Le reimport ne perd aucune ligne, il en AJOUTE (+6 ou +7 par etape). L'explication
mecanique est que `import_race_results` mappe `rider_url -> rider_id` sur la table
`riders` d'aujourd'hui : un coureur entre dans le pool apres juillet 2026 devient
mappable, alors qu'il etait compte en `skipped` a l'import d'origine.

Ce n'est anodin QUE si aucun de ces coureurs n'est sous contrat dans la ligue V2.
Sinon le rescore du ticket 05 leur distribuerait de l'XP qui n'a jamais existe,
et le delta ne serait plus imputable au bug d'import.

    python verif_lignes_ajoutees.py <avant.json> <apres.json>
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve()
REPO = HERE.parents[2]
PCS = REPO / "services" / "pcs-sync"
sys.path.insert(0, str(PCS))

LEAGUE = "00000000-0000-4000-8000-c1a551c2026e"

before = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
after = json.loads(Path(sys.argv[2]).read_text(encoding="utf-8"))


def keys(snap, table):
    return {(r["race_slug"], r["rider_id"]) for r in snap[table]}


added = set()
for table in ("race_results", "gt_final_classifications"):
    added |= keys(after, table) - keys(before, table)

riders_added = {rid for _, rid in added}
print(f"{len(added)} ligne(s) ajoutee(s), portees par {len(riders_added)} coureur(s)")

out = subprocess.run(["supabase", "status", "-o", "env"], cwd=REPO,
                     capture_output=True, text=True, check=True).stdout
env = dict(l.split("=", 1) for l in out.splitlines() if "=" in l)

from db_utils import _fetch_all  # noqa: E402
from supabase import create_client  # noqa: E402

sb = create_client(env["API_URL"].strip('"'), env["SERVICE_ROLE_KEY"].strip('"'))

riders = {
    r["id"]: (r.get("full_name") or r["pcs_slug"], r.get("pcs_rank"))
    for r in _fetch_all(lambda: sb.table("riders")
                        .select("id,pcs_slug,full_name,pcs_rank").order("id"))
}
teams = {t["id"]: t["name"] for t in _fetch_all(
    lambda: sb.table("teams").select("id,name").eq("league_id", LEAGUE).order("id"))}
contracts = _fetch_all(lambda: sb.table("contracts")
                       .select("team_id,rider_id,status,purchased_at,released_at")
                       .order("id"))
sous_contrat = {}
for c in contracts:
    if c["team_id"] in teams and c["rider_id"] in riders_added:
        sous_contrat.setdefault(c["rider_id"], []).append(
            (teams[c["team_id"]], c["status"], str(c.get("purchased_at"))[:10],
             str(c.get("released_at"))[:10] if c.get("released_at") else None))

print(f"\n{'coureur':<28}{'pcs_rank':>10}  lignes  contrat dans la V2")
for rid in sorted(riders_added, key=lambda r: riders.get(r, ("?", None))[0]):
    name, rank = riders.get(rid, (rid[:8], None))
    n = sum(1 for _, r in added if r == rid)
    ctr = sous_contrat.get(rid)
    print(f"{name:<28}{str(rank):>10}{n:>8}  {ctr if ctr else 'aucun'}")

print(f"\ncoureurs ajoutes ET sous contrat dans la V2 : {len(sous_contrat)}")
if sous_contrat:
    print("  >>> le rescore leur donnerait de l'XP qui n'a jamais existe. A trancher.")
