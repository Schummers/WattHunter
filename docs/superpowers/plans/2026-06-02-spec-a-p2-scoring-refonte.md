# Spec A — P2: Scoring Refonte — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebalance Grand Tour scoring per Spec A — double the matched daily-classification bonus and restrict it to matching roles (V2), drop the GC-final over-boost to ×1.0, reward breakaway stage hunters, gate the sprinter bonus by stage profile, retune Overdrive, and score the final Points/KOM/Youth jerseys via a rank-derived 2-value scale.

**Architecture:** Pure scoring-layer change in the Python sync service (`services/pcs-sync`), all forward-only (no Giro re-score). Every multiplier/bonus rule lives in `scoring.py` and reads data already captured by P1 (`breakaway_kms`, `profile_icon`, daily `youth`). One additive migration adds a `gt_distance_bonus` traceability column. One new import (`import_final_classifications`) plus a pipeline hook captures the final secondary jerseys for completed GTs. **Nemesis profile-gating (A7) and 1-week Race Team squads (A9) are out of P2** (deferred to P3 — see Scope).

**Tech Stack:** Python 3.12 (`services/pcs-sync`, pytest + pytest-asyncio), Supabase Postgres migration, TypeScript types regen (`apps/web/lib/database.types.ts`), `procyclingstats` lib.

**Source spec:** `docs/superpowers/specs/2026-06-01-spec-a-levels-and-roles-design.md` (A2, A3, A4, A7 — Overdrive half only).

**Project rules:** Rule #2 — schema changes via migration only. App text English. The one migration here recomputes nothing and is additive, but pushing to **prod** (`supabase db push --linked`, ref `uuvshpykvpnhpeondqjt`) still requires **explicit user confirmation** (CLAUDE.md) — never auto-push. Test locally first. Python: invoke the pcs-sync venv `.venv/bin/python` (3.12), run pytest from `services/pcs-sync`.

---

## Scope (locked with user 2026-06-02)

**In P2 (all scoring-time, reads post-race data):**
- A2 — daily classif matched mult ×1.5 → **×2**; **V2 role-matched-only** (non-matching roles earn 0); daily **youth** scored (gc_leader ×1.5); **GC final ×1.0** (no role mult); final **Points/KOM/Youth** scored via 2-value scale × role mult.
- A3 — **stage hunter** ×1.5 only in the breakaway (`breakaway_kms ≥ 30`) + additive **+1 XP / 10 km** (no cap); ×1.0 otherwise.
- A4 — **sprinter** ×1.5 only on stage profile **p1/p2/p3**; ×1.0 otherwise.
- A7 (Overdrive half) — **Overdrive** boosts stage_hunter to ×2 only when in the breakaway.

**Deferred to P3 (decided with user):**
- A7 **Nemesis profile-gating at activation** — requires the stage profile *before* the race; `profile_icon` is only captured post-race (`race_results`), so no pre-race source exists today. Bundled with P3/A9 where the tactics tables generalize. `compute_nemesis_modifier` (scoring-time resolution) is **unchanged** in P2.
- A9 **1-week Race Team squads** — `FINAL_SECONDARY_SCALE["one_week"]` (40/10/5) is coded so P3 can flip it on, but P2 imports + scores final secondary jerseys for **GT only** (Giro/Tour/Vuelta), where squads + roles already exist.
- A8 doc-front scoring page (P3).

**Forward-only:** the Giro 2026 is not re-scored. New rules apply from the Tour onward. The Giro GC final, if not yet synced, is imported under the new ×1.0 rule anyway.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `services/pcs-sync/scoring.py` | role multipliers, classif V2/×2/youth, breakaway distance, GC ×1.0, final-secondary scoring | Modify |
| `services/pcs-sync/tactics.py` | Overdrive breakaway gating | Modify |
| `services/pcs-sync/sync_race.py` | `import_final_classifications` (writes to `gt_final_classifications`); `import_gc_results` returns `has_points` | Modify |
| `services/pcs-sync/run_pipeline.py` | import finals when a GT completes; append final slugs for scoring | Modify |
| `supabase/migrations/20260602130000_rider_xp_daily_distance_bonus.sql` | add `gt_distance_bonus` column | Create |
| `supabase/migrations/_rollback/20260602130000_rider_xp_daily_distance_bonus.down.sql` | rollback | Create |
| `supabase/migrations/20260602130100_gt_final_classifications.sql` | dedicated table for final Points/KOM/Youth jerseys | Create |
| `supabase/migrations/_rollback/20260602130100_gt_final_classifications.down.sql` | rollback | Create |
| `apps/web/lib/database.types.ts` | regenerated (new column) | Regenerate |
| `services/pcs-sync/tests/test_scoring.py` | unit tests for new helpers | Modify |
| `services/pcs-sync/tests/test_scoring_gt.py` | update expected XP, un-skip 3 V2 tests | Modify |
| `services/pcs-sync/tests/test_tactics.py` | Overdrive breakaway tests | Modify |
| `services/pcs-sync/tests/test_sync_race.py` | finals import + `has_points` tests | Modify |
| `docs/GAME_RULES.md` | §7 scoring detail, §11 constants, §13 Overdrive | Modify |
| `docs/ARCHITECTURE.md` | new function, column, finals scoring pass | Modify |

**Mock-ordering invariant (critical).** `tests/helpers.py:make_supabase(*responses)` pops one response per `.table()` call **in call order**. The GT integration tests (`test_scoring_gt.py`) hard-code that order. Therefore **every new query or upsert added to `calculate_daily_scores` MUST be gated behind a condition that is FALSE for the existing stage-slug tests** (`race_slugs=[".../stage-4"]`). The two additions here — the final-secondary prefetch (`if final_secondary_slugs:`) and the final-secondary scoring pass (`if final_by_rider:`) — are both empty for stage-slug tests, so no `.table()` call fires and the existing response ordering is preserved. Adding columns to a `.select(...)` string is safe (the mock ignores the string).

---

## Task 0: Worktree Python environment

**Files:** none (environment only).

Worktrees do not share untracked files, so `services/pcs-sync/.venv` is absent here. Reuse the main repo's venv (no reinstall) by symlinking it — its interpreter has `supabase`, `procyclingstats`, `pytest`, `pytest-asyncio` already.

- [ ] **Step 1: Symlink the existing venv into the worktree**

Run: `ln -s /Users/jonathanschummers/Documents/WattHunter/services/pcs-sync/.venv services/pcs-sync/.venv`

- [ ] **Step 2: Confirm the baseline suite is green before any change**

Run: `cd services/pcs-sync && .venv/bin/python -m pytest -q`
Expected: `164 passed, 3 skipped` (the 3 skipped are the `@_P2_CLASSIF_V2` tests this plan un-skips).

---

## Task 1: `gt_distance_bonus` traceability column (migration)

**Files:**
- Create: `supabase/migrations/20260602130000_rider_xp_daily_distance_bonus.sql`
- Create: `supabase/migrations/_rollback/20260602130000_rider_xp_daily_distance_bonus.down.sql`

**Why:** the stage-hunter breakaway bonus (Task 3) is an *additive* term in the XP formula, not captured by any existing decomposition column (`gt_role_mult`, `gt_classif_bonus`, `nemesis_modifier`). Storing it keeps the invariant that the stored columns reproduce `xp_gained`. The column must exist on prod before the first Tour scoring run (the upsert writes it). Additive, no recompute.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260602130000_rider_xp_daily_distance_bonus.sql`:

```sql
-- Spec A (A3) — store the stage-hunter breakaway distance bonus (+1 XP / 10 km, additive).
-- Keeps the rider_xp_daily decomposition complete:
--   xp_gained = (raw_pcs_points × gt_role_mult × (1 + strategy_bonus)
--               + gt_classif_bonus + gt_distance_bonus) × nemesis_modifier
ALTER TABLE public.rider_xp_daily
  ADD COLUMN IF NOT EXISTS gt_distance_bonus NUMERIC(5,1) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.rider_xp_daily.gt_distance_bonus IS
  'Stage-hunter breakaway distance bonus: floor(breakaway_kms / 10), additive, not multiplied (Spec A A3). 0 otherwise.';
```

- [ ] **Step 2: Write the rollback**

Create `supabase/migrations/_rollback/20260602130000_rider_xp_daily_distance_bonus.down.sql`:

```sql
ALTER TABLE public.rider_xp_daily
  DROP COLUMN IF EXISTS gt_distance_bonus;
