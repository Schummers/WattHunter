"""pcs_deobfuscate.py — undo procyclingstats' results-table obfuscation.

Why this exists
---------------
PCS scrambles the DOM order of rider name cells in its results tables and puts
the names back in the right place with CSS. On a scrambled row the
``<td class="ridername">`` carries the *neighbouring* rider (name, href, and the
team printed inside the cell), while BIB, age, rank, points and the separate
``Team`` column stay with the real row. The site's main stylesheet then holds,
for the affected table and row numbers::

    .results[data-id="SEINSF"] tbody tr:nth-child(6) div.cont { position:absolute; top: 26px; }
    .results[data-id="SEINSF"] tbody tr:nth-child(7) div.cont { position:absolute; top:-19px; }

``26px`` and ``-19px`` are one row pitch each way, so the two names are repainted
in each other's row and the rendered page is correct. A human reads the truth;
anything reading the markup reads a lie.

Proven on 2026-09-14 (`.scratch/pcs-import-integrity/issues/01`): it is what put
13 wrong ranks into `race_results` for the Vuelta 2026. It moves over time — a
stage scrambled in August can be clean today and vice versa, so a blind
re-import repairs one stage and breaks another.

What this module does
---------------------
Two independent signals, both free, both inside the HTML we already download:

1. ``data-id`` non-empty on a ``table.results`` — PCS's own flag for a scrambled
   table. Empty on every clean table observed.
2. **Intra-row incoherence** — the team printed inside the Rider cell contradicts
   the ``Team`` column. Measured at 0 false positives on 670 clean rows, and it
   picks out exactly the rows the stylesheet names.

Signal 2 locates the rows; the repair swaps the ``div.cont`` blocks back between
the two rows of each pair, which is the exact inverse of what PCS did. Signal 1
is the safety net: if PCS flags a table and we find nothing to repair, we refuse
rather than write.

The guard is the point. The failure mode that caused this incident was silence:
``imported: 106, skipped: 36`` and wrong data in the database. An import that
cannot vouch for its alignment must fail loudly.
"""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from typing import List, Optional

from selectolax.parser import HTMLParser, Node

logger = logging.getLogger(__name__)

#: Set ``PCS_DEOBFUSCATE=0`` to disable both repair and guard. Escape hatch for
#: the day PCS changes the scheme and this module blocks an urgent import; the
#: data it lets through is then unverified.
ENV_FLAG = "PCS_DEOBFUSCATE"


class ObfuscationError(RuntimeError):
    """The page is scrambled in a way we cannot undo. Refuse to import."""


@dataclass
class Swap:
    """One repaired pair of adjacent rows."""

    table_index: int
    data_id: Optional[str]
    row_a: int
    row_b: int
    rank_a: str
    rank_b: str
    rider_a: str
    rider_b: str

    def __str__(self) -> str:
        return (
            f"table#{self.table_index}(data-id={self.data_id!r}) "
            f"rangs {self.rank_a}/{self.rank_b} : {self.rider_a} <-> {self.rider_b}"
        )


@dataclass
class Report:
    swaps: List[Swap] = field(default_factory=list)
    flagged_tables: List[str] = field(default_factory=list)
    scanned_tables: int = 0
    scanned_rows: int = 0

    @property
    def repaired(self) -> bool:
        return bool(self.swaps)


@dataclass
class _Row:
    index: int  # 1-based, matches CSS nth-child
    rank: str
    rider_cell: Node
    cont: Node
    rider_url: str
    rider_name: str
    anchor_team: str
    column_team: str

    @property
    def incoherent(self) -> bool:
        return bool(self.anchor_team) and bool(self.column_team) and self.anchor_team != self.column_team


def _txt(node: Optional[Node]) -> str:
    if node is None:
        return ""
    return " ".join(node.text(separator=" ").split())


def _read_rows(table: Node) -> List[_Row]:
    """Read a results table row by row. Returns [] for tables without riders."""
    headers = [_txt(th) for th in table.css("thead th")]
    try:
        team_idx = headers.index("Team")
    except ValueError:
        return []

    rows: List[_Row] = []
    for i, tr in enumerate(table.css("tbody > tr"), start=1):
        cells = tr.css("td")
        rider_cell = tr.css_first("td.ridername")
        if rider_cell is None or team_idx >= len(cells):
            continue
        cont = rider_cell.css_first("div.cont")
        anchor = rider_cell.css_first('a[href^="rider/"]')
        if cont is None or anchor is None:
            continue
        rows.append(
            _Row(
                index=i,
                rank=_txt(cells[0]) if cells else "",
                rider_cell=rider_cell,
                cont=cont,
                rider_url=anchor.attributes.get("href") or "",
                rider_name=_txt(anchor),
                # The team printed inside the Rider cell travels with the name.
                anchor_team=_txt(rider_cell.css_first("div.showIfMobile")),
                # The Team column stays with the real row.
                column_team=_txt(cells[team_idx]),
            )
        )
    return rows


