"""
Sponsor bonus calculation — WattHunter PCS Sync Microservice.

Parts:
  A. classify_result_type  — categorise a race_results row
  B. expand_sponsor_nationality — parse "BE/NL" → ["BE", "NL"]
  C. calculate_bonus        — compute (base, multiplier, final) for a sponsor+result
  D. process_race_bonuses   — async pipeline step: fetch → calculate → upsert → credit

Called from Pipeline B (post-race) after race results are synced.
"""
from __future__ import annotations

import logging
from typing import Optional

from db_utils import _fetch_all

logger = logging.getLogger(__name__)

# Grand tour slugs used for ×2 stage multiplier detection
GRAND_TOUR_SLUGS = ("giro-d-italia", "tour-de-france", "vuelta-a-espana")


# ---------------------------------------------------------------------------
# Part A — classify_result_type
# ---------------------------------------------------------------------------

def classify_result_type(
    race_class: Optional[str],
    stage: Optional[str],
    race_slug: str,
) -> str:
    """Return one of: 'stage', 'monument', 'grand_tour', 'gc', 'one_day'.

    Priority rule: if *stage* is a numeric stage (not 'gc') → 'stage'.
    If stage == 'gc' → fall through to race_class-based classification.
    """
    if stage is not None and stage != "gc":
        return "stage"

    if race_class == "monument":
        return "monument"
    if race_class == "grand_tour":
        return "grand_tour"
    if race_class == "stage_race":
        return "gc"
    # 'classic', 'one_day', None, or anything unrecognised → one_day
    return "one_day"


# ---------------------------------------------------------------------------
# Part B — expand_sponsor_nationality
# ---------------------------------------------------------------------------

def expand_sponsor_nationality(code: Optional[str]) -> list[str]:
    """Parse a sponsor nationality code into a list of country codes.

    Examples:
        "FR"    → ["FR"]
        "BE/NL" → ["BE", "NL"]
        None    → []
        ""      → []
    """
    if not code:
        return []
    return [c.strip() for c in code.split("/") if c.strip()]


# ---------------------------------------------------------------------------
# Part C — calculate_bonus
# ---------------------------------------------------------------------------

def _is_grand_tour_slug(race_slug: str) -> bool:
    """Return True if the race_slug contains a grand tour identifier."""
    return any(gt in race_slug for gt in GRAND_TOUR_SLUGS)


def _is_doubled(result_type: str, race_slug: str) -> bool:
    """B-value (×2) applies for Grand Tour stage/gc results and for monuments."""
    if result_type == "monument":
        return True
    if result_type == "grand_tour":
        return True
    if result_type in ("stage", "gc") and _is_grand_tour_slug(race_slug):
        return True
    return False


def _base_and_threshold(sponsor: dict, result_type: str) -> tuple[Optional[int], Optional[int]]:
    """Map a result_type to the sponsor's A base amount + rank threshold."""
    if result_type in ("gc", "grand_tour"):
        return sponsor.get("bonus_gc"), sponsor.get("gc_threshold")
    if result_type in ("one_day", "monument"):
        return sponsor.get("bonus_one_day"), sponsor.get("one_day_threshold")
    if result_type == "stage":
        return sponsor.get("bonus_stage"), sponsor.get("stage_threshold")
    return None, None


def calculate_bonus(
    sponsor: dict,
    result_type: str,
    rank: int,
    rider_nationality: Optional[str],
    race_slug: str,
) -> tuple[int, float, int]:
    """Calculate sponsor bonus for a single race result (Spec C 2-value barème).

    A value from the sponsor row × 2 for Grand Tour/Monument × 1.20 for nationality
    match (T1-T4 only). T6 keeps the legacy prestige path (deferred rework).
    Returns (base, multiplier, final); (0, 0.0, 0) if rank doesn't qualify.
    """
    tier = sponsor.get("tier")
    if tier == 6:
        return _calculate_bonus_t5_t6(sponsor, result_type, rank, race_slug)

    base, threshold = _base_and_threshold(sponsor, result_type)
    if base is None or threshold is None or rank > threshold:
        return (0, 0.0, 0)

    multiplier = 2.0 if _is_doubled(result_type, race_slug) else 1.0

    if tier is not None and tier <= 4:
        sponsor_nat = sponsor.get("nationality")
        if sponsor_nat and rider_nationality:
            if rider_nationality in expand_sponsor_nationality(sponsor_nat):
                multiplier *= 1.20

    final = int(base * multiplier)
    return (base, multiplier, final)


