"""Preuve de la cloture — deux couches independantes, lecture seule.

Couche 1 — INTEGRITE DE L'IMPORT. Les rangs en base sont-ils les vrais rangs ?
   Confronte la base a Wikipedia (source sans aucun lien avec PCS).
   C'est la couche qui manquait : verify_tdf2026_closeout.py et les audits
   "0 ecart" du Tour et de la Vuelta ne testaient QUE la couche 2, donc ils
   validaient un bareme correctement applique a des rangs faux.

Couche 2 — CONFORMITE DU BAREME. L'XP stocke est-il celui que GAME_RULES §7
   prescrit pour ce rang ? Recalcule rank_points depuis le rang et compare.

Sortie : un tableau par equipe, XP ventile par etape et par coureur.

Usage :
    .venv/bin/python ../.scratch/pcs-import-integrity/verif/preuve_cloture.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve()
ROOT = HERE.parents[1]
PCS = HERE.parents[3] / "services" / "pcs-sync"
sys.path.insert(0, str(PCS))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(PCS / ".env")

from sync import get_supabase  # noqa: E402
from db_utils import _fetch_all  # noqa: E402

RACE = "race/vuelta-a-espana/2026"
LEAGUE = "00000000-0000-4000-8000-c1a551c2026e"
OUT_JSON = ROOT / "preuve-cloture.json"
OUT_MD = ROOT / "preuve-cloture.md"

# GAME_RULES.md §7 — bareme rank-based 2026-07 (+ rehausse GC 2026-08, PR #73).
STAGE_SCALE = [100, 80, 70, 65, 55, 50, 45, 35, 30, 25, 20, 18, 16, 14, 12, 10, 8, 6, 4, 2]
GC_SCALE = [400, 320, 265, 225, 195, 170, 145, 130, 115, 100, 90, 80, 70, 64, 56, 50,
            42, 35, 30, 25, 21, 18, 14, 12, 9, 7, 5, 4, 2, 1]
SECONDARY_SCALE = [150, 120, 100, 75, 60, 45, 32, 22, 15, 8]
YOUTH_SCALE = [75, 60, 50, 38, 30, 22, 16, 11, 8, 4]


def scale_for(slug: str) -> list[int]:
    tail = slug.rsplit("/", 1)[-1]
    if tail == "gc":
        return GC_SCALE
    if tail == "youth":
        return YOUTH_SCALE
    if tail in ("points", "kom"):
        return SECONDARY_SCALE
    return STAGE_SCALE


def rank_points(slug: str, rank: int | None) -> int:
    if not rank:
        return 0
    sc = scale_for(slug)
    return sc[rank - 1] if 1 <= rank <= len(sc) else 0


def main() -> None:
    sb = get_supabase()

    # --- rangs de reference en base -------------------------------------------
    results = _fetch_all(
        lambda: sb.table("race_results")
        .select("race_slug,rank,rider_id")
        .like("race_slug", f"%{RACE}%")
        .order("race_slug").order("rank")
    )
    rank_of = {(r["race_slug"], r["rider_id"]): r["rank"] for r in results}
    finals = _fetch_all(
        lambda: sb.table("gt_final_classifications")
        .select("race_slug,rank,rider_id")
        .like("race_slug", f"%{RACE}%")
        .order("race_slug").order("rank")
    )
    for r in finals:
        rank_of[(r["race_slug"], r["rider_id"])] = r["rank"]

    # --- lignes XP -------------------------------------------------------------
    xp = _fetch_all(
        lambda: sb.table("rider_xp_daily")
        .select("rider_id,team_id,race_slug,raw_pcs_points,role_mult,underdog_mult,"
                "classif_bonus,strategy_bonus,nemesis_modifier,xp_gained,"
                "kom_event_bonus,sprint_event_bonus,assist_bonus,gt_distance_bonus,"
                "riders(full_name),teams(name,league_id)")
        .like("race_slug", f"%{RACE}%")
        .order("race_slug")
    )
    xp = [r for r in xp if (r.get("teams") or {}).get("league_id") == LEAGUE]

    per_team: dict[str, list] = {}
    bareme_ecarts = []

    for r in xp:
        team = (r.get("teams") or {}).get("name") or "?"
        slug = r["race_slug"]
        rk = rank_of.get((slug, r["rider_id"]))
        expected_rp = rank_points(slug, rk)
        tail = slug.rsplit("/", 1)[-1]
        # points/kom/youth : pas de points PCS, raw_pcs_points=0 par convention,
        # le bareme est ecrit tel quel dans xp_gained (pas de role mult sur les finals).
        stored_rp = float(r.get("xp_gained") or 0) if tail in ("points", "kom", "youth") \
            else float(r.get("raw_pcs_points") or 0)

        row = {
            "etape": slug.rsplit("/", 1)[-1],
            "coureur": (r.get("riders") or {}).get("full_name") or "?",
            "rang": rk,
            "rank_points_bareme": expected_rp,
            "rank_points_stockes": stored_rp,
            "role_mult": r.get("role_mult"),
            "underdog_mult": r.get("underdog_mult"),
            "classif_bonus": r.get("classif_bonus"),
            "nemesis": r.get("nemesis_modifier"),
            "xp": r.get("xp_gained"),
        }
        per_team.setdefault(team, []).append(row)

        if abs(stored_rp - expected_rp) > 0.01:
            bareme_ecarts.append({"equipe": team, **row})

    # --- couche 1 : rappel du crosscheck Wikipedia -----------------------------
    cross = ROOT / "wikipedia-crosscheck-2026-09-14.json"
    couche1 = json.loads(cross.read_text(encoding="utf-8"))["totaux"] if cross.exists() else None

    totals = {t: round(sum(float(x["xp"] or 0) for x in rows), 2) for t, rows in per_team.items()}
    classement = sorted(totals.items(), key=lambda kv: -kv[1])

    report = {
        "couche_1_integrite_import_vs_wikipedia": couche1,
        "couche_2_conformite_bareme": {
            "lignes_verifiees": len(xp),
            "ecarts": len(bareme_ecarts),
            "detail": bareme_ecarts[:50],
        },
        "classement_vuelta": classement,
        "par_equipe": per_team,
    }
    OUT_JSON.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")

    # --- markdown ---------------------------------------------------------------
    L = ["# Preuve de la cloture — Vuelta 2026", ""]
    if couche1:
        p = couche1["pcs_repare_vs_wikipedia"]; b = couche1["base_vs_wikipedia"]
        L += ["## Couche 1 — integrite de l'import (source independante : Wikipedia)", "",
              f"- PCS repare vs Wikipedia : **{p['ecarts']} ecart(s)** sur {p['compares']} rangs compares",
              f"- Base (avant cloture) vs Wikipedia : {b['ecarts']} ecart(s) sur {b['compares']} rangs", ""]
    L += ["## Couche 2 — conformite du bareme (GAME_RULES §7)", "",
          f"- Lignes XP verifiees : **{len(xp)}**",
          f"- Ecarts rank_points stockes vs bareme : **{len(bareme_ecarts)}**", ""]
    L += ["## Classement Vuelta (XP des slugs Vuelta)", "",
          "| # | Equipe | XP Vuelta |", "|---|---|---|"]
    for i, (t, v) in enumerate(classement, 1):
        L.append(f"| {i} | {t} | {v} |")
    L += ["", "## Ventilation par equipe", ""]
    for t, _ in classement:
        rows = sorted(per_team[t], key=lambda r: (r["etape"], -float(r["xp"] or 0)))
        L += [f"### {t} — {totals[t]} XP", "",
              "| Slug | Coureur | Rang | Bareme | role | underdog | classif | nemesis | XP |",
              "|---|---|---|---|---|---|---|---|---|"]
        for r in rows:
            if not float(r["xp"] or 0):
                continue
            L.append(f"| {r['etape']} | {r['coureur']} | {r['rang'] or '-'} | "
                     f"{r['rank_points_bareme']} | {r['role_mult']} | {r['underdog_mult']} | "
                     f"{r['classif_bonus']} | {r['nemesis']} | {r['xp']} |")
        L.append("")
    OUT_MD.write_text("\n".join(L), encoding="utf-8")

    print(f"Couche 2 : {len(bareme_ecarts)} ecart(s) de bareme sur {len(xp)} lignes")
    print("\nClassement Vuelta :")
    for i, (t, v) in enumerate(classement, 1):
        print(f"  {i}. {t:<24} {v:>10}")
    print(f"\n{OUT_MD}")


if __name__ == "__main__":
    main()
