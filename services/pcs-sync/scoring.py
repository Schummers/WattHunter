"""
Daily scoring job — WattHunter PCS Sync Microservice.

For each contracted rider with pcs_points > 0 (from race_results):
  1. Apply per-rider strategy matching → XP gained
  2. Upsert into rider_xp_daily (keyed by team_id, rider_id, race_slug)
  3. Update teams.cumulative_xp and teams.level
  4. Snapshot team_ranking_daily for movement tracking

Treasury is handled separately by confirmPhaseSetup server action and sponsor_bonus.py.
"""
from __future__ import annotations
import json
import logging
import re
from datetime import date, datetime
from functools import lru_cache
from pathlib import Path
from zoneinfo import ZoneInfo
from supabase import Client
from tactics import (
    compute_unleash_modifier,
    compute_overdrive_modifier,
    compute_call_bus_modifier,
    compute_nemesis_modifier,
)

logger = logging.getLogger(__name__)

# Level thresholds — must match apps/web/lib/levels.ts (8 levels). L7/L8 stretched (Spec A A1).
LEVEL_THRESHOLDS = [0, 25, 150, 350, 600, 1200, 2600, 5000]


def _parse_supabase_ts(ts: str) -> datetime:
    """Parse Supabase timestamp — Python 3.9 compatible.

    Python 3.9 fromisoformat rejects +00:00 offsets and non-standard microsecond widths.
    Supabase always returns UTC, so we strip the offset and normalize to 6-digit µs.
    """
    from datetime import timezone as _tz
    s = ts.replace("+00:00", "").replace("Z", "")
    if "." in s:
        base, frac = s.split(".", 1)
        s = base + "." + (frac + "000000")[:6]
    return datetime.fromisoformat(s).replace(tzinfo=_tz.utc)


# --- GT mode --------------------------------------------------------------
GT_RACE_PREFIXES = (
    "race/giro-d-italia/",
    "race/tour-de-france/",
    "race/vuelta-a-espana/",
)

# --- Role multipliers (Spec A A2/A3/A4/A5) -------------------------------
# gc_leader / climber: ×1.5 on any GT stage result; GC final (/gc) → ×1.0 (A2/A5).
# tt_specialist: ×2.0 on ITT stages only.
# sprinter: ×1.5 only on flat/hilly stages (profile p1/p2/p3, A4); ×1.0 otherwise.
# stage_hunter: ×1.5 only when in the breakaway (breakaway_kms ≥ threshold, A3); ×1.0 otherwise.
# domestique: ×1.0.
BREAKAWAY_THRESHOLD_KM = 30.0   # A3 — min km in the break to count as "in the breakaway".
BREAKAWAY_KM_PER_POINT = 10.0   # A3 — +1 additive XP per 10 km in the break (no cap).
SPRINT_PROFILES = ("p1", "p2", "p3")  # A4 — flat + hilly (everything but mountain p4/p5).

_GT_PHASE_MAP = {
    "giro-d-italia": 4,
    "tour-de-france": 6,
    "vuelta-a-espana": 8,
}

# Rank-ceiling per daily classification — bonus decays linearly from `top` (rank 1)
# down to 1 (rank = top). Ranks outside the top zero out.
CLASSIF_TOP = {"gc": 10, "points": 5, "kom": 3, "youth": 5}

# V2 (Spec A A2): only the classification(s) matching the rider's role earn a bonus.
# Matched daily mult is ×2 for gc/points/kom (was ×1.5); youth matched (gc_leader) is ×1.5.
CLASSIF_ROLE_MATCH: dict[str, dict[str, float]] = {
    "gc_leader": {"gc": 2.0, "youth": 1.5},
    "sprinter":  {"points": 2.0},
    "climber":   {"kom": 2.0},
}

# --- Final secondary classifications (Points / KOM / Youth) — Spec A A2 ----
# Custom rank-derived 2-value scale (PCS gives no points for these jerseys).
# GT/Monument vs 1-week stage race; one_week is coded for P3 (Race Team / A9).
FINAL_SECONDARY_SCALE = {
    "gt": [80.0, 20.0, 10.0],        # ranks 1 / 2 / 3
    "one_week": [40.0, 10.0, 5.0],
}
# Final secondary classif → (role that matches, multiplier on the scale value).
FINAL_ROLE_MATCH = {
    "points": ("sprinter", 2.0),
    "kom":    ("climber", 2.0),
    "youth":  ("gc_leader", 1.5),
}


def _final_secondary_bonus(classif_type: str, rank, role: str, mode: str = "gt") -> float:
    """XP for a final Points/KOM/Youth placement (Spec A A2).

    Base scale value by rank (mode gt vs one_week) × role multiplier when the role matches
    (points→sprinter ×2, kom→climber ×2, youth→gc_leader ×1.5); ×1.0 otherwise.
    Ranks beyond the scale length earn 0.
    """
    scale = FINAL_SECONDARY_SCALE.get(mode, FINAL_SECONDARY_SCALE["gt"])
    try:
        r = int(rank)
    except (TypeError, ValueError):
        return 0.0
    if r < 1 or r > len(scale):
        return 0.0
    base = scale[r - 1]
    matched_role, mult = FINAL_ROLE_MATCH.get(classif_type, (None, 1.0))
    rate = mult if role == matched_role else 1.0
    return base * rate