```

- [ ] **Step 3: Apply + verify locally**

Start the local stack if needed (`colima start --cpu 4 --memory 6` then `supabase start --exclude vector,edge-runtime,logflare,imgproxy,studio,mailpit`), then:

Run: `supabase db reset`
Run: `docker exec -i supabase_db_WattHunter psql -U postgres -d postgres -c "SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name='rider_xp_daily' AND column_name='gt_distance_bonus';"`
Expected: one row — `gt_distance_bonus | numeric | 0`.

- [ ] **Step 4: Push to remote (additive — REQUIRES USER CONFIRMATION)**

⚠️ Per CLAUDE.md, ask the user before running. This is additive (column with default), low-risk.

Run (only after the user confirms): `supabase db push --linked`

- [ ] **Step 5: Regenerate TS types**

Run: `cd apps/web && pnpm supabase gen types typescript --linked > lib/database.types.ts` (or the repo's existing gen command — confirm `gt_distance_bonus` appears under `rider_xp_daily` Row/Insert/Update).

Verify: `grep -n "gt_distance_bonus" apps/web/lib/database.types.ts` returns 3 hits (Row, Insert, Update).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260602130000_rider_xp_daily_distance_bonus.sql supabase/migrations/_rollback/20260602130000_rider_xp_daily_distance_bonus.down.sql apps/web/lib/database.types.ts
git commit -m "feat(db): add rider_xp_daily.gt_distance_bonus for breakaway scoring (Spec A A3)"
```

---

## Task 2: Scoring core refonte — role multipliers, classif V2/×2/youth, breakaway distance, GC ×1.0

This is the heart of P2. It changes three coupled pieces of `scoring.py` (`_role_multiplier`, `_classif_bonus`, the XP formula + wiring). Because the GT integration tests exercise all three through `calculate_daily_scores`, they are updated together at the end of this task so the suite ends green.

**Files:**
- Modify: `services/pcs-sync/scoring.py` (constants ~57-81, `_classif_bonus` 84-110, `_role_multiplier` 117-131, `calculate_daily_scores` query ~226-249 + loop ~438-536)
- Test: `services/pcs-sync/tests/test_scoring.py` (new unit tests)
- Test: `services/pcs-sync/tests/test_scoring_gt.py` (update expected values, un-skip 3)

### 2a — Pure helper functions (unit-tested in isolation)

- [ ] **Step 1: Write failing unit tests for the new helpers**

Append to `services/pcs-sync/tests/test_scoring.py`:

```python
# --- Spec A P2 scoring helpers ------------------------------------------------

def test_role_multiplier_gc_final_is_unboosted():
    """Any role on a /gc slug → ×1.0 (GC final raw PCS points, Spec A A2)."""
    from scoring import _role_multiplier
    assert _role_multiplier("gc_leader", "race/giro-d-italia/2026/gc", False) == 1.0
    assert _role_multiplier("climber",   "race/giro-d-italia/2026/gc", False) == 1.0


def test_role_multiplier_gc_leader_and_climber_on_stage():
    from scoring import _role_multiplier
    assert _role_multiplier("gc_leader", "race/giro-d-italia/2026/stage-4", False) == 1.5
    assert _role_multiplier("climber",   "race/giro-d-italia/2026/stage-4", False) == 1.5


def test_role_multiplier_tt_specialist_itt_only():
    from scoring import _role_multiplier
    s = "race/giro-d-italia/2026/stage-7"
    assert _role_multiplier("tt_specialist", s, True) == 2.0
    assert _role_multiplier("tt_specialist", s, False) == 1.0


def test_role_multiplier_sprinter_gated_by_profile():
    """Sprinter ×1.5 only on p1/p2/p3; ×1.0 on p4/p5/unknown (Spec A A4)."""
    from scoring import _role_multiplier
    s = "race/giro-d-italia/2026/stage-4"
    assert _role_multiplier("sprinter", s, False, profile_icon="p1") == 1.5
    assert _role_multiplier("sprinter", s, False, profile_icon="p3") == 1.5
    assert _role_multiplier("sprinter", s, False, profile_icon="p4") == 1.0
    assert _role_multiplier("sprinter", s, False, profile_icon="p5") == 1.0
    assert _role_multiplier("sprinter", s, False, profile_icon=None) == 1.0


def test_role_multiplier_stage_hunter_gated_by_breakaway():
    """Stage hunter ×1.5 only when in the breakaway (≥30 km), else ×1.0 (Spec A A3)."""
    from scoring import _role_multiplier
    s = "race/giro-d-italia/2026/stage-4"
    assert _role_multiplier("stage_hunter", s, False, breakaway_kms=120.0) == 1.5
    assert _role_multiplier("stage_hunter", s, False, breakaway_kms=30.0) == 1.5
    assert _role_multiplier("stage_hunter", s, False, breakaway_kms=29.9) == 1.0
    assert _role_multiplier("stage_hunter", s, False, breakaway_kms=None) == 1.0


def test_breakaway_distance_bonus():
    """+1 XP per 10 km in the break, no cap; 0 below the 30 km threshold (Spec A A3)."""
    from scoring import _breakaway_distance_bonus
    assert _breakaway_distance_bonus(150.0) == 15.0
    assert _breakaway_distance_bonus(255.0) == 25.0   # no cap; floor
    assert _breakaway_distance_bonus(30.0) == 3.0
    assert _breakaway_distance_bonus(29.0) == 0.0      # below threshold → not in break
    assert _breakaway_distance_bonus(None) == 0.0


def test_classif_bonus_v2_role_matched_only():
    """Only the matching classification earns a bonus; matched daily mult is ×2 (Spec A A2)."""
    from scoring import _classif_bonus
    # gc_leader, rank 3 GC: base (10+1-3)=8 × 2.0 = 16
    assert _classif_bonus([{"classification_type": "gc", "rank": 3}], "gc_leader") == 16.0
    # sprinter, rank 2 points: base (5+1-2)=4 × 2.0 = 8
    assert _classif_bonus([{"classification_type": "points", "rank": 2}], "sprinter") == 8.0
    # climber, rank 1 kom: base (3+1-1)=3 × 2.0 = 6
    assert _classif_bonus([{"classification_type": "kom", "rank": 1}], "climber") == 6.0
    # gc_leader, rank 1 youth: base (5+1-1)=5 × 1.5 = 7.5
    assert _classif_bonus([{"classification_type": "youth", "rank": 1}], "gc_leader") == 7.5
    # gc_leader also matches youth AND gc together
    assert _classif_bonus(
        [{"classification_type": "gc", "rank": 1}, {"classification_type": "youth", "rank": 1}],
        "gc_leader",
    ) == 20.0 + 7.5
    # non-matching roles → 0
    assert _classif_bonus([{"classification_type": "gc", "rank": 1}], "domestique") == 0.0
    assert _classif_bonus([{"classification_type": "points", "rank": 1}], "stage_hunter") == 0.0
    assert _classif_bonus([{"classification_type": "gc", "rank": 1}], "tt_specialist") == 0.0
    # sprinter in GC (non-matched ctype for sprinter) → 0
    assert _classif_bonus([{"classification_type": "gc", "rank": 1}], "sprinter") == 0.0
    # out of top-N → 0
    assert _classif_bonus([{"classification_type": "gc", "rank": 11}], "gc_leader") == 0.0
```

- [ ] **Step 2: Run them to confirm failure**

Run: `cd services/pcs-sync && .venv/bin/python -m pytest tests/test_scoring.py -k "role_multiplier or breakaway_distance or classif_bonus_v2" -v`
Expected: FAIL — `_breakaway_distance_bonus` undefined; `_role_multiplier` rejects `breakaway_kms`/`profile_icon` kwargs; `_classif_bonus` still gives non-matched roles a bonus.

- [ ] **Step 3: Replace the role/classif constants in `scoring.py`**

In `services/pcs-sync/scoring.py`, replace the block from `# (scope, multiplier) per role.` through the `CLASSIF_ROLE_MATCH` dict (lines ~52-81) with:

```python
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
```

> Note: the original `_GT_PHASE_MAP` lives at lines 66-70; it is reproduced above so the replaced block stays contiguous. Delete the now-duplicate `_GT_PHASE_MAP` definition further down (lines 66-70) so it is declared once. The old `ROLE_MULTIPLIERS` dict is removed entirely (replaced by explicit logic in `_role_multiplier`).

