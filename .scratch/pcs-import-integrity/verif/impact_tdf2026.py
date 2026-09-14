"""Ticket 09 — impact XP du bug d'import sur le Tour 2026, au bareme de juillet.

Lecture seule. Deux colonnes separees, comme demande par le handoff :

  * `delta_bug`   — ce que la correction du rang change, **bareme de juillet**
                    (celui qui a ete joue), a code de scoring constant ;
  * `delta_drift` — ce qu'un rescore au code actuel changerait EN PLUS, a rang
                    inchange. Sans aucun rapport avec le bug ; c'est la colonne
                    qui explique pourquoi on ne rescore pas.

Le delta du bug est **exact**, pas une exposition brute : `rider_xp_daily`
stocke les rank_points effectivement utilises et tous les multiplicateurs.

    XP = (rank_points × gt_role_mult × underdog_mult × (1+bonus)
          + gt_classif_bonus + gt_distance_bonus + assist_bonus
          + kom_event_bonus + sprint_event_bonus) × nemesis_modifier

Ou vivent les rank_points selon le slug — verifie en base, pas suppose :
  * etapes et `/gc`      -> colonne `raw_pcs_points` (250/210/170 sur /gc :
                            bareme de juillet, avant la rehausse `3583af0`) ;
  * `/points /kom /youth` -> colonne `gt_classif_bonus` (100/80/65…), et le rang
                            vit dans `gt_final_classifications`, pas dans
                            `race_results`.

Le rang « vrai » vient de la page PCS refetchee avec le correctif actif
(`fixtures/sweep-tdf/`), dont `wikipedia_crosscheck_tdf.py` a montre qu'elle
colle a Wikipedia sur 200 rangs, 0 ecart.

Reserve : `nemesis_modifier` depend lui aussi du rang dans certains duels. Les
lignes concernees sont comptees a part (0 sur le Tour).
"""
from __future__ import annotations

import json
import re
import sys
import unicodedata
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).resolve()
ROOT = HERE.parents[1]
PCS = HERE.parents[3] / "services" / "pcs-sync"
sys.path.insert(0, str(PCS))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(PCS / ".env")

import sync_race  # noqa: E402,F401
from procyclingstats import Stage  # noqa: E402
from sync import get_supabase  # noqa: E402
from db_utils import _fetch_all  # noqa: E402

LEAGUE = "00000000-0000-4000-8000-c1a551c2026e"
RACE = "race/tour-de-france/2026"
SWEEP = ROOT / "fixtures" / "sweep-tdf"
OUT = ROOT / "impact-tdf2026-2026-09-14.json"

# Etape 1 = TTT scoree via GC (memoire `tdf2026_stage1_ttt_via_gc`) : pas de
# classement individuel comparable, traitee a part dans le ticket.
TARGETS = [f"stage-{s}" for s in range(2, 22)] + ["gc", "points", "kom", "youth"]
SECONDARY = ("points", "kom", "youth")

# --- Bareme de juillet 2026, celui applique a la cloture du Tour (2026-07-27).
STAGE_JUL = [100, 80, 70, 65, 55, 50, 45, 35, 30, 25, 20, 18, 16, 14, 12, 10, 8, 6, 4, 2]
GC_JUL = [250, 210, 170, 145, 125, 110, 95, 85, 75, 65, 60, 55, 50, 45, 40,
          35, 30, 25, 22, 20, 18, 16, 14, 12, 10, 8, 6, 4, 2, 1]
SEC_JUL = {
    "points": [100, 80, 65, 50, 40, 30, 22, 15, 10, 5],
    "kom": [100, 80, 65, 50, 40, 30, 22, 15, 10, 5],
    "youth": [50, 40, 32, 25, 20, 15, 11, 8, 5, 2],
}
# --- Bareme actuel en prod (scoring.py), pour la colonne drift.
GC_NOW = [400, 320, 265, 225, 195, 170, 145, 130, 115, 100, 90, 80, 70, 64, 56,
          50, 42, 35, 30, 25, 21, 18, 14, 12, 9, 7, 5, 4, 2, 1]
SEC_NOW = {
    "points": [150, 120, 100, 75, 60, 45, 32, 22, 15, 8],
    "kom": [150, 120, 100, 75, 60, 45, 32, 22, 15, 8],
    "youth": [75, 60, 50, 38, 30, 22, 16, 11, 8, 4],
}


def scale(target: str, when: str) -> list[int]:
    if target == "gc":
        return GC_JUL if when == "jul" else GC_NOW
    if target in SECONDARY:
        return (SEC_JUL if when == "jul" else SEC_NOW)[target]
    return STAGE_JUL


def pts(sc: list[int], rank: int | None) -> float:
    return float(sc[rank - 1]) if rank and 1 <= rank <= len(sc) else 0.0


def norm(s: str) -> str:
    s = (s or "").lower()
    for a, b in (("ø", "o"), ("ł", "l"), ("đ", "d"), ("ß", "ss"), ("æ", "ae")):
        s = s.replace(a, b)
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return " ".join(sorted(t for t in re.sub(r"[^a-z0-9]+", " ", s).split()))