def _classif_bonus(classif_rows: list[dict], role: str) -> float:
    """Daily classification bonus (Spec A A2, V2 role-matched-only).

    Only the classification(s) matching the rider's role earn a bonus:
      gc_leader → gc ×2 (and youth ×1.5), sprinter → points ×2, climber → kom ×2.
    domestique / stage_hunter / tt_specialist match nothing → 0.
    Base bonus per classification = (top + 1) - rank, for ranks within the top zone.
    """
    matched = CLASSIF_ROLE_MATCH.get(role, {})
    if not matched:
        return 0.0
    total = 0.0
    for row in classif_rows or []:
        ctype = row.get("classification_type")
        mult = matched.get(ctype)
        if mult is None:
            continue
        top = CLASSIF_TOP.get(ctype)
        if top is None:
            continue
        rank = row.get("rank")
        if rank is None:
            continue
        try:
            r = int(rank)
        except (TypeError, ValueError):
            continue
        if r < 1 or r > top:
            continue
        base = (top + 1) - r
        total += base * mult
    return total


# --- Spec A A9: 1-week stage-race awareness ---------------------------------
# The squad-gate + classif + finals-secondary passes are extended to any
# stage-race slug listed in wt_calendar_2026.json (type='stage-race'),
# NOT just the 3 GTs. One-day races (monuments) remain ungated.
_CALENDAR_PATH = Path(__file__).parent / "wt_calendar_2026.json"


@lru_cache(maxsize=1)
def _stage_race_slug_prefixes() -> tuple[str, ...]:
    """Read wt_calendar_2026.json once and return a tuple of slug-prefixes
    (with trailing '/') for every type='stage-race' race. Used by
    _is_squad_race() to gate scoring on 1-week stage races.
    """
    try:
        with open(_CALENDAR_PATH, encoding="utf-8") as fh:
            calendar = json.load(fh)
    except (OSError, json.JSONDecodeError):
        return tuple()
    prefixes: list[str] = []
    for entry in calendar:
        if entry.get("type") != "stage-race":
            continue
        slug = entry.get("slug") or ""
        if slug:
            # Match the race itself + any descendant (stage-N, gc, points, kom, youth).
            prefixes.append(slug if slug.endswith("/") else slug + "/")
            prefixes.append(slug)  # also accept the bare parent slug
    return tuple(prefixes)


def _is_squad_race(slug: str) -> bool:
    """True if the slug belongs to a stage-race (GT or 1-week) — gates squad scoring.

    Stricter than 'not one-day': uses the calendar whitelist so unknown slugs
    default to False (preserves the existing monument-test invariant).
    """
    if not slug:
        return False
    if slug.startswith(GT_RACE_PREFIXES):
        return True
    return any(slug == p.rstrip("/") or slug.startswith(p) for p in _stage_race_slug_prefixes())


def _is_gt_slug(slug: str) -> bool:
    return slug.startswith(GT_RACE_PREFIXES)


def _unseeded_stage_slugs(history_rows: list[dict]) -> list[str]:
    """Return squad-race *stage* slugs whose profile_icon was never imported (SC-4).

    A stage's profile (p1..p5 / itt) is identical across all its race_results rows;
    if none carry a profile_icon, `import_stage_profiles` (cmd `startlists`) never
    ran for that stage. Scoring it would silently degrade the sprinter ×1.5 role
    multiplier to ×1.0 (profile not in SPRINT_PROFILES) — a hard-to-spot scoring
    error. We surface these loudly instead of scoring on incomplete data.

    Only individual road/ITT stages (`/stage-N`) on squad races are checked;
    final classifications (/gc, /points, /kom, /youth) carry no profile and are
    excluded.
    """
    seeded_by_slug: dict[str, bool] = {}
    for h in history_rows:
        slug = h.get("race_slug") or ""
        if "/stage-" not in slug or not _is_squad_race(slug):
            continue
        has_profile = _norm_profile(h.get("profile_icon")) is not None
        seeded_by_slug[slug] = seeded_by_slug.get(slug, False) or has_profile
    return sorted(slug for slug, seeded in seeded_by_slug.items() if not seeded)


def _norm_profile(profile_icon) -> str | None:
    """Normalize a PCS profile icon to lowercase p0-p5, or None."""
    if not profile_icon:
        return None
    return str(profile_icon).strip().lower()


def _in_breakaway(breakaway_kms) -> bool:
    """True if the rider spent at least BREAKAWAY_THRESHOLD_KM in the break (Spec A A3)."""
    try:
        return breakaway_kms is not None and float(breakaway_kms) >= BREAKAWAY_THRESHOLD_KM
    except (TypeError, ValueError):
        return False