- [ ] **Step 4: Rewrite `_classif_bonus` (V2)**

Replace the body of `_classif_bonus` (lines ~84-110) with:

```python
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
```

- [ ] **Step 5: Add the breakaway helpers + rewrite `_role_multiplier`**

Replace `_role_multiplier` (lines ~117-131) with the following (and add the two helpers just above it):

```python
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

    Awarded only when the rider counts as in the breakaway (≥ threshold). Never multiplied.
    """
    if not _in_breakaway(breakaway_kms):
        return 0.0
    return float(int(float(breakaway_kms) // BREAKAWAY_KM_PER_POINT))


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
```

- [ ] **Step 6: Run the helper unit tests — confirm pass**

Run: `cd services/pcs-sync && .venv/bin/python -m pytest tests/test_scoring.py -k "role_multiplier or breakaway_distance or classif_bonus_v2" -v`
Expected: PASS.

### 2b — Wire breakaway/profile + distance bonus into `calculate_daily_scores`

- [ ] **Step 7: Add the two capture columns to the race_results select (both branches)**

In `calculate_daily_scores`, the `race_results` select string appears twice (lines ~226-228 and ~230-232). In both, change:

```python
            "rider_id, race_slug, pcs_points, race_date, is_itt"
```
to:
```python
            "rider_id, race_slug, pcs_points, race_date, is_itt, breakaway_kms, profile_icon"
```

- [ ] **Step 8: Carry the new fields into `rider_race_points` entries**

In the loop building `rider_race_points` (lines ~243-249), add two keys:

```python
        rider_race_points.setdefault(h["rider_id"], []).append({
            "race_slug": h["race_slug"],
            "pcs_points": h["pcs_points"],
            "race_date": h.get("race_date"),
            "is_itt": bool(h.get("is_itt", False)),
            "breakaway_kms": h.get("breakaway_kms"),
            "profile_icon": h.get("profile_icon"),
        })
```

- [ ] **Step 9: Use the fields in the per-entry scoring block**

In the per-`entry` block, after `race_slug = entry["race_slug"]` (line ~439), add:

```python
                breakaway_kms = entry.get("breakaway_kms")
                profile_icon = entry.get("profile_icon")
```

Change the role-multiplier call (line ~450) to pass them:

```python
                    gt_role_mult = _role_multiplier(
                        role, race_slug, entry.get("is_itt", False),
                        breakaway_kms, profile_icon,
                    )
```

Right after the `gt_classif_bonus = _classif_bonus(...)` assignment (inside the `if _is_gt_slug(race_slug):` block, after line ~455), add the distance bonus:

```python
                    gt_distance_bonus = 0.0
                    if role == "stage_hunter":
                        gt_distance_bonus = _breakaway_distance_bonus(breakaway_kms)
```

And initialize it for the non-GT path: just before `gt_role_mult = 1.0` (line ~443), add `gt_distance_bonus = 0.0` to the defaults block so it is always defined:

```python
                in_squad = (team_id, rider_id) in gt_squad_members
                gt_role_mult = 1.0
                gt_classif_bonus = 0.0
                gt_distance_bonus = 0.0
                role = "domestique"  # default; overridden for squad members with assigned role
```

- [ ] **Step 10: Add the distance bonus to the XP formula + persist it**

Change the XP formula (lines ~510-517) to include the additive distance bonus inside the nemesis factor:

```python
                xp = max(
                    0,
                    round(
                        (raw_points * gt_role_mult * (1 + bonus)
                         + gt_classif_bonus + gt_distance_bonus)
                        * nemesis_modifier,
                        2,
                    ),
                )
```

Add `"gt_distance_bonus": gt_distance_bonus,` to the main `rider_xp_daily` upsert payload (after `"gt_classif_bonus": gt_classif_bonus,`, line ~531).

Also add `"gt_distance_bonus": 0.0,` to the **classif-only second-pass** upsert payload (after its `"gt_classif_bonus": c_classif_bonus,`, line ~579) so that payload stays schema-complete.

### 2c — Update the GT integration tests

- [ ] **Step 11: Add `breakaway_kms` / `profile_icon` params to `_base_mocks`**

In `services/pcs-sync/tests/test_scoring_gt.py`, extend `_base_mocks` signature (lines ~26-37) with two params:

```python
def _base_mocks(
    *,
    role: str,
    pcs_points: int = 100,
    is_itt: bool = False,
    prev_xp: list | None = None,
    classif_rows: list | None = None,
    starting_cumulative_xp: float = 0.0,
    squad_created_at: str = BEFORE_CUTOFF,
    squad_removed_at: str | None = None,
    role_applied_at: str = "2026-05-10T09:00:00+02:00",
    breakaway_kms: float | None = None,
    profile_icon: str | None = None,
):
```

And add the two keys to the race_results dict (the `# 1. race_results` block, lines ~64-71):

```python
        [{
            "rider_id": RIDER_ID,
            "race_slug": GIRO_SLUG,
            "pcs_points": pcs_points,
            "race_date": "2026-05-11",
            "is_itt": is_itt,
            "breakaway_kms": breakaway_kms,
            "profile_icon": profile_icon,
        }],
```

- [ ] **Step 12: Update the role-multiplier tests**

Replace the bodies as follows (only the changed tests):

`test_sprinter_applies_1_5x` — sprinter now needs a flat/hilly profile:
```python
async def test_sprinter_applies_1_5x():
    import scoring

    sb = _base_mocks(role="sprinter", profile_icon="p1")
    await scoring.calculate_daily_scores(sb, race_slugs=[GIRO_SLUG])

    payload = sb._last_upsert_payload("rider_xp_daily")
    assert payload["xp_gained"] == 150.0  # 100 × 1.5 (sprinter on p1 stage)


async def test_sprinter_no_multiplier_on_mountain_profile():
    """Sprinter on a mountain stage (p4/p5) → ×1.0 (Spec A A4)."""
    import scoring

    sb = _base_mocks(role="sprinter", profile_icon="p4")
    await scoring.calculate_daily_scores(sb, race_slugs=[GIRO_SLUG])

    payload = sb._last_upsert_payload("rider_xp_daily")
    assert payload["xp_gained"] == 100.0
```

`test_stage_hunter_1_5x_on_stage` — replace with breakaway-aware pair:
```python
async def test_stage_hunter_in_breakaway_gets_1_5x_plus_distance():
    """Stage hunter in the break (≥30 km): ×1.5 on the result + 1 pt/10 km additive (Spec A A3)."""
    import scoring

    sb = _base_mocks(role="stage_hunter", breakaway_kms=120.0)
    await scoring.calculate_daily_scores(sb, race_slugs=[GIRO_SLUG])

    payload = sb._last_upsert_payload("rider_xp_daily")
    # 100 × 1.5 + floor(120/10)=12 → 162
    assert payload["xp_gained"] == 162.0
    assert payload["gt_role_mult"] == 1.5
    assert payload["gt_distance_bonus"] == 12.0


async def test_stage_hunter_not_in_breakaway_gets_no_multiplier():
    """Stage hunter outside the break → ×1.0, no distance bonus (Spec A A3)."""
    import scoring

    sb = _base_mocks(role="stage_hunter", breakaway_kms=None)
    await scoring.calculate_daily_scores(sb, race_slugs=[GIRO_SLUG])

    payload = sb._last_upsert_payload("rider_xp_daily")
    assert payload["xp_gained"] == 100.0
    assert payload["gt_role_mult"] == 1.0
    assert payload["gt_distance_bonus"] == 0.0
```

