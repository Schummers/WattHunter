"""Backfill the per-jersey columns of rider_xp_daily (issue 08).

Until this runs, `gc_classif_bonus`, `points_classif_bonus`, `kom_classif_bonus`
and `youth_classif_bonus` are 0 on every row scored before the migration, while
`gt_classif_bonus` still carries their merged total.

It never recomputes XP. It only splits a number that is already stored, and it
refuses to write a split it cannot prove:

  - A final classification row (`.../gc`, `.../points`, `.../kom`, `.../youth`)
    carries exactly one jersey. Its split is read off the slug — exact, no guess.

  - A daily row is split from `gt_daily_classifications`. Neither the role nor
    the scale in force at scoring time is re-derived: a role cutoff replayed
    months later is its own source of error, and the scale itself changed twice
    in 2026 (the Giro was scored under the V2 matched-only rule, the Vuelta under
    the flat-for-all one). Every combination of scale and role is tried instead,
    and the split is written only when the combinations that reproduce the stored
    total all agree on the same split. Anything else is reported and left
    untouched.

This is the whole point of the check: a split that does not add back up to what
was credited is a wrong split, and a rescore is not what is wanted here.

Dry-run by default. Writes only with --apply.

  cd services/pcs-sync
  .venv/bin/python scripts/backfill_classif_breakdown.py --race race/vuelta-a-espana/2026
  .venv/bin/python scripts/backfill_classif_breakdown.py --race race/vuelta-a-espana/2026 --apply
"""
from __future__ import annotations

import argparse
import sys
from collections import defaultdict
from pathlib import Path

from dotenv import load_dotenv

_PCS_DIR = Path(__file__).resolve().parents[1]
load_dotenv(_PCS_DIR / ".env")
sys.path.append(str(_PCS_DIR))

from db_utils import _fetch_all  # noqa: E402
from sync import get_supabase  # noqa: E402
from scoring import (  # noqa: E402
    CLASSIF_TYPES,
    _classif_breakdown,
    _classif_breakdown_gt,
    _empty_breakdown,
)

TOLERANCE = 0.01

# Every role a daily classification bonus can have been computed under. Roles
# absent from the multiplier tables all behave the same (flat scale), so one
# representative is enough for them.
CANDIDATE_ROLES = ("domestique", "gc_leader", "sprinter", "climber")

# Both scales that ever produced a stored bonus: the 2026-07 flat-for-all refonte
# and the V2 matched-only rule it replaced. The Giro 2026 was scored under the
# second, the Vuelta under the first, and neither is re-derived from the slug —
# whichever reproduces what was actually credited is the right one.
CANDIDATE_SCALES = (_classif_breakdown_gt, _classif_breakdown)

COLUMN_BY_TYPE = {
    "gc": "gc_classif_bonus",
    "points": "points_classif_bonus",
    "kom": "kom_classif_bonus",
    "youth": "youth_classif_bonus",
}


def _final_type(race_slug: str) -> str | None:
    suffix = race_slug.rsplit("/", 1)[-1]
    return suffix if suffix in COLUMN_BY_TYPE else None


def _rounded(breakdown: dict[str, float]) -> tuple[float, ...]:
    return tuple(round(breakdown[t], 2) for t in CLASSIF_TYPES)


def resolve_split(
    race_slug: str,
    stored_bonus: float,
    classif_rows: list[dict],
) -> tuple[dict[str, float] | None, str]:
    """Return (split, reason). `split` is None when it could not be proven."""
    final_type = _final_type(race_slug)
    if final_type is not None:
        split = _empty_breakdown()
        split[final_type] = stored_bonus
        return split, "final"

    if abs(stored_bonus) < TOLERANCE:
        return _empty_breakdown(), "zero"

    if not classif_rows:
        return None, "no classification row for a non-zero bonus"

    matching = set()
    for compute in CANDIDATE_SCALES:
        for role in CANDIDATE_ROLES:
            breakdown = compute(classif_rows, role)
            if abs(sum(breakdown.values()) - stored_bonus) < TOLERANCE:
                matching.add(_rounded(breakdown))
    if not matching:
        return None, "no candidate scale or role reproduces the stored bonus"
    if len(matching) > 1:
        return None, "candidates disagree on the split"

    values = matching.pop()
    return dict(zip(CLASSIF_TYPES, values)), "reconstructed"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--race", required=True, help="parent race slug, e.g. race/vuelta-a-espana/2026")
    parser.add_argument("--apply", action="store_true", help="write the split (default: dry-run)")
    args = parser.parse_args()

    supabase = get_supabase()
    prefix = args.race.rstrip("/")

    base_columns = "id, team_id, rider_id, race_slug, gt_classif_bonus, xp_gained"
    split_columns = (
        "gc_classif_bonus, points_classif_bonus, kom_classif_bonus, youth_classif_bonus"
    )
    try:
        xp_rows = _fetch_all(lambda: supabase.table("rider_xp_daily").select(
            f"{base_columns}, {split_columns}"
        ).like("race_slug", f"{prefix}%").order("id"))
    except Exception:
        # The migration is not on this database yet: the dry-run still proves the
        # split can be reconstructed, which is the whole point of running it first.
        if args.apply:
            raise
        print("(per-jersey columns absent from this database — verification only)\n")
        xp_rows = _fetch_all(lambda: supabase.table("rider_xp_daily").select(
            base_columns
        ).like("race_slug", f"{prefix}%").order("id"))

    if not xp_rows:
        print(f"No rider_xp_daily row under {prefix}")
        return 1

    slugs = sorted({r["race_slug"] for r in xp_rows})
    classif_rows = _fetch_all(lambda: supabase.table("gt_daily_classifications").select(
        "race_slug, rider_id, classification_type, rank"
    ).in_("race_slug", slugs))
    classif_by_key: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for row in classif_rows:
        classif_by_key[(row["race_slug"], row["rider_id"])].append(row)

    updates: list[dict] = []
    counters: dict[str, int] = defaultdict(int)
    failures: list[tuple[str, str, str]] = []

    for row in xp_rows:
        stored = float(row.get("gt_classif_bonus") or 0)
        split, reason = resolve_split(
            row["race_slug"], stored,
            classif_by_key.get((row["race_slug"], row["rider_id"]), []),
        )
        counters[reason] += 1
        if split is None:
            failures.append((row["race_slug"], row["rider_id"], reason))
            continue
        already = {
            t: float(row.get(COLUMN_BY_TYPE[t]) or 0) for t in CLASSIF_TYPES
        }
        if all(abs(already[t] - split[t]) < TOLERANCE for t in CLASSIF_TYPES):
            counters["already up to date"] += 1
            continue
        updates.append({
            "id": row["id"],
            **{COLUMN_BY_TYPE[t]: round(split[t], 2) for t in CLASSIF_TYPES},
        })

    print(f"{prefix}: {len(xp_rows)} rows over {len(slugs)} slugs")
    for reason, count in sorted(counters.items()):
        print(f"  {reason}: {count}")
    print(f"  rows to update: {len(updates)}")

    if failures:
        print(f"\n{len(failures)} rows could NOT be split (left untouched):")
        for slug, rider_id, reason in failures[:20]:
            print(f"  {slug} {rider_id} — {reason}")
        if len(failures) > 20:
            print(f"  ... and {len(failures) - 20} more")

    if not args.apply:
        print("\nDRY RUN — nothing written. Re-run with --apply.")
        return 0

    for update in updates:
        row_id = update.pop("id")
        supabase.table("rider_xp_daily").update(update).eq("id", row_id).execute()
    print(f"\nWrote {len(updates)} rows.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