def _breakaway_distance_bonus(breakaway_kms) -> float:
    """Additive XP for time in the break: +1 per BREAKAWAY_KM_PER_POINT km, no cap (Spec A A3).

    Awarded only when the rider counts as in the breakaway (≥ threshold).
    Additive, not role-multiplied (still scaled by nemesis_modifier).
    """
    if not _in_breakaway(breakaway_kms):
        return 0.0
    return float(breakaway_kms) // BREAKAWAY_KM_PER_POINT


def _role_multiplier(
    role: str,
    race_slug: str,
    is_itt: bool,
    breakaway_kms=None,
    profile_icon=None,
) -> float:
    """Return the PCS role multiplier for a GT result (Spec A A2/A3/A4/A5)."""
    if not role:
        return 1.0
    # GC final (slug ends /gc): raw PCS points, no role multiplier (A2).
    if race_slug.endswith("/gc"):
        return 1.0
    if role in ("gc_leader", "climber"):
        return 1.5
    if role == "tt_specialist":
        return 2.0 if is_itt else 1.0
    if role == "sprinter":
        return 1.5 if _norm_profile(profile_icon) in SPRINT_PROFILES else 1.0
    if role == "stage_hunter":
        return 1.5 if _in_breakaway(breakaway_kms) else 1.0
    return 1.0  # domestique + unknown


def _underdog_multiplier(pcs_rank: "int | None", race_slug: str) -> float:
    """Underdog role boost: clamp(pcs_rank / 100, 1, 4) on GT stages.

    Returns 1.0 on final-classification slugs (…/gc, …/points, …/kom — no role mult on
    finals per Spec A D4) and when the rider has no PCS rank.
    """
    if pcs_rank is None:
        return 1.0
    if race_slug.endswith(("/gc", "/points", "/kom")):
        return 1.0
    return max(1.0, min(4.0, pcs_rank / 100.0))


def _phase_year_from_slug(slug: str) -> tuple[int, int]:
    """Return (phase_id, year) from a GT race slug like race/giro-d-italia/2026/stage-4."""
    m = re.match(r"^race/([a-z0-9-]+)/(\d{4})", slug)
    if not m:
        return (4, date.today().year)
    name, year = m.group(1), int(m.group(2))
    return (_GT_PHASE_MAP.get(name, 4), year)


def compute_level(xp: float) -> int:
    """Compute team level from cumulative XP."""
    for i in range(len(LEVEL_THRESHOLDS) - 1, -1, -1):
        if xp >= LEVEL_THRESHOLDS[i]:
            return i + 1
    return 1


def _rider_matches_strategy(
    strategy_slug: str,
    config: dict,
    rider: dict,
) -> bool:
    """Check if a rider matches a strategy's config criteria."""
    if strategy_slug == "specialist":
        return (rider.get("specialty") or "").lower() == (config.get("specialty") or "").lower()
    elif strategy_slug == "national_pride":
        return (rider.get("nationality") or "").lower() == (config.get("nationality") or "").lower()
    elif strategy_slug == "team_chemistry":
        return (rider.get("real_team") or "").lower() == (config.get("team") or "").lower()
    elif strategy_slug == "young_blood":
        max_age = config.get("max_age", 25)
        birthdate = rider.get("birthdate")
        if not birthdate:
            return False
        try:
            birth = datetime.fromisoformat(str(birthdate)).date()
            today = date.today()
            age = today.year - birth.year - ((today.month, today.day) < (birth.month, birth.day))
            return age <= max_age
        except (ValueError, TypeError):
            return False
    elif strategy_slug == "road_warriors":
        birthdate = rider.get("birthdate")
        if not birthdate:
            return False
        try:
            birth = datetime.fromisoformat(str(birthdate)).date()
            today = date.today()
            age = today.year - birth.year - ((today.month, today.day) < (birth.month, birth.day))
            return age > 32
        except (ValueError, TypeError):
            return False
    return False


def _compute_rider_bonus(
    rider_info: dict,
    team_strategies: list[dict],
) -> float:
    """Sum xp_bonus for all strategies that match this rider."""
    total = 0.0
    for strategy in team_strategies:
        slug = strategy.get("slug", "")
        xp_bonus = float(strategy.get("xp_bonus", 0) or 0)
        config = strategy.get("config") or {}
        if _rider_matches_strategy(slug, config, rider_info):
            total += xp_bonus
    return total


