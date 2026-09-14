"""Ticket 04 — ce que l'import d'evenements a reellement mis en base. Lecture seule.

Quatre mesures, toutes lues dans la table et non deduites des logs :

  1. comptage des cotes (dont HC / cat.1) et des sprints ;
  2. XP d'evenements distribuable, **hors multiplicateur de role** (bareme brut
     de `_event_bonus`), au total et sur les seuls coureurs sous contrat dans la
     ligue V2 ;
  3. le garde-fou anti-silence de `scoring.py` : aucune etape p4/p5 non-ITT ne
     doit rester sans ligne KOM ;
  4. les collisions de cle primaire, qui sont silencieuses.

    python verif_evenements.py
"""
from __future__ import annotations

import subprocess
import sys
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).resolve()
REPO = HERE.parents[2]
PCS = REPO / "services" / "pcs-sync"
sys.path.insert(0, str(PCS))

RACE = "race/tour-de-france/2026"
LEAGUE = "00000000-0000-4000-8000-c1a551c2026e"

from db_utils import _fetch_all  # noqa: E402
from scoring import KOM_EVENT_SCALES, SPRINT_EVENT_SCALE, _norm_profile  # noqa: E402
from supabase import create_client  # noqa: E402

out = subprocess.run(["supabase", "status", "-o", "env"], cwd=REPO,
                     capture_output=True, text=True, check=True).stdout
env = dict(l.split("=", 1) for l in out.splitlines() if "=" in l)
sb = create_client(env["API_URL"].strip('"'), env["SERVICE_ROLE_KEY"].strip('"'))

SLUGS = [f"{RACE}/stage-{n}" for n in range(1, 22)]

events = _fetch_all(lambda: sb.table("stage_event_results")
                    .select("race_slug,rider_id,event_type,event_name,category,rank")
                    .in_("race_slug", SLUGS)
                    .order("race_slug").order("event_type").order("event_name").order("rank"))

# --- 1. comptage -----------------------------------------------------------
climbs, sprints = set(), set()
for e in events:
    key = (e["race_slug"], e["event_name"])
    (climbs if e["event_type"] == "kom" else sprints).add(key)

cat_of = {}
for e in events:
    if e["event_type"] == "kom":
        cat_of[(e["race_slug"], e["event_name"])] = e["category"]

hc_cat1 = [k for k, c in cat_of.items() if str(c).upper() in ("HC", "1")]

print("1. Comptage")
print(f"   cotes                 {len(climbs)}")
print(f"   dont HC / cat.1       {len(hc_cat1)}")
print(f"   sprints intermediaires {len(sprints)}")
print(f"   lignes coureur        {len(events)}")
sans_sprint = [s.rsplit('/', 1)[1] for s in SLUGS
               if not any(k[0] == s for k in sprints)]
print(f"   etapes sans sprint    {sans_sprint}")

# --- 2. XP distribuable, hors multiplicateur de role ------------------------
def brut(e) -> float:
    try:
        r = int(e["rank"])
    except (TypeError, ValueError):
        return 0.0
    if e["event_type"] == "kom":
        sc = KOM_EVENT_SCALES.get(str(e.get("category") or "").upper())
        return float(sc[r - 1]) if sc and 1 <= r <= len(sc) else 0.0
    return float(SPRINT_EVENT_SCALE[r - 1]) if 1 <= r <= len(SPRINT_EVENT_SCALE) else 0.0


teams = {t["id"]: t["name"] for t in _fetch_all(
    lambda: sb.table("teams").select("id,name").eq("league_id", LEAGUE).order("id"))}
contrats = defaultdict(list)
for c in _fetch_all(lambda: sb.table("contracts")
                    .select("team_id,rider_id,purchased_at,released_at,release_date")
                    .order("id")):
    if c["team_id"] in teams:
        contrats[c["rider_id"]].append(c)

dates = {r["race_slug"]: str(r["race_date"]) for r in _fetch_all(
    lambda: sb.table("stage_profiles").select("race_slug,race_date,profile_icon")
    .in_("race_slug", SLUGS))}
profils = {r["race_slug"]: r["profile_icon"] for r in _fetch_all(
    lambda: sb.table("stage_profiles").select("race_slug,race_date,profile_icon")
    .in_("race_slug", SLUGS))}


def sous_contrat(rider_id: str, jour: str | None) -> bool:
    for c in contrats.get(rider_id, []):
        if jour:
            pa = str(c.get("purchased_at") or "")[:10]
            rel = str(c.get("released_at") or c.get("release_date") or "")[:10]
            if pa and jour < pa:
                continue
            if rel and jour > rel:
                continue
        return True
    return False


total = sum(brut(e) for e in events)
v2 = sum(brut(e) for e in events if sous_contrat(e["rider_id"], dates.get(e["race_slug"])))
print("\n2. XP d'evenements distribuable, hors multiplicateur de role")
print(f"   total                 {total:.0f}")
print(f"   sur coureurs sous contrat V2 le jour de l'etape   {v2:.0f}")

# --- 3. garde-fou anti-silence ---------------------------------------------
kom_slugs = {e["race_slug"] for e in events if e["event_type"] == "kom"}
itt = {r["race_slug"] for r in _fetch_all(
    lambda: sb.table("race_results").select("race_slug,is_itt")
    .in_("race_slug", SLUGS).eq("is_itt", True).order("id"))}
montagne = [s for s in SLUGS
            if _norm_profile(profils.get(s)) in ("p4", "p5") and s not in itt]
manquantes = [s.rsplit("/", 1)[1] for s in montagne if s not in kom_slugs]
print("\n3. Garde-fou anti-silence (p4/p5 non-ITT sans ligne KOM)")
print(f"   etapes de montagne    {len(montagne)} : {[s.rsplit('/', 1)[1] for s in montagne]}")
print(f"   sans donnee KOM       {manquantes if manquantes else 'aucune  OK'}")

# --- 4. collisions de cle primaire -----------------------------------------
vus = defaultdict(int)
for e in events:
    vus[(e["race_slug"], e["event_type"], e["event_name"])] += 1
doublons = defaultdict(list)
for e in events:
    doublons[(e["race_slug"], e["event_name"])].append(e["event_type"])
noms = defaultdict(set)
for (slug, name), _ in doublons.items():
    noms[slug].add(name)
print("\n4. Cle primaire (race_slug, event_type, event_name, rider_id)")
print("   Deux cotes de MEME NOM sur une meme etape s'ecrasent l'une l'autre.")
for slug in SLUGS:
    n_evts = len([k for k in climbs if k[0] == slug]) + len([k for k in sprints if k[0] == slug])
    if n_evts == 0:
        continue
print(f"   evenements distincts  {len(climbs) + len(sprints)}")
print(f"   lignes en base        {len(events)}")