Add a GC-final test for gc_leader (the existing `test_stage_hunter_no_multiplier_on_gc` already covers stage_hunter):
```python
async def test_gc_leader_no_multiplier_on_gc_final():
    """GC final (/gc) → ×1.0 even for gc_leader (Spec A A2, no double-boost)."""
    import scoring

    gc_slug = "race/giro-d-italia/2026/gc"
    sb = make_supabase(
        [{"rider_id": RIDER_ID, "race_slug": gc_slug, "pcs_points": 100,
          "race_date": "2026-05-28", "is_itt": False,
          "breakaway_kms": None, "profile_icon": None}],
        [],
        [{"id": CONTRACT_ID, "team_id": TEAM_ID, "rider_id": RIDER_ID,
          "purchased_at": "2026-01-01T00:00:00Z", "release_date": None, "released_at": None,
          "riders": {"specialty": "GC", "nationality": "BE", "real_team": "Soudal", "birthdate": "1998-01-01"}}],
        [],
        [{"team_id": TEAM_ID, "rider_id": RIDER_ID, "created_at": BEFORE_CUTOFF, "removed_at": None}],
        [{"team_id": TEAM_ID, "rider_id": RIDER_ID, "role": "gc_leader", "applied_at": "2026-05-10T09:00:00+02:00"}],
        [],
        [],
        {"id": TEAM_ID, "cumulative_xp": 0, "level": 1, "league_id": LEAGUE_ID},
        [],
        [{"id": TEAM_ID, "cumulative_xp": 100}],
    )
    await scoring.calculate_daily_scores(sb, race_slugs=[gc_slug])

    payload = sb._last_upsert_payload("rider_xp_daily")
    assert payload["xp_gained"] == 100.0  # was 150 under the old ×1.5 GC boost
```

- [ ] **Step 13: Update the classification tests (×2 + V2)**

Update these expected values (matched daily mult is now ×2):

- `test_gc_leader_gets_gc_classif_bonus_with_match_multiplier`: `assert payload["xp_gained"] == 166.0` (100×1.5 + 8×2=16). Update the docstring math accordingly.
- `test_sprinter_gets_points_classif_bonus_with_match_multiplier`: add `profile_icon="p1"` to the `_base_mocks(...)` call, then `assert payload["xp_gained"] == 158.0` (100×1.5 + 4×2=8).
- `test_climber_gets_kom_classif_bonus_with_match_multiplier`: `assert payload["xp_gained"] == 156.0` (150 + 3×2=6).
- `test_classif_outside_top_n_is_ignored`: unchanged (`150.0`).

Add a youth daily test:
```python
async def test_gc_leader_gets_youth_classif_bonus_1_5x():
    """gc_leader matches youth at ×1.5: rank 1 youth base (5+1-1)=5 × 1.5 = 7.5."""
    import scoring

    sb = _base_mocks(
        role="gc_leader",
        classif_rows=[{"classification_type": "youth", "rank": 1}],
    )
    await scoring.calculate_daily_scores(sb, race_slugs=[GIRO_SLUG])

    payload = sb._last_upsert_payload("rider_xp_daily")
    assert payload["xp_gained"] == 157.5  # 100 × 1.5 + 7.5
```

- [ ] **Step 14: Un-skip + fix the 3 V2 tests**

In `test_scoring_gt.py`, delete the `@_P2_CLASSIF_V2` decorator from all three tests and the `_P2_CLASSIF_V2 = pytest.mark.skip(...)` definition (lines 8-11). Update `test_stage_hunter_gets_no_classif_bonus` — its old expectation (150) assumed the retired ×1.5-always stage mult; under A3 a stage_hunter outside the break is ×1.0:

```python
async def test_stage_hunter_gets_no_classif_bonus():
    """V2: stage_hunter matches no classification → 0 bonus; outside the break → ×1.0.

    points rank 2 → no match → 0. Total: 100 × 1.0 + 0 = 100.
    """
    import scoring

    sb = _base_mocks(
        role="stage_hunter",
        classif_rows=[{"classification_type": "points", "rank": 2}],
    )
    await scoring.calculate_daily_scores(sb, race_slugs=[GIRO_SLUG])

    payload = sb._last_upsert_payload("rider_xp_daily")
    assert payload["xp_gained"] == 100.0
```

`test_domestique_gets_no_classif_bonus` (expects 100) and `test_tt_specialist_gets_no_classif_bonus` (expects 100) already match V2 — just remove the decorator.

- [ ] **Step 15: Update the idempotency + classif-only + traceability tests**

- `test_idempotent_rerun_no_team_xp_delta`: gc rank 1 base 10 × 2.0 = 20 → total 170. Change both `165.0` literals to `170.0` and the inline comment to `100 × 1.5 (role) + (10+1-1) × 2.0 (gc rank 1 match) = 150 + 20 = 170`.
- `test_squad_rider_no_stage_points_gets_classif_bonus`: gc rank 3 base 8 × 2.0 = 16. Change `assert classif_only["xp_gained"] == 12.0` → `16.0`, `assert classif_only["gt_classif_bonus"] == 12.0` → `16.0`, and the docstring `12.0` → `16.0`.
- `test_squad_rider_with_stage_points_classif_not_double_counted`: `162.0` → `166.0` (150 + 16); update the docstring and the "not 174" note to "not 182".
- `test_scoring_persists_traceability_columns`: `xp_gained` `162.0` → `166.0`; `gt_classif_bonus` `12.0` → `16.0`; add `assert payload["gt_distance_bonus"] == 0.0`. Update the docstring math.

- [ ] **Step 16: Run the full GT + scoring suites — confirm green**

Run: `cd services/pcs-sync && .venv/bin/python -m pytest tests/test_scoring.py tests/test_scoring_gt.py -v`
Expected: PASS, **0 skipped** in `test_scoring_gt.py` (the 3 V2 tests now run).

- [ ] **Step 17: Commit**

```bash
git add services/pcs-sync/scoring.py services/pcs-sync/tests/test_scoring.py services/pcs-sync/tests/test_scoring_gt.py
git commit -m "feat(scoring): classif V2 ×2 + youth, GC final ×1.0, sprinter profile + stage-hunter breakaway (Spec A A2/A3/A4)"
```

---

## Task 3: Overdrive breakaway gating (A7)

The new stage_hunter is ×1.0 outside the break, so Overdrive (which made any stage_hunter ×2.0) must now require the breakaway too.

**Files:**
- Modify: `services/pcs-sync/tactics.py` (`compute_overdrive_modifier`)
- Modify: `services/pcs-sync/scoring.py` (Overdrive call site ~471-473)
- Test: `services/pcs-sync/tests/test_tactics.py`

- [ ] **Step 1: Update the Overdrive tests**

In `services/pcs-sync/tests/test_tactics.py`, replace the Overdrive section (lines ~31-40):

```python
# --- Overdrive ---

def test_overdrive_promotes_breakaway_stage_hunter_to_2x():
    mult, applied = compute_overdrive_modifier(
        role="stage_hunter", race_slug="race/giro/2026/stage-3", breakaway_kms=120.0
    )
    assert mult == 2.0
    assert applied == "overdrive"

def test_overdrive_no_effect_when_stage_hunter_not_in_break():
    mult, applied = compute_overdrive_modifier(
        role="stage_hunter", race_slug="race/giro/2026/stage-3", breakaway_kms=10.0
    )
    assert mult is None
    assert applied is None

def test_overdrive_does_not_apply_to_domestiques():
    mult, applied = compute_overdrive_modifier(
        role="domestique", race_slug="race/giro/2026/stage-3", breakaway_kms=120.0
    )
    assert mult is None
```

- [ ] **Step 2: Run to confirm failure**

Run: `cd services/pcs-sync && .venv/bin/python -m pytest tests/test_tactics.py -k overdrive -v`
Expected: FAIL — `compute_overdrive_modifier` rejects `breakaway_kms`.

- [ ] **Step 3: Update `compute_overdrive_modifier`**

In `services/pcs-sync/tactics.py`, add the threshold + helper near the top (after the imports) and rewrite the function:

```python
BREAKAWAY_THRESHOLD_KM = 30.0  # Spec A A3 — mirror of scoring.BREAKAWAY_THRESHOLD_KM.


def _in_breakaway(breakaway_kms) -> bool:
    try:
        return breakaway_kms is not None and float(breakaway_kms) >= BREAKAWAY_THRESHOLD_KM
    except (TypeError, ValueError):
        return False


def compute_overdrive_modifier(
    role: str, race_slug: str, breakaway_kms=None
) -> tuple[Optional[float], Optional[str]]:
    """Stage Hunters in the breakaway jump to ×2.0 on stage results (Spec A A7).

    No effect for non-stage-hunters, non-stage results, or riders not in the break.
    """
    if role != "stage_hunter":
        return (None, None)
    if not _is_stage_result(race_slug):
        return (None, None)
    if not _in_breakaway(breakaway_kms):
        return (None, None)
    return (2.0, "overdrive")
```

> DRY note: the threshold is duplicated from `scoring.py` to avoid a circular import (`scoring` imports from `tactics`). Both reference Spec A A3 = 30 km; keep them in sync.

