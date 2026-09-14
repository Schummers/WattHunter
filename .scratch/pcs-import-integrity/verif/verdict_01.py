"""Ticket 01 — verdict: does the raw HTML carry the misalignment (H1),
or does procyclingstats.Stage.results() produce it (H2)?

Read-only, offline: works on the saved HTML fixture.
"""
from __future__ import annotations

import sys
from pathlib import Path

HERE = Path(__file__).resolve()
PCS = HERE.parents[3] / "services" / "pcs-sync"
sys.path.insert(0, str(PCS))

from selectolax.parser import HTMLParser  # noqa: E402
from procyclingstats import Stage  # noqa: E402

TABLES_PATH = ".resultCont .resTab .general table.results"


def raw_rows(html: str):
    """Read the results table row by row, as a human would."""
    tree = HTMLParser(html)
    table = tree.css_first(TABLES_PATH)
    if table is None:
        table = tree.css_first(".general > table.results")
    header = [th.text().strip() for th in table.css("thead th")]
    out = []
    for tr in table.css("tbody > tr"):
        tds = tr.css("td")
        cells = [td.text(separator=" ").strip() for td in tds]
        rider_links = [
            a.attributes.get("href", "")
            for a in tr.css("a")
            if (a.attributes.get("href") or "").startswith("rider/")
        ]
        team_links = [
            a.text().strip()
            for a in tr.css("a")
            if (a.attributes.get("href") or "").startswith("team/")
        ]
        all_links = [a.attributes.get("href", "") for a in tr.css("a")]
        out.append(
            {
                "cells": cells,
                "rider_links": rider_links,
                "team_links": team_links,
                "all_links": all_links,
                "n_a": len(tr.css("a")),
            }
        )
    return header, out


def main(path: str, focus: int) -> None:
    html = Path(path).read_text(encoding="utf-8")
    header, rows = raw_rows(html)
    print(f"header = {header}")
    print(f"rows   = {len(rows)}")

    def col(name):
        return header.index(name) if name in header else None

    rnk_i = col("Rnk")
    print("\n--- RAW HTML, rows 1..20 (rank cell | rider link | team) ---")
    for i, r in enumerate(rows[:20]):
        rnk = r["cells"][rnk_i] if rnk_i is not None and rnk_i < len(r["cells"]) else "?"
        print(
            f"  row[{i:>3}] rnk={rnk:>4} riders={r['rider_links']} "
            f"team={r['team_links']} n_a={r['n_a']}"
        )

    print("\n--- Stage.results(), entries 0..19 ---")
    stage = Stage("race/vuelta-a-espana/2026/stage-4", html=html, update_html=False)
    res = stage.results()
    for i, e in enumerate(res[:20]):
        print(
            f"  res[{i:>3}] rank={e.get('rank')} url={e.get('rider_url')} "
            f"team={e.get('team_name')} pts={e.get('pcs_points')} time={e.get('time')}"
        )

    print(f"\n--- FOCUS rank {focus} ---")
    raw_focus = [
        (i, r) for i, r in enumerate(rows)
        if rnk_i is not None and rnk_i < len(r["cells"]) and r["cells"][rnk_i] == str(focus)
    ]
    for i, r in raw_focus:
        print(f"  raw row[{i}]: rank cell={focus} riders={r['rider_links']} team={r['team_links']}")
    for e in res:
        if e.get("rank") == focus:
            print(f"  results(): rank={focus} url={e.get('rider_url')} team={e.get('team_name')}")

    # Structural check: rows whose rider-link count != 1
    print("\n--- Rows with != 1 rider link (zip-shift candidates) ---")
    bad = [(i, r) for i, r in enumerate(rows) if len(r["rider_links"]) != 1]
    if not bad:
        print("  none")
    for i, r in bad:
        rnk = r["cells"][rnk_i] if rnk_i is not None else "?"
        print(f"  row[{i}] rnk={rnk} riders={r['rider_links']} cells={r['cells'][:6]}")

    # Structural check: intra-row incoherence rider/team is not checkable offline,
    # but report the a-element count distribution.
    from collections import Counter
    print("\n--- <a> per row distribution ---", Counter(r["n_a"] for r in rows))

    # Full row-by-row cross check raw vs results()
    print("\n--- Cross-check raw vs results() on all rows ---")
    mismatches = 0
    for i, (r, e) in enumerate(zip(rows, res)):
        raw_rider = r["rider_links"][0] if r["rider_links"] else None
        raw_rnk = r["cells"][rnk_i] if rnk_i is not None and rnk_i < len(r["cells"]) else None
        if raw_rider != e.get("rider_url") or (raw_rnk or "") != str(e.get("rank") or ""):
            mismatches += 1
            if mismatches <= 25:
                print(
                    f"  [{i}] raw rnk={raw_rnk} rider={raw_rider} || "
                    f"res rank={e.get('rank')} rider={e.get('rider_url')}"
                )
    print(f"  total row mismatches: {mismatches} / {min(len(rows), len(res))}")
    print(f"  len(raw rows)={len(rows)} len(results)={len(res)}")


if __name__ == "__main__":
    main(sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 8)
