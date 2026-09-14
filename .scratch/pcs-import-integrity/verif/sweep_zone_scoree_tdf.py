"""Ticket 09 — etendue du bug sur le Tour 2026, limitee a la zone qui score.

Compare la base a la page PCS refetchee (correctif actif) sur la seule zone qui
rapporte de l'XP : top 20 d'une etape, top 30 de la GC finale, top 10 des
maillots Points/KOM/Youth. Au-dela, le bareme vaut 0 et un ecart ne change rien.

Lecture seule. Sortie : `etendue-tdf2026-2026-09-14.json`.
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

RACE = "race/tour-de-france/2026"
SWEEP = ROOT / "fixtures" / "sweep-tdf"
OUT = ROOT / "etendue-tdf2026-2026-09-14.json"
SECONDARY = ("points", "kom", "youth")
TARGETS = [f"stage-{s}" for s in range(2, 22)] + ["gc", *SECONDARY]


def norm(s: str) -> str:
    s = (s or "").lower()
    for a, b in (("ø", "o"), ("ł", "l"), ("đ", "d"), ("ß", "ss"), ("æ", "ae")):
        s = s.replace(a, b)
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return " ".join(sorted(t for t in re.sub(r"[^a-z0-9]+", " ", s).split()))


def depth(target: str) -> int:
    return 30 if target == "gc" else (10 if target in SECONDARY else 20)


def main() -> None:
    sb = get_supabase()
    like = f"%{RACE.split('race/')[1]}%"
    base: dict[str, dict[int, str]] = defaultdict(dict)
    for r in _fetch_all(
        lambda: sb.table("race_results")
        .select("race_slug,rank,riders(pcs_slug,full_name)").like("race_slug", like).order("id")
    ):
        base[r["race_slug"].rsplit("/", 1)[1]][r["rank"]] = (r.get("riders") or {}).get("pcs_slug") or ""
    for r in _fetch_all(
        lambda: sb.table("gt_final_classifications")
        .select("race_slug,rank,riders(pcs_slug,full_name)").like("race_slug", like).order("rank")
    ):
        base[r["race_slug"].rsplit("/", 1)[1]][r["rank"]] = (r.get("riders") or {}).get("pcs_slug") or ""

    per: dict[str, dict] = {}
    tot_bad = tot_cmp = 0
    for t in TARGETS:
        st = Stage(f"{RACE}/{t}", html=(SWEEP / f"{t}.html").read_text(encoding="utf-8"), update_html=False)
        entries = st.gc() if t == "gc" else (getattr(st, t)() or [] if t in SECONDARY else st.results())
        pcs = {e["rank"]: (e.get("rider_url") or "") for e in entries if e.get("rank")}
        b = base[t]
        d = depth(t)
        common = [k for k in range(1, d + 1) if k in pcs and k in b]
        bad = [
            {"rank": k, "base": b[k], "pcs_repare": pcs[k]}
            for k in common
            if norm(b[k]) != norm(pcs[k])
        ]
        per[t] = {"profondeur": d, "compares": len(common), "ecarts": bad}
        tot_bad += len(bad)
        tot_cmp += len(common)
        print(f"{t:<9} {len(bad)}/{len(common)}  rangs {[x['rank'] for x in bad]}", flush=True)

    print(f"\nTOTAL zone scoree : {tot_bad} rangs faux / {tot_cmp} compares")
    OUT.write_text(
        json.dumps(
            {"race": RACE, "par_slug": per, "total": {"ecarts": tot_bad, "compares": tot_cmp}},
            indent=2, ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    print(f"Detail : {OUT}")


if __name__ == "__main__":
    main()