- [ ] **Step 4: Pass `breakaway_kms` at the scoring call site**

In `services/pcs-sync/scoring.py`, the Overdrive branch (lines ~471-473) becomes:

```python
                        elif t_type == "overdrive":
                            override, applied = compute_overdrive_modifier(
                                role, race_slug, breakaway_kms
                            )
                            if override is not None:
                                gt_role_mult = override
                                tactic_applied = applied
```

(`breakaway_kms` is already in scope from Task 2 Step 9.)

- [ ] **Step 5: Run the tactics + scoring suites — confirm green**

Run: `cd services/pcs-sync && .venv/bin/python -m pytest tests/test_tactics.py tests/test_scoring_gt.py -v`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add services/pcs-sync/tactics.py services/pcs-sync/scoring.py services/pcs-sync/tests/test_tactics.py
git commit -m "feat(tactics): Overdrive boosts stage hunter only when in the breakaway (Spec A A7)"
```

---

## Task 4: Import final secondary classifications (Points / KOM / Youth) for completed GTs

PCS gives no points for these jerseys outside a GT, so we store **rank** (scoring applies the scale). A GT is "complete" exactly when the GC page carries non-zero PCS points (the existing `import_gc_results` comment confirms PCS assigns GC points only after the final stage) — so we gate the finals import on that signal.

> **Storage rationale (why a dedicated table, NOT `race_results`).** An earlier draft stored these jersey rows in `race_results` (`stage="points"/"kom"/"youth"`, `pcs_points=0`, `rank`). That pollutes **every** `race_results` consumer: `sponsor_bonus.py:classify_result_type` maps any non-`gc` stage to `"stage"` → a rank-1 jersey row triggers a spurious **stage-win sponsor bonus**; `goal_evaluator.py` fetches `race_results LIKE "{gt}%"` and registers a rank-1 jersey as a **stage win** (spurious "Win a stage" payout); and ~7 `apps/web` files read `race_results` for palmares/feed/ranking. `scoring.py` (main loop) and `_print_contracted_rider_points` are safe (they filter `pcs_points > 0`), but the money-affecting pipelines are not. Spec A line 71 explicitly allowed *"slugs dédiés … **ou table**"* — so we use a dedicated `gt_final_classifications` table that **only the scoring finals pass reads**. Zero blast radius on existing consumers.

**Files:**
- Create: `supabase/migrations/20260602130100_gt_final_classifications.sql` (+ `_rollback/...down.sql`)
- Modify: `services/pcs-sync/sync_race.py` (`import_gc_results` returns `has_points`; new `import_final_classifications` writing to `gt_final_classifications`)
- Modify: `services/pcs-sync/run_pipeline.py` (`_is_gt_race` helper; `_maybe_import_finals`; call after each GC import)
- Test: `services/pcs-sync/tests/test_sync_race.py`

- [ ] **Step 0: Create the `gt_final_classifications` table migration**

Create `supabase/migrations/20260602130100_gt_final_classifications.sql`:

```sql
-- Spec A (A2) — dedicated store for final GT secondary jerseys (Points/KOM/Youth).
-- Kept OUT of race_results so it never pollutes sponsor_bonus / goal_evaluator / UI,
-- which treat any non-gc race_results stage as a stage result. Read only by scoring's
-- final-secondary pass. Rank-only (PCS assigns no points to these jerseys).
CREATE TABLE IF NOT EXISTS public.gt_final_classifications (
  race_slug            text NOT NULL,            -- 'race/giro-d-italia/2026/points' | '/kom' | '/youth'
  classification_type  text NOT NULL CHECK (classification_type IN ('points', 'kom', 'youth')),
  rider_id             uuid NOT NULL REFERENCES public.riders(id) ON DELETE CASCADE,
  rank                 int  NOT NULL,
  race_date            date,
  created_at           timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (race_slug, rider_id)
);

ALTER TABLE public.gt_final_classifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read gt_final_classifications"
  ON public.gt_final_classifications FOR SELECT USING (true);
```

Create `supabase/migrations/_rollback/20260602130100_gt_final_classifications.down.sql`:

```sql
DROP TABLE IF EXISTS public.gt_final_classifications;
```

Local verify (if the Colima stack is up): `supabase db reset` then confirm the table exists. Otherwise leave the DB apply/push to the Task 7 checkpoint (controller-gated, like Task 1's migration). The pytest tests mock Supabase and do not need the table applied. **Do NOT push to prod here.**

- [ ] **Step 1: Write failing tests**

Append to `services/pcs-sync/tests/test_sync_race.py`:

```python
async def test_import_gc_results_reports_has_points():
    """import_gc_results flags whether the GC carries real PCS points (GT complete signal)."""
    import sync_race

    gc_entries = [{"rider_url": PCS_SLUG_MATCH, "rank": 1, "pcs_points": 400}]
    mock_stage_instance = MagicMock()
    mock_stage_instance.gc.return_value = gc_entries
    mock_stage = MagicMock(return_value=mock_stage_instance)
    sb = make_supabase([{"id": RIDER_ID, "pcs_slug": PCS_SLUG_MATCH}], [])

    with _patch_fetch_html(), patch("sync_race.Stage", mock_stage):
        result = await sync_race.import_gc_results(
            sb, page=MagicMock(),
            race_slug="race/giro-d-italia/2026", race_name="Giro", race_date="2026-05-28",
        )
    assert result["has_points"] is True


async def test_import_gc_results_has_points_false_when_zero():
    import sync_race

    gc_entries = [{"rider_url": PCS_SLUG_MATCH, "rank": 1, "pcs_points": 0}]
    mock_stage_instance = MagicMock()
    mock_stage_instance.gc.return_value = gc_entries
    mock_stage = MagicMock(return_value=mock_stage_instance)
    sb = make_supabase([{"id": RIDER_ID, "pcs_slug": PCS_SLUG_MATCH}], [])

    with _patch_fetch_html(), patch("sync_race.Stage", mock_stage):
        result = await sync_race.import_gc_results(
            sb, page=MagicMock(),
            race_slug="race/giro-d-italia/2026", race_name="Giro", race_date="2026-05-15",
        )
    assert result["has_points"] is False


async def test_import_final_classifications_stores_rank_per_jersey():
    """Final Points/KOM/Youth standings are upserted into the dedicated gt_final_classifications
    table (NOT race_results) with the rank + classification_type."""
    import sync_race

    def _stage_factory(url, html=None, update_html=False):
        inst = MagicMock()
        inst.points.return_value = [{"rider_url": PCS_SLUG_MATCH, "rank": 1}]
        inst.kom.return_value = [{"rider_url": PCS_SLUG_MATCH, "rank": 2}]
        inst.youth.return_value = [{"rider_url": PCS_SLUG_MATCH, "rank": 3}]
        return inst

    sb = make_supabase(
        [{"id": RIDER_ID, "pcs_slug": PCS_SLUG_MATCH}],  # riders lookup
    )

    with _patch_fetch_html(), patch("sync_race.Stage", side_effect=_stage_factory):
        counts = await sync_race.import_final_classifications(
            sb, page=MagicMock(),
            race_slug="race/giro-d-italia/2026", race_name="Giro", race_date="2026-05-28",
        )

    assert counts == {"points": 1, "kom": 1, "youth": 1}
    # MUST land in gt_final_classifications, NOT race_results (no pollution of other consumers).
    assert "race_results" not in sb.upserts
    rows = sb.upserts["gt_final_classifications"]
    by_slug = {r["race_slug"]: r for r in rows}
    assert by_slug["race/giro-d-italia/2026/points"]["rank"] == 1
    assert by_slug["race/giro-d-italia/2026/points"]["classification_type"] == "points"
    assert by_slug["race/giro-d-italia/2026/kom"]["rank"] == 2
    assert by_slug["race/giro-d-italia/2026/youth"]["rank"] == 3


async def test_import_final_classifications_continues_on_jersey_failure():
    """A fetch failure on one jersey must not abort the others (per-jersey resilience)."""
    import sync_race

    def _stage_factory(url, html=None, update_html=False):
        if "/kom" in url:
            raise RuntimeError("network error")
        inst = MagicMock()
        inst.points.return_value = [{"rider_url": PCS_SLUG_MATCH, "rank": 1}]
        inst.youth.return_value = [{"rider_url": PCS_SLUG_MATCH, "rank": 3}]
        return inst

    sb = make_supabase([{"id": RIDER_ID, "pcs_slug": PCS_SLUG_MATCH}])

    with _patch_fetch_html(), patch("sync_race.Stage", side_effect=_stage_factory):
        counts = await sync_race.import_final_classifications(
            sb, page=MagicMock(),
            race_slug="race/giro-d-italia/2026", race_name="Giro", race_date="2026-05-28",
        )

    assert counts == {"points": 1, "kom": 0, "youth": 1}
