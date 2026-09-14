"""Ticket 01 — intra-row incoherence detector.

On a PCS results page, the "Rider" cell embeds the rider's team name, and a
separate "Team" column repeats it. When PCS perturbs a response, it swaps the
rider anchor between two adjacent rows: the anchor (name + href + embedded team)
moves, while BIB / Age / GC / Timelag / the Team column stay with the real row.

The row then contradicts itself. That is detectable without any external source.
"""
from __future__ import annotations

import sys
from pathlib import Path

from selectolax.parser import HTMLParser


def rows(html: str):
    tree = HTMLParser(html)
    tb = tree.css_first(".resultCont .resTab .general table.results") or tree.css_first(
        ".general > table.results"
    )
    hdr = [th.text().strip() for th in tb.css("thead th")]
    i_rnk, i_rider, i_team = hdr.index("Rnk"), hdr.index("Rider"), hdr.index("Team")
    i_bib = hdr.index("BIB") if "BIB" in hdr else None
    out = []
    for tr in tb.css("tbody > tr"):
        tds = tr.css("td")
        if len(tds) <= max(i_rider, i_team):
            continue
        rnk = tds[i_rnk].text().strip()
        rider_cell = tds[i_rider]
        team_col = tds[i_team].text(separator=" ").strip()
        a = [x for x in rider_cell.css("a") if (x.attributes.get("href") or "").startswith("rider/")]
        if not a:
            continue
        # team embedded inside the Rider cell = cell text minus the anchor text
        cell_txt = " ".join(rider_cell.text(separator=" ").split())
        anchor_txt = " ".join(a[0].text(separator=" ").split())
        embedded = cell_txt.replace(anchor_txt, "", 1).strip()
        out.append(
            {
                "rank": rnk,
                "rider": a[0].attributes.get("href"),
                "name": a[0].text().strip(),
                "embedded_team": " ".join(embedded.split()),
                "team_col": " ".join(team_col.split()),
                "bib": tds[i_bib].text().strip() if i_bib is not None else None,
            }
        )
    return out


def main(paths) -> None:
    total_rows = total_bad = 0
    for p in paths:
        rs = rows(Path(p).read_text(encoding="utf-8"))
        bad = [r for r in rs if r["embedded_team"] and r["embedded_team"] != r["team_col"]]
        total_rows += len(rs)
        total_bad += len(bad)
        print(f"\n{Path(p).name}: {len(rs)} lignes, {len(bad)} incoherence(s) intra-ligne")
        for r in bad:
            print(
                f"   rnk={r['rank']:>4} bib={r['bib']:>4} anchor={r['name']:<26} "
                f"anchor-team={r['embedded_team']:<32} Team-col={r['team_col']}"
            )
    print(f"\nTOTAL : {total_bad} incoherences sur {total_rows} lignes")


if __name__ == "__main__":
    main(sys.argv[1:])