async def calculate_daily_scores(
    supabase: Client,
    race_slugs: list[str] | None = None,
    ignore_role_cutoff: bool = False,
) -> dict:
    """
    For each contracted rider with pcs_points > 0 in race_results:
      - Filter by race_slugs if provided, otherwise by today's date (backward compat)
      - Apply per-rider strategy matching → XP
      - Upsert rider_xp_daily (keyed by team_id, rider_id, race_slug)
      - Update team cumulative_xp and level
      - Snapshot team_ranking_daily

    Returns a summary dict with teams_processed count and any errors.
    """
    today = date.today().isoformat()
    processed = 0
    errors = []

    # --- Step 1: Get race results ---
    # Task 1: filter by race_slugs if provided, else fallback to today's date
    if race_slugs:
        history = supabase.table("race_results").select(
            "rider_id, race_slug, pcs_points, race_date, is_itt, breakaway_kms, profile_icon"
        ).in_("race_slug", race_slugs).gt("pcs_points", 0).execute()
    else:
        history = supabase.table("race_results").select(
            "rider_id, race_slug, pcs_points, race_date, is_itt, breakaway_kms, profile_icon"
        ).eq("race_date", today).gt("pcs_points", 0).execute()

    if not history.data:
        return {
            "status": "completed",
            "processed": 0,
            "message": "No race results found",
        }

    # SC-4 — fail loud if a squad-race stage being scored has no imported profile.
    # Without profile_icon the sprinter ×1.5 role multiplier silently drops to ×1.0.
    unseeded = _unseeded_stage_slugs(history.data)
    if unseeded:
        raise ValueError(
            "Stage profiles not imported for squad-race stage(s): "
            f"{', '.join(unseeded)}. Run "
            "`run_pipeline.py startlists --race <race>` (import_stage_profiles) "
            "before scoring — missing profile_icon silently degrades the sprinter "
            "×1.5 role multiplier to ×1.0 (SC-4)."
        )

    # Build rider_id → list of (race_slug, pcs_points) for per-race upserts
    rider_race_points: dict[str, list[dict]] = {}
    for h in history.data:
        rider_race_points.setdefault(h["rider_id"], []).append({
            "race_slug": h["race_slug"],
            "pcs_points": h["pcs_points"],
            "race_date": h.get("race_date"),
            "is_itt": bool(h.get("is_itt", False)),
            "breakaway_kms": h.get("breakaway_kms"),
            "profile_icon": h.get("profile_icon"),
        })

    # Build race_slug → race_date mapping for the second pass (classif-only entries).
    race_date_by_slug: dict[str, str] = {}
    for h in history.data:
        race_date_by_slug.setdefault(h["race_slug"], h.get("race_date", today))

    # Pre-fetch existing rider_xp_daily for these race_slugs to compute deltas (idempotency).
    # On first run prev=0 → delta=total (same as before).
    # On re-run prev=total → delta=0 → teams unchanged (no double-count).
    prev_team_xp: dict[str, float] = {}
    if race_slugs:
        prev_resp = supabase.table("rider_xp_daily").select(
            "team_id, xp_gained"
        ).in_("race_slug", race_slugs).execute()
        for row in (prev_resp.data or []):
            tid = row["team_id"]
            prev_team_xp[tid] = prev_team_xp.get(tid, 0.0) + float(row.get("xp_gained") or 0)

    # --- Step 2: Get all active/notice contracts with rider info for policy matching ---
    contracts = supabase.table("contracts").select(
        "id, team_id, rider_id, purchased_at, release_date, released_at, "
        "riders:rider_id(specialty, nationality, real_team, birthdate, pcs_rank)"
    ).in_("status", ["active", "notice"]).execute()

    if not contracts.data:
        return {
            "status": "completed",
            "processed": 0,
            "message": "No active contracts",
        }

    # Group contracts by team for efficient processing
    team_contracts: dict[str, list[dict]] = {}
    for c in contracts.data:
        team_id = c["team_id"]
        team_contracts.setdefault(team_id, []).append(c)

    # --- Step 3: Get strategies with slug and config for per-rider matching ---
    strategies = supabase.table("team_strategies").select(
        "team_id, config, strategies:strategy_id(slug, xp_bonus)"
    ).eq("is_active", True).execute()

    # Build per-team strategy list: [{slug, xp_bonus, config}, ...]
    team_strategies: dict[str, list[dict]] = {}
    for s in strategies.data or []:
        team_id = s["team_id"]
        strategy_data = s.get("strategies") or {}
        entry = {
            "slug": strategy_data.get("slug", ""),
            "xp_bonus": float(strategy_data.get("xp_bonus", 0) or 0),
            "config": s.get("config") or {},
        }
        team_strategies.setdefault(team_id, []).append(entry)

    # --- Step 3b: Pre-fetch squad membership + latest roles when scoring stage-race slugs.
    # Spec A A9: extends from GT-only to any stage-race (GT + 1-week) via _is_squad_race.
    # Only fetched when at least one race_slug is a stage-race slug to avoid extra reads.
    # Uses 11:00 CET cutoff per stage date for both squad membership and role assignments.
    squad_slugs = [s for s in (race_slugs or []) if _is_squad_race(s)]
    gt_squad_members: dict[tuple[str, str], bool] = {}  # (team_id, rider_id) → True
    gt_roles: dict[tuple[str, str], str] = {}           # (team_id, rider_id) → latest role
    _paris_tz = ZoneInfo("Europe/Paris")
    if squad_slugs:
        phase_id, year = _phase_year_from_slug(squad_slugs[0])

        # Build race_slug → race_date mapping for cutoff computation
        _slug_dates: dict[str, str] = {}
        for h in (history.data or []):
            if _is_squad_race(h.get("race_slug", "")):
                _slug_dates.setdefault(h["race_slug"], h.get("race_date", today))

        # Compute cutoff from the first stage-race slug's date (all slugs in one call share a date)
        _cutoff_date_str = _slug_dates.get(squad_slugs[0], today)
        _cutoff_dt = date.fromisoformat(str(_cutoff_date_str))
        if ignore_role_cutoff:
            # Retroactive scoring: accept all role/squad assignments regardless of time
            from datetime import timezone as _tz
            gt_cutoff = datetime(9999, 12, 31, 23, 59, 59, tzinfo=_tz.utc)
        else:
            gt_cutoff = datetime(
                _cutoff_dt.year, _cutoff_dt.month, _cutoff_dt.day, 11, 0, 0,
                tzinfo=_paris_tz,
            )

        squad_resp = supabase.table("gt_squad").select(
            "team_id, rider_id, role, created_at, removed_at"
        ).eq("phase_id", phase_id).eq("year", year).execute()
        for r in (squad_resp.data or []):
            created = _parse_supabase_ts(r["created_at"])
            removed = _parse_supabase_ts(r["removed_at"]) if r.get("removed_at") else None
            # SC-6: membership window is [created, removed) at the cutoff instant —
            # created AT the cutoff counts (<=), a removal AT the cutoff does not
            # (strict >). This is consistent with the role-assignment rule below
            # (`applied > cutoff` skips), so both treat "exactly at cutoff" as active.
            if created <= gt_cutoff and (removed is None or removed > gt_cutoff):
                gt_squad_members[(r["team_id"], r["rider_id"])] = True

        role_resp = supabase.table("gt_role_assignments").select(
            "team_id, rider_id, role, applied_at"
        ).eq("phase_id", phase_id).eq("year", year).order(
            "applied_at", desc=True
        ).execute()
        for r in (role_resp.data or []):
            applied = _parse_supabase_ts(r["applied_at"])
            if applied > gt_cutoff:
                continue
            key = (r["team_id"], r["rider_id"])
            if key not in gt_roles:
                gt_roles[key] = r["role"]

    # --- Step 3c: Daily classifications for the current stage-race stage(s).
    # Indexed by (race_slug, rider_id) so each rider-stage pair gets its own bonus.
    classif_by_key: dict[tuple[str, str], list[dict]] = {}
    if squad_slugs:
        classif_resp = supabase.table("gt_daily_classifications").select(
            "race_slug, rider_id, classification_type, rank"
        ).in_("race_slug", squad_slugs).execute()
        for row in (classif_resp.data or []):
            classif_by_key.setdefault(
                (row["race_slug"], row["rider_id"]), []
            ).append(row)

    # --- Step 3d: Final secondary classifications (Points/KOM/Youth) for completed stage-races.
    # Read from the DEDICATED gt_final_classifications table (kept out of race_results so it
    # never pollutes sponsor_bonus / goal_evaluator / UI — see Task 4 storage rationale).
    # Gated: empty for ordinary stage-slug runs → no .table() call (mock-safe).
    # Spec A A9: extended to any stage-race (GT + 1-week) — mode selection happens in the loop.
    final_secondary_slugs = [
        s for s in (race_slugs or [])
        if _is_squad_race(s) and s.rsplit("/", 1)[-1] in ("points", "kom", "youth")
    ]
    final_by_rider: dict[str, list[dict]] = {}
    if final_secondary_slugs:
        fr_resp = supabase.table("gt_final_classifications").select(
            "rider_id, race_slug, classification_type, rank, race_date"
        ).in_("race_slug", final_secondary_slugs).execute()
        for row in (fr_resp.data or []):
            final_by_rider.setdefault(row["rider_id"], []).append(row)

    # === Resolve unresolved Nemesis duels for the stages we're about to score ===
    # Must run BEFORE the tactics prefetch so the per-rider loop sees outcomes.
    if squad_slugs:
        for gt_slug in squad_slugs:
            try:
                supabase.rpc("resolve_nemesis_for_stage", {"p_stage_slug": gt_slug}).execute()
            except Exception as e:
                # Don't fail scoring if resolution errors — log and continue
                print(f"WARN: resolve_nemesis_for_stage failed for {gt_slug}: {e}")

    # === Pre-fetch active tactics for the stage-race stages we are about to score ===
    # Keyed by stage_slug → list of activations with team_id + tactic_type + nemesis fields.
    # This prefetch now sees the resolved outcomes (if any).
    gt_tactics: dict[str, list[dict]] = {}
    if squad_slugs:  # avoid an empty `.in_([])` query
        tactics_resp = supabase.table("gt_tactic_activations").select(
            "id, team_id, phase_id, year, tactic_type, stage_slug,"
            " nemesis_target_team_id, nemesis_target_role,"
            " resolved_attacker_rider_id, resolved_target_rider_id,"
            " outcome, resolved_at"
        ).in_("stage_slug", squad_slugs).execute()

        for row in tactics_resp.data or []:
            gt_tactics.setdefault(row["stage_slug"], []).append(row)

    # Track all league_ids for snapshot step
    league_ids_seen: set[str] = set()

    # --- Step 4: Calculate XP per team and persist ---
    for team_id, team_clist in team_contracts.items():
        total_xp = 0.0
        processed_in_team: set[tuple[str, str]] = set()  # (rider_id, race_slug)

        for contract in team_clist:
            rider_id = contract["rider_id"]
            race_entries = rider_race_points.get(rider_id)
            if not race_entries:
                continue

            # Extract rider info for policy matching
            rider_join = contract.get("riders") or {}
            if isinstance(rider_join, list):
                rider_join = rider_join[0] if rider_join else {}
            rider_info = {
                "specialty": rider_join.get("specialty"),
                "nationality": rider_join.get("nationality"),
                "real_team": rider_join.get("real_team"),
                "birthdate": rider_join.get("birthdate"),
                "pcs_rank": rider_join.get("pcs_rank"),
            }

            # Task 2: per-rider strategy bonus
            strategies_for_team = team_strategies.get(team_id, [])
            bonus = _compute_rider_bonus(rider_info, strategies_for_team)

            for entry in race_entries:
                # Contract-date guard: only score races during contract period
                race_date_str = entry.get("race_date")
                if race_date_str:
                    race_dt = date.fromisoformat(str(race_date_str))
                    purchased_at_raw = contract.get("purchased_at")
                    if purchased_at_raw:
                        purchased_dt = date.fromisoformat(str(purchased_at_raw)[:10])
                        if race_dt < purchased_dt:
                            continue
                    # Prefer released_at (set by current code); fall back to legacy release_date
                    released_raw = contract.get("released_at") or contract.get("release_date")
                    if released_raw:
                        release_dt = date.fromisoformat(str(released_raw)[:10])
                        if race_dt > release_dt:
                            continue

                raw_points = entry["pcs_points"]
                race_slug = entry["race_slug"]
                breakaway_kms = entry.get("breakaway_kms")
                profile_icon = entry.get("profile_icon")

                # === Compute role multiplier (squad only) + classif bonus (all squad-race contracted riders).
                # Spec A A9: extends squad-gating from GT-only to any stage-race (GT + 1-week).
                in_squad = (team_id, rider_id) in gt_squad_members
                gt_role_mult = 1.0
                gt_classif_bonus = 0.0
                gt_distance_bonus = 0.0
                underdog_mult = 1.0
                role = "domestique"  # default; overridden for squad members with assigned role
                if _is_squad_race(race_slug):
                    if not in_squad:
                        continue  # non-squad contracted riders earn 0 XP on stage-race stages
                    role = gt_roles.get((team_id, rider_id), "domestique")
                    gt_role_mult = _role_multiplier(
                        role, race_slug, entry.get("is_itt", False),
                        breakaway_kms, profile_icon,
                    )
                    underdog_mult = (
                        _underdog_multiplier(rider_info.get("pcs_rank"), race_slug)
                        if role == "underdog" else 1.0
                    )
                    # V2: only role-matched classifications earn a bonus (Spec A A2).
                    gt_classif_bonus = _classif_bonus(
                        classif_by_key.get((race_slug, rider_id), []),
                        role,
                    )
                    if role == "stage_hunter" and not race_slug.endswith("/gc"):
                        gt_distance_bonus = _breakaway_distance_bonus(breakaway_kms)

                # === Apply tactic modifiers (no-op when gt_tactics is empty) ===
                nemesis_modifier = 1.0
                tactic_applied: str | None = None
                # SC-2: Underdog and Nemesis are mutually exclusive. Nemesis duels are
                # fought by gc_leader/sprinter rivals; the underdog role is separate, so
                # the two boosts must never stack (× nemesis × underdog). If a Nemesis
                # duel materially affects this rider, we drop the underdog multiplier.
                nemesis_applied = False
                # Nemesis modifiers are collected, then combined after the loop. The
                # attacker (own duel) and each enemy duel that targets this rider are
                # tracked separately so a single target_won reward (1.25) is NOT clamped
                # against the initial 1.0 — see the combination block below.
                attacker_nem_mod: float | None = None
                target_nem_mods: list[float] = []

                for tactic in gt_tactics.get(race_slug, []):
                    t_type = tactic["tactic_type"]

                    if tactic["team_id"] == team_id:
                        # Tactic owned by this team
                        if t_type == "unleash":
                            override, applied = compute_unleash_modifier(role, race_slug)
                            if override is not None:
                                gt_role_mult = override
                                tactic_applied = applied
                        elif t_type == "overdrive":
                            override, applied = compute_overdrive_modifier(
                                role, race_slug, breakaway_kms
                            )
                            if override is not None:
                                gt_role_mult = override
                                tactic_applied = applied
                        elif t_type == "call_the_bus":
                            include, applied = compute_call_bus_modifier(in_squad, race_slug)
                            if include:
                                tactic_applied = applied
                                # gt_role_mult remains 1.0 (domestique default for bench riders)
                        elif t_type in ("nemesis_gc", "nemesis_sprint"):
                            attacker_rider = tactic.get("resolved_attacker_rider_id")
                            if attacker_rider == rider_id:
                                role_override, nem_mod, applied = compute_nemesis_modifier(
                                    outcome=tactic.get("outcome") or "no_resolution",
                                    rider_role="attacker",
                                    tactic_type=t_type,
                                )
                                if role_override is not None:
                                    gt_role_mult = role_override
                                attacker_nem_mod = nem_mod
                                tactic_applied = applied
                                if role_override is not None or nem_mod != 1.0:
                                    nemesis_applied = True
                    else:
                        # Tactic owned by another team — only Nemesis affects this rider
                        if t_type in ("nemesis_gc", "nemesis_sprint"):
                            target_team = tactic.get("nemesis_target_team_id")
                            target_rider = tactic.get("resolved_target_rider_id")
                            if target_team == team_id and target_rider == rider_id:
                                role_override, nem_mod, applied = compute_nemesis_modifier(
                                    outcome=tactic.get("outcome") or "no_resolution",
                                    rider_role="target",
                                    tactic_type=t_type,
                                )
                                if role_override is not None:
                                    gt_role_mult = role_override
                                target_nem_mods.append(nem_mod)
                                tactic_applied = applied
                                if role_override is not None or nem_mod != 1.0:
                                    nemesis_applied = True

                # === Combine Nemesis modifiers ===
                # Fix (2026-06-04): a single enemy duel the target WINS now keeps its
                # 1.25 reward — previously `min(1.0_initial, 1.25)` silently clamped it
                # to 1.0, so a defended duel never paid out (contradicting §6.4).
                # SC-3 (decided — kept): when 2+ enemy duels target the same rider, the
                # harshest of those still wins (min over the target list). The own-duel
                # (attacker) modifier and the targeted-duels worst case combine by min.
                _nem_inputs: list[float] = []
                if attacker_nem_mod is not None:
                    _nem_inputs.append(attacker_nem_mod)
                if target_nem_mods:
                    _nem_inputs.append(min(target_nem_mods))
                if _nem_inputs:
                    nemesis_modifier = min(_nem_inputs)

                # SC-2: drop the underdog multiplier when a Nemesis duel materially affects
                # this rider — the two boosts are mutually exclusive (see comment above).
                if nemesis_applied:
                    underdog_mult = 1.0

                xp = max(
                    0,
                    round(
                        (raw_points * gt_role_mult * (1 + bonus)
                         + gt_classif_bonus + gt_distance_bonus)
                        * nemesis_modifier * underdog_mult,
                        2,
                    ),
                )

                # Upsert rider_xp_daily (conflict key: team_id + rider_id + race_slug)
                try:
                    supabase.table("rider_xp_daily").upsert({
                        "team_id": team_id,
                        "rider_id": rider_id,
                        "contract_id": contract["id"],
                        "date": entry.get("race_date", today),
                        "raw_pcs_points": raw_points,
                        "strategy_bonus": bonus,
                        # SC-5: role_mult/classif_bonus are the legacy columns; gt_role_mult/
                        # gt_classif_bonus are the current ones. They are written with identical
                        # values on purpose (backward-compat for older readers). Kept in sync, not
                        # dropped — removing the legacy pair needs a migration + a frontend audit.
                        "role_mult": gt_role_mult,
                        "classif_bonus": gt_classif_bonus,
                        "gt_role_mult": gt_role_mult,
                        "gt_classif_bonus": gt_classif_bonus,
                        "gt_distance_bonus": gt_distance_bonus,
                        "nemesis_modifier": nemesis_modifier,
                        "underdog_mult": underdog_mult,
                        "tactic_applied": tactic_applied,
                        "xp_gained": xp,
                        "race_slug": race_slug,
                    }, on_conflict="team_id,rider_id,race_slug").execute()
                except Exception as e:
                    logger.error(f"rider_xp_daily upsert failed for rider {rider_id} race {race_slug}: {e}")
                    errors.append(str(e))
                    continue

                total_xp += xp
                processed_in_team.add((rider_id, race_slug))

        # === Second pass: classif-only XP ===
        # Squad riders who placed in GC/points/KOM classifications but had no stage result
        # (0 PCS points) are skipped by the main loop. This pass creates their entries.
        if classif_by_key:
            for (c_race_slug, c_rider_id), classif_rows in classif_by_key.items():
                if (team_id, c_rider_id) not in gt_squad_members:
                    continue
                if (c_rider_id, c_race_slug) in processed_in_team:
                    continue  # already handled with stage points in main loop
                contract = next(
                    (c for c in team_clist if c["rider_id"] == c_rider_id), None
                )
                if not contract:
                    continue

                c_role = gt_roles.get((team_id, c_rider_id), "domestique")
                c_classif_bonus = _classif_bonus(classif_rows, c_role)
                if c_classif_bonus == 0:
                    continue

                c_xp = max(0, round(c_classif_bonus, 2))
                c_date = race_date_by_slug.get(c_race_slug, today)

                try:
                    supabase.table("rider_xp_daily").upsert({
                        "team_id": team_id,
                        "rider_id": c_rider_id,
                        "contract_id": contract["id"],
                        "date": c_date,
                        "raw_pcs_points": 0,
                        "strategy_bonus": 0.0,
                        "role_mult": 1.0,
                        "classif_bonus": c_classif_bonus,
                        "gt_role_mult": 1.0,
                        "gt_classif_bonus": c_classif_bonus,
                        "gt_distance_bonus": 0.0,
                        "nemesis_modifier": 1.0,
                        "tactic_applied": None,
                        "xp_gained": c_xp,
                        "race_slug": c_race_slug,
                    }, on_conflict="team_id,rider_id,race_slug").execute()
                except Exception as e:
                    logger.error(
                        f"rider_xp_daily classif upsert failed for rider {c_rider_id} "
                        f"race {c_race_slug}: {e}"
                    )
                    errors.append(str(e))
                    continue

                total_xp += c_xp
                processed_in_team.add((c_rider_id, c_race_slug))

        # === Third pass: final secondary classification XP (Points/KOM/Youth) ===
        # Spec A A2 — rank → 2-value scale × role mult. Squad-gated; GT-only in P2.
        if final_by_rider:
            for contract in team_clist:
                f_rider_id = contract["rider_id"]
                if (team_id, f_rider_id) not in gt_squad_members:
                    continue
                for fr in final_by_rider.get(f_rider_id, []):
                    f_slug = fr["race_slug"]
                    if (f_rider_id, f_slug) in processed_in_team:
                        continue
                    f_ctype = fr.get("classification_type") or f_slug.rsplit("/", 1)[-1]
                    f_role = gt_roles.get((team_id, f_rider_id), "domestique")
                    f_mode = "gt" if _is_gt_slug(f_slug) else "one_week"
                    f_bonus = _final_secondary_bonus(f_ctype, fr.get("rank"), f_role, mode=f_mode)
                    if f_bonus == 0:
                        continue
                    f_xp = max(0, round(f_bonus, 2))
                    f_date = fr.get("race_date") or race_date_by_slug.get(f_slug, today)
                    try:
                        supabase.table("rider_xp_daily").upsert({
                            "team_id": team_id,
                            "rider_id": f_rider_id,
                            "contract_id": contract["id"],
                            "date": f_date,
                            "raw_pcs_points": 0,
                            "strategy_bonus": 0.0,
                            "role_mult": 1.0,
                            "classif_bonus": f_bonus,
                            "gt_role_mult": 1.0,
                            "gt_classif_bonus": f_bonus,
                            "gt_distance_bonus": 0.0,
                            "nemesis_modifier": 1.0,
                            "tactic_applied": None,
                            "xp_gained": f_xp,
                            "race_slug": f_slug,
                        }, on_conflict="team_id,rider_id,race_slug").execute()
                    except Exception as e:
                        logger.error(
                            f"final classif upsert failed for rider {f_rider_id} "
                            f"slug {f_slug}: {e}"
                        )
                        errors.append(str(e))
                        continue
                    total_xp += f_xp
                    processed_in_team.add((f_rider_id, f_slug))

        if total_xp == 0:
            continue

        try:
            # Fetch current team values
            team_row = supabase.table("teams").select(
                "id, cumulative_xp, level, league_id"
            ).eq("id", team_id).single().execute()

            if not team_row.data:
                logger.warning(f"Team {team_id} not found — skipping XP update")
                continue

            prev_xp = round(prev_team_xp.get(team_id, 0.0), 2)
            delta_xp = round(total_xp - prev_xp, 2)
            new_xp = team_row.data["cumulative_xp"] + delta_xp

            # Task 3: auto level-up (monotonic — no regression, per Level Curve Stretch grandfather rule)
            current_level = team_row.data.get("level", 1)
            computed_level = compute_level(new_xp)
            new_level = max(current_level, computed_level)  # grandfather: never regress

            update_data: dict = {
                "cumulative_xp": new_xp,
            }
            if new_level > current_level:
                update_data["level"] = new_level
                logger.info(f"Team {team_id} level up: {current_level} → {new_level} (XP: {new_xp})")
            elif computed_level < current_level:
                logger.debug(
                    f"Team {team_id} grandfathered at Lv.{current_level} (computed would be Lv.{computed_level} with {new_xp} XP)"
                )

            supabase.table("teams").update(update_data).eq("id", team_id).execute()

            # Track league for snapshot
            if team_row.data.get("league_id"):
                league_ids_seen.add(team_row.data["league_id"])

            processed += 1

        except Exception as e:
            logger.error(f"Failed to update team {team_id}: {e}")
            errors.append(str(e))

    # --- Step 5: Snapshot team_ranking_daily ---
    for league_id in league_ids_seen:
        # 5a. Build POST-scoring ranking for this league.
        try:
            league_teams_resp = supabase.table("teams").select(
                "id, cumulative_xp"
            ).eq("league_id", league_id).order(
                "cumulative_xp", desc=True
            ).execute()
            league_rows = league_teams_resp.data or []

            # 5b. Write the existing daily snapshot (unchanged behavior).
            for rank, row in enumerate(league_rows, start=1):
                supabase.table("team_ranking_daily").upsert({
                    "team_id": row["id"],
                    "date": today,
                    "rank": rank,
                    "cumulative_xp": row["cumulative_xp"],
                }, on_conflict="team_id,date").execute()

        except Exception as e:
            logger.error(f"Failed to snapshot/detect for league {league_id}: {e}")
            errors.append(str(e))

    return {
        "status": "completed",
        "teams_processed": processed,
        "errors": errors,
    }
