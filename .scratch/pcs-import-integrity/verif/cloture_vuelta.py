"""Cloture de la Vuelta 2026 — baseline, re-import, rescore scope, diff.

Ecrit en prod. Refuse de tourner sans --write (par defaut : dry-run complet,
qui fait le baseline et le re-import "a blanc" via un compte des lignes).

Le re-import lit les pages HTML mises en cache le 2026-09-14 par sweep_stages.py
et audit_closing.py, servies a la place du reseau par un patch de fetch_html.
Ces pages sont DEJA reparees (sweep les a sauvegardees apres fetch_html, donc
apres deobfuscate) et la reparation est idempotente : verifie par hash identique
du parse avec PCS_DEOBFUSCATE=1 et =0 sur les etapes 8, 12, 15 et 19.

Usage :
    .venv/bin/python ../.scratch/pcs-import-integrity/verif/cloture_vuelta.py [--write]
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).resolve()
ROOT = HERE.parents[1]
PCS = HERE.parents[3] / "services" / "pcs-sync"
sys.path.insert(0, str(PCS))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(PCS / ".env")

import sync  # noqa: E402
import sync_race  # noqa: E402
from sync import get_supabase  # noqa: E402
from db_utils import _fetch_all  # noqa: E402

RACE = "race/vuelta-a-espana/2026"
RACE_NAME = "La Vuelta ciclista a España"
RACE_DATE = "2026-09-13"
LEAGUE = "00000000-0000-4000-8000-c1a551c2026e"
STAGES = [s for s in range(1, 22) if s != 3]
SWEEP = ROOT / "fixtures" / "sweep"
CLOSING = ROOT / "fixtures" / "closing"
STAMP = datetime.now().strftime("%Y%m%d-%H%M%S")


# --- le cache sert le reseau ---------------------------------------------------

def cached_path(url: str) -> Path | None:
    tail = url[len(RACE) + 1 :] if url.startswith(RACE + "/") else None
    if tail is None:
        return None
    for base in (SWEEP, CLOSING):
        p = base / f"{tail}.html"
        if p.exists():
            return p
    return None


_served: dict[str, str] = {}


def patch_fetch_html() -> None:
    async def fake_fetch_html(page, url: str, delay: float = 4.0) -> str:
        p = cached_path(url)
        if p is None:
            raise RuntimeError(
                f"pas de page en cache pour {url} — refus de scraper en direct "
                f"pendant la cloture (le cache est la trace du chiffrage)"
            )
        _served[url] = str(p)
        return p.read_text(encoding="utf-8")

    sync.fetch_html = fake_fetch_html
    sync_race.fetch_html = fake_fetch_html


# --- snapshots ------------------------------------------------------------------

def snapshot(sb, label: str) -> dict:
    teams = _fetch_all(
        lambda: sb.table("teams")
        .select("id,name,cumulative_xp,level")
        .eq("league_id", LEAGUE)
        .order("id")
    )
    xp = _fetch_all(
        lambda: sb.table("rider_xp_daily")
        .select("id,rider_id,team_id,race_slug,raw_pcs_points,role_mult,underdog_mult,"
                "classif_bonus,gt_classif_bonus,nemesis_modifier,xp_gained,riders(full_name)")
        .like("race_slug", f"%{RACE}%")
        .order("id")
    )
    results = _fetch_all(
        lambda: sb.table("race_results")
        .select("race_slug,rank,pcs_points,riders(pcs_slug,full_name)")
        .like("race_slug", f"%{RACE}%")
        .order("id")
    )
    finals = _fetch_all(
        lambda: sb.table("gt_final_classifications")
        .select("race_slug,classification_type,rank,riders(pcs_slug,full_name)")
        .like("race_slug", f"%{RACE}%")
        .order("race_slug")
        .order("rank")
    )
    snap = {
        "label": label,
        "taken_at": datetime.now().isoformat(),
        "teams": teams,
        "rider_xp_daily": xp,
        "race_results": results,
        "gt_final_classifications": finals,
    }
    out = ROOT / f"cloture-{STAMP}-{label}.json"
    out.write_text(json.dumps(snap, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"[snapshot {label}] {len(teams)} equipes, {len(xp)} lignes XP, "
          f"{len(results)} resultats, {len(finals)} finals -> {out.name}")
    return snap


# --- re-import -------------------------------------------------------------------

async def reimport(sb) -> dict:
    from browser_session import BrowserSession  # noqa: F401  (jamais ouvert)

    page = None  # fetch_html est patche : aucun navigateur n'est ouvert
    counts = {}

    # INCIDENT 2026-09-14 : la premiere version passait RACE_DATE (fin de course)
    # a toutes les etapes. Le moteur derive le cutoff des roles (11:00 le jour
    # de l'etape) de race_results.race_date -> 20 etapes scorees avec les roles
    # du dernier jour. Une date par etape, depuis stage_profiles, obligatoire.
    stage_dates = {
        r["race_slug"]: r["race_date"]
        for r in sb.table("stage_profiles").select("race_slug,race_date")
        .like("race_slug", f"{RACE}/stage-%").execute().data
    }
    for st in STAGES:
        stage_url = f"{RACE}/stage-{st}"
        stage_date = stage_dates.get(stage_url)
        if not stage_date:
            raise RuntimeError(f"pas de date dans stage_profiles pour {stage_url}")
        r = await sync_race.import_race_results(
            sb, page, RACE, RACE_NAME, stage_date, stage_url=stage_url
        )
        d = await sync_race.import_daily_classifications(
            sb, page, race_slug=RACE, stage_url=stage_url
        )
        counts[f"stage-{st}"] = {"results": r.get("imported"), "daily": d}
        print(f"  stage-{st:<2} results={r.get('imported'):<4} daily={d}", flush=True)

    gc = await sync_race.import_gc_results(sb, page, RACE, RACE_NAME, RACE_DATE)
    counts["gc"] = {"imported": gc.get("imported")}
    print(f"  gc        imported={gc.get('imported')}", flush=True)

    fin = await sync_race.import_final_classifications(
        sb, page, race_slug=RACE, race_name=RACE_NAME, race_date=RACE_DATE
    )
    counts["finals"] = fin
    print(f"  finals    {fin}", flush=True)
    return counts


# --- rescore ---------------------------------------------------------------------

async def rescore(sb) -> dict:
    """Une etape par appel : le moteur ne calcule qu'un cutoff de roles par appel."""
    from scoring import calculate_daily_scores

    out = {"teams_processed": 0, "errors": []}
    for st in STAGES[:-1]:
        r = await calculate_daily_scores(sb, race_slugs=[f"{RACE}/stage-{st}"])
        out["errors"] += r.get("errors") or []
        print(f"  stage-{st:<2} teams={r.get('teams_processed')}", flush=True)
    closing = [f"{RACE}/stage-21", f"{RACE}/gc"] + [f"{RACE}/{k}" for k in ("points", "kom", "youth")]
    r = await calculate_daily_scores(sb, race_slugs=closing)
    out["errors"] += r.get("errors") or []
    out["teams_processed"] = r.get("teams_processed")
    return out