```

> The test file already defines `PCS_SLUG_MATCH`, `RIDER_ID`, `_patch_fetch_html`, `make_supabase` (used by the P1 capture tests). Reuse them; do not redefine.

- [ ] **Step 2: Run to confirm failure**

Run: `cd services/pcs-sync && .venv/bin/python -m pytest tests/test_sync_race.py -k "has_points or final_classifications" -v`
Expected: FAIL — `has_points` missing from the return dict; `import_final_classifications` undefined.

- [ ] **Step 3: Make `import_gc_results` report `has_points`**

In `services/pcs-sync/sync_race.py`, inside `import_gc_results`, track points and add the flag. Initialize `has_points = False` next to `imported = 0` (line ~221). In the per-entry block, replace the points read so it feeds both the row and the flag:

```python
            rider_id = rider_map[rider_url]
            pts = int(entry.get("pcs_points") or 0)
            if pts > 0:
                has_points = True

            row = {
                "rider_id": rider_id,
                "race_slug": gc_url,
                "race_name": f"{race_name} - GC",
                "stage": "gc",
                "race_date": race_date or None,
                "pcs_points": pts,
                "rank": entry.get("rank"),
                "is_itt": False,
            }
```

Add `"has_points": has_points,` to **both** return dicts (the early `if not gc_entries:` return at line ~213 sets `"has_points": False`; the final return at line ~257 sets `"has_points": has_points`).

- [ ] **Step 4: Add `import_final_classifications`**

In `services/pcs-sync/sync_race.py`, add after `import_gc_results` (after line ~263):

```python
FINAL_SECONDARY_TYPES = ("points", "kom", "youth")


async def import_final_classifications(
    supabase: Client,
    page,
    *,
    race_slug: str,
    race_name: str,
    race_date: str,
) -> Dict[str, int]:
    """Import final Points/KOM/Youth standings for a completed GT (Spec A A2).

    These jerseys carry no PCS points, so we store the rank into the DEDICATED table
    gt_final_classifications (NOT race_results — see the storage rationale at the top of
    Task 4) keyed by race_slug {race_slug}/points|/kom|/youth; scoring's finals pass applies
    the 2-value rank scale. GT-only — the caller gates on GT completion (GC has points).
    """
    counts = {"points": 0, "kom": 0, "youth": 0}

    riders_resp = supabase.table("riders").select("id, pcs_slug").execute()
    rider_map: Dict[str, str] = {
        r["pcs_slug"]: r["id"] for r in (riders_resp.data or [])
    }

    for ctype in FINAL_SECONDARY_TYPES:
        url = f"{race_slug}/{ctype}"
        try:
            html = await fetch_html(page, url)
            stage = Stage(url, html=html, update_html=False)
            # Stage.points()/kom()/youth() parse the standings table on the dedicated page.
            entries = getattr(stage, ctype)() or []
        except Exception as exc:
            logger.warning("Failed to fetch final %s for %s: %s", ctype, url, exc)
            continue

        for entry in entries:
            rider_url = entry.get("rider_url", "")
            rank = entry.get("rank")
            rid = rider_map.get(rider_url)
            if not rid or rank is None:
                continue
            try:
                supabase.table("gt_final_classifications").upsert(
                    {
                        "race_slug": url,
                        "classification_type": ctype,
                        "rider_id": rid,
                        "rank": int(rank),
                        "race_date": race_date or None,
                    },
                    on_conflict="race_slug,rider_id",
                ).execute()
                counts[ctype] += 1
            except Exception as exc:
                logger.error("Failed final %s upsert (%s): %s", ctype, rid, exc)

    return counts
```

> ⚠️ **Verify against the live lib during the local scraping run:** confirm `Stage("race/<gt>/2026/points").points()` (and `.kom()`, `.youth()`) returns the *final* standings with `rider_url` + `rank` on the dedicated jersey page. If a method name differs, adjust the `getattr` mapping. The unit test mocks `Stage`, so this is the only spot needing live confirmation.

- [ ] **Step 5: Wire the finals import into the pipeline**

In `services/pcs-sync/run_pipeline.py`, add a GT-race predicate next to `_is_gt_stage` (after line ~65):

```python
def _is_gt_race(slug: str) -> bool:
    """True when the slug is a Grand Tour race (with or without a /stage-N or /gc suffix)."""
    return slug.startswith(GT_SLUG_PREFIXES)
```

Add a reusable helper after `_fetch_gt_classifications` (after line ~87):

```python
async def _maybe_import_finals(supabase, browser, parent_slug, race_name, race_date, gc_result, imported_slugs):
    """After a GT's GC import, import the final Points/KOM/Youth jerseys once the GT is complete.

    Completion signal: GC carries PCS points (assigned only after the final stage). GT-only.
    Appends the three final slugs to imported_slugs so scoring picks them up.
    """
    if not (_is_gt_race(parent_slug) and gc_result.get("has_points")):
        return
    from sync_race import import_final_classifications

    print("  Waiting 15s before final classifications...")
    await asyncio.sleep(15)
    ctx_f = await browser.new_context(user_agent=USER_AGENT)
    f_page = await ctx_f.new_page()
    try:
        fc = await import_final_classifications(
            supabase, f_page,
            race_slug=parent_slug, race_name=race_name, race_date=race_date,
        )
        print(f"    Final classifs: points={fc['points']} kom={fc['kom']} youth={fc['youth']}")
        for ct in ("points", "kom", "youth"):
            imported_slugs.append(f"{parent_slug}/{ct}")
    except Exception as exc:
        print(f"    Final classif import failed: {exc}")
    finally:
        await ctx_f.close()
```

Then call it right after each of the three GC imports in `_import_single_race`:
- Direct `/gc` branch — after line ~333 (`imported_slugs.append(f"{parent_slug}/gc")`), before `await ctx_gc.close()`, add:
  ```python
            await _maybe_import_finals(supabase, browser, parent_slug, race_name, race_date, gc_result, imported_slugs)
  ```
- Direct `/stage-N` branch — after line ~382 (`imported_slugs.append(f"{parent_slug}/gc")`), add the same call (parent var is `parent_slug`).
- Stage-race loop branch — after line ~479 (`imported_slugs.append(f"{race_slug}/gc")`), add (here the parent var is `race_slug`):
  ```python
            await _maybe_import_finals(supabase, browser, race_slug, race_name, race_date, gc_result, imported_slugs)
  ```

- [ ] **Step 6: Run the sync_race suite — confirm green**

Run: `cd services/pcs-sync && .venv/bin/python -m pytest tests/test_sync_race.py -v`
Expected: PASS (new tests + existing GC/capture/daily-classif tests).

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260602130100_gt_final_classifications.sql supabase/migrations/_rollback/20260602130100_gt_final_classifications.down.sql services/pcs-sync/sync_race.py services/pcs-sync/run_pipeline.py services/pcs-sync/tests/test_sync_race.py
git commit -m "feat(sync): import final Points/KOM/Youth jerseys into gt_final_classifications (Spec A A2)"
```

---

## Task 5: Score final secondary jerseys (rank → 2-value scale × role mult)

A dedicated, gated scoring pass — additive and mock-safe (no effect on stage-slug tests).

**Files:**
- Modify: `services/pcs-sync/scoring.py` (constants + `_final_secondary_bonus`; prefetch + per-team pass in `calculate_daily_scores`)
- Test: `services/pcs-sync/tests/test_scoring.py` (unit), `services/pcs-sync/tests/test_scoring_gt.py` (integration)

- [ ] **Step 1: Unit-test the scale helper (failing)**

Append to `services/pcs-sync/tests/test_scoring.py`:

