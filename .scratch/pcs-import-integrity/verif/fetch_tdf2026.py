"""Ticket 09 — refetch lecture seule des pages PCS du Tour 2026.

Passe par le chemin de production (`fetch_html`), donc par `pcs_deobfuscate`.
Ecrit uniquement dans `fixtures/sweep-tdf/`. Aucune ecriture en base.

Le brouillage PCS tourne dans le temps : ce qu'on recupere ici est l'etat du
jour, repare. C'est la reference PCS contre laquelle on compare la base.
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

HERE = Path(__file__).resolve()
PCS = HERE.parents[3] / "services" / "pcs-sync"
sys.path.insert(0, str(PCS))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(PCS / ".env")

import sync_race  # noqa: E402,F401
from browser_session import BrowserSession  # noqa: E402
from run_pipeline import USER_AGENT  # noqa: E402
from sync import fetch_html  # noqa: E402

RACE = "race/tour-de-france/2026"
CACHE = HERE.parents[1] / "fixtures" / "sweep-tdf"
TARGETS = [f"stage-{s}" for s in range(1, 22)] + ["gc", "points", "kom", "youth"]


async def main() -> None:
    CACHE.mkdir(parents=True, exist_ok=True)
    ok = fail = skip = 0
    async with BrowserSession() as browser:
        for t in TARGETS:
            dest = CACHE / f"{t}.html"
            if dest.exists() and dest.stat().st_size > 10_000:
                print(f"{t:<10} cache", flush=True)
                skip += 1
                continue
            slug = f"{RACE}/{t}"
            ctx = await browser.new_context(user_agent=USER_AGENT)
            page = await ctx.new_page()
            try:
                html = await fetch_html(page, slug)
                dest.write_text(html, encoding="utf-8")
                print(f"{t:<10} OK {len(html)} octets", flush=True)
                ok += 1
            except Exception as exc:
                print(f"{t:<10} ERREUR {type(exc).__name__}: {exc}", flush=True)
                fail += 1
            finally:
                await ctx.close()
    print(f"\nok={ok} cache={skip} erreurs={fail}  ->  {CACHE}")


if __name__ == "__main__":
    asyncio.run(main())
