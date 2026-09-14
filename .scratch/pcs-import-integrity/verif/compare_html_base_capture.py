"""Ticket 01 — three-way comparison, per rank:
   HTML fetched now  vs  DB (imported 2026-08)  vs  capture (ground truth).

Read-only.
"""
from __future__ import annotations

import sys
import unicodedata
from pathlib import Path

HERE = Path(__file__).resolve()
PCS = HERE.parents[3] / "services" / "pcs-sync"
sys.path.insert(0, str(PCS))
sys.path.insert(0, str(HERE.parent))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(PCS / ".env")

from selectolax.parser import HTMLParser  # noqa: E402
from procyclingstats import Stage  # noqa: E402
from db_utils import _fetch_all  # noqa: E402
from sync import get_supabase  # noqa: E402
from expected import EXPECTED  # noqa: E402

FIX = HERE.parents[1] / "fixtures"


def norm(s: str) -> frozenset:
    s = (s or "").lower()
    for a, b in (("ø", "o"), ("ł", "l"), ("đ", "d"), ("ß", "ss"), ("æ", "ae")):
        s = s.replace(a, b)
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return frozenset(t for t in s.replace("-", " ").split() if t)


def html_rank_map(path: Path, slug: str):
    html = path.read_text(encoding="utf-8")
    stage = Stage(slug, html=html, update_html=False)
    by_rank = {}
    for e in stage.results():
        if e.get("rank"):
            by_rank[e["rank"]] = (e.get("rider_name") or "", e.get("team_name") or "")
    # also raw, row by row, independent of the lib
    tree = HTMLParser(html)
    tb = tree.css_first(".resultCont .resTab .general table.results") or tree.css_first(
        ".general > table.results"
    )
    hdr = [th.text().strip() for th in tb.css("thead th")]
    ri = hdr.index("Rnk")
    raw = {}
    for tr in tb.css("tbody > tr"):
        cells = [td.text(separator=" ").strip() for td in tr.css("td")]
        if ri >= len(cells) or not cells[ri].isdigit():
            continue
        names = [
            a.text().strip()
            for a in tr.css("a")
            if (a.attributes.get("href") or "").startswith("rider/")
        ]
        raw[int(cells[ri])] = names[0] if names else ""
    return by_rank, raw


def main() -> None:
    sb = get_supabase()
    grand_total = {"agree": 0, "html_vs_capture": 0, "base_vs_capture": 0}
    for st in sorted(EXPECTED):
        path = FIX / f"vuelta-2026-stage-{st}.raw.html"
        if not path.exists():
            continue
        slug = f"race/vuelta-a-espana/2026/stage-{st}"
        lib, raw = html_rank_map(path, slug)
        rows = _fetch_all(
            lambda: sb.table("race_results")
            .select("rank,riders(full_name)")
            .eq("race_slug", slug)
            .order("rank")
        )
        base = {r["rank"]: ((r.get("riders") or {}).get("full_name") or "") for r in rows}

        names = EXPECTED[st]
        print(f"\n=== stage-{st} ===")
        bad_html = bad_base = ok = 0
        for i, exp in enumerate(names, 1):
            h = lib.get(i, ("", ""))[0] or raw.get(i, "")
            b = base.get(i)
            h_ok = norm(h) == norm(exp)
            if not h_ok:
                bad_html += 1
            if b is not None:
                if norm(b) == norm(exp):
                    ok += 1
                else:
                    bad_base += 1
            if not h_ok or (b is not None and norm(b) != norm(exp)):
                print(
                    f"  #{i:<3} capture={exp:<26} html-now={h:<26} base={b if b is not None else '(hors pool)'}"
                )
        print(f"  -> html-now vs capture : {bad_html} ecart(s) sur {len(names)} rangs")
        print(f"  -> base vs capture     : {bad_base} ecart(s) sur {ok + bad_base} rangs importes")
        grand_total["html_vs_capture"] += bad_html
        grand_total["base_vs_capture"] += bad_base
        grand_total["agree"] += ok
    print(f"\nTOTAL : {grand_total}")


if __name__ == "__main__":
    main()