def _calculate_bonus_t5_t6(
    sponsor: dict,
    result_type: str,
    rank: int,
    race_slug: str,
) -> tuple[int, float, int]:
    """Bonus logic for T5-T6 sponsors (explicit prestige amounts, no nationality ×)."""
    # Determine base amount and threshold (explicit for monument/grand_tour)
    if result_type == "monument":
        base = sponsor.get("bonus_monument")
        threshold = sponsor.get("monument_threshold")
    elif result_type == "grand_tour":
        base = sponsor.get("bonus_grand_tour")
        threshold = sponsor.get("grand_tour_threshold")
    elif result_type == "gc":
        base = sponsor["bonus_gc"]
        threshold = sponsor["gc_threshold"]
    elif result_type == "one_day":
        base = sponsor["bonus_one_day"]
        threshold = sponsor["one_day_threshold"]
    elif result_type == "stage":
        base = sponsor["bonus_stage"]
        threshold = sponsor["stage_threshold"]
    else:
        return (0, 0.0, 0)

    # If explicit amount is None or threshold is None → no bonus
    if base is None or threshold is None:
        return (0, 0.0, 0)

    if rank > threshold:
        return (0, 0.0, 0)

    # Only multiplier for T5-T6: ×2 for stage in grand tour
    multiplier = 1.0
    if result_type == "stage" and _is_grand_tour_slug(race_slug):
        multiplier *= 2.0

    final = int(base * multiplier)
    return (base, multiplier, final)


# ---------------------------------------------------------------------------
# Part D — process_race_bonuses (async)
# ---------------------------------------------------------------------------