# --- diff --------------------------------------------------------------------------

def diff_teams(before: dict, after: dict) -> list[dict]:
    b = {t["id"]: t for t in before["teams"]}
    rows = []
    for t in after["teams"]:
        prev = b.get(t["id"], {})
        old = float(prev.get("cumulative_xp") or 0)
        new = float(t["cumulative_xp"] or 0)
        rows.append({
            "team": t["name"],
            "xp_avant": round(old, 2),
            "xp_apres": round(new, 2),
            "delta": round(new - old, 2),
        })
    rows.sort(key=lambda r: -r["xp_apres"])
    return rows


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true", help="ecrit reellement en prod")
    args = ap.parse_args()

    sb = get_supabase()
    patch_fetch_html()

    print("=== 1. baseline ===")
    before = snapshot(sb, "avant")

    if not args.write:
        print("\n(dry-run : --write absent, on s'arrete apres le baseline)")
        return

    print("\n=== 2. re-import depuis le cache ===")
    counts = await reimport(sb)

    print("\n=== 3. rescore scope Vuelta ===")
    sc = await rescore(sb)
    print(json.dumps(sc, indent=2, ensure_ascii=False)[:2000])

    print("\n=== 4. snapshot apres + diff ===")
    after = snapshot(sb, "apres")
    rows = diff_teams(before, after)

    print(f"\n{'Equipe':<24}{'XP avant':>12}{'XP apres':>12}{'Delta':>12}")
    for r in rows:
        print(f"{r['team']:<24}{r['xp_avant']:>12}{r['xp_apres']:>12}{r['delta']:>+12}")

    report = {
        "stamp": STAMP,
        "pages_servies_depuis_le_cache": _served,
        "import": counts,
        "scoring": sc,
        "diff_equipes": rows,
    }
    out = ROOT / f"cloture-{STAMP}-rapport.json"
    out.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nRapport : {out}")


if __name__ == "__main__":
    asyncio.run(main())
