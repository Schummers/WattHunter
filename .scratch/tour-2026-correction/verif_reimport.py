"""Ticket 03 — ce que le reimport a le droit de changer, et ce qu'il n'a pas le
droit de toucher. Compare deux snapshots du script de correction.

    python verif_reimport.py <snapshot-avant.json> <snapshot-apres.json>

Trois familles :
  1. `stage-1` — ses lignes de `race_results` doivent etre identiques, ligne a
     ligne. C'est le TTT score via la GC : un reimport l'ecraserait.
  2. `rider_xp_daily`, `teams`, `team_ranking_daily` — strictement identiques.
     Le reimport corrige des rangs, il ne rescore pas ; si l'XP a bouge ici,
     c'est qu'un scoring a tourne sans qu'on le demande.
  3. Le compte de lignes par slug, avant / apres. Un slug qui PERD des lignes
     doit s'expliquer par un coureur hors pool, sinon le ticket echoue.
"""
from __future__ import annotations

import json
import sys
from collections import defaultdict
from pathlib import Path

RACE = "race/tour-de-france/2026"
STAGE_1 = f"{RACE}/stage-1"

before = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
after = json.loads(Path(sys.argv[2]).read_text(encoding="utf-8"))

fail = 0

# --- 1. stage-1 intacte, ligne a ligne -------------------------------------
def stage1(snap):
    return {
        r["rider_id"]: (r["rank"], r["pcs_points"], str(r["race_date"]),
                        r["is_itt"], r.get("profile_icon"))
        for r in snap["race_results"] if r["race_slug"] == STAGE_1
    }


s1b, s1a = stage1(before), stage1(after)
if s1b == s1a:
    print(f"1. stage-1 : {len(s1b)} lignes identiques, ligne a ligne  OK")
else:
    fail += 1
    print(f"1. stage-1 : DIFFERENTE  <<< ECHEC")
    for rid in sorted(set(s1b) | set(s1a)):
        if s1b.get(rid) != s1a.get(rid):
            print(f"   {rid[:8]} {s1b.get(rid)} -> {s1a.get(rid)}")

# --- 2. XP et classements intacts ------------------------------------------
for table, key in (
    ("rider_xp_daily", lambda r: (r["team_id"], r["rider_id"], r["race_slug"])),
    ("teams", lambda r: r["id"]),
    ("team_ranking_daily", lambda r: r["id"]),
):
    def norm(snap):
        out = {}
        for r in snap[table]:
            row = dict(r)
            row.pop("updated_at", None)
            out[key(r)] = json.dumps(row, sort_keys=True, default=str)
        return out

    nb, na = norm(before), norm(after)
    diff = [k for k in set(nb) | set(na) if nb.get(k) != na.get(k)]
    if diff:
        fail += 1
        print(f"2. {table:20s} {len(diff)} ligne(s) de diff  <<< ECHEC")
        for k in diff[:5]:
            print(f"   {k}")
    else:
        print(f"2. {table:20s} {len(nb)} lignes identiques  OK")

# --- 3. lignes par slug -----------------------------------------------------
def per_slug(snap, table, slug_field="race_slug"):
    out = defaultdict(int)
    for r in snap[table]:
        out[r[slug_field]] += 1
    return out


print("\n3. Lignes par slug, avant / apres")
print(f"   {'slug':<12}{'race_results':>26}{'gt_final_classifications':>28}")
rb, ra = per_slug(before, "race_results"), per_slug(after, "race_results")
fb, fa_ = (per_slug(before, "gt_final_classifications"),
           per_slug(after, "gt_final_classifications"))
pertes = []
for slug in sorted(set(rb) | set(ra) | set(fb) | set(fa_),
                   key=lambda s: (s.rsplit("/", 1)[1].startswith("stage-") is False,
                                  int(s.rsplit("-", 1)[1]) if s.rsplit("/", 1)[1].startswith("stage-") else 0,
                                  s)):
    short = slug.rsplit("/", 1)[1]
    r0, r1 = rb.get(slug, 0), ra.get(slug, 0)
    f0, f1 = fb.get(slug, 0), fa_.get(slug, 0)
    if r1 < r0 or f1 < f0:
        pertes.append(short)
    mark = "  <<< PERTE" if (r1 < r0 or f1 < f0) else ""
    rr = f"{r0} -> {r1} ({r1 - r0:+d})" if (r0 or r1) else "-"
    ff = f"{f0} -> {f1} ({f1 - f0:+d})" if (f0 or f1) else "-"
    print(f"   {short:<12}{rr:>26}{ff:>28}{mark}")

if pertes:
    fail += 1
    print(f"\n   slugs en perte : {pertes}  <<< a expliquer ou le ticket echoue")
else:
    print("\n   aucun slug ne perd de ligne")

print(f"\nechecs : {fail}")
raise SystemExit(1 if fail else 0)