```python
def test_final_secondary_bonus_gt_scale_and_role_match():
    """GT scale 80/20/10 by rank; matched role doubles (×1.5 youth); else ×1.0 (Spec A A2)."""
    from scoring import _final_secondary_bonus
    # points, sprinter matches → ×2
    assert _final_secondary_bonus("points", 1, "sprinter") == 160.0
    assert _final_secondary_bonus("points", 2, "sprinter") == 40.0
    assert _final_secondary_bonus("points", 3, "sprinter") == 20.0
    # kom, climber matches → ×2
    assert _final_secondary_bonus("kom", 1, "climber") == 160.0
    # youth, gc_leader matches → ×1.5
    assert _final_secondary_bonus("youth", 1, "gc_leader") == 120.0
    # non-matched squad rider → base × 1.0 (still rewarded; Spec A A2 line "×1.0 partout")
    assert _final_secondary_bonus("points", 1, "domestique") == 80.0
    assert _final_secondary_bonus("kom", 2, "gc_leader") == 20.0
    # beyond rank 3 → 0
    assert _final_secondary_bonus("points", 4, "sprinter") == 0.0


def test_final_secondary_bonus_one_week_scale():
    """1-week scale 40/10/5 (coded for P3; not yet wired into the pipeline)."""
    from scoring import _final_secondary_bonus
    assert _final_secondary_bonus("points", 1, "sprinter", mode="one_week") == 80.0  # 40 × 2
    assert _final_secondary_bonus("kom", 2, "domestique", mode="one_week") == 10.0   # 10 × 1
```

- [ ] **Step 2: Run to confirm failure**

Run: `cd services/pcs-sync && .venv/bin/python -m pytest tests/test_scoring.py -k final_secondary -v`
Expected: FAIL — `_final_secondary_bonus` undefined.

- [ ] **Step 3: Add finals constants + helper to `scoring.py`**

After `CLASSIF_ROLE_MATCH` (added in Task 2), add:

```python
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
```

- [ ] **Step 4: Prefetch the final-secondary rows (gated)**

In `calculate_daily_scores`, immediately after the Step 3c classif prefetch (after line ~365), add:

```python
    # --- Step 3d: Final secondary classifications (Points/KOM/Youth) for completed GTs.
    # Read from the DEDICATED gt_final_classifications table (kept out of race_results so it
    # never pollutes sponsor_bonus / goal_evaluator / UI — see Task 4 storage rationale).
    # Gated: empty for ordinary stage-slug runs → no .table() call (mock-safe).
    final_secondary_slugs = [
        s for s in (race_slugs or [])
        if _is_gt_slug(s) and s.rsplit("/", 1)[-1] in ("points", "kom", "youth")
    ]
    final_by_rider: dict[str, list[dict]] = {}
    if final_secondary_slugs:
        fr_resp = supabase.table("gt_final_classifications").select(
            "rider_id, race_slug, classification_type, rank, race_date"
        ).in_("race_slug", final_secondary_slugs).execute()
        for row in (fr_resp.data or []):
            final_by_rider.setdefault(row["rider_id"], []).append(row)
```

- [ ] **Step 5: Add the per-team finals scoring pass (gated)**

Inside the per-team loop, immediately after the classif-only second pass and **before** `if total_xp == 0: continue` (after line ~594), add:

```python
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
                    f_bonus = _final_secondary_bonus(f_ctype, fr.get("rank"), f_role, mode="gt")
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
```

- [ ] **Step 6: Integration test the finals pass**

Append to `services/pcs-sync/tests/test_scoring_gt.py`:

```python
async def test_final_points_jersey_scored_for_sprinter():
    """Sprinter wins the final Points jersey of a GT: 80 (rank 1, GT scale) × 2 = 160 XP.

    The finals row carries 0 PCS points (invisible to the main query); a second rider
    scores a stage point so calculate_daily_scores does not early-return on empty results.
    """
    import scoring

    points_slug = "race/giro-d-italia/2026/points"
    sb = make_supabase(
        # 1. race_results (pcs_points>0 query): only RIDER_ID_2 scores a stage point.
        [{"rider_id": RIDER_ID_2, "race_slug": "race/giro-d-italia/2026/stage-21",
          "pcs_points": 10, "race_date": "2026-05-31", "is_itt": False,
          "breakaway_kms": None, "profile_icon": "p1"}],
        # 2. prev rider_xp_daily
        [],
        # 3. contracts
        [
            {"id": CONTRACT_ID, "team_id": TEAM_ID, "rider_id": RIDER_ID,
             "purchased_at": "2026-01-01T00:00:00Z", "release_date": None, "released_at": None,
             "riders": {"specialty": "Sprint", "nationality": "BE", "real_team": "x", "birthdate": "1998-01-01"}},
            {"id": CONTRACT_ID_2, "team_id": TEAM_ID, "rider_id": RIDER_ID_2,
             "purchased_at": "2026-01-01T00:00:00Z", "release_date": None, "released_at": None,
             "riders": {"specialty": "Sprint", "nationality": "BE", "real_team": "x", "birthdate": "1998-01-01"}},
        ],
        # 4. team_strategies
        [],
        # 5. gt_squad: both riders in squad
        [
            {"team_id": TEAM_ID, "rider_id": RIDER_ID, "created_at": BEFORE_CUTOFF, "removed_at": None},
            {"team_id": TEAM_ID, "rider_id": RIDER_ID_2, "created_at": BEFORE_CUTOFF, "removed_at": None},
        ],
        # 6. gt_role_assignments: RIDER_ID = sprinter
        [
            {"team_id": TEAM_ID, "rider_id": RIDER_ID, "role": "sprinter", "applied_at": "2026-05-10T09:00:00+02:00"},
            {"team_id": TEAM_ID, "rider_id": RIDER_ID_2, "role": "domestique", "applied_at": "2026-05-10T09:00:00+02:00"},
        ],
        # 7. gt_daily_classifications
        [],
        # 8. final-secondary prefetch (gt_final_classifications in_ final slugs): RIDER_ID rank 1 points
        [{"rider_id": RIDER_ID, "race_slug": points_slug, "classification_type": "points",
          "rank": 1, "race_date": "2026-05-31"}],
        # 9. gt_tactic_activations
        [],
        # remaining: upserts + team select/update + snapshot (queue exhaustion → empty chains)
        {"id": TEAM_ID, "cumulative_xp": 0.0, "level": 1, "league_id": LEAGUE_ID},
        [],
        [{"id": TEAM_ID, "cumulative_xp": 170.0}],
    )
    await scoring.calculate_daily_scores(
        sb, race_slugs=["race/giro-d-italia/2026/stage-21", points_slug]
    )

    payloads = sb.upserts.get("rider_xp_daily", [])
    points_row = next(p for p in payloads if p["race_slug"] == points_slug)
    assert points_row["xp_gained"] == 160.0
    assert points_row["gt_classif_bonus"] == 160.0
    assert points_row["raw_pcs_points"] == 0
```

> Mock-ordering note: the final-secondary prefetch (`if final_secondary_slugs:`) fires here because `race_slugs` includes `.../points`, so its response sits at position 8 (after `gt_daily_classifications`, before `gt_tactic_activations`). Verify this ordering against the `.table()` call sequence in the implemented `calculate_daily_scores` when writing the test; adjust the response list position if the prefetch is placed differently. The Nemesis `resolve_nemesis_for_stage` calls are `.rpc(...)`, not `.table(...)`, so they do not consume the queue.

- [ ] **Step 7: Run the scoring suites — confirm green**

Run: `cd services/pcs-sync && .venv/bin/python -m pytest tests/test_scoring.py tests/test_scoring_gt.py -v`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add services/pcs-sync/scoring.py services/pcs-sync/tests/test_scoring.py services/pcs-sync/tests/test_scoring_gt.py
git commit -m "feat(scoring): score final Points/KOM/Youth jerseys via 2-value scale (Spec A A2)"
```

---

## Task 6: Update living docs (GAME_RULES + ARCHITECTURE) + archive the spec

**Files:**
- Modify: `docs/GAME_RULES.md` (§7 scoring, §11 constants, §13 Overdrive)
- Modify: `docs/ARCHITECTURE.md`
- Move: spec → `docs/archive/specs/` only after P3 lands (Spec A spans P1/P2/P3 — keep in place until P3). **Do not move yet.**

- [ ] **Step 1: GAME_RULES §7 — replace the over-simplified Daily XP block**

In `docs/GAME_RULES.md` §7 "Daily XP" (lines ~173-178), replace with a GT-aware description:

```markdown
### Daily XP

Outside Grand Tours:
```
Rider XP = daily_PCS_points × (1 + sum of active strategy bonuses)
```

