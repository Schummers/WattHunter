"""Ticket 04 — audit lecture seule des 5 jeux de clôture de la Vuelta 2026.

Compare, rang par rang, trois sources :
  PCS-now  : les pages refetchées aujourd'hui, réparées par pcs_deobfuscate
  base     : ce qui est écrit en prod (écrit le 2026-09-14, avec le bug)
  capture  : la transcription des captures de l'utilisateur (vérité établie)

Aucune écriture.
"""
from __future__ import annotations

import json
import sys
import unicodedata
from pathlib import Path

HERE = Path(__file__).resolve()
PCS = HERE.parents[3] / "services" / "pcs-sync"
sys.path.insert(0, str(PCS))
sys.path.insert(0, str(HERE.parent))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(PCS / ".env")

# sync_race monkey-patches procyclingstats' format_time for PCS "same time"
# markers. The import path must match production or the parse blows up.
import sync_race  # noqa: E402,F401
from procyclingstats import Stage  # noqa: E402
from db_utils import _fetch_all  # noqa: E402
from sync import get_supabase  # noqa: E402
import expected_closing as EC  # noqa: E402

FIX = HERE.parents[1] / "fixtures" / "closing"
RACE = "race/vuelta-a-espana/2026"


def norm(s: str) -> frozenset:
    s = (s or "").lower()
    for a, b in (("ø", "o"), ("ł", "l"), ("đ", "d"), ("ß", "ss"), ("æ", "ae")):
        s = s.replace(a, b)
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return frozenset(t for t in s.replace("-", " ").split() if t)


def pcs_now(page: str, method: str) -> dict:
    html = (FIX / f"{page}.html").read_text(encoding="utf-8")
    stage = Stage(f"{RACE}/{page}", html=html, update_html=False)
    entries = getattr(stage, method)()
    return {
        e["rank"]: (e.get("rider_name") or "", e.get("rider_url") or "")
        for e in entries
        if e.get("rank")
    }


def show(label: str, capture: list, now: dict, base: dict, limit: int) -> tuple:
    """capture: list of (rank, name[, pts]) — the ground truth."""
    print(f"\n{'=' * 78}\n{label}\n{'=' * 78}")
    n_bad_base = n_bad_now = 0
    for row in capture:
        rank, name = row[0], row[1]
        if rank > limit:
            break
        nm_now = now.get(rank, ("", ""))[0]
        nm_base = base.get(rank)
        ok_now = norm(nm_now) == norm(name)
        ok_base = nm_base is not None and norm(nm_base) == norm(name)
        if not ok_now:
            n_bad_now += 1
        if nm_base is not None and not ok_base:
            n_bad_base += 1
        if not ok_now or (nm_base is not None and not ok_base):
            flag_now = "  " if ok_now else "!!"
            flag_base = "  " if ok_base else "!!"
            print(
                f"  #{rank:<3} capture={name:<30} "
                f"{flag_now}pcs-now={nm_now:<30} "
                f"{flag_base}base={nm_base if nm_base is not None else '(absent)'}"
            )
    checked = sum(1 for r in capture if r[0] <= limit)
    in_base = sum(1 for r in capture if r[0] <= limit and r[0] in base)
    print(
        f"  -> {checked} rangs dans la capture | "
        f"pcs-now : {n_bad_now} ecart(s) | "
        f"base : {n_bad_base} ecart(s) sur {in_base} rangs presents"
    )
    return n_bad_now, n_bad_base


def main() -> None:
    sb = get_supabase()

    def rr(slug: str) -> dict:
        rows = _fetch_all(
            lambda: sb.table("race_results")
            .select("rank,riders(full_name)")
            .eq("race_slug", slug)
            .order("rank")
        )
        return {r["rank"]: ((r.get("riders") or {}).get("full_name") or "") for r in rows}

    def gfc(slug: str) -> dict:
        rows = _fetch_all(
            lambda: sb.table("gt_final_classifications")
            .select("rank,riders(full_name)")
            .eq("race_slug", slug)
            .order("rank")
        )
        return {r["rank"]: ((r.get("riders") or {}).get("full_name") or "") for r in rows}

    totals = []
    totals.append(show("ETAPE 21", EC.STAGE_21, pcs_now("stage-21", "results"), rr(f"{RACE}/stage-21"), 31))
    totals.append(show("GC FINAL", EC.GC_FINAL, pcs_now("gc", "gc"), rr(f"{RACE}/gc"), 36))
    totals.append(show("POINTS FINAL", EC.POINTS_FINAL, pcs_now("points", "points"), gfc(f"{RACE}/points"), 20))

    # KOM / Youth : la capture a ete resolue en slugs PCS, pas en noms.
    fin = json.loads((HERE.parents[1] / "finals-kom-youth.json").read_text(encoding="utf-8"))
    for ctype in ("kom", "youth"):
        now = pcs_now(ctype, ctype)
        base = gfc(f"{RACE}/{ctype}")
        print(f"\n{'=' * 78}\n{ctype.upper()} FINAL (zone scoree : rangs 1-10)\n{'=' * 78}")
        bad = 0
        for rank, slug in fin[ctype]:
            if rank > 10:
                break
            got = now.get(rank, ("", ""))[1]
            if got != slug:
                bad += 1
                print(f"  #{rank:<3} capture={slug:<45} pcs-now={got}")
        print(f"  -> 10 rangs scores | pcs-now : {bad} ecart(s) | base : {len(base)} ligne(s) en prod")
        totals.append((bad, 0))

    print(f"\n{'=' * 78}")
    print(f"TOTAL  pcs-now vs capture : {sum(t[0] for t in totals)} ecart(s)")
    print(f"TOTAL  base    vs capture : {sum(t[1] for t in totals)} ecart(s)")


if __name__ == "__main__":
    main()