def _pair_up(rows: List[_Row], suspects: List[_Row], where: str) -> List[tuple]:
    """Match incoherent rows into adjacent, mutually-crossed pairs.

    A pair is only accepted when each row's printed team is the other's column
    team — the exact signature of a two-row swap. Anything else (an odd row out,
    a longer cycle, a lone mismatch) is unresolvable and raises: we would rather
    import nothing than guess.
    """
    by_index = {r.index: r for r in rows}
    remaining = {r.index for r in suspects}
    pairs = []

    for row in suspects:
        if row.index not in remaining:
            continue
        partner = by_index.get(row.index + 1)
        if (
            partner is None
            or partner.index not in remaining
            or partner.anchor_team != row.column_team
            or row.anchor_team != partner.column_team
        ):
            raise ObfuscationError(
                f"{where}: ligne {row.index} (rang {row.rank}, "
                f"ancre={row.rider_name!r} equipe-ancre={row.anchor_team!r} "
                f"colonne-Team={row.column_team!r}) incoherente sans paire voisine "
                f"croisee. Permutation non reconnue : import refuse plutot "
                f"qu'ecrit faux."
            )
        remaining.discard(row.index)
        remaining.discard(partner.index)
        pairs.append((row, partner))

    return pairs


def _swap_conts(a: _Row, b: _Row) -> None:
    """Put each rider block back in its own row."""
    node_a = HTMLParser(a.cont.html or "").css_first("div.cont")
    node_b = HTMLParser(b.cont.html or "").css_first("div.cont")
    if node_a is None or node_b is None:  # pragma: no cover - defensive
        raise ObfuscationError("Impossible de re-parser un bloc div.cont")
    a.cont.replace_with(node_b)
    b.cont.replace_with(node_a)


def deobfuscate(html: str, *, source: str = "<html>") -> tuple[str, Report]:
    """Return (repaired_html, report).

    Raises ObfuscationError when the page is scrambled in a shape we do not
    recognise, or when PCS flags a table we cannot find anything wrong with.
    """
    report = Report()
    if os.environ.get(ENV_FLAG, "1") == "0":
        logger.warning("%s=0 : deobfuscation et garde-fou desactives pour %s", ENV_FLAG, source)
        return html, report

    tree = HTMLParser(html)
    tables = tree.css("table.results")
    touched = False

    for t_i, table in enumerate(tables):
        rows = _read_rows(table)
        if not rows:
            continue
        report.scanned_tables += 1
        report.scanned_rows += len(rows)

        data_id = (table.attributes.get("data-id") or "").strip()
        suspects = [r for r in rows if r.incoherent]

        if data_id:
            report.flagged_tables.append(data_id)
            if not suspects:
                raise ObfuscationError(
                    f"{source} : table #{t_i} porte data-id={data_id!r} "
                    f"(marqueur de brouillage PCS) mais aucune ligne incoherente "
                    f"n'a ete trouvee. Le schema a peut-etre change : import refuse."
                )

        if not suspects:
            continue

        for a, b in _pair_up(rows, suspects, where=f"{source} table #{t_i}"):
            _swap_conts(a, b)
            touched = True
            report.swaps.append(
                Swap(
                    table_index=t_i,
                    data_id=data_id or None,
                    row_a=a.index,
                    row_b=b.index,
                    rank_a=a.rank,
                    rank_b=b.rank,
                    # After the swap, row A carries what row B's cell held.
                    rider_a=b.rider_name,
                    rider_b=a.rider_name,
                )
            )

        # Clear PCS's scramble flag once the table is repaired, so running this
        # again on the same HTML is a clean no-op instead of tripping the
        # "flagged but nothing wrong" guard.
        if data_id:
            table.attrs["data-id"] = ""

    if not touched:
        return html, report

    for swap in report.swaps:
        logger.warning("Brouillage PCS repare — %s (%s)", swap, source)

    return tree.html or html, report
