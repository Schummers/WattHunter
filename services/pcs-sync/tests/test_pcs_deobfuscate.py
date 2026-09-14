"""Tests for the PCS results-table de-obfuscation (issue 01/03, 2026-09-14).

These run on **real PCS HTML** saved from the live site, not on synthetic
skeletons. That is the whole point: the bug lives in exactly what a skeleton
simplifies away, and two Grand Tour closeouts passed their "0 écart" checks
while the data was wrong.

Fixtures (gzipped, `tests/fixtures/`):
  - `vuelta-2026-stage-19` — scrambled: 5 tables flagged, 9 swapped pairs. The
    stage table's pairs are rows 6/7, 15/16 and 29/30, which is exactly what
    PCS's own stylesheet named the day it was captured.
  - `vuelta-2026-stage-4` — clean: same page shape, an out-of-pool rider mid
    ranking (rank 14, Torres, absent from our pool), same-time groups rendered
    as `,,`. It is the false-positive guard.

Ground truth is the user's screenshot of the rendered page, transcribed below.
The rendered page is correct; only the markup lies.
"""
from __future__ import annotations

import gzip
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from helpers import make_supabase

FIXTURES = Path(__file__).parent / "fixtures"

STAGE_19 = "race/vuelta-a-espana/2026/stage-19"
STAGE_4 = "race/vuelta-a-espana/2026/stage-4"

# From the capture of the rendered page, ranks 5..10 and 14..17.
STAGE_19_TRUTH = {
    5: "rider/marcel-camprubi",
    6: "rider/andreas-leknessund",
    7: "rider/guillaume-martin",
    8: "rider/chris-hamilton",
    9: "rider/kevin-vermaerke",
    14: "rider/primoz-roglic",
    15: "rider/oscar-onley",
    16: "rider/enric-mas",
    17: "rider/jakob-omrzel",
}

STAGE_4_TRUTH = {
    7: "rider/primoz-roglic",
    8: "rider/richard-carapaz",
    9: "rider/mattias-skjelmose-jensen",
    13: "rider/harold-tejada",
    # rank 14 is Pablo Torres, absent from our rider pool: a legitimate hole
    15: "rider/marco-brenner",
    16: "rider/clement-berthet",
}


def load(name: str) -> str:
    with gzip.open(FIXTURES / f"{name}.html.gz", "rt", encoding="utf-8") as fh:
        return fh.read()


def ranks_to_riders(html: str, slug: str) -> dict:
    from procyclingstats import Stage

    return {
        e["rank"]: e["rider_url"]
        for e in Stage(slug, html=html, update_html=False).results()
        if e.get("rank")
    }


# ---------------------------------------------------------------------------
# The bug, and the fix
# ---------------------------------------------------------------------------


def test_scrambled_page_is_wrong_before_repair():
    """Guard against a fix that silently stops testing anything.

    If this ever starts passing, the fixture is no longer scrambled and the
    tests below prove nothing.
    """
    raw = ranks_to_riders(load("vuelta-2026-stage-19"), STAGE_19)

    assert raw[6] == "rider/guillaume-martin"
    assert raw[7] == "rider/andreas-leknessund"
    assert raw[15] == "rider/enric-mas"
    assert raw[16] == "rider/oscar-onley"


def test_repair_restores_the_rendered_order():
    from pcs_deobfuscate import deobfuscate

    fixed, report = deobfuscate(load("vuelta-2026-stage-19"), source=STAGE_19)

    assert ranks_to_riders(fixed, STAGE_19) | STAGE_19_TRUTH == ranks_to_riders(fixed, STAGE_19)
    for rank, rider in STAGE_19_TRUTH.items():
        assert ranks_to_riders(fixed, STAGE_19)[rank] == rider, f"rang {rank}"
    assert report.repaired


def test_repair_locates_the_rows_pcs_css_named():
    """The stylesheet said rows 6/7, 15/16, 29/30 on the stage table.

    Our detector uses a different signal entirely (the team printed in the Rider
    cell vs the Team column). The two agreeing is what makes the diagnosis
    trustworthy.
    """
    from pcs_deobfuscate import deobfuscate

    _fixed, report = deobfuscate(load("vuelta-2026-stage-19"), source=STAGE_19)

    stage_table = [s for s in report.swaps if s.data_id == "SEINSF"]
    assert [(s.row_a, s.row_b) for s in stage_table] == [(6, 7), (15, 16), (29, 30)]
    assert len(report.swaps) == 9
    assert len(report.flagged_tables) == 5


