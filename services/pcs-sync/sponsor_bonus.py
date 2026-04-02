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

    Priority rule: if *stage* is not None → always 'stage'.
    """
    if stage is not None:
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


def calculate_bonus(
    sponsor: dict,
    result_type: str,
    rank: int,
    rider_nationality: Optional[str],
    race_slug: str,
) -> tuple[int, float, int]:
    """Calculate sponsor bonus for a single race result.

    Returns:
        (base_bonus, multiplier, final_bonus)
        (0, 0.0, 0) if the rank doesn't qualify.
    """
    has_explicit_prestige: bool = sponsor.get("has_explicit_prestige", False)

    if has_explicit_prestige:
        return _calculate_bonus_t5_t6(sponsor, result_type, rank, race_slug)
    else:
        return _calculate_bonus_t1_t4(sponsor, result_type, rank, rider_nationality, race_slug)


def _calculate_bonus_t1_t4(
    sponsor: dict,
    result_type: str,
    rank: int,
    rider_nationality: Optional[str],
    race_slug: str,
) -> tuple[int, float, int]:
    """Bonus logic for T1-T4 sponsors (implicit prestige via multipliers)."""
    # Determine base amount and threshold
    if result_type in ("gc", "grand_tour"):
        base = sponsor["bonus_gc"]
        threshold = sponsor["gc_threshold"]
    elif result_type in ("one_day", "monument"):
        base = sponsor["bonus_one_day"]
        threshold = sponsor["one_day_threshold"]
    elif result_type == "stage":
        base = sponsor["bonus_stage"]
        threshold = sponsor["stage_threshold"]
    else:
        return (0, 0.0, 0)

    if rank > threshold:
        return (0, 0.0, 0)

    # Build multiplier
    multiplier = 1.0

    # ×2 for prestige events
    if result_type == "grand_tour":
        multiplier *= 2.0
    elif result_type == "monument":
        multiplier *= 2.0
    elif result_type == "stage" and _is_grand_tour_slug(race_slug):
        multiplier *= 2.0

    # ×1.5 for nationality match (T1-T4 only, but only when sponsor has a nationality)
    sponsor_nat = sponsor.get("nationality")
    if sponsor_nat and rider_nationality:
        allowed = expand_sponsor_nationality(sponsor_nat)
        if rider_nationality in allowed:
            multiplier *= 1.5

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

    # Step 1 — Fetch race results
    results_resp = (
        supabase.table("race_results")
        .select("rider_id,race_slug,race_class,stage,rank,pcs_points,race_date")
        .in_("race_slug", race_slugs)
        .execute()
    )
    race_results: list[dict] = results_resp.data or []

    if not race_results:
        return {"status": "completed", "bonuses_created": 0, "errors": []}

    # Step 2 — Fetch active/notice contracts with rider nationality
    contracts_resp = (
        supabase.table("contracts")
        .select("team_id,rider_id,status,riders:rider_id(nationality)")
        .in_("status", ["active", "notice"])
        .execute()
    )
    contracts: list[dict] = contracts_resp.data or []

    if not contracts:
        return {"status": "completed", "bonuses_created": 0, "errors": []}

    # Build lookup: rider_id → list of (team_id, nationality)
    rider_teams: dict[str, list[dict]] = {}
    for c in contracts:
        rid = c["rider_id"]
        nat = (c.get("riders") or {}).get("nationality")
        rider_teams.setdefault(rid, []).append({"team_id": c["team_id"], "nationality": nat})

    # Step 3 — Fetch team_sponsors with full sponsor data
    sponsors_resp = (
        supabase.table("team_sponsors")
        .select("team_id,sponsor_id,sponsors(*)")
        .execute()
    )
    team_sponsors_rows: list[dict] = sponsors_resp.data or []

    # Build lookup: team_id → sponsor dict
    team_sponsor: dict[str, dict] = {}
    for ts in team_sponsors_rows:
        team_sponsor[ts["team_id"]] = ts.get("sponsors") or {}

    # Step 4 — Process each result
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

            base_bonus, multiplier, final_bonus = calculate_bonus(
                sponsor, result_type, rank, rider_nationality, race_slug
            )

            if final_bonus <= 0:
                continue

            sponsor_id = sponsor.get("id")

            # Step 5 — Upsert to sponsor_bonuses
            try:
                supabase.table("sponsor_bonuses").upsert(
                    {
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
                    },
                    on_conflict="team_id,rider_id,race_slug,result_type",
                ).execute()
                bonuses_created += 1
            except Exception as exc:
                errors.append(f"upsert sponsor_bonus team={team_id} rider={rider_id}: {exc}")
                continue

            # Step 6 — Credit treasury
            try:
                team_resp = (
                    supabase.table("teams")
                    .select("id,treasury")
                    .eq("id", team_id)
                    .execute()
                )
                team_data = team_resp.data
                current_treasury = (
                    team_data.get("treasury", 0)
                    if isinstance(team_data, dict)
                    else (team_data[0].get("treasury", 0) if team_data else 0)
                )
                new_treasury = current_treasury + final_bonus

                supabase.table("teams").update(
                    {"treasury": new_treasury}
                ).eq("id", team_id).execute()

                supabase.table("treasury_log").insert(
                    {
                        "team_id": team_id,
                        "type": "sponsor_bonus",
                        "amount": final_bonus,
                        "description": (
                            f"Sponsor bonus: {result_type} rank {rank} "
                            f"in {race_slug} (×{multiplier})"
                        ),
                        "race_slug": race_slug,
                        "rider_id": rider_id,
                    }
                ).execute()
            except Exception as exc:
                errors.append(f"treasury credit team={team_id}: {exc}")

    return {
        "status": "completed",
        "bonuses_created": bonuses_created,
        "errors": errors,
    }
