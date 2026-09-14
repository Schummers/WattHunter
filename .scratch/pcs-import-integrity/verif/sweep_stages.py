"""Ticket 05/06 — balayage lecture seule de toutes les etapes de la Vuelta 2026.

Refetch chaque etape par le chemin de production (donc reparee par
pcs_deobfuscate), et diff rang par rang contre ce qui est en base.

Ne compare que les rangs presents en base : un coureur hors pool y fait un trou
legitime. Aucune ecriture.
"""
from __future__ import annotations

import asyncio
import json
import sys
import unicodedata
from pathlib import Path

HERE = Path(__file__).resolve()
PCS = HERE.parents[3] / "services" / "pcs-sync"
sys.path.insert(0, str(PCS))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(PCS / ".env")

import sync_race  # noqa: E402,F401  (monkey-patch format_time, comme en prod)
from procyclingstats import Stage  # noqa: E402
from browser_session import BrowserSession  # noqa: E402
from run_pipeline import USER_AGENT  # noqa: E402
from sync import fetch_html, get_supabase  # noqa: E402
from db_utils import _fetch_all  # noqa: E402

RACE = "race/vuelta-a-espana/2026"
OUT = HERE.parents[1] / "sweep-stages-2026-09-14.json"
CACHE = HERE.parents[1] / "fixtures" / "sweep"
# Etape 3 annulee (meteo, col de Mont-Louis) : rien a scorer, trou legitime.
STAGES = [s for s in range(1, 22) if s != 3]


def norm(s: str) -> frozenset:
    s = (s or "").lower()
    for a, b in (("ø", "o"), ("ł", "l"), ("đ", "d"), ("ß", "ss"), ("æ", "ae")):
        s = s.replace(a, b)
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return frozenset(t for t in s.replace("-", " ").split() if t)


async def main() -> None:
    CACHE.mkdir(parents=True, exist_ok=True)
    sb = get_supabase()
    report = {}

    async with BrowserSession() as browser:
        for st in STAGES:
            slug = f"{RACE}/stage-{st}"
            cached = CACHE / f"stage-{st}.html"
            try:
                if cached.exists():
                    html = cached.read_text(encoding="utf-8")
                else:
                    ctx = await browser.new_context(user_agent=USER_AGENT)
                    page = await ctx.new_page()
                    try:
                        html = await fetch_html(page, slug)
                    finally:
                        await ctx.close()
                    cached.write_text(html, encoding="utf-8")

                now = {
                    e["rank"]: (e.get("rider_url") or "", e.get("pcs_points"))
                    for e in Stage(slug, html=html, update_html=False).results()
                    if e.get("rank")
                }
            except Exception as exc:
                report[st] = {"error": f"{type(exc).__name__}: {exc}"}
                print(f"stage-{st:<2} ERREUR {type(exc).__name__}: {exc}", flush=True)
                continue

            rows = _fetch_all(
                lambda: sb.table("race_results")
                .select("rank,pcs_points,riders(pcs_slug,full_name)")
                .eq("race_slug", slug)
                .order("rank")
            )
            diffs = []
            for r in rows:
                rank = r["rank"]
                expected = now.get(rank)
                if expected is None:
                    continue
                got_slug = (r.get("riders") or {}).get("pcs_slug") or ""
                if got_slug != expected[0]:
                    diffs.append(
                        {
                            "rank": rank,
                            "pcs_now": expected[0],
                            "pcs_now_points": expected[1],
                            "base": got_slug,
                            "base_points": r.get("pcs_points"),
                        }
                    )
            report[st] = {"rows_in_base": len(rows), "compared": sum(1 for r in rows if r["rank"] in now), "diffs": diffs}
            print(f"stage-{st:<2} {len(rows):>3} lignes en base, {len(diffs)} ecart(s)", flush=True)

    OUT.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    total = sum(len(v.get("diffs", [])) for v in report.values())
    touched = [s for s, v in report.items() if v.get("diffs")]
    print(f"\nTOTAL : {total} ecart(s) sur {len(touched)} etape(s) : {touched}")
    print(f"Detail : {OUT}")


if __name__ == "__main__":
    asyncio.run(main())