async def process_race_bonuses(
    supabase,
    race_slugs: list[str],
) -> dict:
    """Fetch race results and compute sponsor bonuses for all qualifying results.

    Steps:
      1. Fetch race_results for given race_slugs
      2. Fetch active/notice contracts with rider nationality
      3. Fetch team_sponsors with full sponsor data
      4. For each result: classify → find team → find sponsor → calculate bonus
      5. Upsert to sponsor_bonuses table
      6. Credit team treasury + insert treasury_log
      7. Return summary dict

    Conflict key on sponsor_bonuses: (team_id, rider_id, race_slug, result_type) — idempotent.
    """
    errors: list[str] = []
    bonuses_created = 0

    # Step 1 — Fetch race results (paginated: a full GT spans 1500+ rows)
    race_results: list[dict] = _fetch_all(
        lambda: supabase.table("race_results")
        .select("rider_id,race_slug,race_class,stage,rank,pcs_points,race_date")
        .in_("race_slug", race_slugs)
    )

    if not race_results:
        return {"status": "completed", "bonuses_created": 0, "errors": []}

    # Step 1b — For GT stages, build GT squad membership set (team_id, rider_id).
    # Mirrors the scoring rule: non-squad riders earn 0 XP on GT stages → same for bonuses.
    # Temporal check: rider must have been in the squad at 11:00 CET on race day
    # (same cutoff as scoring.py) — prevents retroactive bonuses for late squad additions.
    import re as _re
    from datetime import date as _date, datetime as _datetime
    from zoneinfo import ZoneInfo as _ZoneInfo

    _paris_tz = _ZoneInfo("Europe/Paris")

    def _is_gt_stage(slug: str) -> bool:
        return any(gt in slug for gt in GRAND_TOUR_SLUGS) and "/stage-" in slug

    def _parse_ts(val: str | None) -> _datetime | None:
        """Parse Supabase timestamp — Python 3.9 compatible.

        Python 3.9 fromisoformat rejects +00:00 offsets and non-standard
        microsecond widths. Supabase always returns UTC.
        """
        if not val:
            return None
        from datetime import timezone as _tz
        s = val.replace("+00:00", "").replace("Z", "")
        if "." in s:
            base, frac = s.split(".", 1)
            s = base + "." + (frac + "000000")[:6]
        return _datetime.fromisoformat(s).replace(tzinfo=_tz.utc)

    gt_stage_slugs = {r["race_slug"] for r in race_results if _is_gt_stage(r["race_slug"])}

    # Map each GT stage slug → race_date for cutoff computation
    _gt_slug_dates: dict[str, str] = {}
    for r in race_results:
        if r["race_slug"] in gt_stage_slugs and r.get("race_date"):
            _gt_slug_dates.setdefault(r["race_slug"], r["race_date"])

    # Build per-slug squad sets: slug → set of (team_id, rider_id)
    gt_squad_by_slug: dict[str, set[tuple[str, str]]] = {}
    if gt_stage_slugs:
        years: set[int] = set()
        phase_ids: set[int] = set()
        for s in gt_stage_slugs:
            m = _re.search(r"/(\d{4})/", s)
            if m:
                years.add(int(m.group(1)))
            # Derive phase_id from GT slug
            if "giro-d-italia" in s:
                phase_ids.add(4)
            elif "tour-de-france" in s:
                phase_ids.add(6)
            elif "vuelta-a-espana" in s:
                phase_ids.add(8)

        # Fetch all squad rows for matching years (query once, filter per slug)
        all_squad_rows: list[dict] = []
        for year in years:
            all_squad_rows.extend(_fetch_all(
                lambda y=year: supabase.table("gt_squad")
                .select("team_id,rider_id,created_at,removed_at")
                .eq("year", y)
            ))

        for slug in gt_stage_slugs:
            race_date_str = _gt_slug_dates.get(slug)
            if not race_date_str:
                # Fallback: no date filtering (accept all current members)
                gt_squad_by_slug[slug] = {
                    (row["team_id"], row["rider_id"])
                    for row in all_squad_rows
                    if not row.get("removed_at")
                }
                continue

            # 11:00 CET on race day — same cutoff as scoring.py
            rd = _date.fromisoformat(str(race_date_str))
            cutoff = _datetime(rd.year, rd.month, rd.day, 11, 0, 0, tzinfo=_paris_tz)

            members: set[tuple[str, str]] = set()
            for row in all_squad_rows:
                created = _parse_ts(row["created_at"])
                removed = _parse_ts(row.get("removed_at"))
                if created and created <= cutoff and (removed is None or removed > cutoff):
                    members.add((row["team_id"], row["rider_id"]))
            gt_squad_by_slug[slug] = members

    # Step 2 — Fetch active/notice contracts with rider nationality (paginated:
    # league-wide across all teams → easily exceeds 1000 rows at scale)
    contracts: list[dict] = _fetch_all(
        lambda: supabase.table("contracts")
        .select("team_id,rider_id,status,riders:rider_id(nationality)")
        .in_("status", ["active", "notice"])
    )

    if not contracts:
        return {"status": "completed", "bonuses_created": 0, "errors": []}

    # Build lookup: rider_id → list of (team_id, nationality)
    rider_teams: dict[str, list[dict]] = {}
    for c in contracts:
        rid = c["rider_id"]
        nat = (c.get("riders") or {}).get("nationality")
        rider_teams.setdefault(rid, []).append({"team_id": c["team_id"], "nationality": nat})

    # Step 3 — Fetch team_sponsors with full sponsor data (paginated: one row
    # per team, league-wide)
    team_sponsors_rows: list[dict] = _fetch_all(
        lambda: supabase.table("team_sponsors")
        .select("team_id,sponsor_id,sponsors(*)")
    )

    # Build lookup: team_id → sponsor dict
    team_sponsor: dict[str, dict] = {}
    for ts in team_sponsors_rows:
        team_sponsor[ts["team_id"]] = ts.get("sponsors") or {}

    # Step 4 — Process each result
    upsert_rows: list[dict] = []
    team_bonus_entries: dict[str, list[dict]] = {}

    # Idempotence guard: pre-fetch existing sponsor_bonuses keys for this race batch.
    # sponsor_bonuses has a UNIQUE INDEX (team_id, rider_id, race_slug, result_type) so
    # the UPSERT below is naturally idempotent — but credit_sponsor_bonuses RPC inserts
    # into treasury_log + credits teams.treasury unconditionally. Without this filter,
    # rerunning the pipeline on the same race re-credits previously paid bonuses.
    existing_bonus_keys: set[tuple[str, str, str, str]] = set()
    if race_slugs:
        existing_bonuses = _fetch_all(
            lambda: supabase.table("sponsor_bonuses")
            .select("team_id,rider_id,race_slug,result_type")
            .in_("race_slug", race_slugs)
        )
        existing_bonus_keys = {
            (r["team_id"], r["rider_id"], r["race_slug"], r["result_type"])
            for r in existing_bonuses
        }

    # No-cumul rule (GAME_RULES.md §17): a rider who triggered a one-time sponsor
    # goal must not also receive the base bonus on the same race. goal_evaluator
    # persists the consumed base-bonus race_slugs in
    # sponsor_goal_completions.neutralized_stage_slugs; we skip emitting those here.
    # Goals are evaluated BEFORE this step (see run_pipeline.run_post_race), so the
    # base bonus is never created → never re-credited on a rerun (idempotent).
    neutralized: set[tuple[str, str, str]] = set()
    if race_slugs:
        parent_slugs = {
            m.group(1)
            for s in race_slugs
            if (m := _re.match(r"^(race/[a-z0-9-]+/\d{4})", s))
        }
        if parent_slugs:
            completions_rows = _fetch_all(
                lambda: supabase.table("sponsor_goal_completions")
                .select("team_id,rider_id,neutralized_stage_slugs")
                .in_("race_slug", list(parent_slugs))
            )
            for row in completions_rows:
                for slug in (row.get("neutralized_stage_slugs") or []):
                    neutralized.add((row["team_id"], row["rider_id"], slug))

    for result in race_results:
        rider_id = result["rider_id"]
        race_slug = result["race_slug"]
        race_class = result.get("race_class")
        stage = result.get("stage")
        rank = result.get("rank")
        race_date = result.get("race_date")

        if rank is None:
            continue

        result_type = classify_result_type(race_class, stage, race_slug)
        teams_for_rider = rider_teams.get(rider_id, [])

        for team_entry in teams_for_rider:
            team_id = team_entry["team_id"]
            rider_nationality = team_entry["nationality"]
            sponsor = team_sponsor.get(team_id)

            if not sponsor:
                continue

            # No-cumul: a one-time goal already paid for this (rider, race) → skip base bonus.
            if (team_id, rider_id, race_slug) in neutralized:
                continue

            # GT stage: only squad members (at race time) can trigger sponsor bonuses.
            if _is_gt_stage(race_slug) and (team_id, rider_id) not in gt_squad_by_slug.get(race_slug, set()):
                continue

            base_bonus, multiplier, final_bonus = calculate_bonus(
                sponsor, result_type, rank, rider_nationality, race_slug
            )

            if final_bonus <= 0:
                continue

            sponsor_id = sponsor.get("id")

            # Accumulate for batch operations (no DB call in the loop)
            upsert_rows.append({
                "team_id": team_id,
                "sponsor_id": sponsor_id,
                "rider_id": rider_id,
                "race_slug": race_slug,
                "race_date": race_date,
                "result_type": result_type,
                "rider_rank": rank,
                "base_bonus": base_bonus,
                "multiplier": float(multiplier),
                "final_bonus": final_bonus,
            })

            # Skip treasury credit if this bonus key already exists in sponsor_bonuses.
            # The upsert above is idempotent; this guard keeps treasury_log idempotent too.
            bonus_key = (team_id, rider_id, race_slug, result_type)
            if bonus_key in existing_bonus_keys:
                continue

            team_bonus_entries.setdefault(team_id, []).append({
                "amount": final_bonus,
                "rider_id": rider_id,
                "description": (
                    f"Sponsor bonus: {result_type} rank {rank} "
                    f"in {race_slug} (×{multiplier})"
                ),
            })
            bonuses_created += 1

    # --- Batch upsert sponsor_bonuses (1 call instead of N) ---
    if upsert_rows:
        try:
            supabase.table("sponsor_bonuses").upsert(
                upsert_rows,
                on_conflict="team_id,rider_id,race_slug,result_type",
            ).execute()
        except Exception as exc:
            errors.append(f"batch upsert sponsor_bonuses: {exc}")

    # --- Atomic treasury credit per team via RPC ---
    for team_id, entries in team_bonus_entries.items():
        try:
            supabase.rpc("credit_sponsor_bonuses", {
                "p_team_id": team_id,
                "p_bonuses": entries,
            }).execute()
        except Exception as exc:
            logger.error(
                f"[SponsorBonus] RPC credit_sponsor_bonuses FAILED "
                f"for team={team_id}: {exc}"
            )
            errors.append(f"rpc credit_sponsor_bonuses team={team_id}: {exc}")

    # Step 7 — Cleanup: remove stale GT sponsor bonuses for non-squad riders.
    # When the temporal squad check now excludes a rider who previously had a bonus
    # (e.g., added to squad after race day), we must delete the bonus row and
    # reverse the treasury credit.
    reverted_count = 0
    for slug in gt_stage_slugs:
        squad_for_slug = gt_squad_by_slug.get(slug, set())
        # Fetch existing bonuses for this GT stage slug (paginated)
        existing_for_slug = _fetch_all(
            lambda s=slug: supabase.table("sponsor_bonuses")
            .select("id, team_id, rider_id, final_bonus")
            .eq("race_slug", s)
        )
        for bonus_row in existing_for_slug:
            key = (bonus_row["team_id"], bonus_row["rider_id"])
            if key not in squad_for_slug:
                # This rider was not in the squad at race time — revert bonus
                try:
                    # Debit treasury
                    team_resp = (
                        supabase.table("teams")
                        .select("id,treasury")
                        .eq("id", bonus_row["team_id"])
                        .single()
                        .execute()
                    )
                    if team_resp.data:
                        old_treasury = team_resp.data.get("treasury", 0)
                        new_treasury = max(0, old_treasury - bonus_row["final_bonus"])
                        supabase.table("teams").update(
                            {"treasury": new_treasury}
                        ).eq("id", bonus_row["team_id"]).execute()

                        supabase.table("treasury_log").insert({
                            "team_id": bonus_row["team_id"],
                            "type": "sponsor_bonus_revert",
                            "amount": -bonus_row["final_bonus"],
                            "description": (
                                f"Reverted: rider not in GT squad at race time ({slug})"
                            ),
                            "rider_id": bonus_row["rider_id"],
                        }).execute()

                    # Delete the stale bonus row
                    supabase.table("sponsor_bonuses").delete().eq(
                        "id", bonus_row["id"]
                    ).execute()
                    reverted_count += 1
                    logger.info(
                        f"[SponsorBonus] Reverted stale bonus id={bonus_row['id']} "
                        f"team={bonus_row['team_id'][:8]} rider={bonus_row['rider_id'][:8]} "
                        f"slug={slug} amount={bonus_row['final_bonus']}"
                    )
                except Exception as exc:
                    errors.append(f"revert stale bonus id={bonus_row['id']}: {exc}")

    return {
        "status": "completed",
        "bonuses_created": bonuses_created,
        "bonuses_reverted": reverted_count,
        "errors": errors,
    }