def pcs_ranks(target: str) -> dict[str, int]:
    """-> {nom normalise: rang} depuis la page refetchee, chemin de prod."""
    html = (SWEEP / f"{target}.html").read_text(encoding="utf-8")
    st = Stage(f"{RACE}/{target}", html=html, update_html=False)
    if target == "gc":
        entries = st.gc()
    elif target in SECONDARY:
        entries = getattr(st, target)() or []
    else:
        entries = st.results()
    return {
        norm(e.get("rider_url") or ""): e["rank"]
        for e in entries
        if e.get("rank") and e.get("rider_url")
    }


def main() -> None:
    sb = get_supabase()
    teams = {
        t["id"]: t["name"]
        for t in sb.table("teams").select("id,name").eq("league_id", LEAGUE).execute().data
    }
    riders = {
        r["id"]: (r["pcs_slug"], r.get("full_name") or r["pcs_slug"])
        for r in _fetch_all(lambda: sb.table("riders").select("id,pcs_slug,full_name").order("id"))
    }

    like = f"%{RACE.split('race/')[1]}%"
    xp_rows = _fetch_all(
        lambda: sb.table("rider_xp_daily").select("*").like("race_slug", like).order("id")
    )
    base_rank: dict[tuple[str, str], int] = {}
    for r in _fetch_all(
        lambda: sb.table("race_results").select("race_slug,rank,rider_id").like("race_slug", like).order("id")
    ):
        base_rank[(r["race_slug"], r["rider_id"])] = r["rank"]
    for r in _fetch_all(
        lambda: sb.table("gt_final_classifications")
        .select("race_slug,rank,rider_id").like("race_slug", like).order("rank")
    ):
        base_rank[(r["race_slug"], r["rider_id"])] = r["rank"]

    truth = {t: pcs_ranks(t) for t in TARGETS}

    delta_bug: dict[str, float] = defaultdict(float)
    exposure: dict[str, float] = defaultdict(float)
    delta_drift: dict[str, float] = defaultdict(float)
    tour_xp: dict[str, float] = defaultdict(float)
    lines: list[dict] = []
    nemesis_lines = 0

    for row in xp_rows:
        tname = teams.get(row["team_id"])
        if not tname:
            continue
        tour_xp[tname] += row.get("xp_gained") or 0.0
        target = row["race_slug"].rsplit("/", 1)[1]
        if target not in truth:
            continue  # stage-1 (TTT via GC), traitee a part

        slug_pcs, full_name = riders.get(row["rider_id"], ("", ""))
        played = base_rank.get((row["race_slug"], row["rider_id"]))
        real = truth[target].get(norm(slug_pcs))
        mult = (
            (row.get("gt_role_mult") or 1.0)
            * (row.get("underdog_mult") or 1.0)
            * (1 + (row.get("strategy_bonus") or 0.0))
            * (row.get("nemesis_modifier") or 1.0)
        )
        sc_jul, sc_now = scale(target, "jul"), scale(target, "now")

        # --- colonne drift : meme rang (celui de la base), bareme actuel.
        if target == "gc" or target in SECONDARY:
            delta_drift[tname] += round((pts(sc_now, played) - pts(sc_jul, played)) * mult, 2)

        # --- colonne bug : rang corrige, bareme de juillet.
        if real is None or played is None or real == played:
            continue
        d = round((pts(sc_jul, real) - pts(sc_jul, played)) * mult, 2)
        exposure[tname] += round(pts(sc_jul, played) * mult, 2)
        if (row.get("nemesis_modifier") or 1.0) != 1.0:
            nemesis_lines += 1
        if d == 0:
            continue
        delta_bug[tname] += d
        lines.append(
            {
                "slug": target,
                "coureur": full_name,
                "equipe": tname,
                "rang_en_base": played,
                "rang_reel": real,
                "rank_points_joues": pts(sc_jul, played),
                "rank_points_reels": pts(sc_jul, real),
                "delta_xp": d,
            }
        )

    ranking = sorted(tour_xp.items(), key=lambda x: -x[1])
    print(f"{len(lines)} ligne(s) XP deplacee(s) par un rang faux\n")
    print(f"{'#':>2} {'Equipe':<22} {'XP Tour':>9} {'ecart':>8} {'delta bug':>10} {'exposition':>11} {'drift':>9}")
    prev = None
    for i, (name, xp) in enumerate(ranking, 1):
        gap = "" if prev is None else f"{prev - xp:.1f}"
        print(
            f"{i:>2} {name:<22} {xp:>9.1f} {gap:>8} {delta_bug.get(name, 0.0):>+10.1f} "
            f"{exposure.get(name, 0.0):>11.1f} {delta_drift.get(name, 0.0):>+9.1f}"
        )
        prev = xp
    print(f"\nlignes avec nemesis_modifier != 1 : {nemesis_lines}")

    OUT.write_text(
        json.dumps(
            {
                "race": RACE,
                "league": LEAGUE,
                "bareme": "juillet 2026 (avant 3583af0 / 92dbf19)",
                "classement_tour": [{"equipe": n, "xp": x} for n, x in ranking],
                "delta_bug_par_equipe": dict(delta_bug),
                "exposition_par_equipe": dict(exposure),
                "delta_drift_par_equipe": dict(delta_drift),
                "lignes": sorted(lines, key=lambda l: -abs(l["delta_xp"])),
                "lignes_nemesis": nemesis_lines,
            },
            indent=2,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    print(f"Detail : {OUT}")


if __name__ == "__main__":
    main()
