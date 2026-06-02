# Spec A — P3b: Race Team 1-week (A9 data + scoring) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generalize the GT squad + tactics machinery (currently hard-keyed on `phase_id ∈ {4,6,8}`) so it accepts any stage-race `race_slug`. After this plan, **1-week stage races (Paris-Nice, Dauphiné, Suisse, Pologne, …) are first-class citizens** for squad composition, role assignments, tactic activations, and scoring — with the activated `FINAL_SECONDARY_SCALE["one_week"] = [40, 10, 5]`. The 3 GTs (Giro/Tour/Vuelta) continue to work unchanged (legacy `phase_id` path preserved).

**Architecture:** A nullable `race_slug TEXT` column is added to `gt_squad`, `gt_role_assignments`, and `gt_tactic_activations`. Legacy rows stay phase-keyed; new rows (1-week + going forward for GTs) are race_slug-keyed. The tactic per-race usage limits move from a hard-coded `CASE` inside the trigger to a seeded reference table `tactic_usage_limits(race_kind, tactic_type, max_per_race)` looked up at INSERT-time (race_kind = `'gt'` when the slug matches a GT prefix, `'one_week'` otherwise). The scoring pipeline replaces the GT-only `_is_gt_slug()` gate with a broader `_is_squad_race()` predicate that returns True for both GT slugs **and** 1-week stage-race slugs sourced from `wt_calendar_2026.json`. `import_final_classifications` is unlocked for 1-week races whose GC carries PCS points. Forward-only — Giro 2026 (already complete) is not rescored; backfill only adds `race_slug` to existing Tour/Vuelta rows via deterministic mapping (`phase_id=6 → 'race/tour-de-france/<year>'`, `phase_id=8 → 'race/vuelta-a-espana/<year>'`).

**Tech Stack:** Postgres migration (Supabase remote `uuvshpykvpnhpeondqjt`), Python 3.12 + `procyclingstats` lib (`services/pcs-sync`), pytest + pytest-asyncio.

**Source spec:** `docs/superpowers/specs/2026-06-01-spec-a-levels-and-roles-design.md` — focus A9 (Race Team 1-week) + A9 sub-decisions (8 slots / 6 roles, 11:00 CET cutoff, free swaps, per-race tactic limits 1/1/2/1/1 for one-week vs 2/2/3/1/1 for GT, "Race Team" tab rename, scoring gates squad for non-GT stage races, FINAL_SECONDARY_SCALE one_week 40/10/5 activated).

**Source plan (precursor, assumed merged):** `docs/superpowers/plans/2026-06-02-spec-a-p3a-nemesis-profile-gating.md` — P3a delivers `stage_profiles` + `place_tactic` v2 (Nemesis profile gating). This plan (P3b) **builds on top of P3a** — Task 5 below writes `place_tactic` v3 that preserves all of P3a's Nemesis profile-gating block verbatim and merely relaxes the GT-phase precondition.

