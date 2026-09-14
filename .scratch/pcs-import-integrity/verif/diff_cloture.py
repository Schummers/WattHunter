"""Diff decompose baseline -> etat courant, lecture seule (prend un snapshot frais).

Trois causes par ligne (equipe, coureur, slug) :
  rang        : le rang en base a change (c'est la correction du bug d'import)
  maillots    : ligne nouvelle sur gc/points/kom/youth (XP jamais distribue)
  derive      : rang identique mais un multiplicateur a bouge (ne doit PAS
                subsister apres un rescore etape par etape)

Usage :
    .venv/bin/python ../.scratch/pcs-import-integrity/verif/diff_cloture.py <baseline.json> [label]
"""
from __future__ import annotations
import json, sys
from pathlib import Path
HERE = Path(__file__).resolve(); ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE.parent))
from cloture_vuelta import snapshot  # noqa: E402  (importe aussi get_supabase, dotenv)
from sync import get_supabase  # noqa: E402

A = json.load(open(sys.argv[1], encoding="utf-8"))
label = sys.argv[2] if len(sys.argv) > 2 else "apres2"
B = snapshot(get_supabase(), label)

teams = {t["id"]: t["name"] for t in A["teams"]}
key = lambda r: (r["team_id"], r["rider_id"], r["race_slug"])
a = {key(r): r for r in A["rider_xp_daily"]}; b = {key(r): r for r in B["rider_xp_daily"]}

def ranks(S):
    return {(r["race_slug"], (r["riders"] or {}).get("full_name")): r["rank"] for r in S["race_results"]}
RA, RB = ranks(A), ranks(B)

MULTS = ("role_mult", "underdog_mult", "nemesis_modifier")
per_team: dict[str, dict[str, float]] = {}
lignes = []
for k in sorted(set(a) | set(b)):
    ra, rb = a.get(k), b.get(k)
    xa = float((ra or {}).get("xp_gained") or 0); xb = float((rb or {}).get("xp_gained") or 0)
    if abs(xa - xb) < 0.01:
        continue
    name = ((ra or rb)["riders"] or {}).get("full_name")
    tail = k[2].rsplit("/", 1)[-1]
    if tail in ("points", "kom", "youth") or (ra is None and tail == "gc"):
        cause = "maillots"
    elif ra is None or rb is None:
        cause = "rang"  # coureur entre ou sort du top 20 : c'est un rang qui a change
    elif RA.get((k[2], name)) != RB.get((k[2], name)):
        cause = "rang"
    elif any(abs(float(ra.get(f) or 0) - float(rb.get(f) or 0)) > 1e-3 for f in MULTS):
        cause = "derive"
    else:
        cause = "classif"  # classement journalier corrige (meme page, meme bug)
    t = teams[k[0]]
    per_team.setdefault(t, {}).setdefault(cause, 0.0)
    per_team[t][cause] += xb - xa
    lignes.append({"equipe": t, "slug": tail, "coureur": name, "cause": cause,
                   "rang_avant": RA.get((k[2], name)), "rang_apres": RB.get((k[2], name)),
                   "xp_avant": xa, "xp_apres": xb, "delta": round(xb - xa, 2)})

tb = {t["id"]: float(t["cumulative_xp"] or 0) for t in B["teams"]}
ta = {t["id"]: float(t["cumulative_xp"] or 0) for t in A["teams"]}
print(f"\n{'Equipe':<22}{'rang':>9}{'classif':>9}{'maillots':>10}{'derive':>9}{'total lignes':>14}{'cumulative_xp':>15}")
for tid, name in sorted(teams.items(), key=lambda kv: -tb[kv[0]]):
    d = per_team.get(name, {})
    tot = sum(d.values())
    print(f"{name:<22}{d.get('rang',0):>+9.1f}{d.get('classif',0):>+9.1f}{d.get('maillots',0):>+10.1f}"
          f"{d.get('derive',0):>+9.1f}{tot:>+14.1f}{tb[tid]-ta[tid]:>+15.2f}")

derive = [l for l in lignes if l["cause"] == "derive"]
print(f"\nlignes en derive : {len(derive)}")
for l in sorted(derive, key=lambda l: -abs(l["delta"]))[:15]:
    print(f"  {l['equipe']:<20}{l['slug']:<9}{l['coureur']:<24}{l['xp_avant']:>8} -> {l['xp_apres']:<8} {l['delta']:+.1f}")

out = ROOT / f"diff-cloture-{label}.json"
out.write_text(json.dumps({"par_equipe": per_team, "lignes": lignes}, indent=2, ensure_ascii=False), encoding="utf-8")
print(f"\n{out}")
