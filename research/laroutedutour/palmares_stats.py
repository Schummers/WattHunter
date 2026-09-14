#!/usr/bin/env python3
"""Agrégats palmarès depuis rankings.csv (LRDT 2017-2025).

Règles appliquées (décidées 2026-08-20 puis 2026-09-14) :
  - courses d'une semaine exclues (Paris-Nice, Critérium du Dauphiné) ;
  - identités fusionnées (kli_max = Klimax, Sandy Chazar = David Choncoutié) ;
  - victoire = rang 1 d'une épreuve, quel que soit le format ;
  - champion de saison = plus gros cumul de points DANS l'année (jamais cross-ère) ;
  - titre de maillot = meilleur cumul d'une catégorie sur une épreuve, GT seulement ;
  - aucun seuil de participation, aucune conversion en XP.
"""
import csv, json, sys
from collections import defaultdict
from pathlib import Path

EXCLUDED_TYPES = {"Paris-Nice", "Critérium du Dauphiné"}
ALIASES = {"kli_max": "Klimax", "Sandy Chazar": "David Choncoutié"}
JERSEYS = [("gc_points", "Général"), ("sprinter", "Sprinteur"),
           ("climber", "Grimpeur"), ("young_rider", "Jeune")]

def load(path):
    tours = defaultdict(lambda: {"rows": []})
    for r in csv.DictReader(open(path, encoding="utf-8")):
        if r["canonical_type"] in EXCLUDED_TYPES:
            continue
        r["user"] = ALIASES.get(r["user"], r["user"])
        t = tours[r["tour_id"]]
        t.update(type=r["canonical_type"], year=r["year"], name=r["tour_name"],
                 canonical=r["canonical_name"])
        t["rows"].append(r)
    return tours

def main(csv_path, out_path):
    tours = load(csv_path)
    wins = defaultdict(lambda: defaultdict(int))       # player -> type -> count
    places = defaultdict(lambda: [0, 0, 0])            # player -> [1st,2nd,3rd]
    starts = defaultdict(int)
    jerseys = defaultdict(lambda: defaultdict(int))    # player -> jersey -> count
    seasons = defaultdict(lambda: {"tours": [], "cumul": defaultdict(int)})

    for t in tours.values():
        year = t["year"] or "?"
        season = seasons[year]
        winner = None
        for r in t["rows"]:
            u, rank = r["user"], int(r["rank"])
            starts[u] += 1
            if rank <= 3:
                places[u][rank - 1] += 1
            if rank == 1:
                wins[u][t["type"]] += 1
                winner = u
            season["cumul"][u] += int(r["total"])
        season["tours"].append({"type": t["type"], "name": t["name"], "winner": winner})
        # titres de maillot : GT uniquement (colonnes nulles sur les classiques)
        for col, label in JERSEYS:
            best = max(t["rows"], key=lambda r: int(r[col]))
            if int(best[col]) > 0:
                jerseys[best["user"]][label] += 1

    out = {"seasons": {}, "players": {}}
    for year, s in sorted(seasons.items()):
        podium = sorted(s["cumul"].items(), key=lambda kv: -kv[1])[:3]
        out["seasons"][year] = {
            "tours": sorted(s["tours"], key=lambda x: x["type"]),
            "podium": [{"user": u, "points": p} for u, p in podium],
        }
    for u in sorted(starts, key=lambda u: (-sum(wins[u].values()), -places[u][0])):
        out["players"][u] = {
            "starts": starts[u],
            "wins": dict(wins[u]),
            "wins_total": sum(wins[u].values()),
            "podium": places[u],
            "jerseys": dict(jerseys[u]),
            "season_titles": sum(1 for y in out["seasons"]
                                 if out["seasons"][y]["podium"] and
                                 out["seasons"][y]["podium"][0]["user"] == u),
        }
    Path(out_path).write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    return out

if __name__ == "__main__":
    o = main(sys.argv[1] if len(sys.argv) > 1 else "research/laroutedutour/rankings.csv",
             sys.argv[2] if len(sys.argv) > 2 else "research/laroutedutour/palmares_stats.json")
    for y, s in o["seasons"].items():
        print(y, [t["type"][:4] + ":" + (t["winner"] or "?") for t in s["tours"]],
              "| champion:", s["podium"][0]["user"] if s["podium"] else "-")
    print()
    for u, p in o["players"].items():
        print(f'{u:20} {p["starts"]:3} dep  {p["wins_total"]}W  podium {p["podium"]}  '
              f'saisons {p["season_titles"]}  maillots {sum(p["jerseys"].values())}  {p["wins"]}')
