"""Ticket 04 — pourquoi le parse annonce 68 cotes et la base n'en porte que 64.

La cle primaire de `stage_event_results` est
`(race_slug, event_type, event_name, rider_id)`. Une etape qui franchit DEUX FOIS
une cote du meme nom (boucle finale, double ascension) ecrase donc la premiere
ascension avec la seconde, sans erreur et sans log.

Ce script reparse les pages du cache, compte les cotes cote parse, et confronte
au contenu de la base pour nommer exactement ce qui manque.

    python verif_cotes_perdues.py
"""
from __future__ import annotations

import subprocess
import sys
from collections import Counter, defaultdict
from pathlib import Path

HERE = Path(__file__).resolve()
REPO = HERE.parents[2]
PCS = REPO / "services" / "pcs-sync"
CACHE = REPO / ".scratch" / "pcs-import-integrity" / "fixtures" / "sweep-tdf"
sys.path.insert(0, str(PCS))

RACE = "race/tour-de-france/2026"
SLUGS = [f"{RACE}/stage-{n}" for n in range(1, 22)]

from db_utils import _fetch_all  # noqa: E402
from pcs_deobfuscate import deobfuscate  # noqa: E402
from procyclingstats import Stage  # noqa: E402
from stage_events import parse_stage_climbs, parse_intermediate_sprints  # noqa: E402
from supabase import create_client  # noqa: E402

parse_climbs = defaultdict(list)
parse_sprints = defaultdict(list)
for slug in SLUGS:
    html = (CACHE / f"{slug.rsplit('/', 1)[1]}.html").read_text(encoding="utf-8")
    html, _ = deobfuscate(html, source=slug)
    st = Stage(slug, html=html, update_html=False)
    for c in parse_stage_climbs(st):
        parse_climbs[slug].append((str(c.get("climb_name") or "?"), c.get("category")))
    for s in parse_intermediate_sprints(html):
        parse_sprints[slug].append(s["event_name"])

out = subprocess.run(["supabase", "status", "-o", "env"], cwd=REPO,
                     capture_output=True, text=True, check=True).stdout
env = dict(l.split("=", 1) for l in out.splitlines() if "=" in l)
sb = create_client(env["API_URL"].strip('"'), env["SERVICE_ROLE_KEY"].strip('"'))

base = _fetch_all(lambda: sb.table("stage_event_results")
                  .select("race_slug,event_type,event_name,category,rank,rider_id")
                  .in_("race_slug", SLUGS)
                  .order("race_slug").order("event_type").order("event_name").order("rank"))
base_climbs = defaultdict(set)
for e in base:
    if e["event_type"] == "kom":
        base_climbs[e["race_slug"]].add(e["event_name"])

tot_parse = sum(len(v) for v in parse_climbs.values())
tot_base = sum(len(v) for v in base_climbs.values())
print(f"cotes cote parse : {tot_parse}")
print(f"cotes en base    : {tot_base}")
print(f"perdues          : {tot_parse - tot_base}\n")

for slug in SLUGS:
    noms = Counter(n for n, _ in parse_climbs[slug])
    doublons = {n: c for n, c in noms.items() if c > 1}
    if doublons:
        short = slug.rsplit("/", 1)[1]
        for nom, c in doublons.items():
            cats = [cat for n, cat in parse_climbs[slug] if n == nom]
            en_base = nom in base_climbs[slug]
            print(f"{short:<10} « {nom} » franchie {c}x  categories={cats}  "
                  f"-> 1 seule ligne en base ({'presente' if en_base else 'ABSENTE'})")