def test_clean_page_is_left_alone():
    """No false positives, and the bytes are returned untouched."""
    from pcs_deobfuscate import deobfuscate

    original = load("vuelta-2026-stage-4")
    fixed, report = deobfuscate(original, source=STAGE_4)

    assert report.swaps == []
    assert report.flagged_tables == []
    assert fixed == original
    assert report.scanned_rows > 500

    got = ranks_to_riders(fixed, STAGE_4)
    for rank, rider in STAGE_4_TRUTH.items():
        assert got[rank] == rider, f"rang {rank}"


def test_repair_is_idempotent():
    """A second pass must be a clean no-op, not a re-scramble or a refusal."""
    from pcs_deobfuscate import deobfuscate

    once, _ = deobfuscate(load("vuelta-2026-stage-19"), source=STAGE_19)
    twice, report = deobfuscate(once, source=STAGE_19)

    assert report.swaps == []
    assert twice == once


def test_kill_switch_disables_everything(monkeypatch):
    from pcs_deobfuscate import ENV_FLAG, deobfuscate

    monkeypatch.setenv(ENV_FLAG, "0")
    original = load("vuelta-2026-stage-19")
    fixed, report = deobfuscate(original, source=STAGE_19)

    assert fixed == original
    assert report.swaps == []


# ---------------------------------------------------------------------------
# The guard: refuse rather than write wrong
# ---------------------------------------------------------------------------


def test_flagged_table_with_nothing_to_repair_is_refused():
    """PCS says the table is scrambled and we cannot see how. Refuse.

    Simulated by re-flagging an already repaired table: the scheme changing
    under us looks exactly like this.
    """
    from pcs_deobfuscate import ObfuscationError, deobfuscate

    clean = load("vuelta-2026-stage-4")
    # Flag the stage results table, the one Stage.results() reads.
    marker = '<table class="results   hide_td2 hide_td3 hide_td4 hide_td5 hide_td6 hide_td7" data-id=""'
    assert marker in clean
    reflagged = clean.replace(marker, marker.replace('data-id=""', 'data-id="ZZZZZZ"'), 1)

    with pytest.raises(ObfuscationError, match="data-id"):
        deobfuscate(reflagged, source=STAGE_19)


def test_unpairable_incoherence_is_refused():
    """One row out of step, no crossed neighbour: we do not guess."""
    from pcs_deobfuscate import ObfuscationError, deobfuscate

    html = load("vuelta-2026-stage-4").replace(
        '<div class="showIfMobile fs12 clr999">EF Education - EasyPost</div>',
        '<div class="showIfMobile fs12 clr999">Not A Real Team</div>',
        1,
    )

    with pytest.raises(ObfuscationError, match="import refuse"):
        deobfuscate(html, source=STAGE_4)


# ---------------------------------------------------------------------------
# End to end through import_race_results, the seam the tickets prescribe
# ---------------------------------------------------------------------------


async def test_import_race_results_writes_the_rendered_order():
    """fetch_html patched on the real scrambled fixture, real Stage parsing.

    Asserts on the rows handed to the database, not on any internal of the lib.
    """
    import sync_race

    pool = {
        rider: f"id-{i}"
        for i, rider in enumerate(sorted(set(STAGE_19_TRUTH.values())))
    }
    sb = make_supabase([{"id": v, "pcs_slug": k} for k, v in pool.items()], [])

    with patch("sync_race.fetch_html", AsyncMock(return_value=load("vuelta-2026-stage-19"))):
        result = await sync_race.import_race_results(
            sb,
            page=MagicMock(),
            race_slug="race/vuelta-a-espana/2026",
            race_name="La Vuelta 2026",
            race_date="2026-09-11",
            stage_url=STAGE_19,
        )

    written = {row["rank"]: row["rider_id"] for row in sb.upserts["race_results"]}

    for rank, rider in STAGE_19_TRUTH.items():
        assert written[rank] == pool[rider], f"rang {rank}"

    assert len(result["deobfuscated"]) == 9


async def test_import_race_results_refuses_an_unreadable_page():
    """An import that cannot vouch for its alignment must fail loudly.

    Silence is the failure mode that put 13 wrong ranks in production.
    """
    import sync_race
    from pcs_deobfuscate import ObfuscationError

    broken = load("vuelta-2026-stage-4").replace(
        '<div class="showIfMobile fs12 clr999">EF Education - EasyPost</div>',
        '<div class="showIfMobile fs12 clr999">Not A Real Team</div>',
        1,
    )
    sb = make_supabase([], [])

    with patch("sync_race.fetch_html", AsyncMock(return_value=broken)):
        with pytest.raises(ObfuscationError):
            await sync_race.import_race_results(
                sb,
                page=MagicMock(),
                race_slug="race/vuelta-a-espana/2026",
                race_name="La Vuelta 2026",
                race_date="2026-08-26",
                stage_url=STAGE_4,
            )