**Project rules:**
- Rule #2 — schema changes only via migration; never mutate the DB by hand.
- App text English; RPC error messages too.
- `supabase db push --linked` (prod) requires **explicit user confirmation** per CLAUDE.md — Tasks 2, 3, 4, 5, 6 each include a confirmation step (or are bundled into a single confirmed push at end of Task 6, agent's call).
- Python invocations always via the worktree venv symlink: `services/pcs-sync/.venv/bin/python`.

**Lessons applied from P3a (2026-06-02):**
- `supabase gen types typescript --linked` **pollutes the redirected file with stderr noise** ("Initialising login role...", version-update warning). All gen-types steps below use `2>/dev/null >` to suppress stderr before redirecting stdout — copy verbatim, do not "fix" by removing the redirect.
- The user's standing preference (confirmed during P3a) is to **skip local `supabase db reset` for low-risk additive / `CREATE OR REPLACE` migrations** and push direct to prod after the explicit confirmation step. Each migration task below offers this shortcut; only fall back to the local-apply path if the migration is destructive or the rollback is uncertain.
- Worktree authentication: the supabase CLI reads `supabase/.temp/` for the linked project. If absent, copy from the main repo: `cp -R /Users/jonathanschummers/Documents/WattHunter/supabase/.temp supabase/.temp`.

---

## Scope (locked with user 2026-06-02)

**In P3b:**
- Schema: nullable `race_slug TEXT` on `gt_squad`, `gt_role_assignments`, `gt_tactic_activations`. New partial unique indexes on `race_slug` (mirror of the existing `phase_id` partial indexes). Backfill `race_slug` deterministically for Tour 2026 (`phase_id=6 → race/tour-de-france/2026`) and Vuelta 2026 (`phase_id=8 → race/vuelta-a-espana/2026`). Giro skipped (already complete; forward-only).
- New table `tactic_usage_limits(race_kind TEXT, tactic_type TEXT, max_per_race INT)` with rows for both kinds. `enforce_tactic_usage_limit` rewritten to look up the limit based on inferred race_kind from `NEW.race_slug` (or fallback to `phase_id`-derived GT kind when race_slug is NULL).
- `place_tactic` v3: accepts `p_race_slug TEXT` (preferred) AND legacy `p_phase_id` (kept for the front not yet migrated). Derives `phase_id` from race_slug if matching a GT prefix; nullable otherwise. Preserves the P3a Nemesis profile-gating block verbatim. Drops the hard `phase_id IN (4,6,8)` check — replaced by a slug regex `^race/[^/]+/\d{4}/stage-\d+$` validation (or a GT prefix + stage match for legacy callers).
- `gt_add_to_squad`, `gt_remove_from_squad`, `gt_swap_slot`, `gt_assign_role` v2: accept `p_race_slug TEXT` (preferred) **or** legacy `p_phase_id`. Validate against race_slug (or phase_id) consistently, drop the hard `phase_id IN (4,6,8)` check.
- `scoring.py`: replace `_is_gt_slug()` consumption with `_is_squad_race()`. Squad-gate + classif + final-secondary passes now apply to 1-week stage-race slugs too. `_role_multiplier` is unchanged (`/gc` slug branch already handles 1-week GC). Activate `FINAL_SECONDARY_SCALE["one_week"]` in the third-pass loop (mode='one_week' when slug is non-GT).
- `run_pipeline.py`: add `_is_squad_race(slug)` helper. Generalize `_maybe_import_finals` to also fire for 1-week stage-races whose GC carries PCS points. Keep `_is_gt_race` as a thin wrapper for clarity.
- Tests: extend `tests/test_scoring_gt.py` with 1-week squad gating + 1-week finals-secondary scenarios; extend `tests/test_sync_race.py` to cover `import_final_classifications` on a 1-week slug; extend `tests/test_tactics.py` if the limit-table lookup needs new coverage.
- Regenerate `apps/web/lib/database.types.ts`.
- Docs: `docs/GAME_RULES.md` §13 (tactic usage limits per race_kind table) + `docs/ARCHITECTURE.md` (column additions + RPC v2/v3 + new table).

**Not in P3b (deferred to P3c — UI):**
- Front: tab rename "GT" → "Race Team", race selector dropdown, per-race tactic budget chip, history of squads across races.
- Any new server actions in `apps/web/app/(game)/.../`. P3b only touches RPCs + scoring; the front is unaware.
- Telemetry / analytics for tactic-per-race usage.

**Forward-only:**
- Giro 2026 (already complete) is **not** rescored. Existing `gt_squad`/`gt_role_assignments`/`gt_tactic_activations` rows for `phase_id=4` keep `race_slug = NULL`; reads that fall back to `phase_id` continue to work.
- Tour de France + Vuelta a España (still upcoming) get a deterministic backfill: each existing row's `race_slug` is set to `'race/<gt-slug>/<year>'` (without `/stage-N` — the squad scope is the whole GT). This lets the new race_slug-keyed unique indexes apply without conflict.
- 1-week stage-races (`type="stage-race"` in `wt_calendar_2026.json`, non-GT prefix) become eligible going forward only. No historical Paris-Nice / UAE Tour / etc. is recomputed.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `supabase/migrations/20260604000000_squad_race_slug_column.sql` | add `race_slug TEXT` to `gt_squad`, `gt_role_assignments`, `gt_tactic_activations`; partial unique indexes; Tour+Vuelta backfill | Create |
| `supabase/migrations/_rollback/20260604000000_squad_race_slug_column.down.sql` | drop the new indexes + columns | Create |
| `supabase/migrations/20260604000100_tactic_usage_limits.sql` | new `tactic_usage_limits` table + seed both kinds + rewrite `enforce_tactic_usage_limit` trigger | Create |
| `supabase/migrations/_rollback/20260604000100_tactic_usage_limits.down.sql` | restore the pre-P3b inline-CASE trigger; drop the table | Create |
| `supabase/migrations/20260604000200_place_tactic_v3_race_slug.sql` | `place_tactic` v3 accepts `race_slug`, preserves P3a Nemesis profile gating, drops hard phase_id IN (4,6,8) check | Create |
| `supabase/migrations/_rollback/20260604000200_place_tactic_v3_race_slug.down.sql` | restore the P3a v2 body (paste of `20260603000100`) | Create |
| `supabase/migrations/20260604000300_gt_squad_rpcs_v2_race_slug.sql` | `gt_add_to_squad` / `gt_remove_from_squad` / `gt_swap_slot` / `gt_assign_role` v2 — accept `p_race_slug` or legacy `p_phase_id` | Create |
| `supabase/migrations/_rollback/20260604000300_gt_squad_rpcs_v2_race_slug.down.sql` | restore the v1 RPCs (paste of `20260510000000`) | Create |
| `services/pcs-sync/scoring.py` | replace `_is_gt_slug()` callers with `_is_squad_race()` (new helper); activate `FINAL_SECONDARY_SCALE["one_week"]` for non-GT slugs | Modify |
| `services/pcs-sync/run_pipeline.py` | add `_is_squad_race()`; generalize `_maybe_import_finals` to non-GT stage-races whose GC has PCS points | Modify |
| `services/pcs-sync/tests/test_scoring_gt.py` | new test class for 1-week squad gating + 1-week finals-secondary | Modify |
| `services/pcs-sync/tests/test_sync_race.py` | one new test: `import_final_classifications` works on a 1-week race | Modify |
| `services/pcs-sync/tests/test_tactics.py` | new test: per-race limit lookup honors `race_kind='one_week'` | Modify |
| `apps/web/lib/database.types.ts` | regenerated (3 altered tables + 1 new table) | Regenerate |
| `docs/GAME_RULES.md` | §13 — per-race tactic limit table (GT vs 1-week); §11 — `FINAL_SECONDARY_SCALE` one_week values | Modify |
| `docs/ARCHITECTURE.md` | new column on 3 tables; new `tactic_usage_limits` table; place_tactic v3 + GT-squad RPCs v2 | Modify |

---

## Task 0: Worktree Python environment

This worktree was created off the P3a branch. P3a is assumed to have been merged (or is at least available in the branch history). If running fresh:

- [ ] **Step 1: Symlink the venv** (skip if `.venv` already exists)

Run: `ln -s /Users/jonathanschummers/Documents/WattHunter/services/pcs-sync/.venv services/pcs-sync/.venv`

- [ ] **Step 2: Confirm baseline**

Run: `cd services/pcs-sync && .venv/bin/python -m pytest -q`
Expected: `191 passed` (187 from P2 + 4 new from P3a). If P3a is NOT merged yet, baseline is `187 passed` — flag this to the user, do not silently downgrade the expected counts later in the plan.

---

## Task 1: Migration — add `race_slug` column + indexes + backfill

**Files:**
- Create: `supabase/migrations/20260604000000_squad_race_slug_column.sql`
- Create: `supabase/migrations/_rollback/20260604000000_squad_race_slug_column.down.sql`

**Why additive + nullable:** existing Giro 2026 rows keep `race_slug = NULL`; scoring's race_slug-keyed lookups for the Giro continue to work via the `phase_id` fallback path. Tour + Vuelta get backfilled deterministically so the new partial unique indexes hold without conflict. The CHECK constraint allows either `phase_id IS NOT NULL` OR `race_slug IS NOT NULL` (at least one) — but not both NULL.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260604000000_squad_race_slug_column.sql`:

```sql
-- Spec A (A9) — generalize gt_squad / gt_role_assignments / gt_tactic_activations
-- so they accept any stage-race race_slug (1-week stage races, not only GTs).
-- Additive + nullable: legacy phase_id rows continue to work; new code paths
-- prefer race_slug. Tour + Vuelta 2026 backfilled deterministically.

-- ---------------------------------------------------------------------------
-- 1. gt_squad — add race_slug, drop the strict phase_id CHECK, backfill, index
-- ---------------------------------------------------------------------------
ALTER TABLE public.gt_squad
  ADD COLUMN IF NOT EXISTS race_slug TEXT;

-- The original CHECK (phase_id IN (4,6,8)) is now too tight. Relax it to allow
-- legacy GT phase ids OR any non-null race_slug.
ALTER TABLE public.gt_squad
  DROP CONSTRAINT IF EXISTS gt_squad_phase_id_check;
ALTER TABLE public.gt_squad
  ALTER COLUMN phase_id DROP NOT NULL;
ALTER TABLE public.gt_squad
  ADD CONSTRAINT gt_squad_scope_check
    CHECK (
      phase_id IS NOT NULL
      OR race_slug IS NOT NULL
    );

-- Deterministic backfill for Tour + Vuelta only (Giro = forward-only, skipped).
UPDATE public.gt_squad
   SET race_slug = 'race/tour-de-france/' || year
 WHERE phase_id = 6 AND race_slug IS NULL;

UPDATE public.gt_squad
   SET race_slug = 'race/vuelta-a-espana/' || year
 WHERE phase_id = 8 AND race_slug IS NULL;

-- New partial unique indexes mirror the phase_id ones, scoped on race_slug.
-- (Each role's slot uniqueness — gc_leader, sprinter, climber, tt_specialist —
-- enforced once per (team_id, race_slug) for active rows.)
CREATE UNIQUE INDEX IF NOT EXISTS idx_gt_squad_active_rider_by_slug
  ON public.gt_squad(team_id, race_slug, rider_id)
  WHERE removed_at IS NULL AND race_slug IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_gt_squad_slot_gc_leader_by_slug
  ON public.gt_squad(team_id, race_slug)
  WHERE role = 'gc_leader' AND removed_at IS NULL AND race_slug IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_gt_squad_slot_sprinter_by_slug
  ON public.gt_squad(team_id, race_slug)
  WHERE role = 'sprinter' AND removed_at IS NULL AND race_slug IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_gt_squad_slot_climber_by_slug
  ON public.gt_squad(team_id, race_slug)
  WHERE role = 'climber' AND removed_at IS NULL AND race_slug IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_gt_squad_slot_tt_specialist_by_slug
  ON public.gt_squad(team_id, race_slug)
  WHERE role = 'tt_specialist' AND removed_at IS NULL AND race_slug IS NOT NULL;

COMMENT ON COLUMN public.gt_squad.race_slug IS
  'Race slug (e.g. race/paris-nice/2026, race/tour-de-france/2026). Preferred over phase_id going forward; phase_id retained for legacy Giro 2026.';

-- ---------------------------------------------------------------------------
-- 2. gt_role_assignments — add race_slug, relax phase_id CHECK, backfill
-- ---------------------------------------------------------------------------
ALTER TABLE public.gt_role_assignments
  ADD COLUMN IF NOT EXISTS race_slug TEXT;

ALTER TABLE public.gt_role_assignments
  DROP CONSTRAINT IF EXISTS gt_role_assignments_phase_id_check;
ALTER TABLE public.gt_role_assignments
  ALTER COLUMN phase_id DROP NOT NULL;
ALTER TABLE public.gt_role_assignments
  ADD CONSTRAINT gt_role_assignments_scope_check
    CHECK (
      phase_id IS NOT NULL
      OR race_slug IS NOT NULL
    );

UPDATE public.gt_role_assignments
   SET race_slug = 'race/tour-de-france/' || year
 WHERE phase_id = 6 AND race_slug IS NULL;

UPDATE public.gt_role_assignments
   SET race_slug = 'race/vuelta-a-espana/' || year
 WHERE phase_id = 8 AND race_slug IS NULL;

CREATE INDEX IF NOT EXISTS idx_gt_role_team_race_slug
  ON public.gt_role_assignments(team_id, race_slug, rider_id, applied_at DESC)
  WHERE race_slug IS NOT NULL;

COMMENT ON COLUMN public.gt_role_assignments.race_slug IS
  'Race slug. Preferred over phase_id going forward; phase_id retained for legacy Giro 2026.';

-- ---------------------------------------------------------------------------
-- 3. gt_tactic_activations — add race_slug, relax phase_id, backfill, index
-- ---------------------------------------------------------------------------
ALTER TABLE public.gt_tactic_activations
  ADD COLUMN IF NOT EXISTS race_slug TEXT;

-- The existing unique key (team_id, phase_id, year, stage_slug) still works
-- because stage_slug is per-stage. We add a parallel unique key for the
-- new race_slug-keyed callers so 1-week races can never accidentally collide.
ALTER TABLE public.gt_tactic_activations
  ALTER COLUMN phase_id DROP NOT NULL;
ALTER TABLE public.gt_tactic_activations
  ADD CONSTRAINT gt_tactic_activations_scope_check
    CHECK (
      phase_id IS NOT NULL
      OR race_slug IS NOT NULL
    );

UPDATE public.gt_tactic_activations
   SET race_slug = 'race/tour-de-france/' || year
 WHERE phase_id = 6 AND race_slug IS NULL;

UPDATE public.gt_tactic_activations
   SET race_slug = 'race/vuelta-a-espana/' || year
 WHERE phase_id = 8 AND race_slug IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_gt_tactic_activations_by_slug
  ON public.gt_tactic_activations(team_id, race_slug, stage_slug)
  WHERE race_slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_gt_tactic_activations_race_slug
  ON public.gt_tactic_activations(team_id, race_slug)
  WHERE race_slug IS NOT NULL;

COMMENT ON COLUMN public.gt_tactic_activations.race_slug IS
  'Parent race slug for the activation (e.g. race/paris-nice/2026). Preferred over phase_id going forward.';
```

- [ ] **Step 2: Write the rollback**

Create `supabase/migrations/_rollback/20260604000000_squad_race_slug_column.down.sql`:

```sql
-- Drop the new indexes + scope checks + race_slug columns.
DROP INDEX IF EXISTS public.idx_gt_tactic_activations_race_slug;
DROP INDEX IF EXISTS public.idx_gt_tactic_activations_by_slug;
DROP INDEX IF EXISTS public.idx_gt_role_team_race_slug;
DROP INDEX IF EXISTS public.idx_gt_squad_slot_tt_specialist_by_slug;
DROP INDEX IF EXISTS public.idx_gt_squad_slot_climber_by_slug;
DROP INDEX IF EXISTS public.idx_gt_squad_slot_sprinter_by_slug;
DROP INDEX IF EXISTS public.idx_gt_squad_slot_gc_leader_by_slug;
DROP INDEX IF EXISTS public.idx_gt_squad_active_rider_by_slug;

ALTER TABLE public.gt_tactic_activations DROP CONSTRAINT IF EXISTS gt_tactic_activations_scope_check;
ALTER TABLE public.gt_role_assignments  DROP CONSTRAINT IF EXISTS gt_role_assignments_scope_check;
ALTER TABLE public.gt_squad             DROP CONSTRAINT IF EXISTS gt_squad_scope_check;

ALTER TABLE public.gt_tactic_activations DROP COLUMN IF EXISTS race_slug;
ALTER TABLE public.gt_role_assignments  DROP COLUMN IF EXISTS race_slug;
ALTER TABLE public.gt_squad             DROP COLUMN IF EXISTS race_slug;

-- Note: we do NOT restore the strict phase_id IN (4,6,8) CHECK / NOT NULL
-- because intermediate migrations between P3b and the rollback target may have
-- inserted phase_id NULL rows. Operator must clean those up manually if needed.
```

- [ ] **Step 3: Apply locally**

If Colima/Supabase local stack is not up: `colima start --cpu 4 --memory 6 && supabase start --exclude vector,edge-runtime,logflare,imgproxy,studio,mailpit`

**Shortcut (per user preference set during P3a):** for this migration (additive only — new column + relaxed CHECK + partial unique indexes + deterministic Tour/Vuelta backfill, fully reversible via the rollback), the local apply may be skipped; ask the user to confirm and push direct to prod. The next time the user reboots the local stack, `supabase db reset` will rebuild from history.

Run: `supabase db reset`

Verify:
```bash
docker exec -i supabase_db_WattHunter psql -U postgres -d postgres -c "\d public.gt_squad" \
  | grep -E "race_slug|gt_squad_scope_check"
```
Expected: `race_slug | text` line appears; `gt_squad_scope_check` CHECK listed.

- [ ] **Step 4: Push to prod (REQUIRES USER CONFIRMATION)**

⚠️ Per CLAUDE.md, ask the user before running. Migration is additive (new column + indexes + backfill). Backfill only touches Tour + Vuelta rows — Giro untouched.

Run (only after the user confirms): `supabase db push --linked`

- [ ] **Step 5: Verify backfill in prod**

Run:
```bash
docker exec -i supabase_db_WattHunter psql -U postgres -d postgres -c "
SELECT
  COUNT(*) FILTER (WHERE phase_id = 4 AND race_slug IS NULL)  AS giro_unbackfilled,
  COUNT(*) FILTER (WHERE phase_id = 6 AND race_slug = 'race/tour-de-france/2026')  AS tour_backfilled,
  COUNT(*) FILTER (WHERE phase_id = 8 AND race_slug = 'race/vuelta-a-espana/2026') AS vuelta_backfilled
FROM public.gt_squad;
"
```
Expected: `giro_unbackfilled` > 0 (intentional — forward-only), `tour_backfilled` and `vuelta_backfilled` match the count of phase 6 / phase 8 rows.

(Run the same `SELECT` against `gt_role_assignments` and `gt_tactic_activations` to sanity-check the other two tables.)

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260604000000_squad_race_slug_column.sql \
        supabase/migrations/_rollback/20260604000000_squad_race_slug_column.down.sql
git commit -m "feat(db): add race_slug to gt_squad/role_assignments/tactic_activations (Spec A A9)"
```

---

## Task 2: Migration — `tactic_usage_limits` table + new trigger

**Files:**
- Create: `supabase/migrations/20260604000100_tactic_usage_limits.sql`
- Create: `supabase/migrations/_rollback/20260604000100_tactic_usage_limits.down.sql`

**Why a table:** the trigger currently uses an inline `CASE NEW.tactic_type` to set `max_allowed`. Adding a second axis (race_kind) without exploding the CASE blocks is cleaner with a small reference table. Bonus: future tuning (e.g. monument tactics) needs no DDL — just an INSERT.

### Decision: how to infer `race_kind` from a row

The trigger needs to map a row to either `'gt'` or `'one_week'`:
1. **If `NEW.race_slug` is NOT NULL** → check if it starts with one of `GT_RACE_PREFIXES` (`race/giro-d-italia/`, `race/tour-de-france/`, `race/vuelta-a-espana/`). Match → `'gt'`. Otherwise → `'one_week'`.
2. **If `NEW.race_slug` IS NULL** (legacy phase_id-only call) → use `NEW.phase_id` (4/6/8 → `'gt'`; anything else → `'one_week'`, defensive).

This is encoded as a small SECURITY DEFINER helper `infer_race_kind(race_slug, phase_id)` to keep the trigger body short.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260604000100_tactic_usage_limits.sql`:

```sql
-- Spec A (A9) — per-race tactic usage limits as a reference table
-- (instead of inline CASE inside the BEFORE-INSERT trigger). GT keeps the
-- original 2/2/3/1/1 budget; 1-week stage races get a tighter 1/1/2/1/1.

CREATE TABLE IF NOT EXISTS public.tactic_usage_limits (
  race_kind     TEXT NOT NULL CHECK (race_kind IN ('gt','one_week')),
  tactic_type   TEXT NOT NULL CHECK (tactic_type IN
                  ('unleash','overdrive','call_the_bus','nemesis_gc','nemesis_sprint')),
  max_per_race  INT  NOT NULL CHECK (max_per_race > 0),
  PRIMARY KEY (race_kind, tactic_type)
);

ALTER TABLE public.tactic_usage_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read tactic_usage_limits"
  ON public.tactic_usage_limits FOR SELECT USING (true);

COMMENT ON TABLE public.tactic_usage_limits IS
  'Max activations per (team, race) for each tactic, scoped by race kind. Spec A A9.';

-- Seed both kinds (idempotent — use ON CONFLICT).
INSERT INTO public.tactic_usage_limits(race_kind, tactic_type, max_per_race) VALUES
  ('gt',       'unleash',        2),
  ('gt',       'overdrive',      2),
  ('gt',       'call_the_bus',   3),
  ('gt',       'nemesis_gc',     1),
  ('gt',       'nemesis_sprint', 1),
  ('one_week', 'unleash',        1),
  ('one_week', 'overdrive',      1),
  ('one_week', 'call_the_bus',   2),
  ('one_week', 'nemesis_gc',     1),
  ('one_week', 'nemesis_sprint', 1)
ON CONFLICT (race_kind, tactic_type) DO UPDATE
  SET max_per_race = EXCLUDED.max_per_race;

-- ---------------------------------------------------------------------------
-- Helper: infer race_kind from a row's race_slug / phase_id
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.infer_race_kind(
  p_race_slug TEXT,
  p_phase_id  INT
) RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_race_slug IS NOT NULL THEN
    IF p_race_slug LIKE 'race/giro-d-italia/%'
       OR p_race_slug LIKE 'race/tour-de-france/%'
       OR p_race_slug LIKE 'race/vuelta-a-espana/%' THEN
      RETURN 'gt';
    END IF;
    RETURN 'one_week';
  END IF;

  -- Legacy fallback: phase_id only.
  IF p_phase_id IN (4, 6, 8) THEN
    RETURN 'gt';
  END IF;
  RETURN 'one_week';
END;
$$;

COMMENT ON FUNCTION public.infer_race_kind IS
  'Return ''gt'' or ''one_week'' for a (race_slug, phase_id) pair. Used by enforce_tactic_usage_limit and place_tactic.';

-- ---------------------------------------------------------------------------
-- Rewrite enforce_tactic_usage_limit to read tactic_usage_limits
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_tactic_usage_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_race_kind   TEXT;
  v_max_allowed INT;
  v_current     INT;
BEGIN
  v_race_kind := public.infer_race_kind(NEW.race_slug, NEW.phase_id);

  SELECT max_per_race INTO v_max_allowed
  FROM public.tactic_usage_limits
  WHERE race_kind = v_race_kind
    AND tactic_type = NEW.tactic_type;

  IF v_max_allowed IS NULL THEN
    RAISE EXCEPTION 'no usage limit configured for race_kind=% tactic_type=%',
      v_race_kind, NEW.tactic_type
      USING ERRCODE = 'check_violation';
  END IF;

  -- Count activations scoped to the same race.
  -- Prefer race_slug when present; fall back to (phase_id, year) for legacy rows.
  IF NEW.race_slug IS NOT NULL THEN
    SELECT COUNT(*) INTO v_current
    FROM public.gt_tactic_activations
    WHERE team_id = NEW.team_id
      AND race_slug = NEW.race_slug
      AND tactic_type = NEW.tactic_type;
  ELSE
    SELECT COUNT(*) INTO v_current
    FROM public.gt_tactic_activations
    WHERE team_id = NEW.team_id
      AND phase_id = NEW.phase_id
      AND year = NEW.year
      AND tactic_type = NEW.tactic_type;
  END IF;

  IF v_current >= v_max_allowed THEN
    RAISE EXCEPTION 'tactic % already used % time(s) for this race (max %)',
      NEW.tactic_type, v_current, v_max_allowed
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp;

-- Trigger is already in place from migration 20260508010100; rebinding the
-- function body via CREATE OR REPLACE FUNCTION is sufficient (no DROP/CREATE TRIGGER).
```

- [ ] **Step 2: Write the rollback**

Create `supabase/migrations/_rollback/20260604000100_tactic_usage_limits.down.sql`:

```sql
-- Restore the inline-CASE trigger body from migration 20260508010100,
-- then drop the new table + helper.

CREATE OR REPLACE FUNCTION public.enforce_tactic_usage_limit()
RETURNS TRIGGER AS $$
DECLARE
  current_count INT;
  max_allowed   INT;
BEGIN
  max_allowed := CASE NEW.tactic_type
    WHEN 'unleash'         THEN 2
    WHEN 'overdrive'       THEN 2
    WHEN 'call_the_bus'    THEN 3
    WHEN 'nemesis_gc'      THEN 1
    WHEN 'nemesis_sprint'  THEN 1
    ELSE NULL
  END;

  IF max_allowed IS NULL THEN
    RAISE EXCEPTION 'unknown tactic_type: %', NEW.tactic_type
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT COUNT(*) INTO current_count
  FROM public.gt_tactic_activations
  WHERE team_id = NEW.team_id
    AND phase_id = NEW.phase_id
    AND year = NEW.year
    AND tactic_type = NEW.tactic_type;

  IF current_count >= max_allowed THEN
    RAISE EXCEPTION 'tactic % already used % time(s) (max %)',
      NEW.tactic_type, current_count, max_allowed
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp;

DROP FUNCTION IF EXISTS public.infer_race_kind(TEXT, INT);
DROP TABLE IF EXISTS public.tactic_usage_limits;
```

- [ ] **Step 3: Apply locally**

Run: `supabase db reset`
Verify:
```bash
docker exec -i supabase_db_WattHunter psql -U postgres -d postgres -c "
SELECT race_kind, tactic_type, max_per_race
FROM public.tactic_usage_limits
ORDER BY race_kind, tactic_type;
"
```
Expected: 10 rows (5 tactic types × 2 race_kinds), with the GT row for `call_the_bus` showing `max_per_race=3` and the one_week row showing `2`.

- [ ] **Step 4: Push to prod (REQUIRES USER CONFIRMATION)**

⚠️ Ask the user. The trigger body changes — existing GT tactic limits are unchanged (verified by the seed values), so no behavioral regression on the live Tour.

Run (only after the user confirms): `supabase db push --linked`

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260604000100_tactic_usage_limits.sql \
        supabase/migrations/_rollback/20260604000100_tactic_usage_limits.down.sql
git commit -m "feat(db): tactic_usage_limits table for per-race-kind budgets (Spec A A9)"
```

---

## Task 3: Migration — `place_tactic` v3 (race_slug-aware, P3a Nemesis gating preserved)

**Files:**
- Create: `supabase/migrations/20260604000200_place_tactic_v3_race_slug.sql`
- Create: `supabase/migrations/_rollback/20260604000200_place_tactic_v3_race_slug.down.sql`

**Behavioral diff vs P3a v2:**
1. New parameter `p_race_slug TEXT DEFAULT NULL` appended at the END of the signature (so existing TS callers pass NULL implicitly — supabase-py / supabase-js skip unset trailing args).
2. The hard `IF p_phase_id NOT IN (4, 6, 8) THEN RAISE` block is replaced with a slug-shape validation: stage_slug must match `^race/[^/]+/\d{4}/stage-\d+$`. The GT-specific `v_gt_slug_pattern` LIKE check that ties stage_slug to phase_id is replaced by a parent-slug derivation (parent = stage_slug minus `/stage-N`), and the parent is compared to `p_race_slug` when provided.
3. Race kind is inferred via `infer_race_kind(...)` and used to decide whether to derive phase_id (legacy GT path) or leave it NULL (1-week path).
4. The entire P3a Nemesis profile-gating block (Sprint p1/p2/p3, GC p3/p4/p5, `stage_profiles` lookup) is preserved verbatim.
5. The Nemesis ≥-XP eligibility query joins on `(race_slug = p_race_slug)` when p_race_slug is provided, falling back to the legacy phase_id-keyed query otherwise.
6. The INSERT now writes both `phase_id` (NULL if 1-week) and `race_slug`.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260604000200_place_tactic_v3_race_slug.sql`:

```sql
-- Spec A (A9) — place_tactic v3: accept race_slug for 1-week stage races,
-- while preserving every safety check from P3a v2 (cutoff, ownership,
-- league-scope, Nemesis profile gating, Nemesis ≥-XP).
-- Backwards-compatible: legacy callers passing only phase_id continue to work.

CREATE OR REPLACE FUNCTION public.place_tactic(
  p_team_id      UUID,
  p_phase_id     INT,
  p_year         INT,
  p_tactic_type  TEXT,
  p_stage_slug   TEXT,
  p_nemesis_target_team_id UUID DEFAULT NULL,
  p_nemesis_target_role    TEXT DEFAULT NULL,
  p_race_slug    TEXT DEFAULT NULL  -- NEW in v3 (Spec A A9)
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id       UUID;
  v_owner         UUID;
  v_my_league     UUID;
  v_target_league UUID;
  v_attacker_xp   NUMERIC;
  v_target_xp     NUMERIC;
  v_role_filter   TEXT;
  v_new_id        UUID;
  v_stage_date    DATE;
  v_stage_profile TEXT;
  v_race_kind     TEXT;
  v_parent_slug   TEXT;
  v_effective_race_slug TEXT;
  v_effective_phase_id  INT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  -- ---------------------------------------------------------------------
  -- Ownership check
  -- ---------------------------------------------------------------------
  SELECT user_id, league_id INTO v_owner, v_my_league
  FROM public.teams WHERE id = p_team_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'team not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_owner <> v_user_id THEN
    RAISE EXCEPTION 'not team owner' USING ERRCODE = '42501';
  END IF;

  -- ---------------------------------------------------------------------
  -- Tactic-type validity
  -- ---------------------------------------------------------------------
  IF p_tactic_type NOT IN
       ('unleash','overdrive','call_the_bus','nemesis_gc','nemesis_sprint') THEN
    RAISE EXCEPTION 'invalid tactic_type %', p_tactic_type
      USING ERRCODE = 'check_violation';
  END IF;

  -- ---------------------------------------------------------------------
  -- Stage_slug shape — must be 'race/<race>/<year>/stage-<N>'.
  -- (No more hard phase_id IN (4,6,8) — 1-week races are now valid.)
  -- ---------------------------------------------------------------------
  IF p_stage_slug !~ '^race/[^/]+/[0-9]{4}/stage-[0-9]+$' THEN
    RAISE EXCEPTION 'invalid stage_slug shape: %', p_stage_slug
      USING ERRCODE = 'check_violation';
  END IF;

  -- Derive parent race slug from the stage slug.
  v_parent_slug := regexp_replace(p_stage_slug, '/stage-[0-9]+$', '');

  -- Pick the effective scope: prefer caller-supplied race_slug, else parent.
  v_effective_race_slug := COALESCE(p_race_slug, v_parent_slug);

  -- Consistency: if both were provided, they must match.
  IF p_race_slug IS NOT NULL AND p_race_slug <> v_parent_slug THEN
    RAISE EXCEPTION 'race_slug % does not match stage_slug parent %', p_race_slug, v_parent_slug
      USING ERRCODE = 'check_violation';
  END IF;

  v_race_kind := public.infer_race_kind(v_effective_race_slug, p_phase_id);

  -- Legacy GT path: derive a phase_id when omitted (back-compat with old front).
  -- Modern path (1-week): leave phase_id NULL.
  IF v_race_kind = 'gt' THEN
    v_effective_phase_id := COALESCE(
      p_phase_id,
      CASE
        WHEN v_effective_race_slug LIKE 'race/giro-d-italia/%'    THEN 4
        WHEN v_effective_race_slug LIKE 'race/tour-de-france/%'   THEN 6
        WHEN v_effective_race_slug LIKE 'race/vuelta-a-espana/%'  THEN 8
      END
    );
  ELSE
    v_effective_phase_id := NULL;
  END IF;

  -- ---------------------------------------------------------------------
  -- 11:00 CET cutoff (unchanged from P3a v2)
  -- ---------------------------------------------------------------------
  SELECT race_date INTO v_stage_date
  FROM public.race_startlists
  WHERE race_slug = p_stage_slug
  LIMIT 1;

  IF v_stage_date IS NOT NULL
     AND v_stage_date = (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Paris')::DATE
     AND (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Paris')::TIME >= TIME '11:00' THEN
    RAISE EXCEPTION 'tactic cutoff has passed for today stage'
      USING ERRCODE = 'check_violation';
  END IF;

  -- ---------------------------------------------------------------------
  -- Nemesis-specific validations
  -- ---------------------------------------------------------------------
  IF p_tactic_type IN ('nemesis_gc','nemesis_sprint') THEN
    IF p_nemesis_target_team_id IS NULL OR p_nemesis_target_role IS NULL THEN
      RAISE EXCEPTION 'nemesis tactics require a target team and role';
    END IF;

    -- ----- Profile gating (Spec A A7, preserved verbatim from P3a v2) -----
    SELECT profile_icon INTO v_stage_profile
    FROM public.stage_profiles
    WHERE race_slug = p_stage_slug
    LIMIT 1;

    IF v_stage_profile IS NULL THEN
      RAISE EXCEPTION 'stage profile unknown for % — run the startlists pipeline first', p_stage_slug
        USING ERRCODE = 'check_violation';
    END IF;

    IF p_tactic_type = 'nemesis_sprint'
       AND v_stage_profile NOT IN ('p1','p2','p3') THEN
      RAISE EXCEPTION 'Nemesis Sprint requires a flat or hilly stage (p1/p2/p3), got %', v_stage_profile
        USING ERRCODE = 'check_violation';
    END IF;

    IF p_tactic_type = 'nemesis_gc'
       AND v_stage_profile NOT IN ('p3','p4','p5') THEN
      RAISE EXCEPTION 'Nemesis GC requires a hilly-uphill or mountain stage (p3/p4/p5), got %', v_stage_profile
        USING ERRCODE = 'check_violation';
    END IF;
    -- ------------------ end preserved P3a block ------------------------

    -- Target must be in same league (unchanged)
    SELECT league_id INTO v_target_league FROM public.teams WHERE id = p_nemesis_target_team_id;
    IF v_target_league IS NULL THEN
      RAISE EXCEPTION 'target team not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_target_league <> v_my_league THEN
      RAISE EXCEPTION 'target team not in same league' USING ERRCODE = '42501';
    END IF;

    v_role_filter := CASE p_tactic_type
      WHEN 'nemesis_gc' THEN 'gc_leader'
      ELSE 'sprinter'
    END;

    -- ≥-XP eligibility.
    -- Modern race_slug-keyed path (v3): scope role assignments + xp to race_slug.
    -- Legacy phase_id-keyed path: kept for back-compat (Giro 2026 callers).
    IF v_effective_race_slug IS NOT NULL THEN
      SELECT COALESCE(SUM(rxd.xp_gained), 0) INTO v_attacker_xp
      FROM public.gt_role_assignments ra
      JOIN public.rider_xp_daily rxd
        ON rxd.team_id = ra.team_id AND rxd.rider_id = ra.rider_id
      WHERE ra.team_id = p_team_id
        AND (ra.race_slug = v_effective_race_slug
             OR (ra.race_slug IS NULL AND ra.phase_id = v_effective_phase_id AND ra.year = p_year))
        AND ra.role = v_role_filter
        AND rxd.race_slug LIKE v_effective_race_slug || '/%'
        AND ra.applied_at = (
          SELECT MAX(applied_at) FROM public.gt_role_assignments
          WHERE team_id = ra.team_id AND rider_id = ra.rider_id
            AND COALESCE(race_slug, '') = COALESCE(ra.race_slug, '')
            AND COALESCE(phase_id, -1) = COALESCE(ra.phase_id, -1)
            AND year = ra.year
        );

      SELECT COALESCE(SUM(rxd.xp_gained), 0) INTO v_target_xp
      FROM public.gt_role_assignments ra
      JOIN public.rider_xp_daily rxd
        ON rxd.team_id = ra.team_id AND rxd.rider_id = ra.rider_id
      WHERE ra.team_id = p_nemesis_target_team_id
        AND (ra.race_slug = v_effective_race_slug
             OR (ra.race_slug IS NULL AND ra.phase_id = v_effective_phase_id AND ra.year = p_year))
        AND ra.role = v_role_filter
        AND rxd.race_slug LIKE v_effective_race_slug || '/%'
        AND ra.applied_at = (
          SELECT MAX(applied_at) FROM public.gt_role_assignments
          WHERE team_id = ra.team_id AND rider_id = ra.rider_id
            AND COALESCE(race_slug, '') = COALESCE(ra.race_slug, '')
            AND COALESCE(phase_id, -1) = COALESCE(ra.phase_id, -1)
            AND year = ra.year
        );
    ELSE
      -- Pure legacy fallback (race_slug not derivable — should not happen
      -- given the stage_slug regex, but defensive).
      SELECT COALESCE(SUM(rxd.xp_gained), 0) INTO v_attacker_xp
      FROM public.gt_role_assignments ra
      JOIN public.rider_xp_daily rxd
        ON rxd.team_id = ra.team_id AND rxd.rider_id = ra.rider_id
      WHERE ra.team_id = p_team_id
        AND ra.phase_id = v_effective_phase_id AND ra.year = p_year
        AND ra.role = v_role_filter
        AND ra.applied_at = (
          SELECT MAX(applied_at) FROM public.gt_role_assignments
          WHERE team_id = ra.team_id AND rider_id = ra.rider_id
            AND phase_id = ra.phase_id AND year = ra.year
        );
      SELECT COALESCE(SUM(rxd.xp_gained), 0) INTO v_target_xp
      FROM public.gt_role_assignments ra
      JOIN public.rider_xp_daily rxd
        ON rxd.team_id = ra.team_id AND rxd.rider_id = ra.rider_id
      WHERE ra.team_id = p_nemesis_target_team_id
        AND ra.phase_id = v_effective_phase_id AND ra.year = p_year
        AND ra.role = v_role_filter
        AND ra.applied_at = (
          SELECT MAX(applied_at) FROM public.gt_role_assignments
          WHERE team_id = ra.team_id AND rider_id = ra.rider_id
            AND phase_id = ra.phase_id AND year = ra.year
        );
    END IF;

    IF v_target_xp < v_attacker_xp THEN
      RAISE EXCEPTION 'target must have >= your race XP (you=%, target=%)',
        v_attacker_xp, v_target_xp;
    END IF;
  ELSE
    IF p_nemesis_target_team_id IS NOT NULL OR p_nemesis_target_role IS NOT NULL THEN
      RAISE EXCEPTION 'nemesis fields must be NULL for non-nemesis tactics';
    END IF;
  END IF;

  -- ---------------------------------------------------------------------
  -- Insert (write BOTH phase_id and race_slug; trigger reads either)
  -- ---------------------------------------------------------------------
  INSERT INTO public.gt_tactic_activations(
    team_id, phase_id, year, tactic_type, stage_slug,
    nemesis_target_team_id, nemesis_target_role,
    race_slug
  )
  VALUES (
    p_team_id, v_effective_phase_id, p_year, p_tactic_type, p_stage_slug,
    p_nemesis_target_team_id, p_nemesis_target_role,
    v_effective_race_slug
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.place_tactic FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_tactic TO authenticated;

COMMENT ON FUNCTION public.place_tactic IS
  'v3 (Spec A A9): accept race_slug for 1-week stage races. Preserves P3a Nemesis profile gating. Back-compatible with legacy phase_id-only callers (Giro 2026).';
```

- [ ] **Step 2: Write the rollback**

Create `supabase/migrations/_rollback/20260604000200_place_tactic_v3_race_slug.down.sql` — paste the **entire** `CREATE OR REPLACE FUNCTION place_tactic` body from `supabase/migrations/20260603000100_place_tactic_profile_gating.sql` (the P3a v2). Below the paste, add:

```sql
-- Drop the v3 signature (DEFAULT-extended). PG resolves by full type list,
-- so we must drop the exact 8-arg version before the 7-arg replacement
-- (above) takes effect on legacy callers.
DROP FUNCTION IF EXISTS public.place_tactic(UUID, INT, INT, TEXT, TEXT, UUID, TEXT, TEXT);
```

- [ ] **Step 3: Apply locally**

Run: `supabase db reset`
Verify: `docker exec -i supabase_db_WattHunter psql -U postgres -d postgres -c "\df public.place_tactic"`
Expected: a single `place_tactic` overload with 8 arguments, the last one being `p_race_slug text`.

- [ ] **Step 4: Smoke check in psql — 1-week tactic placement (manual)**

```bash
docker exec -i supabase_db_WattHunter psql -U postgres -d postgres <<'SQL'
-- Seed a 1-week stage profile so a Nemesis Sprint placement can succeed.
INSERT INTO public.stage_profiles(race_slug, profile_icon, race_date)
VALUES ('race/dauphine/2026/stage-2', 'p1', '2026-06-08')
ON CONFLICT (race_slug) DO UPDATE SET profile_icon = EXCLUDED.profile_icon;

-- The SQL invocation can't easily set auth.uid(); this is a parse smoke check.
EXPLAIN ANALYZE SELECT public.place_tactic(
  gen_random_uuid(), NULL, 2026, 'unleash', 'race/dauphine/2026/stage-2',
  NULL, NULL, 'race/dauphine/2026'
);
SQL
```
Expected: planner explains the function call without "syntax error" / "column does not exist" / "function does not exist". (It will RAISE "not authenticated" — that's fine; the parse + signature are what we're checking.)

- [ ] **Step 5: Push to prod (REQUIRES USER CONFIRMATION)**

⚠️ Ask the user. This swaps `place_tactic`; existing callers (front + scoring) pass legacy args and still resolve.

Run (only after the user confirms): `supabase db push --linked`

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260604000200_place_tactic_v3_race_slug.sql \
        supabase/migrations/_rollback/20260604000200_place_tactic_v3_race_slug.down.sql
git commit -m "feat(rpc): place_tactic v3 accepts race_slug for 1-week races (Spec A A9)"
```

---

## Task 4: Migration — GT squad RPCs v2 (race_slug-aware)

Generalize `gt_add_to_squad`, `gt_remove_from_squad`, `gt_swap_slot`, `gt_assign_role` so each accepts a new trailing `p_race_slug TEXT DEFAULT NULL` parameter. Same back-compat shape as `place_tactic`: legacy callers pass NULL → behavior identical; new 1-week callers pass a slug.

**Files:**
- Create: `supabase/migrations/20260604000300_gt_squad_rpcs_v2_race_slug.sql`
- Create: `supabase/migrations/_rollback/20260604000300_gt_squad_rpcs_v2_race_slug.down.sql`

### Decision: where to write `race_slug` on INSERT

When `p_race_slug` is non-null, write it to **both** `gt_squad.race_slug` and `gt_role_assignments.race_slug` (and leave `phase_id` to the value passed by the caller — which may be NULL for 1-week, or a GT phase for the new "tour-as-race_slug" callers). When `p_race_slug` is NULL, behave exactly like v1 (write only `phase_id` / `year`).

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260604000300_gt_squad_rpcs_v2_race_slug.sql`:

```sql
-- Spec A (A9) — gt_squad RPCs v2: accept race_slug for 1-week stage races.
-- Backwards-compatible: callers that pass NULL keep the old phase_id-only behavior.

-- Note: we ALTER the function signature by adding a trailing DEFAULT NULL
-- argument; existing call sites continue to resolve.

-- ---------------------------------------------------------------------------
-- 1. gt_add_to_squad v2
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gt_add_to_squad(
  p_team_id   uuid,
  p_rider_id  uuid,
  p_role      text,
  p_phase_id  int,
  p_year      int,
  p_race_slug text DEFAULT NULL  -- NEW in v2 (Spec A A9)
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id          uuid := auth.uid();
  v_team_user_id     uuid;
  v_contract_exists  boolean;
  v_already_in_squad boolean;
  v_role_count       int;
  v_cap              int;
  v_use_slug         boolean := p_race_slug IS NOT NULL;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  IF p_role NOT IN ('gc_leader','sprinter','climber','tt_specialist','stage_hunter','domestique') THEN
    RETURN jsonb_build_object('error', 'Invalid role');
  END IF;

  -- Validate scope: either a race_slug or a legacy GT phase id must be provided.
  IF NOT v_use_slug AND p_phase_id NOT IN (4, 6, 8) THEN
    RETURN jsonb_build_object('error', 'Invalid phase_id (and no race_slug provided)');
  END IF;

  SELECT user_id INTO v_team_user_id
  FROM public.teams WHERE id = p_team_id FOR UPDATE;

  IF v_team_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Team not found');
  END IF;

  IF v_team_user_id <> v_user_id THEN
    RETURN jsonb_build_object('error', 'Not team owner');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.contracts
    WHERE team_id = p_team_id AND rider_id = p_rider_id AND status = 'active'
  ) INTO v_contract_exists;

  IF NOT v_contract_exists THEN
    RETURN jsonb_build_object('error', 'Rider has no active contract with this team');
  END IF;

  -- "Already in squad" check (scope-aware)
  IF v_use_slug THEN
    SELECT EXISTS (
      SELECT 1 FROM public.gt_squad
      WHERE team_id = p_team_id AND race_slug = p_race_slug
        AND rider_id = p_rider_id AND removed_at IS NULL
    ) INTO v_already_in_squad;
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM public.gt_squad
      WHERE team_id = p_team_id AND phase_id = p_phase_id AND year = p_year
        AND rider_id = p_rider_id AND removed_at IS NULL
    ) INTO v_already_in_squad;
  END IF;

  IF v_already_in_squad THEN
    RETURN jsonb_build_object('error', 'Rider is already in the squad');
  END IF;

  v_cap := CASE p_role
    WHEN 'gc_leader'     THEN 1
    WHEN 'sprinter'      THEN 1
    WHEN 'climber'       THEN 1
    WHEN 'tt_specialist' THEN 1
    WHEN 'stage_hunter'  THEN 2
    WHEN 'domestique'    THEN 2
  END;

  IF v_use_slug THEN
    SELECT COUNT(*) INTO v_role_count
    FROM public.gt_squad
    WHERE team_id = p_team_id AND race_slug = p_race_slug
      AND role = p_role AND removed_at IS NULL;
  ELSE
    SELECT COUNT(*) INTO v_role_count
    FROM public.gt_squad
    WHERE team_id = p_team_id AND phase_id = p_phase_id AND year = p_year
      AND role = p_role AND removed_at IS NULL;
  END IF;

  IF v_role_count >= v_cap THEN
    RETURN jsonb_build_object('error', format('Role %s is at capacity (%s)', p_role, v_cap));
  END IF;

  INSERT INTO public.gt_squad (team_id, phase_id, year, rider_id, role, race_slug)
  VALUES (p_team_id, p_phase_id, p_year, p_rider_id, p_role, p_race_slug);

  INSERT INTO public.gt_role_assignments (team_id, phase_id, year, rider_id, role, race_slug)
  VALUES (p_team_id, p_phase_id, p_year, p_rider_id, p_role, p_race_slug);

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. gt_remove_from_squad v2
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gt_remove_from_squad(
  p_team_id   uuid,
  p_rider_id  uuid,
  p_phase_id  int,
  p_year      int,
  p_race_slug text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id      uuid := auth.uid();
  v_team_user_id uuid;
  v_squad_id     uuid;
  v_use_slug     boolean := p_race_slug IS NOT NULL;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  IF NOT v_use_slug AND p_phase_id NOT IN (4, 6, 8) THEN
    RETURN jsonb_build_object('error', 'Invalid phase_id (and no race_slug provided)');
  END IF;

  SELECT user_id INTO v_team_user_id
  FROM public.teams WHERE id = p_team_id FOR UPDATE;

  IF v_team_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Team not found');
  END IF;

  IF v_team_user_id <> v_user_id THEN
    RETURN jsonb_build_object('error', 'Not team owner');
  END IF;

  IF v_use_slug THEN
    SELECT id INTO v_squad_id
    FROM public.gt_squad
    WHERE team_id = p_team_id AND race_slug = p_race_slug
      AND rider_id = p_rider_id AND removed_at IS NULL;
  ELSE
    SELECT id INTO v_squad_id
    FROM public.gt_squad
    WHERE team_id = p_team_id AND phase_id = p_phase_id AND year = p_year
      AND rider_id = p_rider_id AND removed_at IS NULL;
  END IF;

  IF v_squad_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Rider not in squad');
  END IF;

  UPDATE public.gt_squad SET removed_at = now() WHERE id = v_squad_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. gt_swap_slot v2
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gt_swap_slot(
  p_team_id      uuid,
  p_old_rider_id uuid,
  p_new_rider_id uuid,
  p_phase_id     int,
  p_year         int,
  p_race_slug    text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id          uuid := auth.uid();
  v_team_user_id     uuid;
  v_old_squad_id     uuid;
  v_inherited_role   text;
  v_contract_exists  boolean;
  v_already_in_squad boolean;
  v_use_slug         boolean := p_race_slug IS NOT NULL;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  IF NOT v_use_slug AND p_phase_id NOT IN (4, 6, 8) THEN
    RETURN jsonb_build_object('error', 'Invalid phase_id (and no race_slug provided)');
  END IF;

  SELECT user_id INTO v_team_user_id
  FROM public.teams WHERE id = p_team_id FOR UPDATE;

  IF v_team_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Team not found');
  END IF;

  IF v_team_user_id <> v_user_id THEN
    RETURN jsonb_build_object('error', 'Not team owner');
  END IF;

  IF v_use_slug THEN
    SELECT id, role INTO v_old_squad_id, v_inherited_role
    FROM public.gt_squad
    WHERE team_id = p_team_id AND race_slug = p_race_slug
      AND rider_id = p_old_rider_id AND removed_at IS NULL;
  ELSE
    SELECT id, role INTO v_old_squad_id, v_inherited_role
    FROM public.gt_squad
    WHERE team_id = p_team_id AND phase_id = p_phase_id AND year = p_year
      AND rider_id = p_old_rider_id AND removed_at IS NULL;
  END IF;

  IF v_old_squad_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Old rider not in squad');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.contracts
    WHERE team_id = p_team_id AND rider_id = p_new_rider_id AND status = 'active'
  ) INTO v_contract_exists;

  IF NOT v_contract_exists THEN
    RETURN jsonb_build_object('error', 'New rider has no active contract with this team');
  END IF;

  IF v_use_slug THEN
    SELECT EXISTS (
      SELECT 1 FROM public.gt_squad
      WHERE team_id = p_team_id AND race_slug = p_race_slug
        AND rider_id = p_new_rider_id AND removed_at IS NULL
    ) INTO v_already_in_squad;
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM public.gt_squad
      WHERE team_id = p_team_id AND phase_id = p_phase_id AND year = p_year
        AND rider_id = p_new_rider_id AND removed_at IS NULL
    ) INTO v_already_in_squad;
  END IF;

  IF v_already_in_squad THEN
    RETURN jsonb_build_object('error', 'New rider is already in the squad');
  END IF;

  UPDATE public.gt_squad SET removed_at = now() WHERE id = v_old_squad_id;

  INSERT INTO public.gt_squad (team_id, phase_id, year, rider_id, role, race_slug)
  VALUES (p_team_id, p_phase_id, p_year, p_new_rider_id, v_inherited_role, p_race_slug);

  INSERT INTO public.gt_role_assignments (team_id, phase_id, year, rider_id, role, race_slug)
  VALUES (p_team_id, p_phase_id, p_year, p_new_rider_id, v_inherited_role, p_race_slug);

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. gt_assign_role v2
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gt_assign_role(
  p_team_id   uuid,
  p_rider_id  uuid,
  p_role      text,
  p_phase_id  int,
  p_year      int,
  p_race_slug text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id      uuid := auth.uid();
  v_team_user_id uuid;
  v_squad_id     uuid;
  v_cap          int;
  v_demote       record;
  v_use_slug     boolean := p_race_slug IS NOT NULL;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  IF p_role NOT IN ('gc_leader','sprinter','climber','tt_specialist','stage_hunter','domestique') THEN
    RETURN jsonb_build_object('error', 'Invalid role');
  END IF;

  IF NOT v_use_slug AND p_phase_id NOT IN (4, 6, 8) THEN
    RETURN jsonb_build_object('error', 'Invalid phase_id (and no race_slug provided)');
  END IF;

  SELECT user_id INTO v_team_user_id
  FROM public.teams WHERE id = p_team_id FOR UPDATE;

  IF v_team_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Team not found');
  END IF;

  IF v_team_user_id <> v_user_id THEN
    RETURN jsonb_build_object('error', 'Not team owner');
  END IF;

  IF v_use_slug THEN
    SELECT id INTO v_squad_id
    FROM public.gt_squad
    WHERE team_id = p_team_id AND race_slug = p_race_slug
      AND rider_id = p_rider_id AND removed_at IS NULL;
  ELSE
    SELECT id INTO v_squad_id
    FROM public.gt_squad
    WHERE team_id = p_team_id AND phase_id = p_phase_id AND year = p_year
      AND rider_id = p_rider_id AND removed_at IS NULL;
  END IF;

  IF v_squad_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Rider not in squad');
  END IF;

  v_cap := CASE p_role
    WHEN 'gc_leader'     THEN 1
    WHEN 'sprinter'      THEN 1
    WHEN 'climber'       THEN 1
    WHEN 'tt_specialist' THEN 1
    WHEN 'stage_hunter'  THEN 2
    WHEN 'domestique'    THEN 2
  END;

  -- Demote oldest current holder if at cap (excluding the target rider).
  IF v_use_slug THEN
    IF (
      SELECT COUNT(*) FROM public.gt_squad
      WHERE team_id = p_team_id AND race_slug = p_race_slug
        AND role = p_role AND removed_at IS NULL AND rider_id <> p_rider_id
    ) >= v_cap THEN
      SELECT id, rider_id INTO v_demote
      FROM public.gt_squad
      WHERE team_id = p_team_id AND race_slug = p_race_slug
        AND role = p_role AND removed_at IS NULL AND rider_id <> p_rider_id
      ORDER BY created_at ASC
      LIMIT 1;

      UPDATE public.gt_squad SET role = 'domestique' WHERE id = v_demote.id;

      INSERT INTO public.gt_role_assignments (team_id, phase_id, year, rider_id, role, race_slug)
      VALUES (p_team_id, p_phase_id, p_year, v_demote.rider_id, 'domestique', p_race_slug);
    END IF;
  ELSE
    IF (
      SELECT COUNT(*) FROM public.gt_squad
      WHERE team_id = p_team_id AND phase_id = p_phase_id AND year = p_year
        AND role = p_role AND removed_at IS NULL AND rider_id <> p_rider_id
    ) >= v_cap THEN
      SELECT id, rider_id INTO v_demote
      FROM public.gt_squad
      WHERE team_id = p_team_id AND phase_id = p_phase_id AND year = p_year
        AND role = p_role AND removed_at IS NULL AND rider_id <> p_rider_id
      ORDER BY created_at ASC
      LIMIT 1;

      UPDATE public.gt_squad SET role = 'domestique' WHERE id = v_demote.id;

      INSERT INTO public.gt_role_assignments (team_id, phase_id, year, rider_id, role)
      VALUES (p_team_id, p_phase_id, p_year, v_demote.rider_id, 'domestique');
    END IF;
  END IF;

  UPDATE public.gt_squad SET role = p_role WHERE id = v_squad_id;

  INSERT INTO public.gt_role_assignments (team_id, phase_id, year, rider_id, role, race_slug)
  VALUES (p_team_id, p_phase_id, p_year, p_rider_id, p_role, p_race_slug);

  RETURN jsonb_build_object('ok', true);
END;
$$;
```

- [ ] **Step 2: Write the rollback**

Create `supabase/migrations/_rollback/20260604000300_gt_squad_rpcs_v2_race_slug.down.sql` — paste the **entire** v1 body of all four RPCs from `supabase/migrations/20260510000000_gt_squad_builder_v2.sql` (sections 6, 7, 8, 9). Below the paste, add `DROP FUNCTION` lines for the new 6-arg signatures so PG picks up the restored 5-arg versions:

```sql
DROP FUNCTION IF EXISTS public.gt_add_to_squad(uuid, uuid, text, int, int, text);
DROP FUNCTION IF EXISTS public.gt_remove_from_squad(uuid, uuid, int, int, text);
DROP FUNCTION IF EXISTS public.gt_swap_slot(uuid, uuid, uuid, int, int, text);
DROP FUNCTION IF EXISTS public.gt_assign_role(uuid, uuid, text, int, int, text);
```

- [ ] **Step 3: Apply locally + push to prod (REQUIRES USER CONFIRMATION)**

Run: `supabase db reset`

Verify: `docker exec -i supabase_db_WattHunter psql -U postgres -d postgres -c "\df public.gt_add_to_squad"`
Expected: a single overload with 6 arguments, the last being `p_race_slug text`.

⚠️ Ask the user before `supabase db push --linked`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260604000300_gt_squad_rpcs_v2_race_slug.sql \
        supabase/migrations/_rollback/20260604000300_gt_squad_rpcs_v2_race_slug.down.sql
git commit -m "feat(rpc): gt_squad RPCs accept race_slug for 1-week races (Spec A A9)"
```

---

## Task 5: Scoring — `_is_squad_race()` + 1-week finals-secondary activation

The scoring pipeline currently treats 1-week stage races identically to monuments (no squad gating, no classif bonus, no finals-secondary). P3b makes them first-class.

**File:** `services/pcs-sync/scoring.py`.

### Mock-ordering invariant — read before editing

Per the P2 plan, any new `.table()` call added inside `calculate_daily_scores` MUST be gated behind a condition that is **false** for the existing stage-slug tests (i.e. the tests in `test_scoring.py` whose `race_slugs` are non-stage-race monuments and which only inject mocks for `contracts`, `riders_strategies`, `rider_xp_daily`). If the gate evaluates true for those tests, the existing mocks won't satisfy the new call → the test errors out with a `MagicMock`-not-subscriptable failure.

For P3b the gate becomes `_is_squad_race(slug)` (broader than `_is_gt_slug`) — but the existing mocked tests use monument slugs (`milano-sanremo`, `paris-roubaix`, etc.), which are `type="one-day"` in `wt_calendar_2026.json`. **Therefore `_is_squad_race` must return False for one-day races**. Encode this strictly via a whitelist (stage-race slugs from the calendar) — never just "not one-day", as monuments without a `type` field would otherwise leak.

- [ ] **Step 1: Add the predicate + calendar reader (top of scoring.py near `_is_gt_slug`)**

Above the existing `_is_gt_slug` (line ~149), insert:

```python
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
```

Add the needed imports at the top of the file:
```python
from functools import lru_cache
from pathlib import Path
import json
```
(Most are already imported; double-check before adding to avoid duplicate-import lint nags.)

- [ ] **Step 2: Replace `_is_gt_slug` callers with `_is_squad_race`**

There are 5 call sites (per `grep -n _is_gt_slug services/pcs-sync/scoring.py`):
- line ~378: `gt_slugs = [s for s in (race_slugs or []) if _is_gt_slug(s)]`
- line ~388: `if _is_gt_slug(h.get("race_slug", "")):`
- line ~444: `if _is_gt_slug(s) and s.rsplit("/", 1)[-1] in ("points", "kom", "youth")`
- line ~536: `if _is_gt_slug(race_slug):`

Replace each with `_is_squad_race(...)`. Keep `_is_gt_slug` itself defined — it's still used by the `mode` decision below.

Also rename the local variable `gt_slugs` to `squad_slugs` for clarity (search-replace in `calculate_daily_scores`).

- [ ] **Step 3: Activate `FINAL_SECONDARY_SCALE["one_week"]` in the finals-secondary pass**

In the third-pass loop (around line ~696), the call is currently:
```python
f_bonus = _final_secondary_bonus(f_ctype, fr.get("rank"), f_role, mode="gt")
```

Replace with a slug-derived mode:
```python
f_mode = "gt" if _is_gt_slug(f_slug) else "one_week"
f_bonus = _final_secondary_bonus(f_ctype, fr.get("rank"), f_role, mode=f_mode)
```

(`_is_gt_slug` still narrowly answers "is this one of the 3 GTs?" — that's the right question for picking the scale.)

- [ ] **Step 4: Keep `_role_multiplier` unchanged**

Confirm by re-reading `_role_multiplier` (lines 179-200). The `/gc` branch (`race_slug.endswith("/gc"): return 1.0`) already correctly handles 1-week race GC finals, since they share the `/gc` suffix. No edit needed.

- [ ] **Step 5: Run the existing suite — confirm zero regression**

Run: `cd services/pcs-sync && .venv/bin/python -m pytest -q`
Expected: `191 passed` (same as baseline — no behavior change for monument tests, no new tests yet).

If a test fails: the mock-ordering invariant has been broken. Most likely cause: a monument test slug is being matched by `_is_squad_race` (check `wt_calendar_2026.json` — verify the slug used in the test is `type="one-day"`).

- [ ] **Step 6: Commit (interim — code-only, tests next task)**

```bash
git add services/pcs-sync/scoring.py
git commit -m "feat(scoring): _is_squad_race extends squad gating to 1-week races (Spec A A9)"
```

---

## Task 6: Pipeline — `_is_squad_race` + finals import for 1-week

**File:** `services/pcs-sync/run_pipeline.py`.

- [ ] **Step 1: Add `_is_squad_race` and refactor `_maybe_import_finals`**

Near the existing `_is_gt_race` (line 68), add:

```python
@functools.lru_cache(maxsize=1)
def _stage_race_slug_prefixes() -> tuple[str, ...]:
    """Mirror of the scoring.py helper — calendar-driven stage-race whitelist."""
    try:
        with open(CALENDAR_PATH, encoding="utf-8") as fh:
            calendar = json.load(fh)
    except (OSError, json.JSONDecodeError):
        return tuple()
    out: list[str] = []
    for e in calendar:
        if e.get("type") != "stage-race":
            continue
        s = e.get("slug") or ""
        if s:
            out.append(s)
            out.append(s if s.endswith("/") else s + "/")
    return tuple(out)


def _is_squad_race(slug: str) -> bool:
    """True for any stage-race slug (GT + 1-week). Use this instead of _is_gt_race
    when the question is 'should we run squad-aware scoring / finals import here?'."""
    if not slug:
        return False
    if slug.startswith(GT_SLUG_PREFIXES):
        return True
    return any(slug == p.rstrip("/") or slug.startswith(p)
               for p in _stage_race_slug_prefixes())
```

Add at top of file if missing: `import functools`.

Then update `_maybe_import_finals` (line 73) to fire for any squad race, not just GTs:

```python
async def _maybe_import_finals(supabase, browser, parent_slug, race_name, race_date, gc_result, imported_slugs):
    """After a stage-race GC import, import final Points/KOM/Youth jerseys once the race is complete.

    Completion signal: GC carries PCS points (assigned only after the final stage).
    Used for GTs (Giro/Tour/Vuelta) AND 1-week stage races whose GC carries points (Spec A A9).
    Appends the three final slugs to imported_slugs so scoring picks them up.
    """
    if not (_is_squad_race(parent_slug) and gc_result.get("has_points")):
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

Keep `_is_gt_race` defined — it may still be referenced elsewhere (e.g. in `services/pcs-sync/scripts/`). No semantic change to its body.

- [ ] **Step 2: Smoke-check the file parses**

Run: `cd services/pcs-sync && .venv/bin/python -c "import run_pipeline"`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add services/pcs-sync/run_pipeline.py
git commit -m "feat(pipeline): import_final_classifications fires for 1-week races (Spec A A9)"
```

---

## Task 7: Tests — 1-week squad gating + finals-secondary + tactic limit

Three test files to extend. Each test is **additive** — do not modify existing tests.

### 7.1 — `tests/test_scoring_gt.py`

The existing tests cover GT-only flows. Add a class `TestOneWeekSquadGating` that exercises a Paris-Nice stage slug.

- [ ] **Step 1: Append the test class**

At the bottom of `services/pcs-sync/tests/test_scoring_gt.py`:

```python
# ---------------------------------------------------------------------------
# Spec A A9 — 1-week Race Team squad gating + finals-secondary
# ---------------------------------------------------------------------------

class TestOneWeekSquadGating:
    """Squad scoring on a 1-week stage-race slug behaves like a GT
    (gate non-squad riders to 0, classif bonus + finals-secondary one_week)."""

    @pytest.fixture
    def paris_nice_slug(self):
        return "race/paris-nice/2026/stage-3"

    def test_one_week_stage_gates_non_squad_riders(
        self, paris_nice_slug, make_supabase_for_gt
    ):
        """A contracted rider NOT in the gt_squad of paris-nice must score 0 on the stage."""
        from scoring import calculate_daily_scores

        team_id = "11111111-1111-1111-1111-111111111111"
        rider_in_squad = "22222222-2222-2222-2222-222222222222"
        rider_not_in_squad = "33333333-3333-3333-3333-333333333333"

        # Both contracted; only `rider_in_squad` is in gt_squad with race_slug = paris-nice/2026.
        sb = make_supabase_for_gt(
            contracts=[
                _contract(team_id, rider_in_squad, "11111111-aaaa-aaaa-aaaa-cccccccccccc"),
                _contract(team_id, rider_not_in_squad, "11111111-aaaa-aaaa-aaaa-dddddddddddd"),
            ],
            race_results=[
                {"race_slug": paris_nice_slug, "rider_id": rider_in_squad,
                 "pcs_points": 40, "race_date": "2026-03-10", "is_itt": False,
                 "breakaway_kms": None, "profile_icon": "p2"},
                {"race_slug": paris_nice_slug, "rider_id": rider_not_in_squad,
                 "pcs_points": 30, "race_date": "2026-03-10", "is_itt": False,
                 "breakaway_kms": None, "profile_icon": "p2"},
            ],
            gt_squad=[
                {"team_id": team_id, "rider_id": rider_in_squad, "role": "sprinter",
                 "race_slug": "race/paris-nice/2026", "phase_id": None, "year": 2026,
                 "created_at": "2026-03-08T00:00:00Z", "removed_at": None},
            ],
            gt_roles=[
                {"team_id": team_id, "rider_id": rider_in_squad, "role": "sprinter",
                 "race_slug": "race/paris-nice/2026", "phase_id": None, "year": 2026,
                 "applied_at": "2026-03-08T00:00:00Z"},
            ],
        )

        calculate_daily_scores(sb, race_slugs=[paris_nice_slug])

        upserts = sb.upserts["rider_xp_daily"]
        rider_xp = {r["rider_id"]: r["xp_gained"] for r in upserts}

        # In-squad sprinter scored on p2 → ×1.5 sprinter multiplier on 40 pts = 60.
        assert rider_xp[rider_in_squad] == 60.0
        # Out-of-squad rider scored 0 (gated out of the loop by `continue`).
        assert rider_not_in_squad not in rider_xp or rider_xp[rider_not_in_squad] == 0

    def test_one_week_final_secondary_uses_40_10_5_scale(
        self, make_supabase_for_gt
    ):
        """Points/KOM/Youth finals on a 1-week race use [40, 10, 5], not [80, 20, 10]."""
        from scoring import calculate_daily_scores

        team_id = "11111111-1111-1111-1111-111111111111"
        rider_id = "22222222-2222-2222-2222-222222222222"
        race_slug_final = "race/paris-nice/2026/points"

        sb = make_supabase_for_gt(
            contracts=[_contract(team_id, rider_id, "11111111-aaaa-aaaa-aaaa-cccccccccccc")],
            race_results=[],  # final standings only, no stage points
            gt_squad=[
                {"team_id": team_id, "rider_id": rider_id, "role": "sprinter",
                 "race_slug": "race/paris-nice/2026", "phase_id": None, "year": 2026,
                 "created_at": "2026-03-08T00:00:00Z", "removed_at": None},
            ],
            gt_roles=[
                {"team_id": team_id, "rider_id": rider_id, "role": "sprinter",
                 "race_slug": "race/paris-nice/2026", "phase_id": None, "year": 2026,
                 "applied_at": "2026-03-08T00:00:00Z"},
            ],
            gt_final_classifications=[
                {"rider_id": rider_id, "race_slug": race_slug_final,
                 "classification_type": "points", "rank": 1, "race_date": "2026-03-15"},
            ],
        )

        calculate_daily_scores(sb, race_slugs=[race_slug_final])

        upserts = sb.upserts["rider_xp_daily"]
        # 1-week scale rank 1 = 40 base × 2 (sprinter matched on 'points') = 80.
        rider_xp = next(r for r in upserts if r["rider_id"] == rider_id and r["race_slug"] == race_slug_final)
        assert rider_xp["xp_gained"] == 80.0
```

> If the helpers `_contract` / `make_supabase_for_gt` don't already accept a `race_slug` field per row in `gt_squad` / `gt_roles` / a top-level `gt_final_classifications` list, extend the existing fixture in the same file with the minimal addition needed. Do NOT introduce a new fixture file.

- [ ] **Step 2: Run the new tests — confirm they currently fail (no scoring change yet)**

Wait — Tasks 5+6 already shipped the scoring change. So:

Run: `cd services/pcs-sync && .venv/bin/python -m pytest tests/test_scoring_gt.py::TestOneWeekSquadGating -v`
Expected: 2 passed. If they fail, debug — most likely cause: the fixture doesn't yet supply `race_slug` to the mocked `gt_squad`/`gt_role_assignments` query result, so the scoring loop's race_slug-keyed lookup misses.

### 7.2 — `tests/test_sync_race.py`

- [ ] **Step 3: Append one test**

At the bottom of `services/pcs-sync/tests/test_sync_race.py`:

```python
# ---------------------------------------------------------------------------
# Spec A A9 — import_final_classifications works for 1-week races
# ---------------------------------------------------------------------------

async def test_import_final_classifications_one_week_race():
    """1-week stage-races (Paris-Nice, etc.) have Points/KOM/Youth jerseys too.
    The importer reads the standings from {slug}/points|kom|youth and upserts
    into gt_final_classifications with the right scale-agnostic shape."""
    import sync_race

    rider_id = "11111111-2222-3333-4444-555555555555"
    fake_points_entries = [{"rider_url": "rider/some-sprinter", "rank": 1}]

    sb = make_supabase()
    # The importer first reads `riders` to map pcs_slug → id; seed that.
    sb._select_rows["riders"] = [{"id": rider_id, "pcs_slug": "rider/some-sprinter"}]

    class _FakeStage:
        def __init__(self, url, **kw): self.url = url
        def points(self): return fake_points_entries
        def kom(self):    return []
        def youth(self):  return []

    with _patch_fetch_html(), patch("sync_race.Stage", _FakeStage):
        result = await sync_race.import_final_classifications(
            sb, page=MagicMock(),
            race_slug="race/paris-nice/2026",
            race_name="Paris-Nice",
            race_date="2026-03-15",
        )

    assert result == {"points": 1, "kom": 0, "youth": 0}
    upserts = sb.upserts["gt_final_classifications"]
    assert len(upserts) == 1
    assert upserts[0]["race_slug"] == "race/paris-nice/2026/points"
    assert upserts[0]["rider_id"] == rider_id
    assert upserts[0]["rank"] == 1
```

Run: `cd services/pcs-sync && .venv/bin/python -m pytest tests/test_sync_race.py -k "import_final_classifications_one_week" -v`
Expected: 1 passed. The importer is untouched — this test merely confirms the existing function works on a 1-week slug (no GT-only gating inside `import_final_classifications` itself; the GT check lives in `run_pipeline.py:_maybe_import_finals`, which Task 6 already broadened).

### 7.3 — `tests/test_tactics.py`

Add coverage that the new per-race-kind lookup honors the one_week budget. The test is purely table-level (no place_tactic RPC call) — exercises the trigger via a direct INSERT in a test DB context, OR via an end-to-end mock of the supabase client. For simplicity, keep it at the unit level by inspecting `tactic_usage_limits` rows in-memory through the mock supabase.

- [ ] **Step 4: Append the test**

At the bottom of `services/pcs-sync/tests/test_tactics.py`:

```python
def test_tactic_usage_limits_seed_values():
    """The seed migration must populate exactly 10 rows (5 tactics × 2 kinds)
    with the locked-in numbers (Spec A A9)."""
    # We assert the EXPECTED values that the migration seeds. If they ever
    # change in the migration, this test forces a parallel update.
    expected = {
        ("gt",       "unleash"):        2,
        ("gt",       "overdrive"):      2,
        ("gt",       "call_the_bus"):   3,
        ("gt",       "nemesis_gc"):     1,
        ("gt",       "nemesis_sprint"): 1,
        ("one_week", "unleash"):        1,
        ("one_week", "overdrive"):      1,
        ("one_week", "call_the_bus"):   2,
        ("one_week", "nemesis_gc"):     1,
        ("one_week", "nemesis_sprint"): 1,
    }

    # Parse the migration file to extract the INSERT VALUES tuples — keeps the
    # test self-contained (no DB round-trip).
    import re
    from pathlib import Path
    sql = Path(__file__).resolve().parents[2].joinpath(
        "supabase/migrations/20260604000100_tactic_usage_limits.sql"
    ).read_text()
    seeds = re.findall(
        r"\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*(\d+)\s*\)", sql
    )
    seen = {(k, t): int(n) for k, t, n in seeds if k in ("gt", "one_week")}
    assert seen == expected, f"seed drift: {seen}"
```

Run: `cd services/pcs-sync && .venv/bin/python -m pytest tests/test_tactics.py -k "tactic_usage_limits_seed_values" -v`
Expected: 1 passed.

- [ ] **Step 5: Full suite — confirm no regression**

Run: `cd services/pcs-sync && .venv/bin/python -m pytest -q`
Expected: `195 passed` (191 P3a baseline + 2 from 7.1 + 1 from 7.2 + 1 from 7.3).

- [ ] **Step 6: Commit**

```bash
git add services/pcs-sync/tests/
git commit -m "test: 1-week squad gating + finals-secondary + tactic-limit seeds (Spec A A9)"
```

---

## Task 8: Regenerate TypeScript types

After Tasks 1-4 add a column to 3 tables and create a new table, the codegen needs a refresh. Done last so a single regeneration captures all schema deltas.

- [ ] **Step 1: Regenerate**

Run: `supabase gen types typescript --linked 2>/dev/null > apps/web/lib/database.types.ts`

(stderr suppressed — see "Lessons applied from P3a" at the top: without `2>/dev/null` the file gets a stray "Initialising login role..." line at the top + CLI version-warning at the bottom that breaks TypeScript parsing.)

- [ ] **Step 2: Sanity-check**

Run: `grep -n "race_slug" apps/web/lib/database.types.ts | head -20`
Expected: hits inside `gt_squad`, `gt_role_assignments`, `gt_tactic_activations` Row/Insert/Update interfaces (~9+ hits).

Run: `grep -n "tactic_usage_limits" apps/web/lib/database.types.ts | head -10`
Expected: 3+ hits (Row/Insert/Update).

Run: `cd apps/web && pnpm typecheck`
Expected: no errors. If existing front code references the legacy `gt_squad` shape without `race_slug`, the regenerated types should remain compatible because the column is nullable (Insert allows omitting it).

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/database.types.ts
git commit -m "chore(types): regenerate database types for Spec A A9 (race_slug + tactic_usage_limits)"
```

---

## Task 9: Documentation

**Files:**
- Modify: `docs/GAME_RULES.md` (§11 — `FINAL_SECONDARY_SCALE one_week`; §13 — per-race tactic limit table)
- Modify: `docs/ARCHITECTURE.md` (3 modified tables, 1 new table, RPC v2/v3)

- [ ] **Step 1: `docs/GAME_RULES.md` §11 — add the one_week scale**

Under §11 Game Constants, near the GT final scale, add:

```markdown
### Final secondary classifications scale (Spec A A2/A9)
- GT      : `[80, 20, 10]` (ranks 1 / 2 / 3 base XP, before role multiplier).
- 1-week  : `[40, 10, 5]`  (half-scale — shorter race, smaller payout).
- Multiplier on the matching role (×2 for points→sprinter, kom→climber; ×1.5 for youth→gc_leader); ×1.0 otherwise.
- Source : `services/pcs-sync/scoring.py:FINAL_SECONDARY_SCALE`.
```

- [ ] **Step 2: `docs/GAME_RULES.md` §13 — per-race tactic budget**

Replace the existing "tactic usage limit" subsection with:

```markdown
### Tactic usage per race (Spec A A9)

Per `(team, race)`, the max activations of each tactic depend on the race kind:

| Tactic          | GT (Giro/Tour/Vuelta) | 1-week stage race |
|-----------------|-----------------------|-------------------|
| Unleash         | 2                     | 1                 |
| Overdrive       | 2                     | 1                 |
| Call the Bus    | 3                     | 2                 |
| Nemesis GC      | 1                     | 1                 |
| Nemesis Sprint  | 1                     | 1                 |

Enforced by trigger `enforce_tactic_usage_limit` reading `public.tactic_usage_limits`.
```

- [ ] **Step 3: `docs/ARCHITECTURE.md` — table & RPC updates**

Under the Tables section, update the three table entries:

```markdown
- **`gt_squad`** — adds nullable `race_slug TEXT` (Spec A A9). New partial unique indexes on `(team_id, race_slug)` per role mirror the phase_id ones. Legacy Giro 2026 rows keep `race_slug = NULL`; Tour + Vuelta backfilled deterministically.
- **`gt_role_assignments`** — adds nullable `race_slug TEXT`. Index `idx_gt_role_team_race_slug`.
- **`gt_tactic_activations`** — adds nullable `race_slug TEXT`. New unique index `idx_gt_tactic_activations_by_slug` on `(team_id, race_slug, stage_slug)`.
- **`tactic_usage_limits`** — `(race_kind, tactic_type, max_per_race)`. Seeded for `gt` and `one_week`. Read by `enforce_tactic_usage_limit` trigger.
```

Under the RPCs section (or `place_tactic` / `gt_*` entries), add:

```markdown
- **`place_tactic`** — v3 (2026-06-02): adds optional `p_race_slug TEXT` trailing arg. Accepts 1-week stage races (slug regex `^race/[^/]+/\d{4}/stage-\d+$`); the hard `phase_id IN (4,6,8)` precondition is replaced by `infer_race_kind`. Preserves the P3a Nemesis profile-gating block verbatim.
- **`gt_add_to_squad` / `gt_remove_from_squad` / `gt_swap_slot` / `gt_assign_role`** — v2 (2026-06-02): each adds optional `p_race_slug TEXT` trailing arg. When supplied, scope is race_slug; when NULL, legacy `(phase_id, year)` scope used.
```

- [ ] **Step 4: Update MEMORY**

Append a line to `~/.claude/projects/-Users-jonathanschummers-Documents-WattHunter/memory/refonte_equilibrage_progress.md`:

> **P3b (Race Team 1-week, A9 data + scoring) ✅** — migrations `20260604000000-000300` (race_slug column + tactic_usage_limits + place_tactic v3 + gt_squad RPCs v2). scoring.py uses `_is_squad_race`; finals-secondary one_week scale [40,10,5] activated. 4 migrations on prod, 195 tests pass.

- [ ] **Step 5: Commit**

```bash
git add docs/GAME_RULES.md docs/ARCHITECTURE.md
git commit -m "docs: Race Team 1-week + per-race tactic limits (Spec A A9)"
```

---

## Task 10: Final verification

- [ ] **Step 1: Full pcs-sync suite**

Run: `cd services/pcs-sync && .venv/bin/python -m pytest -q`
Expected: `195 passed`.

- [ ] **Step 2: TS typecheck**

Run: `cd apps/web && pnpm typecheck`
Expected: no errors.

- [ ] **Step 3: TS lint**

Run: `cd apps/web && pnpm lint`
Expected: no errors.

- [ ] **Step 4: Prod sanity selects**

Run (after all four migrations are pushed):
```bash
docker exec -i supabase_db_WattHunter psql -U postgres -d postgres <<'SQL'
-- All 10 limit rows present
SELECT race_kind, tactic_type, max_per_race
FROM public.tactic_usage_limits
ORDER BY race_kind, tactic_type;

-- place_tactic v3 visible
\df public.place_tactic

-- Backfill of Tour + Vuelta on the 3 tables
SELECT 'gt_squad'                AS tbl, COUNT(*) FILTER (WHERE race_slug LIKE 'race/tour-de-france/%')  AS tour,
                                       COUNT(*) FILTER (WHERE race_slug LIKE 'race/vuelta-a-espana/%') AS vuelta
FROM public.gt_squad
UNION ALL
SELECT 'gt_role_assignments',     COUNT(*) FILTER (WHERE race_slug LIKE 'race/tour-de-france/%'),
                                  COUNT(*) FILTER (WHERE race_slug LIKE 'race/vuelta-a-espana/%')
FROM public.gt_role_assignments
UNION ALL
SELECT 'gt_tactic_activations',   COUNT(*) FILTER (WHERE race_slug LIKE 'race/tour-de-france/%'),
                                  COUNT(*) FILTER (WHERE race_slug LIKE 'race/vuelta-a-espana/%')
FROM public.gt_tactic_activations;
SQL
```
Expected: the limit table shows 10 rows; `\df place_tactic` shows the 8-arg overload; the backfill counts are non-zero for Tour + Vuelta and 0 for Giro (intentional — forward-only).

- [ ] **Step 5: Hand off via finishing-a-development-branch**

Per superpowers, complete the branch via `superpowers:finishing-a-development-branch` (PR vs merge decision is the user's).

---

## Open / known limitations

- **Giro 2026** : intentionally not backfilled (`race_slug = NULL` on existing rows). Any future read code that prefers `race_slug` MUST fall back to `phase_id`-keyed queries for the Giro. The scoring helpers in this plan already do this implicitly (the `_is_squad_race` predicate is GT-prefix-aware regardless of `race_slug` on the rows).
- **Tactic-limit drift** : the seed values are also asserted in `test_tactic_usage_limits_seed_values` (parses the migration file). If the limits are ever tuned in the migration, the test will block the change until the expectations are updated — by design.
- **1-week races without final jerseys** : some 1-week stage-races (rare ones) carry no Points/KOM/Youth jerseys. `import_final_classifications` already handles empty standings gracefully (returns counts of 0), so no extra gating needed.
- **Front not migrated** : per the locked scope, the front still calls the RPCs with the v1 signatures (no `p_race_slug`). It continues to work — the new arg is `DEFAULT NULL`. P3c will rewire the front to pass race_slug and enable 1-week Race Team tabs.
- **Concurrent tactic placement on different stages of the same race** : the new partial unique index `idx_gt_tactic_activations_by_slug` on `(team_id, race_slug, stage_slug)` is per-stage, so two activations on different stages of the same race don't collide — the budget check inside `enforce_tactic_usage_limit` is what gates the per-race total.