Grand Tour stages (squad riders only — non-squad contracted riders score 0):
```
Rider XP = (PCS_points × role_mult × (1 + strategy_bonus)
            + classif_bonus + breakaway_bonus) × nemesis_modifier
```
- **role_mult** (Spec A): gc_leader / climber ×1.5; tt_specialist ×2.0 on ITT only;
  sprinter ×1.5 only on flat/hilly stages (profile p1/p2/p3); stage_hunter ×1.5 only
  in the breakaway (≥30 km); domestique ×1.0. **GC final → ×1.0 for all roles.**
- **classif_bonus** (daily gc/points/kom/youth): role-matched only — gc_leader→GC ×2
  (and Youth ×1.5), sprinter→Points ×2, climber→KOM ×2; all other roles 0.
- **breakaway_bonus**: stage_hunter only, +1 XP per 10 km in the break (no cap), additive.
- **Final jerseys**: GC final = raw PCS points ×1.0. Points/KOM/Youth finals = rank scale
  80/20/10 (GT) · 40/10/5 (1-week) × role mult (Points→sprinter ×2, KOM→climber ×2,
  Youth→gc_leader ×1.5; ×1.0 otherwise).
```

- [ ] **Step 2: GAME_RULES §11 — record the new scoring constants**

In §11 "Game Constants", add a Scoring sub-block (place near the level table):

```markdown
- **GT scoring multipliers** (Spec A, 2026-06-02): daily classif matched ×2 (youth ×1.5);
  GC final ×1.0; sprinter gated to profile p1/p2/p3; stage_hunter breakaway threshold 30 km,
  distance bonus +1 XP / 10 km (no cap); final secondary jersey scale 80/20/10 (GT) · 40/10/5 (1-week).
```

- [ ] **Step 3: GAME_RULES §13 — Overdrive now requires the breakaway**

In the Tactics table (line ~370), change the Overdrive row effect text:

```markdown
| **Overdrive** | ×2.0 XP for stage hunters **in the breakaway** | 1 specific rider | 1 per GT |
```

- [ ] **Step 4: ARCHITECTURE.md — new function, column, scoring pass**

Add one-line notes:
- `sync_race.py`: new `import_final_classifications(race_slug, race_name, race_date)` — imports final Points/KOM/Youth jerseys (rank-only) for completed GTs into `gt_final_classifications`; `import_gc_results` now returns `has_points`.
- `run_pipeline.py`: `_maybe_import_finals` runs after GC import for completed GTs.
- `scoring.py`: `_role_multiplier` takes `breakaway_kms`/`profile_icon`; new `_breakaway_distance_bonus`, `_final_secondary_bonus`; third scoring pass reads `gt_final_classifications`.
- New table `gt_final_classifications` (race_slug, classification_type, rider_id, rank) — dedicated store for final secondary jerseys, read only by scoring (kept out of `race_results` to avoid polluting sponsor_bonus/goal_evaluator/UI).
- `rider_xp_daily`: new column `gt_distance_bonus NUMERIC(5,1)`.
- Migrations `20260602130000_rider_xp_daily_distance_bonus.sql`, `20260602130100_gt_final_classifications.sql`.

- [ ] **Step 5: Commit**

```bash
git add docs/GAME_RULES.md docs/ARCHITECTURE.md
git commit -m "docs: record Spec A P2 scoring refonte (GAME_RULES + ARCHITECTURE)"
```

---

## Task 7: Full-suite verification

- [ ] **Step 1: Python suite**

Run: `cd services/pcs-sync && .venv/bin/python -m pytest -q`
Expected: all pass, **0 skipped** (baseline was 164 passed / 3 skipped; the 3 V2 tests now run, plus the new tests). No failures.

- [ ] **Step 2: Web type-drift / build sanity (only the changed file)**

Run: `cd apps/web && pnpm typecheck`
Expected: PASS. No TS code references `gt_distance_bonus` or `gt_final_classifications` (both are Python-written / scoring-read only), so typecheck is green even before the types are regenerated. Type regen happens post-prod-push (Step 4).

- [ ] **Step 3: Clean migration replay**

Run: `supabase db reset`
Expected: all migrations apply cleanly, including `20260602130000` (gt_distance_bonus) and `20260602130100` (gt_final_classifications). Confirms a from-scratch rebuild stays consistent (Rule #2).

- [ ] **Step 4: Confirm prod state (if the two migrations were pushed)**

The two P2 migrations (`20260602130000`, `20260602130100`) are additive and controller-gated. If the user authorised `supabase db push --linked`:
- `rider_xp_daily.gt_distance_bonus` exists on remote (default 0).
- `gt_final_classifications` table exists on remote.
- No data was recomputed (forward-only).
Then regenerate `apps/web/lib/database.types.ts` (`gen types --linked`) — it now reflects both the new column and the new table. Confirm `pnpm typecheck` still passes.

- [ ] **Step 5: Live scraping smoke (user-run, local only)**

When the user next runs `post-race` on a completed GT stage (or `--race "race/<gt>/2026/gc"`), confirm in the logs:
- `Final classifs: points=N kom=N youth=N` appears (finals imported).
- Scoring credits the expected final-jersey XP for matched roles.
This is the only step that exercises the real `procyclingstats` lib (`Stage.points()/kom()/youth()` on the dedicated jersey pages) — verify the method assumption from Task 4 Step 4 here.

---

## Self-Review

**1. Spec coverage (A2/A3/A4/A7-Overdrive):**
- A2 daily classif ×2 + V2 role-matched-only → Task 2 (`_classif_bonus`, `CLASSIF_ROLE_MATCH`); 3 V2 tests un-skipped.
- A2 daily youth (gc_leader ×1.5) → Task 2 (`CLASSIF_TOP["youth"]=5`, `gc_leader: {youth: 1.5}`); youth daily already scraped in P1.
- A2 GC final ×1.0 → Task 2 (`_role_multiplier` `/gc` early return).
- A2 final Points/KOM/Youth scale 80/20/10 × role mult → Tasks 4 (import into dedicated `gt_final_classifications`) + 5 (`_final_secondary_bonus`, scoring pass reading that table). Stored in a dedicated table, NOT `race_results`, to avoid spurious sponsor/goal payouts from rank-1 jersey rows (Spec A line 71 sanctioned "slugs … ou table").
- A3 stage_hunter breakaway gating + distance bonus (30 km, +1/10 km, no cap) → Task 2 (`_in_breakaway`, `_breakaway_distance_bonus`, `gt_distance_bonus` column in Task 1).
- A4 sprinter profile gating p1/p2/p3 → Task 2 (`_role_multiplier` sprinter branch, `SPRINT_PROFILES`).
- A7 Overdrive breakaway gating → Task 3.
- **Deferred (confirmed):** A7 Nemesis activation-gating + A9 1-week squads → P3; A8 doc-front → P3. `FINAL_SECONDARY_SCALE["one_week"]` coded but not wired.

**2. Placeholder scan:** every code/SQL/test step has complete content; commands have expected output. The one live-lib assumption (`Stage.points()/kom()/youth()` on jersey pages) is explicitly flagged for local verification (Tasks 4 & 7), with the mock-based unit tests independent of it.

**3. Type consistency:** `_role_multiplier(role, race_slug, is_itt, breakaway_kms=None, profile_icon=None)` — same signature at the call site (Task 2 Step 9) and Overdrive shares `breakaway_kms` (Task 3). `gt_distance_bonus` is NUMERIC(5,1) (migration), float in Python (`_breakaway_distance_bonus`), persisted in all three upsert payloads (main, classif-only, finals), asserted in tests. `gt_classif_bonus` NUMERIC(4,1) holds the finals value (max 160.0 < 999.9). `CLASSIF_ROLE_MATCH` (dict-of-dicts) is read only by `_classif_bonus`; `FINAL_ROLE_MATCH` (tuple values) only by `_final_secondary_bonus` — no cross-use. `_is_gt_race`/`_is_gt_stage` in run_pipeline.py vs `_is_gt_slug` in scoring.py are distinct, file-local.

**4. Mock-ordering safety:** the two new `calculate_daily_scores` queries/passes are gated (`if final_secondary_slugs:`, `if final_by_rider:`) → no `.table()` call for stage-slug tests → existing `_base_mocks` ordering preserved. Adding columns to `.select()` strings is mock-transparent. The new finals integration test (Task 5 Step 6) documents its own response ordering and the executor verifies it against the implemented call sequence.
