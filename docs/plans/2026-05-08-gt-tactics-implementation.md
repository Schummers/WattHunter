# GT Tactics — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the 5-tactic Grand Tour layer (Unleash, Overdrive, Nemesis GC, Nemesis Sprint, Call the Bus) on top of the existing GT Mode V1a, with full scoring traceability and a 2-step Nemesis flow.

**Architecture:** New `gt_tactic_activations` table records each activation. Four traceability columns added to `rider_xp_daily` so every component of the scoring formula is stored and auditable. The Python scoring pipeline applies tactic modifiers when processing race results. Server actions go through a SECURITY DEFINER RPC for atomic validation. The UI lives inside the existing GT Team page (`/league/[leagueId]/team/gt`) using the design system v3 components.

**Tech Stack:** Postgres (Supabase) · Python 3.9 (pcs-sync) · Next.js 16 App Router · TypeScript strict · Tailwind v4 · Shadcn UI · Vitest · Playwright · pytest

**References (read before starting):**
- Design spec: `docs/plans/2026-05-08-gt-tactics-design.md`
- Wireframe (live, run `pnpm dev` then visit `/dev/gt-tactics-preview`): `apps/web/app/dev/gt-tactics-preview/preview-client.tsx`
- Existing GT Mode V1a: `apps/web/app/(game)/league/[leagueId]/team/gt/`
- Scoring pipeline: `services/pcs-sync/scoring.py`
- Design system v3: `docs/watthunter-design-system-v3.md` (read **before** any frontend work — Rule #1 in CLAUDE.md)
- Existing modal pattern: `apps/web/components/role-assign-sheet.tsx`
- Radio-button list pattern: `apps/web/app/(game)/league/[leagueId]/budget/marketplace/marketplace-client.tsx`

---

## Phase 0 — File Structure (read first)

### Files created

| Path | Responsibility |
|---|---|
| `supabase/migrations/20260508000000_gt_tactics_traceability.sql` | Add 4 columns to `rider_xp_daily` |
| `supabase/migrations/20260508000100_gt_tactic_activations.sql` | New table + RLS + usage-limit trigger + check constraints |
| `supabase/migrations/20260508000200_gt_squad_flexible.sql` | Allow squad swap during active GT (rule change §9) |
| `supabase/migrations/20260508000300_place_tactic_rpc.sql` | `place_tactic` SECURITY DEFINER RPC |
| `supabase/migrations/20260508000400_resolve_nemesis_rpc.sql` | `resolve_nemesis_for_stage` RPC called by pipeline |
| `supabase/migrations/_rollback/20260508*_rollback.sql` | Matching rollback files |
| `services/pcs-sync/tactics.py` | Pre-fetch active tactics + `compute_modifier()` helper |
| `services/pcs-sync/tests/test_tactics.py` | Unit tests for tactic modifiers |
| `apps/web/lib/tactics.ts` | Type defs + tactic catalog (id, name, max uses, etc.) |
| `apps/web/lib/gt-stages.ts` | Helpers to enumerate upcoming stages of a GT phase |
| `apps/web/components/tactic-card.tsx` | The mini-card displayed in the row |
| `apps/web/components/tactic-modal-shell.tsx` | Reusable bottom-sheet shell with sticky footer |
| `apps/web/components/tactic-stage-list.tsx` | Scrollable stage list with radio rows |
| `apps/web/components/tactic-boost-modal.tsx` | Modal for Unleash / Overdrive / Call the Bus |
| `apps/web/components/tactic-nemesis-modal.tsx` | 2-step Nemesis modal |
| `apps/web/components/nemesis-incoming-banner.tsx` | Banner shown when targeted |
| `apps/web/app/(game)/league/[leagueId]/team/gt/tactics/actions.ts` | Server actions (place_tactic, list activations, etc.) |
| `apps/web/app/(game)/league/[leagueId]/team/gt/tactics/__tests__/actions.test.ts` | Vitest |
| `apps/web/components/__tests__/tactic-card.test.tsx` | Vitest snapshot/render |
| `apps/web/e2e/gt-tactics.spec.ts` | Playwright e2e (smoke) |

### Files modified

| Path | What changes |
|---|---|
| `services/pcs-sync/scoring.py` | Populate new `gt_role_mult`, `gt_classif_bonus`, `nemesis_modifier`, `tactic_applied` columns. Apply tactic modifiers. Resolve Nemesis duels post-stage. |
| `apps/web/app/(game)/league/[leagueId]/team/gt/page.tsx` | Server-side: fetch active tactics + nemesis incoming alerts |
| `apps/web/app/(game)/league/[leagueId]/team/gt/gt-team-client.tsx` | Insert `<TeamTacticsSection />` between Sponsor Goals and Team Composition; render `<NemesisIncomingBanner />` at top |
| `apps/web/app/(game)/league/[leagueId]/team/gt/actions.ts` | Add `getTacticActivations()` + `getEligibleRivals()` helpers |
| `apps/web/lib/database.types.ts` | Regenerated after migrations |
| `services/pcs-sync/tests/test_scoring.py` | Update existing tests if any rely on `rider_xp_daily` columns (new columns have defaults but check assertions) |

### Files removed

| Path | Reason |
|---|---|
| `apps/web/app/dev/gt-tactics-preview/` | Wireframe scaffold — not for production. **Remove only at the very end** once production UI is live. |
| `apps/web/proxy.ts` | Revert the `/dev/` matcher exclusion added during wireframe phase |

---

## Phase 1 — Database Foundation

### Task 1: Migration — Traceability columns on `rider_xp_daily`

**Files:**
- Create: `supabase/migrations/20260508000000_gt_tactics_traceability.sql`
- Create: `supabase/migrations/_rollback/20260508000000_gt_tactics_traceability_rollback.sql`

- [ ] **Step 1.1: Write the forward migration**

```sql
-- supabase/migrations/20260508000000_gt_tactics_traceability.sql
-- Adds columns to rider_xp_daily so every component of the GT scoring
-- formula is stored: xp_gained = (raw_pcs_points × gt_role_mult × (1 + strategy_bonus)
-- + gt_classif_bonus) × remontada_mult × nemesis_modifier

ALTER TABLE rider_xp_daily
  ADD COLUMN IF NOT EXISTS gt_role_mult     NUMERIC(3,1) NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS gt_classif_bonus INT          NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nemesis_modifier NUMERIC(3,2) NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS tactic_applied   TEXT;

COMMENT ON COLUMN rider_xp_daily.gt_role_mult IS
  'Effective GT role multiplier applied (1.0 domestique, 1.5 most roles, 2.0 TT-on-ITT/Overdrive/Nemesis-attacker-won)';
COMMENT ON COLUMN rider_xp_daily.gt_classif_bonus IS
  'Daily classification bonus points (GC top10, points top5, KOM top3, ×1.5 if role-match)';
COMMENT ON COLUMN rider_xp_daily.nemesis_modifier IS
  'Nemesis duel modifier: 0.5 target lost, 0.75 attacker lost, 1.0 default, 1.25 target won';
COMMENT ON COLUMN rider_xp_daily.tactic_applied IS
  'Which tactic affected this rider on this stage (NULL if none)';
```

- [ ] **Step 1.2: Write the rollback**

```sql
-- supabase/migrations/_rollback/20260508000000_gt_tactics_traceability_rollback.sql
ALTER TABLE rider_xp_daily
  DROP COLUMN IF EXISTS tactic_applied,
  DROP COLUMN IF EXISTS nemesis_modifier,
  DROP COLUMN IF EXISTS gt_classif_bonus,
  DROP COLUMN IF EXISTS gt_role_mult;
```

- [ ] **Step 1.3: Apply locally and verify**

Run:
```bash
supabase db reset  # rebuilds DB from scratch
docker exec -i supabase_db_WattHunter psql -U postgres -d postgres \
  -c "SELECT column_name, data_type, column_default FROM information_schema.columns \
      WHERE table_name='rider_xp_daily' \
      AND column_name IN ('gt_role_mult','gt_classif_bonus','nemesis_modifier','tactic_applied');"
```

Expected: 4 rows returned with the correct types and defaults.

- [ ] **Step 1.4: Apply to remote**

Run: `supabase db push --linked`
Expected: Migration applied successfully.

- [ ] **Step 1.5: Commit**

```bash
git add supabase/migrations/20260508000000_gt_tactics_traceability.sql \
        supabase/migrations/_rollback/20260508000000_gt_tactics_traceability_rollback.sql
git commit -m "feat(db): add GT scoring traceability columns to rider_xp_daily"
```

---

### Task 2: Migration — `gt_tactic_activations` table

**Files:**
- Create: `supabase/migrations/20260508000100_gt_tactic_activations.sql`
- Create: `supabase/migrations/_rollback/20260508000100_gt_tactic_activations_rollback.sql`

- [ ] **Step 2.1: Write the forward migration**

```sql
-- supabase/migrations/20260508000100_gt_tactic_activations.sql
-- Records each tactic activation by a team during a GT phase.

CREATE TABLE gt_tactic_activations (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id                     UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  phase_id                    INT  NOT NULL,
  year                        INT  NOT NULL,
  tactic_type                 TEXT NOT NULL
    CHECK (tactic_type IN (
      'unleash', 'overdrive', 'call_the_bus', 'nemesis_gc', 'nemesis_sprint'
    )),
  stage_slug                  TEXT NOT NULL,
  -- Nemesis-only fields: both NULL or both NOT NULL
  nemesis_target_team_id      UUID REFERENCES teams(id) ON DELETE CASCADE,
  nemesis_target_role         TEXT CHECK (nemesis_target_role IN ('gc_leader', 'sprinter')),
  -- Resolution snapshot (filled by scoring pipeline)
  resolved_attacker_rider_id  UUID REFERENCES riders(id),
  resolved_target_rider_id    UUID REFERENCES riders(id),
  outcome                     TEXT CHECK (outcome IN ('attacker_won', 'target_won', 'no_resolution')),
  resolved_at                 TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (team_id, phase_id, year, stage_slug),

  CONSTRAINT nemesis_fields_consistent CHECK (
    (nemesis_target_team_id IS NULL AND nemesis_target_role IS NULL)
    OR
    (nemesis_target_team_id IS NOT NULL AND nemesis_target_role IS NOT NULL)
  ),

  CONSTRAINT nemesis_role_matches_type CHECK (
    (tactic_type = 'nemesis_gc'     AND nemesis_target_role = 'gc_leader')
    OR (tactic_type = 'nemesis_sprint' AND nemesis_target_role = 'sprinter')
    OR (tactic_type NOT IN ('nemesis_gc', 'nemesis_sprint') AND nemesis_target_role IS NULL)
  )
);

CREATE INDEX gt_tactic_activations_team_phase_idx
  ON gt_tactic_activations(team_id, phase_id, year);

CREATE INDEX gt_tactic_activations_stage_idx
  ON gt_tactic_activations(stage_slug)
  WHERE outcome IS NULL;

-- Enable RLS
ALTER TABLE gt_tactic_activations ENABLE ROW LEVEL SECURITY;

-- Read: any league member can see activations of any team in their league
CREATE POLICY gt_tactic_activations_read ON gt_tactic_activations
  FOR SELECT
  USING (
    team_id IN (
      SELECT t.id
      FROM teams t
      JOIN teams my ON my.league_id = t.league_id
      WHERE my.user_id = auth.uid()
    )
  );

-- Write: only via place_tactic RPC (SECURITY DEFINER) — nothing direct
-- (no INSERT/UPDATE/DELETE policy means no access from anon/authenticated)
```

- [ ] **Step 2.2: Write usage-limit trigger**

Continue in the same migration file:

```sql
-- Usage-limit enforcement: max uses per (team, phase, year, tactic_type)
CREATE OR REPLACE FUNCTION enforce_tactic_usage_limit()
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
  END;

  SELECT COUNT(*) INTO current_count
  FROM gt_tactic_activations
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
$$ LANGUAGE plpgsql;

CREATE TRIGGER gt_tactic_activations_usage_limit
  BEFORE INSERT ON gt_tactic_activations
  FOR EACH ROW
  EXECUTE FUNCTION enforce_tactic_usage_limit();
```

- [ ] **Step 2.3: Write the rollback**

```sql
-- supabase/migrations/_rollback/20260508000100_gt_tactic_activations_rollback.sql
DROP TRIGGER IF EXISTS gt_tactic_activations_usage_limit ON gt_tactic_activations;
DROP FUNCTION IF EXISTS enforce_tactic_usage_limit();
DROP TABLE IF EXISTS gt_tactic_activations;
```

- [ ] **Step 2.4: Apply locally + verify schema**

```bash
supabase db reset
docker exec -i supabase_db_WattHunter psql -U postgres -d postgres \
  -c "\d gt_tactic_activations"
```
Expected: table with 13 columns, both check constraints, indexes, and RLS enabled.

- [ ] **Step 2.5: Verify usage-limit trigger**

```bash
# Insert two unleash activations for the same team/phase — should succeed
# Third should fail with check_violation
docker exec -i supabase_db_WattHunter psql -U postgres -d postgres <<'SQL'
DO $$
DECLARE t UUID; ok BOOLEAN := false;
BEGIN
  SELECT id INTO t FROM teams LIMIT 1;
  IF t IS NULL THEN RAISE NOTICE 'no team to test with'; RETURN; END IF;
  INSERT INTO gt_tactic_activations(team_id,phase_id,year,tactic_type,stage_slug)
    VALUES (t,4,2026,'unleash','race/giro/2026/stage-1');
  INSERT INTO gt_tactic_activations(team_id,phase_id,year,tactic_type,stage_slug)
    VALUES (t,4,2026,'unleash','race/giro/2026/stage-2');
  BEGIN
    INSERT INTO gt_tactic_activations(team_id,phase_id,year,tactic_type,stage_slug)
      VALUES (t,4,2026,'unleash','race/giro/2026/stage-3');
  EXCEPTION WHEN check_violation THEN ok := true;
  END;
  IF NOT ok THEN RAISE EXCEPTION 'limit not enforced'; END IF;
  ROLLBACK;
END $$;
SQL
```
Expected: no errors, transaction rolled back.

- [ ] **Step 2.6: Apply to remote + commit**

```bash
supabase db push --linked
git add supabase/migrations/20260508000100_gt_tactic_activations.sql \
        supabase/migrations/_rollback/20260508000100_gt_tactic_activations_rollback.sql
git commit -m "feat(db): add gt_tactic_activations table with RLS and usage-limit trigger"
```

---

### Task 3: Migration — Flexible GT squad rule (§9)

**Files:**
- Create: `supabase/migrations/20260508000200_gt_squad_flexible.sql`
- Create: `supabase/migrations/_rollback/20260508000200_gt_squad_flexible_rollback.sql`

**Context:** Currently `gt_squad` allows INSERT only at phase init. The rule change lets a player add/remove riders from the squad at any time during the GT (cap remains 8). Same 11:00 CET cutoff applies to changes affecting the day's stage.

- [ ] **Step 3.1: Inspect current RLS**

Run:
```bash
docker exec -i supabase_db_WattHunter psql -U postgres -d postgres \
  -c "SELECT polname, polcmd FROM pg_policy WHERE polrelid = 'gt_squad'::regclass;"
```
Note current policies — we'll keep SELECT, replace INSERT/DELETE.

- [ ] **Step 3.2: Write forward migration**

```sql
-- supabase/migrations/20260508000200_gt_squad_flexible.sql
-- Allow squad changes during active GT phase, capped at 8 riders.
-- Cutoff: changes after 11:00 CET apply to the next stage (enforced
-- in the same way as gt_role_assignments).

-- Drop any existing INSERT/DELETE policy that restricts to phase init.
DROP POLICY IF EXISTS gt_squad_insert ON gt_squad;
DROP POLICY IF EXISTS gt_squad_delete ON gt_squad;

-- New policies: team owner can INSERT/DELETE during the active phase
CREATE POLICY gt_squad_insert ON gt_squad
  FOR INSERT
  WITH CHECK (
    team_id IN (SELECT id FROM teams WHERE user_id = auth.uid())
  );

CREATE POLICY gt_squad_delete ON gt_squad
  FOR DELETE
  USING (
    team_id IN (SELECT id FROM teams WHERE user_id = auth.uid())
  );

-- Cap-at-8 trigger
CREATE OR REPLACE FUNCTION enforce_gt_squad_cap()
RETURNS TRIGGER AS $$
DECLARE current_size INT;
BEGIN
  SELECT COUNT(*) INTO current_size
  FROM gt_squad
  WHERE team_id = NEW.team_id
    AND phase_id = NEW.phase_id
    AND year = NEW.year;
  IF current_size >= 8 THEN
    RAISE EXCEPTION 'GT squad already at max (8 riders)'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER gt_squad_cap_at_8
  BEFORE INSERT ON gt_squad
  FOR EACH ROW
  EXECUTE FUNCTION enforce_gt_squad_cap();

-- When a rider is removed from the squad, also clear their role
-- (so a re-add starts fresh as domestique).
CREATE OR REPLACE FUNCTION clear_role_on_squad_remove()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO gt_role_assignments(team_id, phase_id, year, rider_id, role, applied_at)
  VALUES (OLD.team_id, OLD.phase_id, OLD.year, OLD.rider_id, 'domestique', now());
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER gt_squad_clear_role_on_remove
  AFTER DELETE ON gt_squad
  FOR EACH ROW
  EXECUTE FUNCTION clear_role_on_squad_remove();
```

- [ ] **Step 3.3: Write rollback**

```sql
-- supabase/migrations/_rollback/20260508000200_gt_squad_flexible_rollback.sql
DROP TRIGGER IF EXISTS gt_squad_clear_role_on_remove ON gt_squad;
DROP TRIGGER IF EXISTS gt_squad_cap_at_8 ON gt_squad;
DROP FUNCTION IF EXISTS clear_role_on_squad_remove();
DROP FUNCTION IF EXISTS enforce_gt_squad_cap();
DROP POLICY IF EXISTS gt_squad_delete ON gt_squad;
DROP POLICY IF EXISTS gt_squad_insert ON gt_squad;
-- Recreate previous policies if any existed (check the prior migration)
```

- [ ] **Step 3.4: Apply, verify, commit**

```bash
supabase db reset
supabase db push --linked
git add supabase/migrations/20260508000200_gt_squad_flexible.sql \
        supabase/migrations/_rollback/20260508000200_gt_squad_flexible_rollback.sql
git commit -m "feat(db): allow flexible GT squad changes during active phase (cap 8)"
```

---

### Task 4: RPC — `place_tactic`

**Files:**
- Create: `supabase/migrations/20260508000300_place_tactic_rpc.sql`
- Create: `supabase/migrations/_rollback/20260508000300_place_tactic_rpc_rollback.sql`

- [ ] **Step 4.1: Write the RPC**

```sql
-- supabase/migrations/20260508000300_place_tactic_rpc.sql
-- Atomic tactic placement: validates eligibility, inserts the row.
-- Ownership: only team owner can call (validated via auth.uid()).

CREATE OR REPLACE FUNCTION place_tactic(
  p_team_id      UUID,
  p_phase_id     INT,
  p_year         INT,
  p_tactic_type  TEXT,
  p_stage_slug   TEXT,
  p_nemesis_target_team_id UUID DEFAULT NULL,
  p_nemesis_target_role    TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id  UUID;
  v_owner    UUID;
  v_attacker_xp NUMERIC;
  v_target_xp   NUMERIC;
  v_new_id   UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  -- Ownership check
  SELECT user_id INTO v_owner FROM teams WHERE id = p_team_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'team not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_owner != v_user_id THEN
    RAISE EXCEPTION 'not team owner' USING ERRCODE = '42501';
  END IF;

  -- Tactic-type validity (also enforced by table CHECK, but fail early)
  IF p_tactic_type NOT IN
       ('unleash','overdrive','call_the_bus','nemesis_gc','nemesis_sprint') THEN
    RAISE EXCEPTION 'invalid tactic_type %', p_tactic_type
      USING ERRCODE = 'check_violation';
  END IF;

  -- Nemesis-specific validations
  IF p_tactic_type IN ('nemesis_gc','nemesis_sprint') THEN
    IF p_nemesis_target_team_id IS NULL OR p_nemesis_target_role IS NULL THEN
      RAISE EXCEPTION 'nemesis tactics require a target team and role';
    END IF;

    -- Target must be in same league
    IF NOT EXISTS (
      SELECT 1 FROM teams t
      JOIN teams me ON me.league_id = t.league_id
      WHERE t.id = p_nemesis_target_team_id AND me.id = p_team_id
    ) THEN
      RAISE EXCEPTION 'target team not in same league' USING ERRCODE = '42501';
    END IF;

    -- Eligibility: target_gt_xp >= attacker_gt_xp (compare role-holders' GT XP)
    SELECT COALESCE(SUM(rxd.xp_gained), 0) INTO v_attacker_xp
    FROM gt_role_assignments ra
    JOIN rider_xp_daily rxd ON rxd.team_id = ra.team_id AND rxd.rider_id = ra.rider_id
    WHERE ra.team_id = p_team_id
      AND ra.phase_id = p_phase_id
      AND ra.year = p_year
      AND ra.role = (CASE p_tactic_type WHEN 'nemesis_gc' THEN 'gc_leader' ELSE 'sprinter' END)
      AND rxd.race_slug LIKE 'race/%/' || p_year || '/%'
      AND ra.applied_at = (
        SELECT MAX(applied_at) FROM gt_role_assignments
        WHERE team_id = ra.team_id AND rider_id = ra.rider_id
          AND phase_id = ra.phase_id AND year = ra.year
      );

    SELECT COALESCE(SUM(rxd.xp_gained), 0) INTO v_target_xp
    FROM gt_role_assignments ra
    JOIN rider_xp_daily rxd ON rxd.team_id = ra.team_id AND rxd.rider_id = ra.rider_id
    WHERE ra.team_id = p_nemesis_target_team_id
      AND ra.phase_id = p_phase_id
      AND ra.year = p_year
      AND ra.role = (CASE p_tactic_type WHEN 'nemesis_gc' THEN 'gc_leader' ELSE 'sprinter' END)
      AND rxd.race_slug LIKE 'race/%/' || p_year || '/%'
      AND ra.applied_at = (
        SELECT MAX(applied_at) FROM gt_role_assignments
        WHERE team_id = ra.team_id AND rider_id = ra.rider_id
          AND phase_id = ra.phase_id AND year = ra.year
      );

    IF v_target_xp < v_attacker_xp THEN
      RAISE EXCEPTION 'target must have >= your GT XP (you=%, target=%)',
        v_attacker_xp, v_target_xp;
    END IF;
  ELSE
    -- Non-nemesis: nemesis fields must be NULL
    IF p_nemesis_target_team_id IS NOT NULL OR p_nemesis_target_role IS NOT NULL THEN
      RAISE EXCEPTION 'nemesis fields must be NULL for non-nemesis tactics';
    END IF;
  END IF;

  -- Insert (table CHECK + usage-limit trigger handle the rest)
  INSERT INTO gt_tactic_activations(
    team_id, phase_id, year, tactic_type, stage_slug,
    nemesis_target_team_id, nemesis_target_role
  )
  VALUES (
    p_team_id, p_phase_id, p_year, p_tactic_type, p_stage_slug,
    p_nemesis_target_team_id, p_nemesis_target_role
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

REVOKE ALL ON FUNCTION place_tactic FROM PUBLIC;
GRANT EXECUTE ON FUNCTION place_tactic TO authenticated;
```

- [ ] **Step 4.2: Write rollback**

```sql
-- supabase/migrations/_rollback/20260508000300_place_tactic_rpc_rollback.sql
DROP FUNCTION IF EXISTS place_tactic(UUID, INT, INT, TEXT, TEXT, UUID, TEXT);
```

- [ ] **Step 4.3: Apply + smoke test**

```bash
supabase db reset
docker exec -i supabase_db_WattHunter psql -U postgres -d postgres \
  -c "SELECT proname FROM pg_proc WHERE proname='place_tactic';"
```
Expected: 1 row returned.

- [ ] **Step 4.4: Apply remote + commit**

```bash
supabase db push --linked
git add supabase/migrations/20260508000300_place_tactic_rpc.sql \
        supabase/migrations/_rollback/20260508000300_place_tactic_rpc_rollback.sql
git commit -m "feat(db): add place_tactic SECURITY DEFINER RPC with full validation"
```

---

### Task 5: Regenerate `database.types.ts`

**Files:**
- Modify: `apps/web/lib/database.types.ts`

- [ ] **Step 5.1: Regenerate**

```bash
supabase gen types typescript --linked > apps/web/lib/database.types.ts
```

- [ ] **Step 5.2: Verify**

```bash
grep -E "gt_tactic_activations|place_tactic" apps/web/lib/database.types.ts | head -5
```
Expected: type definitions for the table and RPC.

- [ ] **Step 5.3: Typecheck**

```bash
cd apps/web && pnpm typecheck
```
Expected: 0 errors.

- [ ] **Step 5.4: Commit**

```bash
git add apps/web/lib/database.types.ts
git commit -m "chore(types): regen DB types with gt_tactic_activations + place_tactic"
```

---

## Phase 2 — Scoring Pipeline (Python)

### Task 6: Create `tactics.py` helper module

**Files:**
- Create: `services/pcs-sync/tactics.py`
- Create: `services/pcs-sync/tests/test_tactics.py`

**Context:** Mirrors the structure of `remontada.py`. Pre-fetches active tactics for a stage and provides `compute_modifier(rider_id, role, tactic_row)` that returns `(gt_role_mult_override, nemesis_modifier, tactic_applied)`.

- [ ] **Step 6.1: Write failing tests first**

```python
# services/pcs-sync/tests/test_tactics.py
"""Unit tests for GT Tactic modifier computation."""
from __future__ import annotations
import pytest
from tactics import (
    compute_unleash_modifier,
    compute_overdrive_modifier,
    compute_call_bus_modifier,
    compute_nemesis_modifier,
)

# --- Unleash ---

def test_unleash_promotes_domestique_to_stage_hunter_role_mult():
    """Domestique with Unleash active → role_mult 1.5."""
    mult, applied = compute_unleash_modifier(role="domestique", race_slug="race/giro/2026/stage-3")
    assert mult == 1.5
    assert applied == "unleash"

def test_unleash_does_not_affect_existing_stage_hunters():
    """Stage Hunter is not boosted by Unleash (already 1.5)."""
    mult, applied = compute_unleash_modifier(role="stage_hunter", race_slug="race/giro/2026/stage-3")
    assert mult is None  # no override
    assert applied is None

def test_unleash_does_not_apply_to_gc_results():
    """Unleash applies only to stage results, not /gc."""
    mult, applied = compute_unleash_modifier(role="domestique", race_slug="race/giro/2026/gc")
    assert mult is None
    assert applied is None

# --- Overdrive ---

def test_overdrive_promotes_stage_hunter_to_2x():
    mult, applied = compute_overdrive_modifier(role="stage_hunter", race_slug="race/giro/2026/stage-3")
    assert mult == 2.0
    assert applied == "overdrive"

def test_overdrive_does_not_apply_to_domestiques():
    mult, applied = compute_overdrive_modifier(role="domestique", race_slug="race/giro/2026/stage-3")
    assert mult is None

# --- Call the Bus ---

def test_call_bus_includes_bench_riders_as_domestiques():
    """Bench rider gets role_mult 1.0 (was excluded entirely without Bus)."""
    include, applied = compute_call_bus_modifier(in_squad=False, race_slug="race/giro/2026/stage-3")
    assert include is True
    assert applied == "call_the_bus"

def test_call_bus_no_op_for_squad_riders():
    include, applied = compute_call_bus_modifier(in_squad=True, race_slug="race/giro/2026/stage-3")
    assert include is False
    assert applied is None

# --- Nemesis ---

def test_nemesis_attacker_won_overrides_role_mult_to_2():
    """Attacker gets gt_role_mult=2.0 (replaces 1.5), nemesis_modifier=1.0."""
    role_mult, nem_mod, applied = compute_nemesis_modifier(
        outcome="attacker_won",
        rider_role="attacker",
        tactic_type="nemesis_gc",
    )
    assert role_mult == 2.0
    assert nem_mod == 1.0
    assert applied == "nemesis_gc"

def test_nemesis_attacker_won_target_loses_50pct():
    """Target keeps role_mult=1.5, nemesis_modifier=0.5."""
    role_mult, nem_mod, applied = compute_nemesis_modifier(
        outcome="attacker_won",
        rider_role="target",
        tactic_type="nemesis_gc",
    )
    assert role_mult is None  # no override
    assert nem_mod == 0.5
    assert applied == "nemesis_gc"

def test_nemesis_target_won_attacker_loses_25pct():
    role_mult, nem_mod, applied = compute_nemesis_modifier(
        outcome="target_won",
        rider_role="attacker",
        tactic_type="nemesis_gc",
    )
    assert role_mult is None
    assert nem_mod == 0.75
    assert applied == "nemesis_gc"

def test_nemesis_target_won_target_gets_25pct_bonus():
    role_mult, nem_mod, applied = compute_nemesis_modifier(
        outcome="target_won",
        rider_role="target",
        tactic_type="nemesis_gc",
    )
    assert role_mult is None
    assert nem_mod == 1.25
    assert applied == "nemesis_gc"

def test_nemesis_no_resolution_no_effect():
    role_mult, nem_mod, applied = compute_nemesis_modifier(
        outcome="no_resolution",
        rider_role="attacker",
        tactic_type="nemesis_gc",
    )
    assert role_mult is None
    assert nem_mod == 1.0
    assert applied == "nemesis_gc"  # still tracked
```

- [ ] **Step 6.2: Run tests — verify they fail**

```bash
cd services/pcs-sync && python3 -m pytest tests/test_tactics.py -v
```
Expected: ImportError or "module not found".

- [ ] **Step 6.3: Implement `tactics.py`**

```python
# services/pcs-sync/tactics.py
"""GT Tactic modifier computation.

Each helper returns the override values to apply when a given tactic is
active for a stage. None means "no change from default".

Formula context (from rider_xp_daily):
  xp = (raw_pcs × gt_role_mult × (1 + strat) + classif) × remontada × nemesis
"""
from __future__ import annotations
from typing import Optional


def _is_stage_result(race_slug: str) -> bool:
    """Stage slugs end in /stage-N. GC final ends in /gc."""
    return "/stage-" in race_slug


def compute_unleash_modifier(
    role: str, race_slug: str
) -> tuple[Optional[float], Optional[str]]:
    """Domestiques scoring on a stage become Stage Hunters (×1.5)."""
    if role != "domestique":
        return (None, None)
    if not _is_stage_result(race_slug):
        return (None, None)
    return (1.5, "unleash")


def compute_overdrive_modifier(
    role: str, race_slug: str
) -> tuple[Optional[float], Optional[str]]:
    """Stage Hunters jump from ×1.5 to ×2.0 on stage results."""
    if role != "stage_hunter":
        return (None, None)
    if not _is_stage_result(race_slug):
        return (None, None)
    return (2.0, "overdrive")


def compute_call_bus_modifier(
    in_squad: bool, race_slug: str
) -> tuple[bool, Optional[str]]:
    """Bench riders are scored as domestiques (×1.0) for this stage.
    Returns (should_include, tactic_applied)."""
    if in_squad:
        return (False, None)
    if not _is_stage_result(race_slug):
        return (False, None)
    return (True, "call_the_bus")


def compute_nemesis_modifier(
    outcome: str,
    rider_role: str,  # "attacker" or "target"
    tactic_type: str,  # "nemesis_gc" or "nemesis_sprint"
) -> tuple[Optional[float], float, str]:
    """Returns (gt_role_mult_override, nemesis_modifier, tactic_applied).

    | Outcome       | Role     | role_mult | nemesis_mod |
    |---------------|----------|-----------|-------------|
    | attacker_won  | attacker | 2.0       | 1.0         |
    | attacker_won  | target   | None      | 0.5         |
    | target_won    | attacker | None      | 0.75        |
    | target_won    | target   | None      | 1.25        |
    | no_resolution | both     | None      | 1.0         |
    """
    assert rider_role in ("attacker", "target")
    assert outcome in ("attacker_won", "target_won", "no_resolution")
    assert tactic_type in ("nemesis_gc", "nemesis_sprint")

    if outcome == "no_resolution":
        return (None, 1.0, tactic_type)

    if outcome == "attacker_won":
        if rider_role == "attacker":
            return (2.0, 1.0, tactic_type)
        else:  # target
            return (None, 0.5, tactic_type)

    # target_won
    if rider_role == "attacker":
        return (None, 0.75, tactic_type)
    else:  # target
        return (None, 1.25, tactic_type)
```

- [ ] **Step 6.4: Run tests — all pass**

```bash
cd services/pcs-sync && python3 -m pytest tests/test_tactics.py -v
```
Expected: 11 passed.

- [ ] **Step 6.5: Commit**

```bash
git add services/pcs-sync/tactics.py services/pcs-sync/tests/test_tactics.py
git commit -m "feat(pcs): tactic modifier helpers + unit tests"
```

---

### Task 7: Pre-fetch active tactics in scoring pipeline

**Files:**
- Modify: `services/pcs-sync/scoring.py`

**Context:** Add a `prefetch_tactics()` step similar to the existing `gt_squad` and `gt_role_assignments` prefetches. Returns a dict keyed by `stage_slug` → list of `TacticActivation` rows. Read once per scoring run.

- [ ] **Step 7.1: Locate the prefetch section in scoring.py**

```bash
grep -n "gt_squad_members\|gt_roles\|gt_daily_classifications" services/pcs-sync/scoring.py | head -10
```
Note the line numbers — insert tactics prefetch right after the existing GT prefetches.

- [ ] **Step 7.2: Add the prefetch**

```python
# In services/pcs-sync/scoring.py — after the gt_roles prefetch block

# === Pre-fetch active tactics for the GT stages we are about to score ===
# Keyed by stage_slug → list of activations with team_id + tactic_type + nemesis fields.
gt_tactics: dict[str, list[dict]] = {}
tactics_resp = supabase.table("gt_tactic_activations").select(
    "id, team_id, phase_id, year, tactic_type, stage_slug,"
    " nemesis_target_team_id, nemesis_target_role,"
    " resolved_attacker_rider_id, resolved_target_rider_id,"
    " outcome, resolved_at"
).in_("stage_slug", list(stage_slugs_being_scored)).execute()

for row in tactics_resp.data or []:
    gt_tactics.setdefault(row["stage_slug"], []).append(row)
```

- [ ] **Step 7.3: Verify with a test run**

```bash
# Insert a fake activation, run scoring on a known stage, check the dict is populated
cd services/pcs-sync && python3 -c "
from scoring import score_run
score_run(stage_slugs=['race/giro-d-italia/2026/stage-1'], dry_run=True)
"
```
Expected: log line showing tactic count for the stage (add a debug log if needed).

- [ ] **Step 7.4: Commit**

```bash
git add services/pcs-sync/scoring.py
git commit -m "feat(pcs): pre-fetch gt_tactic_activations per scoring run"
```

---

### Task 8: Apply tactic modifiers in scoring formula

**Files:**
- Modify: `services/pcs-sync/scoring.py`

**Context:** This is the heart of the scoring change. For each rider being scored on a stage:
1. Determine if any tactic affects them (Unleash/Overdrive/Bus/Nemesis)
2. Compute `gt_role_mult` (potentially overridden) and `nemesis_modifier`
3. Persist all components (`raw_pcs_points`, `gt_role_mult`, `gt_classif_bonus`, `strategy_bonus`, `remontada_mult`, `nemesis_modifier`, `tactic_applied`) into `rider_xp_daily`.

- [ ] **Step 8.1: Modify the per-rider scoring loop**

Find the existing scoring section (around the `# else domestique → *= 1` comment from the GT V1a backlog spec). Replace the multiplier logic with this:

```python
# In services/pcs-sync/scoring.py — inside the per-rider loop

# Current (V1a) role mult based on assigned role:
base_role_mult = compute_base_role_mult(role, race_slug)  # existing helper, returns 1.0/1.5/2.0
gt_role_mult = base_role_mult
nemesis_modifier = 1.0
tactic_applied: str | None = None

# Check tactics for this stage
for tactic in gt_tactics.get(race_slug, []):
    if tactic["team_id"] != team_id:
        # Tactics from other teams only matter for Nemesis (target's perspective)
        if tactic["tactic_type"] in ("nemesis_gc", "nemesis_sprint"):
            target_team = tactic["nemesis_target_team_id"]
            target_rider = tactic.get("resolved_target_rider_id")
            if target_team == team_id and target_rider == rider_id:
                role_override, nem_mod, applied = compute_nemesis_modifier(
                    outcome=tactic.get("outcome") or "no_resolution",
                    rider_role="target",
                    tactic_type=tactic["tactic_type"],
                )
                if role_override is not None:
                    gt_role_mult = role_override
                # Cap at 0.5 if multiple attackers all won (spec §6.4)
                nemesis_modifier = min(nemesis_modifier, nem_mod)
                tactic_applied = applied
        continue

    # Tactic owned by this team
    t_type = tactic["tactic_type"]
    if t_type == "unleash":
        override, applied = compute_unleash_modifier(role, race_slug)
        if override is not None:
            gt_role_mult = override
            tactic_applied = applied
    elif t_type == "overdrive":
        override, applied = compute_overdrive_modifier(role, race_slug)
        if override is not None:
            gt_role_mult = override
            tactic_applied = applied
    elif t_type == "call_the_bus":
        # in_squad lookup happens earlier in the loop
        include, applied = compute_call_bus_modifier(in_squad, race_slug)
        if include:
            tactic_applied = applied
            # gt_role_mult already 1.0 by default for non-squad
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
            nemesis_modifier = nem_mod
            tactic_applied = applied
```

- [ ] **Step 8.2: Update the `rider_xp_daily` upsert to include new columns**

```python
xp_value = max(
    0,
    round(
        (raw_pcs_points * gt_role_mult * (1 + strategy_bonus) + gt_classif_bonus)
        * remontada_mult * nemesis_modifier
    ),
)

supabase.table("rider_xp_daily").upsert({
    "team_id": team_id,
    "rider_id": rider_id,
    "race_slug": race_slug,
    "raw_pcs_points": raw_pcs_points,
    "strategy_bonus": strategy_bonus,
    "remontada_mult": remontada_mult,
    "gt_role_mult": gt_role_mult,           # NEW
    "gt_classif_bonus": gt_classif_bonus,   # NEW
    "nemesis_modifier": nemesis_modifier,   # NEW
    "tactic_applied": tactic_applied,       # NEW
    "xp_gained": xp_value,
}, on_conflict="team_id,rider_id,race_slug").execute()
```

Note the `max(0, ...)` floor — `nemesis_modifier=0.5` could in theory create non-negative results, but the floor protects against future modifiers and rounding edge cases.

- [ ] **Step 8.3: Run existing scoring tests + add a test for the new columns**

```bash
cd services/pcs-sync && python3 -m pytest tests/ -v
```

Add a new test in `tests/test_scoring.py`:

```python
def test_scoring_persists_traceability_columns():
    """Every scored row must populate gt_role_mult, gt_classif_bonus, nemesis_modifier, tactic_applied."""
    # ...mock setup using existing test fixtures
    score_stage("race/giro-d-italia/2026/stage-1")
    rows = supabase.table("rider_xp_daily").select(
        "gt_role_mult, gt_classif_bonus, nemesis_modifier, tactic_applied"
    ).execute().data
    assert len(rows) > 0
    for r in rows:
        assert r["gt_role_mult"] is not None
        assert r["gt_classif_bonus"] is not None
        assert r["nemesis_modifier"] is not None
        # tactic_applied may be None if no tactic was active
```

- [ ] **Step 8.4: Commit**

```bash
git add services/pcs-sync/scoring.py services/pcs-sync/tests/test_scoring.py
git commit -m "feat(pcs): apply tactic modifiers in scoring formula + persist traceability"
```

---

### Task 9: Resolve Nemesis duels post-stage

**Files:**
- Create: `supabase/migrations/20260508000400_resolve_nemesis_rpc.sql`
- Create: `supabase/migrations/_rollback/20260508000400_resolve_nemesis_rpc_rollback.sql`
- Modify: `services/pcs-sync/scoring.py`

**Context:** After stage results are imported, the pipeline must resolve all unresolved Nemesis activations on that stage:
1. Snapshot the role-holders at cutoff time (most recent `applied_at` ≤ cutoff)
2. Compare their stage rank in `race_results`
3. Write `outcome` + `resolved_attacker_rider_id` + `resolved_target_rider_id` + `resolved_at`

This must happen **before** the per-rider scoring loop reads `gt_tactic_activations` (so the outcomes are visible).

- [ ] **Step 9.1: Write the RPC**

```sql
-- supabase/migrations/20260508000400_resolve_nemesis_rpc.sql
-- Resolves all unresolved nemesis activations for a given stage_slug.
-- Called by the scoring pipeline (service role) — not by clients.

CREATE OR REPLACE FUNCTION resolve_nemesis_for_stage(p_stage_slug TEXT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_act        gt_tactic_activations%ROWTYPE;
  v_attacker   UUID;
  v_target     UUID;
  v_a_rank     INT;
  v_t_rank     INT;
  v_role       TEXT;
  v_outcome    TEXT;
  v_count      INT := 0;
BEGIN
  FOR v_act IN
    SELECT * FROM gt_tactic_activations
    WHERE stage_slug = p_stage_slug
      AND outcome IS NULL
      AND tactic_type IN ('nemesis_gc','nemesis_sprint')
  LOOP
    v_role := CASE v_act.tactic_type
      WHEN 'nemesis_gc' THEN 'gc_leader' ELSE 'sprinter'
    END;

    -- Snapshot role-holder for attacker team at the latest applied_at
    SELECT rider_id INTO v_attacker
    FROM gt_role_assignments
    WHERE team_id = v_act.team_id
      AND phase_id = v_act.phase_id
      AND year = v_act.year
      AND role = v_role
    ORDER BY applied_at DESC
    LIMIT 1;

    -- Same for target team
    SELECT rider_id INTO v_target
    FROM gt_role_assignments
    WHERE team_id = v_act.nemesis_target_team_id
      AND phase_id = v_act.phase_id
      AND year = v_act.year
      AND role = v_role
    ORDER BY applied_at DESC
    LIMIT 1;

    -- If either role unassigned → no_resolution
    IF v_attacker IS NULL OR v_target IS NULL THEN
      UPDATE gt_tactic_activations
      SET outcome = 'no_resolution',
          resolved_at = now(),
          resolved_attacker_rider_id = v_attacker,
          resolved_target_rider_id = v_target
      WHERE id = v_act.id;
      v_count := v_count + 1;
      CONTINUE;
    END IF;

    -- Get stage ranks
    SELECT rank INTO v_a_rank FROM race_results
      WHERE race_slug = p_stage_slug AND rider_id = v_attacker;
    SELECT rank INTO v_t_rank FROM race_results
      WHERE race_slug = p_stage_slug AND rider_id = v_target;

    IF v_a_rank IS NULL OR v_t_rank IS NULL THEN
      v_outcome := 'no_resolution';
    ELSIF v_a_rank < v_t_rank THEN
      v_outcome := 'attacker_won';
    ELSE
      v_outcome := 'target_won';  -- ties favour the defender (spec §6.3)
    END IF;

    UPDATE gt_tactic_activations
    SET outcome = v_outcome,
        resolved_at = now(),
        resolved_attacker_rider_id = v_attacker,
        resolved_target_rider_id = v_target
    WHERE id = v_act.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION resolve_nemesis_for_stage(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION resolve_nemesis_for_stage(TEXT) TO service_role;
```

- [ ] **Step 9.2: Write rollback**

```sql
-- supabase/migrations/_rollback/20260508000400_resolve_nemesis_rpc_rollback.sql
DROP FUNCTION IF EXISTS resolve_nemesis_for_stage(TEXT);
```

- [ ] **Step 9.3: Call the RPC from `scoring.py`**

In `scoring.py`, **before** the per-rider scoring loop:

```python
# Resolve any unresolved Nemesis duels first, so the outcomes are visible
# during scoring of both attacker and target riders.
for stage_slug in stage_slugs_being_scored:
    supabase.rpc("resolve_nemesis_for_stage", {"p_stage_slug": stage_slug}).execute()

# Then re-fetch gt_tactics to get the resolved outcomes
# (the prefetch from Task 7 was before resolution)
gt_tactics = {}
tactics_resp = supabase.table("gt_tactic_activations").select(
    "id, team_id, phase_id, year, tactic_type, stage_slug,"
    " nemesis_target_team_id, nemesis_target_role,"
    " resolved_attacker_rider_id, resolved_target_rider_id,"
    " outcome, resolved_at"
).in_("stage_slug", list(stage_slugs_being_scored)).execute()
for row in tactics_resp.data or []:
    gt_tactics.setdefault(row["stage_slug"], []).append(row)
```

- [ ] **Step 9.4: Apply migration + smoke-test**

```bash
supabase db reset
supabase db push --linked
# Insert a fake activation + race_results, call the RPC, check outcome is set
```

- [ ] **Step 9.5: Commit**

```bash
git add supabase/migrations/20260508000400_resolve_nemesis_rpc.sql \
        supabase/migrations/_rollback/20260508000400_resolve_nemesis_rpc_rollback.sql \
        services/pcs-sync/scoring.py
git commit -m "feat(pcs): resolve_nemesis_for_stage RPC + integration in scoring loop"
```

---

### Task 10: Backfill script (idempotent)

**Files:**
- Create: `services/pcs-sync/backfill_traceability.py`

**Context:** If the scoring pipeline ran before Task 8 was deployed, existing `rider_xp_daily` rows have `gt_role_mult=1.0`, `gt_classif_bonus=0`, etc. — incorrect for stages already scored. This script recomputes those columns from existing data without changing `xp_gained`.

- [ ] **Step 10.1: Write the script**

```python
# services/pcs-sync/backfill_traceability.py
"""Recompute gt_role_mult and gt_classif_bonus for existing rider_xp_daily rows.
Idempotent: safe to run multiple times. Does NOT change xp_gained.
"""
from __future__ import annotations
import os
from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

def main():
    sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    # Fetch rows with default values (un-backfilled)
    rows = sb.table("rider_xp_daily").select(
        "id, team_id, rider_id, race_slug"
    ).eq("gt_role_mult", 1.0).eq("gt_classif_bonus", 0).execute().data or []
    print(f"Found {len(rows)} rows to backfill")

    for r in rows:
        # Reuse the helpers from scoring.py
        from scoring import compute_base_role_mult, compute_classif_bonus
        # (Move these helpers to a shared module if not already)
        role = lookup_role(sb, r["team_id"], r["rider_id"], r["race_slug"])
        gt_role_mult = compute_base_role_mult(role, r["race_slug"])
        gt_classif_bonus = compute_classif_bonus(sb, r["rider_id"], r["race_slug"])
        sb.table("rider_xp_daily").update({
            "gt_role_mult": gt_role_mult,
            "gt_classif_bonus": gt_classif_bonus,
        }).eq("id", r["id"]).execute()

    print(f"Backfilled {len(rows)} rows")

if __name__ == "__main__":
    main()
```

- [ ] **Step 10.2: Test locally on a small sample**

```bash
cd services/pcs-sync && python3 backfill_traceability.py
```
Expected: prints count, exits cleanly.

- [ ] **Step 10.3: Commit**

```bash
git add services/pcs-sync/backfill_traceability.py
git commit -m "feat(pcs): backfill script for gt_role_mult and gt_classif_bonus"
```

---

## Phase 3 — Server Actions (TypeScript)

### Task 11: Tactic catalog + types

**Files:**
- Create: `apps/web/lib/tactics.ts`

- [ ] **Step 11.1: Write the module**

```typescript
// apps/web/lib/tactics.ts
import { Zap, Rocket, Swords, Crosshair, Users, type LucideIcon } from "lucide-react";

export type TacticId =
  | "unleash"
  | "overdrive"
  | "nemesis_gc"
  | "nemesis_sprint"
  | "call_the_bus";

export type TacticState = "available" | "active_today" | "exhausted" | "disabled";

export interface TacticDef {
  id: TacticId;
  name: string;
  short: string;
  description: string;
  icon: LucideIcon;
  max: number;
}

export const TACTICS: readonly TacticDef[] = [
  {
    id: "unleash",
    name: "Unleash",
    short: "Domestiques → ×1.5",
    description:
      "Pick a stage. All your domestiques score as Stage Hunters (×1.5) for that stage only. Bypasses the 2-Stage-Hunter cap.",
    icon: Zap,
    max: 2,
  },
  {
    id: "overdrive",
    name: "Overdrive",
    short: "Stage Hunters → ×2.0",
    description:
      "Pick a stage. Your Stage Hunters jump from ×1.5 to ×2.0 for that stage only.",
    icon: Rocket,
    max: 2,
  },
  {
    id: "nemesis_gc",
    name: "Nemesis GC",
    short: "Duel a rival GC Leader",
    description:
      "Pick a rival team and a stage. Whoever holds the GC Leader role at 11:00 CET cutoff fights for each side — a last-minute swap changes the duel.",
    icon: Swords,
    max: 1,
  },
  {
    id: "nemesis_sprint",
    name: "Nemesis Sprint",
    short: "Duel a rival Sprinter",
    description:
      "Pick a rival team and a stage. Whoever holds the Sprinter role at 11:00 CET cutoff fights for each side — a last-minute swap changes the duel.",
    icon: Crosshair,
    max: 1,
  },
  {
    id: "call_the_bus",
    name: "Call the Bus",
    short: "+ bench riders",
    description:
      "Pick a stage. Bench riders score for that stage as domestiques (×1.0). Effective squad grows with your level.",
    icon: Users,
    max: 3,
  },
] as const;

export function findTactic(id: TacticId): TacticDef {
  const t = TACTICS.find((t) => t.id === id);
  if (!t) throw new Error(`Unknown tactic: ${id}`);
  return t;
}
```

- [ ] **Step 11.2: Commit**

```bash
git add apps/web/lib/tactics.ts
git commit -m "feat(web): tactic catalog + type definitions"
```

---

### Task 12: GT stages helper

**Files:**
- Create: `apps/web/lib/gt-stages.ts`

**Context:** Lists upcoming stages of the active GT. Used by both the boost modal and the Nemesis modal step 2.

- [ ] **Step 12.1: Write the helper**

```typescript
// apps/web/lib/gt-stages.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export interface GtStage {
  number: number;
  date: string; // ISO date
  slug: string; // e.g., "race/giro-d-italia/2026/stage-3"
  status: "past" | "today" | "upcoming";
  hasTacticActive?: boolean; // for the calling team
}

/**
 * Get upcoming stages of a GT phase, optionally annotated with whether
 * the team has already placed a tactic on each.
 */
export async function getGtStages(
  supabase: SupabaseClient<Database>,
  opts: { phaseId: 4 | 6 | 8; year: number; teamId: string }
): Promise<GtStage[]> {
  // Use existing race_results table (slug pattern: race/<gt-slug>/<year>/stage-N)
  const gtSlug = phaseToGtSlug(opts.phaseId);
  const prefix = `race/${gtSlug}/${opts.year}/stage-`;

  const { data: rows } = await supabase
    .from("race_results")
    .select("race_slug, race_date")
    .like("race_slug", `${prefix}%`)
    .order("race_date");

  if (!rows) return [];

  // Distinct slugs
  const seen = new Set<string>();
  const stages: GtStage[] = [];
  for (const r of rows) {
    if (seen.has(r.race_slug)) continue;
    seen.add(r.race_slug);
    const num = parseInt(r.race_slug.replace(prefix, ""), 10);
    const status = stageStatus(r.race_date);
    stages.push({
      number: num,
      date: r.race_date,
      slug: r.race_slug,
      status,
    });
  }

  // Annotate with hasTacticActive
  const { data: tactics } = await supabase
    .from("gt_tactic_activations")
    .select("stage_slug")
    .eq("team_id", opts.teamId)
    .eq("phase_id", opts.phaseId)
    .eq("year", opts.year);

  const activeSlugs = new Set((tactics ?? []).map((t) => t.stage_slug));
  for (const s of stages) {
    if (activeSlugs.has(s.slug)) s.hasTacticActive = true;
  }

  return stages.filter((s) => s.status !== "past");
}

function phaseToGtSlug(phaseId: 4 | 6 | 8): string {
  return { 4: "giro-d-italia", 6: "tour-de-france", 8: "vuelta-a-espana" }[phaseId];
}

function stageStatus(dateIso: string): "past" | "today" | "upcoming" {
  const today = new Date().toISOString().slice(0, 10);
  if (dateIso < today) return "past";
  if (dateIso === today) return "today";
  return "upcoming";
}
```

- [ ] **Step 12.2: Commit**

```bash
git add apps/web/lib/gt-stages.ts
git commit -m "feat(web): getGtStages helper to list upcoming stages of a GT"
```

---

### Task 13: Server actions for tactic placement

**Files:**
- Create: `apps/web/app/(game)/league/[leagueId]/team/gt/tactics/actions.ts`
- Create: `apps/web/app/(game)/league/[leagueId]/team/gt/tactics/__tests__/actions.test.ts`

- [ ] **Step 13.1: Write failing tests first**

```typescript
// apps/web/app/(game)/league/[leagueId]/team/gt/tactics/__tests__/actions.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase before importing actions
const { mockRpc, mockFrom } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve({
    rpc: mockRpc,
    from: mockFrom,
    auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
  }),
}));

import { placeTactic } from "../actions";

describe("placeTactic", () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockFrom.mockReset();
  });

  it("calls place_tactic RPC with the right params for a boost tactic", async () => {
    mockRpc.mockResolvedValueOnce({ data: "new-id-uuid", error: null });
    await placeTactic({
      teamId: "t1",
      phaseId: 4,
      year: 2026,
      tacticType: "unleash",
      stageSlug: "race/giro-d-italia/2026/stage-3",
    });
    expect(mockRpc).toHaveBeenCalledWith("place_tactic", {
      p_team_id: "t1",
      p_phase_id: 4,
      p_year: 2026,
      p_tactic_type: "unleash",
      p_stage_slug: "race/giro-d-italia/2026/stage-3",
      p_nemesis_target_team_id: null,
      p_nemesis_target_role: null,
    });
  });

  it("rejects nemesis without target", async () => {
    await expect(
      placeTactic({
        teamId: "t1",
        phaseId: 4,
        year: 2026,
        tacticType: "nemesis_gc",
        stageSlug: "race/giro-d-italia/2026/stage-3",
      })
    ).rejects.toThrow(/target/i);
  });

  it("forwards RPC errors", async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: "limit reached" } });
    await expect(
      placeTactic({
        teamId: "t1",
        phaseId: 4,
        year: 2026,
        tacticType: "unleash",
        stageSlug: "race/giro-d-italia/2026/stage-3",
      })
    ).rejects.toThrow(/limit reached/);
  });
});
```

- [ ] **Step 13.2: Run tests — verify they fail**

```bash
cd apps/web && pnpm vitest run app/\(game\)/league/\[leagueId\]/team/gt/tactics/__tests__/actions.test.ts
```
Expected: file-not-found error.

- [ ] **Step 13.3: Implement actions.ts**

```typescript
// apps/web/app/(game)/league/[leagueId]/team/gt/tactics/actions.ts
"use server";

import { z } from "zod/v4";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const PlaceTacticInput = z.object({
  teamId: z.uuid(),
  phaseId: z.union([z.literal(4), z.literal(6), z.literal(8)]),
  year: z.number().int().min(2025).max(2100),
  tacticType: z.enum([
    "unleash", "overdrive", "call_the_bus", "nemesis_gc", "nemesis_sprint",
  ]),
  stageSlug: z.string().min(1),
  nemesisTargetTeamId: z.uuid().optional(),
  nemesisTargetRole: z.enum(["gc_leader", "sprinter"]).optional(),
});

export type PlaceTacticInput = z.infer<typeof PlaceTacticInput>;

export async function placeTactic(input: PlaceTacticInput): Promise<string> {
  const parsed = PlaceTacticInput.parse(input);

  // Client-side guard: nemesis tactics require target
  if (
    (parsed.tacticType === "nemesis_gc" || parsed.tacticType === "nemesis_sprint") &&
    (!parsed.nemesisTargetTeamId || !parsed.nemesisTargetRole)
  ) {
    throw new Error("Nemesis tactics require a target team and role");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("place_tactic", {
    p_team_id: parsed.teamId,
    p_phase_id: parsed.phaseId,
    p_year: parsed.year,
    p_tactic_type: parsed.tacticType,
    p_stage_slug: parsed.stageSlug,
    p_nemesis_target_team_id: parsed.nemesisTargetTeamId ?? null,
    p_nemesis_target_role: parsed.nemesisTargetRole ?? null,
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/league/[leagueId]/team/gt`, "page");
  return data as string;
}

// === Read helpers ===

export async function listTacticActivations(opts: {
  teamId: string;
  phaseId: 4 | 6 | 8;
  year: number;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("gt_tactic_activations")
    .select("*")
    .eq("team_id", opts.teamId)
    .eq("phase_id", opts.phaseId)
    .eq("year", opts.year);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getEligibleRivals(opts: {
  leagueId: string;
  myTeamId: string;
  phaseId: 4 | 6 | 8;
  year: number;
  role: "gc_leader" | "sprinter";
}) {
  const supabase = await createClient();
  // 1. List all teams in the league except mine
  const { data: teams, error: teamsErr } = await supabase
    .from("teams")
    .select("id, name")
    .eq("league_id", opts.leagueId)
    .neq("id", opts.myTeamId);
  if (teamsErr) throw new Error(teamsErr.message);
  if (!teams) return [];

  // 2. For each team, look up the role-holder + their GT XP
  const result = [];
  for (const t of teams) {
    const { data: roleRow } = await supabase
      .from("gt_role_assignments")
      .select("rider_id, riders(full_name)")
      .eq("team_id", t.id)
      .eq("phase_id", opts.phaseId)
      .eq("year", opts.year)
      .eq("role", opts.role)
      .order("applied_at", { ascending: false })
      .limit(1)
      .single();

    if (!roleRow) {
      result.push({ teamId: t.id, teamName: t.name, leader: null, xp: 0 });
      continue;
    }

    const { data: xpRows } = await supabase
      .from("rider_xp_daily")
      .select("xp_gained")
      .eq("team_id", t.id)
      .eq("rider_id", roleRow.rider_id)
      .like("race_slug", `race/%/${opts.year}/%`);
    const xp = (xpRows ?? []).reduce((s, r) => s + (r.xp_gained ?? 0), 0);

    result.push({
      teamId: t.id,
      teamName: t.name,
      leader: { riderId: roleRow.rider_id, name: (roleRow.riders as { full_name: string }).full_name },
      xp,
    });
  }

  return result;
}

export async function getMyLeaderXp(opts: {
  teamId: string;
  phaseId: 4 | 6 | 8;
  year: number;
  role: "gc_leader" | "sprinter";
}): Promise<{ leader: { riderId: string; name: string } | null; xp: number }> {
  const supabase = await createClient();
  const { data: roleRow } = await supabase
    .from("gt_role_assignments")
    .select("rider_id, riders(full_name)")
    .eq("team_id", opts.teamId)
    .eq("phase_id", opts.phaseId)
    .eq("year", opts.year)
    .eq("role", opts.role)
    .order("applied_at", { ascending: false })
    .limit(1)
    .single();

  if (!roleRow) return { leader: null, xp: 0 };

  const { data: xpRows } = await supabase
    .from("rider_xp_daily")
    .select("xp_gained")
    .eq("team_id", opts.teamId)
    .eq("rider_id", roleRow.rider_id)
    .like("race_slug", `race/%/${opts.year}/%`);
  const xp = (xpRows ?? []).reduce((s, r) => s + (r.xp_gained ?? 0), 0);

  return {
    leader: { riderId: roleRow.rider_id, name: (roleRow.riders as { full_name: string }).full_name },
    xp,
  };
}
```

- [ ] **Step 13.4: Run tests — verify they pass**

```bash
cd apps/web && pnpm vitest run app/\(game\)/league/\[leagueId\]/team/gt/tactics/__tests__/actions.test.ts
```
Expected: 3 passed.

- [ ] **Step 13.5: Commit**

```bash
git add apps/web/app/\(game\)/league/\[leagueId\]/team/gt/tactics/
git commit -m "feat(web): server actions for tactic placement and rivals lookup"
```

---

## Phase 4 — UI Components

> **Reminder:** Read `docs/watthunter-design-system-v3.md` before any frontend code (Rule #1 in CLAUDE.md). The wireframe at `apps/web/app/dev/gt-tactics-preview/preview-client.tsx` is the visual reference — copy class names verbatim where they apply.

### Task 14: `TacticCard` component

**Files:**
- Create: `apps/web/components/tactic-card.tsx`
- Create: `apps/web/components/__tests__/tactic-card.test.tsx`

- [ ] **Step 14.1: Write failing tests**

```tsx
// apps/web/components/__tests__/tactic-card.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { TacticCard } from "../tactic-card";

describe("TacticCard", () => {
  const baseProps = {
    tacticId: "unleash" as const,
    used: 0,
    state: "available" as const,
    onClick: vi.fn(),
  };

  it("renders name, short description, and remaining count", () => {
    render(<TacticCard {...baseProps} />);
    expect(screen.getByText("Unleash")).toBeInTheDocument();
    expect(screen.getByText(/Domestiques/)).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument(); // 2 remaining of 2
  });

  it("shows Today badge when active_today", () => {
    render(<TacticCard {...baseProps} state="active_today" />);
    expect(screen.getByText("Today")).toBeInTheDocument();
  });

  it("disables button when exhausted", () => {
    render(<TacticCard {...baseProps} used={2} state="exhausted" />);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("disables button when state=disabled with reason", () => {
    render(
      <TacticCard
        {...baseProps}
        tacticId="nemesis_gc"
        state="disabled"
        disabledReason="No eligible rival"
      />
    );
    expect(screen.getByRole("button")).toBeDisabled();
    expect(screen.getByText("No eligible rival")).toBeInTheDocument();
  });
});
```

- [ ] **Step 14.2: Implement TacticCard**

Use the wireframe code as the source of truth. Copy from `apps/web/app/dev/gt-tactics-preview/preview-client.tsx` lines beginning with `function TacticCard(`. Adapt the props to take `tacticId: TacticId` instead of the full tactic def, and look up the def from `TACTICS`.

```tsx
// apps/web/components/tactic-card.tsx
"use client";
import { cn } from "@/lib/utils";
import { Tag } from "@/components/pill";
import { findTactic, type TacticId, type TacticState } from "@/lib/tactics";

interface Props {
  tacticId: TacticId;
  used: number;
  state: TacticState;
  disabledReason?: string;
  onClick: () => void;
}

export function TacticCard({ tacticId, used, state, disabledReason, onClick }: Props) {
  const tactic = findTactic(tacticId);
  const Icon = tactic.icon;
  const remaining = tactic.max - used;
  const isInteractive = state === "available" || state === "active_today";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!isInteractive}
      className={cn(
        "flex min-w-[140px] shrink-0 snap-start flex-col items-start gap-2 rounded-[var(--radius-lg)] border p-3 text-left transition-colors",
        state === "available" &&
          "border-[var(--border-default)] bg-[var(--bg-surface)] hover:border-[var(--border-hover)] hover:bg-[var(--bg-surface-hover)]",
        state === "active_today" &&
          "border-[var(--accent-default)] bg-[var(--badge-bg)]",
        state === "exhausted" &&
          "cursor-not-allowed border-[var(--border-subtle)] bg-[var(--bg-subtle)] opacity-50",
        state === "disabled" &&
          "cursor-not-allowed border-[var(--border-subtle)] bg-[var(--bg-subtle)] opacity-60"
      )}
      aria-label={`${tactic.name} — ${remaining} of ${tactic.max} uses remaining`}
    >
      <div className="flex w-full items-start justify-between">
        <Icon
          className={cn(
            "size-5",
            state === "active_today"
              ? "text-[var(--accent-default)]"
              : "text-[var(--text-mid)]"
          )}
        />
        {state === "active_today" && (
          <Tag variant="highlighted" className="text-[length:var(--type-micro)]">
            Today
          </Tag>
        )}
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)]">
          {tactic.name}
        </span>
        <span className="text-[length:var(--type-micro)] text-[var(--text-low)]">
          {tactic.short}
        </span>
      </div>
      <div className="mt-auto flex w-full items-baseline justify-between">
        <span className="font-mono text-[length:var(--type-stat-small)] font-bold tabular-nums text-[var(--text-high)]">
          {remaining}
          <span className="text-[length:var(--type-caption)] font-normal text-[var(--text-low)]">
            {" "}/ {tactic.max}
          </span>
        </span>
        {state === "disabled" && disabledReason && (
          <span className="text-[length:var(--type-micro)] text-[var(--text-low)]">
            {disabledReason}
          </span>
        )}
      </div>
    </button>
  );
}
```

- [ ] **Step 14.3: Run tests + commit**

```bash
cd apps/web && pnpm vitest run components/__tests__/tactic-card.test.tsx
```
Expected: 4 passed.

```bash
git add apps/web/components/tactic-card.tsx apps/web/components/__tests__/tactic-card.test.tsx
git commit -m "feat(web): TacticCard component with 4 visual states"
```

---

### Task 15: Modal shell + stage list + boost modal

**Files:**
- Create: `apps/web/components/tactic-modal-shell.tsx`
- Create: `apps/web/components/tactic-stage-list.tsx`
- Create: `apps/web/components/tactic-boost-modal.tsx`

**Context:** Copy the corresponding functions from the wireframe (`ModalShell`, `ModalHeader`, `ModalActions`, `StageList`, `BoostActivationModal`). They use semantic tokens, work with the design system, and were validated by the user.

- [ ] **Step 15.1: Extract `tactic-modal-shell.tsx`**

Copy `ModalShell`, `ModalHeader`, `ModalActions` from the wireframe. Export all three.

- [ ] **Step 15.2: Extract `tactic-stage-list.tsx`**

Copy `StageList` (with the `fillParent` prop). Replace the mock `STAGES` array with a `stages: GtStage[]` prop sourced from `getGtStages()`.

- [ ] **Step 15.3: Build `tactic-boost-modal.tsx`**

```tsx
// apps/web/components/tactic-boost-modal.tsx
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { findTactic, type TacticId } from "@/lib/tactics";
import type { GtStage } from "@/lib/gt-stages";
import { placeTactic } from "@/app/(game)/league/[leagueId]/team/gt/tactics/actions";
import { ModalShell, ModalHeader, ModalActions } from "./tactic-modal-shell";
import { StageList } from "./tactic-stage-list";

interface Props {
  tacticId: Exclude<TacticId, "nemesis_gc" | "nemesis_sprint">;
  used: number;
  teamId: string;
  phaseId: 4 | 6 | 8;
  year: number;
  stages: GtStage[];
  onClose: () => void;
}

export function TacticBoostModal({
  tacticId, used, teamId, phaseId, year, stages, onClose,
}: Props) {
  const tactic = findTactic(tacticId);
  const Icon = tactic.icon;
  const remaining = tactic.max - used;
  const [selectedStage, setSelectedStage] = useState<string>("");
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = () => {
    if (!selectedStage) return;
    setErr(null);
    startTransition(async () => {
      try {
        await placeTactic({
          teamId, phaseId, year,
          tacticType: tacticId,
          stageSlug: selectedStage,
        });
        router.refresh();
        onClose();
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : "Failed");
      }
    });
  };

  return (
    <ModalShell
      onClose={onClose}
      footer={
        <ModalActions
          onClose={onClose}
          onSubmit={handleSubmit}
          submitLabel={pending ? "Activating..." : "Activate"}
          submitDisabled={!selectedStage || pending}
        />
      }
    >
      <div className="flex h-full flex-col gap-4 p-4">
        <ModalHeader
          icon={<Icon className="size-5 text-[var(--accent-default)]" />}
          title={tactic.name}
          subtitle={`${remaining} / ${tactic.max} uses left`}
          subtitleMono
          onClose={onClose}
        />
        <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
          {tactic.description}
        </p>
        <div className="flex flex-1 flex-col gap-2 min-h-0">
          <span className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">
            Target stage
          </span>
          <StageList
            stages={stages}
            value={selectedStage}
            onChange={setSelectedStage}
            fillParent
          />
        </div>
        {err && (
          <p className="text-[length:var(--type-caption)] text-[var(--danger)]">{err}</p>
        )}
      </div>
    </ModalShell>
  );
}
```

- [ ] **Step 15.4: Quick render test**

```bash
cd apps/web && pnpm typecheck
```
Expected: 0 errors.

- [ ] **Step 15.5: Commit**

```bash
git add apps/web/components/tactic-modal-shell.tsx \
        apps/web/components/tactic-stage-list.tsx \
        apps/web/components/tactic-boost-modal.tsx
git commit -m "feat(web): boost activation modal (Unleash, Overdrive, Call the Bus)"
```

---

### Task 16: Nemesis modal — 2 steps

**Files:**
- Create: `apps/web/components/tactic-nemesis-modal.tsx`

**Context:** Copy the `NemesisModal`, `Step1Rivals`, `Step2Stage`, and `RivalRow` functions from the wireframe. Replace the mock `RIVAL_TEAMS` with a prop sourced from `getEligibleRivals()`.

- [ ] **Step 16.1: Build the component**

```tsx
// apps/web/components/tactic-nemesis-modal.tsx
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Swords } from "lucide-react";
import { findTactic } from "@/lib/tactics";
import type { GtStage } from "@/lib/gt-stages";
import { placeTactic } from "@/app/(game)/league/[leagueId]/team/gt/tactics/actions";
import { ModalShell, ModalHeader } from "./tactic-modal-shell";
import { StageList } from "./tactic-stage-list";
import { cn } from "@/lib/utils";

export interface EligibleRival {
  teamId: string;
  teamName: string;
  leader: { riderId: string; name: string } | null;
  xp: number;
}

interface Props {
  tacticId: "nemesis_gc" | "nemesis_sprint";
  used: number;
  teamId: string;
  phaseId: 4 | 6 | 8;
  year: number;
  stages: GtStage[];
  eligibleRivals: EligibleRival[];
  myLeader: { name: string; xp: number } | null;
  onClose: () => void;
}

export function TacticNemesisModal({
  tacticId, used, teamId, phaseId, year, stages, eligibleRivals, myLeader, onClose,
}: Props) {
  const tactic = findTactic(tacticId);
  const Icon = tactic.icon;
  const remaining = tactic.max - used;
  const isGc = tacticId === "nemesis_gc";
  const roleLabel = isGc ? "GC Leader" : "Sprinter";

  const [step, setStep] = useState<1 | 2>(1);
  const [selectedRival, setSelectedRival] = useState<string | null>(null);
  const [selectedStage, setSelectedStage] = useState<string>("");
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  const rival = eligibleRivals.find((r) => r.teamId === selectedRival);

  const declare = () => {
    if (!selectedRival || !selectedStage) return;
    setErr(null);
    startTransition(async () => {
      try {
        await placeTactic({
          teamId, phaseId, year,
          tacticType: tacticId,
          stageSlug: selectedStage,
          nemesisTargetTeamId: selectedRival,
          nemesisTargetRole: isGc ? "gc_leader" : "sprinter",
        });
        router.refresh();
        onClose();
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : "Failed");
      }
    });
  };

  // ===== Step 1 =====
  if (step === 1) {
    return (
      <ModalShell
        onClose={onClose}
        footer={
          <div className="flex flex-col-reverse gap-2 lg:flex-row lg:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-[length:var(--type-body)] font-medium text-[var(--text-mid)] hover:text-[var(--text-high)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={!selectedRival}
              className="rounded-[var(--radius-md)] bg-[var(--accent-default)] px-4 py-2.5 text-[length:var(--type-body)] font-semibold text-[var(--bg-app)] disabled:opacity-50"
            >
              Next
            </button>
          </div>
        }
      >
        <div className="flex h-full flex-col gap-4 p-4">
          <ModalHeader
            icon={<Icon className="size-5 text-[var(--accent-default)]" />}
            title={tactic.name}
            subtitle={`${remaining} / ${tactic.max} uses left · Step 1 of 2`}
            subtitleMono
            onClose={onClose}
          />
          <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
            {tactic.description}
          </p>
          {/* Risk warning */}
          <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--warning-border)] bg-[var(--warning-bg)] px-3 py-2.5">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--warning)]" />
            <div className="flex flex-col gap-1 text-[length:var(--type-caption)]">
              <span className="font-semibold text-[var(--text-high)]">
                This is a duel, not a guarantee
              </span>
              <span className="text-[var(--text-mid)]">
                <strong className="text-[var(--text-high)]">Win</strong> → you score ×2, they lose 50%. <br />
                <strong className="text-[var(--text-high)]">Lose</strong> → you lose 25%, they gain 25%.
              </span>
            </div>
          </div>
          {/* Your leader */}
          {myLeader && (
            <div className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-2">
              <div className="flex flex-col">
                <span className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">
                  Your {roleLabel}
                </span>
                <span className="text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)]">
                  {myLeader.name}
                </span>
              </div>
              <div className="flex flex-col items-end">
                <span className="font-mono text-[length:var(--type-stat-small)] font-bold tabular-nums text-[var(--text-high)]">
                  {myLeader.xp}
                </span>
                <span className="text-[length:var(--type-micro)] uppercase tracking-wide text-[var(--text-low)]">
                  GT XP
                </span>
              </div>
            </div>
          )}
          {/* Rival list */}
          <div className="flex min-h-0 flex-1 flex-col gap-1.5">
            <div className="flex items-baseline justify-between">
              <span className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">
                Rival team
              </span>
              <span className="text-[length:var(--type-micro)] text-[var(--text-low)]">
                ≥ your GT XP
              </span>
            </div>
            {eligibleRivals.length === 0 ? (
              <p className="rounded-[var(--radius-md)] bg-[var(--bg-subtle)] px-3 py-4 text-center text-[length:var(--type-caption)] text-[var(--text-mid)]">
                No rival team has matched or exceeded your GT XP yet.
              </p>
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-app)]">
                <div className="flex flex-col">
                  {eligibleRivals.map((r, i) => (
                    <RivalRow
                      key={r.teamId}
                      rival={r}
                      isSelected={selectedRival === r.teamId}
                      isFirst={i === 0}
                      onSelect={() => setSelectedRival(r.teamId)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </ModalShell>
    );
  }

  // ===== Step 2 =====
  return (
    <ModalShell
      onClose={onClose}
      footer={
        <div className="flex flex-col-reverse gap-2 lg:flex-row lg:justify-between">
          <button
            type="button"
            onClick={() => setStep(1)}
            className="flex items-center justify-center gap-1.5 px-4 py-2 text-[length:var(--type-body)] font-medium text-[var(--text-mid)] hover:text-[var(--text-high)]"
          >
            <ArrowLeft className="size-4" />
            Back
          </button>
          <button
            type="button"
            onClick={declare}
            disabled={!selectedStage || pending}
            className="rounded-[var(--radius-md)] bg-[var(--accent-default)] px-4 py-2.5 text-[length:var(--type-body)] font-semibold text-[var(--bg-app)] disabled:opacity-50"
          >
            {pending ? "Declaring..." : "Declare Nemesis"}
          </button>
        </div>
      }
    >
      <div className="flex h-full flex-col gap-4 p-4">
        <ModalHeader
          icon={<Icon className="size-5 text-[var(--accent-default)]" />}
          title={tactic.name}
          subtitle={`${remaining} / ${tactic.max} uses left · Step 2 of 2`}
          subtitleMono
          onClose={onClose}
        />
        <div className="flex items-center gap-2.5 rounded-[var(--radius-md)] border border-[var(--accent-default)] bg-[var(--badge-bg)] px-3 py-2.5">
          <Swords className="size-4 shrink-0 text-[var(--accent-default)]" />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">
              Target
            </span>
            <span className="truncate text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)]">
              {rival?.teamName}
              {rival?.leader && (
                <span className="font-normal text-[var(--text-mid)]">
                  {" "}· {rival.leader.name}
                </span>
              )}
            </span>
          </div>
          <span className="font-mono text-[length:var(--type-stat-small)] font-bold tabular-nums text-[var(--text-high)]">
            {rival?.xp}
          </span>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-1.5">
          <span className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">
            Target stage
          </span>
          <StageList stages={stages} value={selectedStage} onChange={setSelectedStage} fillParent />
        </div>
        {err && (
          <p className="text-[length:var(--type-caption)] text-[var(--danger)]">{err}</p>
        )}
      </div>
    </ModalShell>
  );
}

// === Rival row (radio button + team name + leader name + XP) ===

function RivalRow({
  rival,
  isSelected,
  isFirst,
  onSelect,
}: {
  rival: EligibleRival;
  isSelected: boolean;
  isFirst: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={!rival.leader}
      className={cn(
        "flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors",
        !isFirst && "border-t border-[var(--border-subtle)]",
        isSelected ? "bg-[var(--badge-bg)]" : "hover:bg-[var(--bg-surface-hover)]",
        !rival.leader && "cursor-not-allowed opacity-50"
      )}
    >
      <div
        role="radio"
        aria-checked={isSelected}
        className={cn(
          "flex size-[18px] shrink-0 items-center justify-center rounded-full border-2 transition-colors",
          isSelected
            ? "border-[var(--accent-default)] bg-[var(--accent-default)]"
            : "border-[var(--border-default)] bg-transparent"
        )}
      >
        {isSelected && <div className="size-[7px] rounded-full bg-[var(--bg-app)]" />}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)]">
          {rival.teamName}
        </span>
        <span className="truncate text-[length:var(--type-caption)] text-[var(--text-mid)]">
          {rival.leader?.name ?? "No leader assigned"}
        </span>
      </div>
      <div className="flex flex-col items-end">
        <span className="font-mono text-[length:var(--type-stat-small)] font-bold tabular-nums text-[var(--text-high)]">
          {rival.xp}
        </span>
        <span className="text-[length:var(--type-micro)] uppercase tracking-wide text-[var(--text-low)]">
          GT XP
        </span>
      </div>
    </button>
  );
}
```

- [ ] **Step 16.2: Typecheck + commit**

```bash
cd apps/web && pnpm typecheck
git add apps/web/components/tactic-nemesis-modal.tsx
git commit -m "feat(web): 2-step Nemesis modal (rival → stage) with risk warning"
```

---

### Task 17: Nemesis incoming banner

**Files:**
- Create: `apps/web/components/nemesis-incoming-banner.tsx`

- [ ] **Step 17.1: Build the component**

```tsx
// apps/web/components/nemesis-incoming-banner.tsx
"use client";
import { Bell } from "lucide-react";

export interface IncomingNemesis {
  attackerTeamName: string;
  role: "gc_leader" | "sprinter";
  stageNumber: number;
  stageDate: string;
  outcome: "attacker_won" | "target_won" | "no_resolution" | null; // null = not resolved
}

export function NemesisIncomingBanner({ incomings }: { incomings: IncomingNemesis[] }) {
  if (incomings.length === 0) return null;
  return (
    <div className="mx-4 flex flex-col gap-2">
      {incomings.map((n, i) => (
        <NemesisRow key={i} n={n} />
      ))}
    </div>
  );
}

function NemesisRow({ n }: { n: IncomingNemesis }) {
  const roleLabel = n.role === "gc_leader" ? "GC Leader" : "Sprinter";
  const isResolved = !!n.outcome;
  const won = n.outcome === "target_won";
  const lost = n.outcome === "attacker_won";

  let statusLine: React.ReactNode;
  if (!isResolved) {
    statusLine = (
      <>
        If they win, you lose 50%. If you win, you gain 25%.
      </>
    );
  } else if (won) {
    statusLine = <span className="text-[var(--success)]">You won the duel — +25%</span>;
  } else if (lost) {
    statusLine = <span className="text-[var(--danger)]">You lost the duel — −50%</span>;
  } else {
    statusLine = <span className="text-[var(--text-mid)]">Duel ended without resolution</span>;
  }

  return (
    <div className="flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--warning-border)] bg-[var(--warning-bg)] px-3 py-3">
      <Bell className="mt-0.5 size-4 shrink-0 text-[var(--warning)]" />
      <div className="flex flex-1 flex-col gap-1">
        <span className="text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)]">
          Nemesis incoming
        </span>
        <span className="text-[length:var(--type-caption)] text-[var(--text-mid)]">
          <span className="font-semibold text-[var(--text-high)]">{n.attackerTeamName}</span>{" "}
          targets your {roleLabel} on{" "}
          <span className="font-mono font-semibold tabular-nums text-[var(--text-high)]">
            S{n.stageNumber}
          </span>{" "}
          ({n.stageDate}). {statusLine}
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 17.2: Commit**

```bash
git add apps/web/components/nemesis-incoming-banner.tsx
git commit -m "feat(web): NemesisIncomingBanner with pre/post resolution states"
```

---

### Task 18: `TeamTacticsSection` — wires everything together

**Files:**
- Create: `apps/web/components/team-tactics-section.tsx`

- [ ] **Step 18.1: Build the section**

```tsx
// apps/web/components/team-tactics-section.tsx
"use client";
import { useState } from "react";
import { TACTICS, type TacticId, type TacticState } from "@/lib/tactics";
import { TacticCard } from "./tactic-card";
import { TacticBoostModal } from "./tactic-boost-modal";
import { TacticNemesisModal, type EligibleRival } from "./tactic-nemesis-modal";
import type { GtStage } from "@/lib/gt-stages";

export interface ActivationLite {
  tacticType: TacticId;
  stageSlug: string;
}

interface Props {
  teamId: string;
  phaseId: 4 | 6 | 8;
  year: number;
  activations: ActivationLite[];
  stages: GtStage[];
  eligibleGcRivals: EligibleRival[];
  eligibleSprintRivals: EligibleRival[];
  myGcLeader: { name: string; xp: number } | null;
  mySprinter: { name: string; xp: number } | null;
}

export function TeamTacticsSection({
  teamId, phaseId, year, activations, stages,
  eligibleGcRivals, eligibleSprintRivals, myGcLeader, mySprinter,
}: Props) {
  const [open, setOpen] = useState<TacticId | null>(null);
  const todayStageSlug = stages.find((s) => s.status === "today")?.slug;

  const stateOf = (id: TacticId): { used: number; state: TacticState; reason?: string } => {
    const used = activations.filter((a) => a.tacticType === id).length;
    const tactic = TACTICS.find((t) => t.id === id)!;
    if (used >= tactic.max) return { used, state: "exhausted" };
    const isActiveToday = todayStageSlug
      ? activations.some((a) => a.stageSlug === todayStageSlug && a.tacticType === id)
      : false;
    if (isActiveToday) return { used, state: "active_today" };
    if (id === "nemesis_gc") {
      if (!myGcLeader) return { used, state: "disabled", reason: "Assign a GC Leader" };
      if (eligibleGcRivals.length === 0) return { used, state: "disabled", reason: "No eligible rival" };
    }
    if (id === "nemesis_sprint") {
      if (!mySprinter) return { used, state: "disabled", reason: "Assign a Sprinter" };
      if (eligibleSprintRivals.length === 0) return { used, state: "disabled", reason: "No eligible rival" };
    }
    return { used, state: "available" };
  };

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between px-4">
        <h2 className="text-[length:var(--type-section)] font-semibold text-[var(--text-high)]">
          Team Tactics
        </h2>
        <span className="text-[length:var(--type-caption)] text-[var(--text-low)]">
          1 per day · cutoff 11:00 CET
        </span>
      </div>
      <div className="flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TACTICS.map((t) => {
          const s = stateOf(t.id);
          return (
            <TacticCard
              key={t.id}
              tacticId={t.id}
              used={s.used}
              state={s.state}
              disabledReason={s.reason}
              onClick={() => setOpen(t.id)}
            />
          );
        })}
      </div>

      {open && open !== "nemesis_gc" && open !== "nemesis_sprint" && (
        <TacticBoostModal
          tacticId={open}
          used={stateOf(open).used}
          teamId={teamId}
          phaseId={phaseId}
          year={year}
          stages={stages}
          onClose={() => setOpen(null)}
        />
      )}
      {(open === "nemesis_gc" || open === "nemesis_sprint") && (
        <TacticNemesisModal
          tacticId={open}
          used={stateOf(open).used}
          teamId={teamId}
          phaseId={phaseId}
          year={year}
          stages={stages}
          eligibleRivals={open === "nemesis_gc" ? eligibleGcRivals : eligibleSprintRivals}
          myLeader={open === "nemesis_gc" ? myGcLeader : mySprinter}
          onClose={() => setOpen(null)}
        />
      )}
    </section>
  );
}
```

- [ ] **Step 18.2: Commit**

```bash
git add apps/web/components/team-tactics-section.tsx
git commit -m "feat(web): TeamTacticsSection orchestrating cards + modals"
```

---

## Phase 5 — Page Integration

### Task 19: Wire into the GT Team page

**Files:**
- Modify: `apps/web/app/(game)/league/[leagueId]/team/gt/page.tsx`
- Modify: `apps/web/app/(game)/league/[leagueId]/team/gt/gt-team-client.tsx`

- [ ] **Step 19.1: Fetch tactic data server-side**

Edit `page.tsx`:

```tsx
// Inside the existing server component, after current data fetches
import { listTacticActivations, getEligibleRivals, getMyLeaderXp } from "./tactics/actions";
import { getGtStages } from "@/lib/gt-stages";
import { getIncomingNemesis } from "./tactics/actions"; // new helper — see step 19.3

const [activations, stages, gcRivals, sprintRivals, myGc, mySprinter, incomings] =
  await Promise.all([
    listTacticActivations({ teamId: team.id, phaseId, year }),
    getGtStages(supabase, { phaseId, year, teamId: team.id }),
    getEligibleRivals({ leagueId, myTeamId: team.id, phaseId, year, role: "gc_leader" }),
    getEligibleRivals({ leagueId, myTeamId: team.id, phaseId, year, role: "sprinter" }),
    getMyLeaderXp({ teamId: team.id, phaseId, year, role: "gc_leader" }),
    getMyLeaderXp({ teamId: team.id, phaseId, year, role: "sprinter" }),
    getIncomingNemesis({ teamId: team.id, phaseId, year }),
  ]);

return (
  <GtTeamClient
    /* ...existing props */
    activations={activations}
    stages={stages}
    eligibleGcRivals={gcRivals}
    eligibleSprintRivals={sprintRivals}
    myGcLeader={myGc.leader ? { name: myGc.leader.name, xp: myGc.xp } : null}
    mySprinter={mySprinter.leader ? { name: mySprinter.leader.name, xp: mySprinter.xp } : null}
    incomingNemesis={incomings}
  />
);
```

- [ ] **Step 19.2: Render in the client**

Edit `gt-team-client.tsx`:

```tsx
import { TeamTacticsSection } from "@/components/team-tactics-section";
import { NemesisIncomingBanner } from "@/components/nemesis-incoming-banner";

// At the top of the JSX (above Sponsor Goals):
{incomingNemesis.length > 0 && <NemesisIncomingBanner incomings={incomingNemesis} />}

// After Sponsor Goals, before Team Composition:
<TeamTacticsSection
  teamId={teamId}
  phaseId={phaseId}
  year={year}
  activations={activations}
  stages={stages}
  eligibleGcRivals={eligibleGcRivals}
  eligibleSprintRivals={eligibleSprintRivals}
  myGcLeader={myGcLeader}
  mySprinter={mySprinter}
/>
```

- [ ] **Step 19.3: Add `getIncomingNemesis` to actions.ts**

```typescript
// In apps/web/app/(game)/league/[leagueId]/team/gt/tactics/actions.ts

export async function getIncomingNemesis(opts: {
  teamId: string;
  phaseId: 4 | 6 | 8;
  year: number;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("gt_tactic_activations")
    .select(`
      tactic_type, stage_slug, outcome, resolved_at, created_at,
      team:team_id (id, name)
    `)
    .eq("nemesis_target_team_id", opts.teamId)
    .eq("phase_id", opts.phaseId)
    .eq("year", opts.year);
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) return [];

  // Resolve stage dates in one query (deduplicate slugs)
  const slugs = Array.from(new Set(data.map((d) => d.stage_slug)));
  const { data: stageRows } = await supabase
    .from("race_results")
    .select("race_slug, race_date")
    .in("race_slug", slugs);
  const dateBySlug = new Map<string, string>(
    (stageRows ?? []).map((r) => [r.race_slug, r.race_date])
  );

  // Hide stale resolved alerts (older than 24h post-resolution)
  const cutoff = Date.now() - 24 * 3600 * 1000;
  return data
    .filter((d) => !d.resolved_at || new Date(d.resolved_at).getTime() > cutoff)
    .map((d) => ({
      attackerTeamName: (d.team as { name: string }).name,
      role: d.tactic_type === "nemesis_gc" ? "gc_leader" as const : "sprinter" as const,
      stageNumber: parseStageNumber(d.stage_slug),
      stageDate: dateBySlug.get(d.stage_slug) ?? "",
      outcome: d.outcome ?? null,
    }));
}

function parseStageNumber(slug: string): number {
  const m = slug.match(/\/stage-(\d+)$/);
  return m ? parseInt(m[1], 10) : 0;
}
```

- [ ] **Step 19.4: Typecheck + commit**

```bash
cd apps/web && pnpm typecheck
git add apps/web/app/\(game\)/league/\[leagueId\]/team/gt/page.tsx \
        apps/web/app/\(game\)/league/\[leagueId\]/team/gt/gt-team-client.tsx \
        apps/web/app/\(game\)/league/\[leagueId\]/team/gt/tactics/actions.ts
git commit -m "feat(web): wire Team Tactics section + incoming Nemesis banner into GT Team page"
```

---

## Phase 6 — End-to-end test

### Task 20: Playwright e2e — happy path

**Files:**
- Create: `apps/web/e2e/gt-tactics.spec.ts`

- [ ] **Step 20.1: Write the test**

```typescript
// apps/web/e2e/gt-tactics.spec.ts
import { test, expect } from "@playwright/test";
import { signInAsTestUser } from "./helpers";

test("user can place an Unleash tactic on a stage", async ({ page }) => {
  await signInAsTestUser(page);
  await page.goto("/league/test-league-id/team/gt");

  // Open the Unleash card
  await page.getByRole("button", { name: /Unleash/i }).click();
  await expect(page.getByText(/Domestiques/)).toBeVisible();

  // Pick the next upcoming stage
  await page.getByRole("button", { name: /Stage \d+/ }).first().click();
  await page.getByRole("button", { name: /Activate/i }).click();

  // Card now shows decremented counter
  await expect(page.getByText(/1\s*\/\s*2/).first()).toBeVisible();
});

test("Nemesis flow — pick rival, pick stage, declare", async ({ page }) => {
  await signInAsTestUser(page);
  await page.goto("/league/test-league-id/team/gt");

  await page.getByRole("button", { name: /Nemesis GC/i }).click();
  // Step 1
  await expect(page.getByText(/duel, not a guarantee/i)).toBeVisible();
  await page.getByRole("button", { name: /Team \w+/ }).first().click();
  await page.getByRole("button", { name: /Next/i }).click();
  // Step 2
  await expect(page.getByText(/Step 2 of 2/)).toBeVisible();
  await page.getByRole("button", { name: /Stage \d+/ }).first().click();
  await page.getByRole("button", { name: /Declare Nemesis/i }).click();
  // Counter at 0/1
  await expect(page.getByText(/0\s*\/\s*1/).first()).toBeVisible();
});
```

- [ ] **Step 20.2: Run + commit**

```bash
cd apps/web && pnpm exec playwright test e2e/gt-tactics.spec.ts
```
Expected: 2 passed.

```bash
git add apps/web/e2e/gt-tactics.spec.ts
git commit -m "test(e2e): GT tactics happy path — Unleash + Nemesis flows"
```

---

## Phase 7 — Cleanup

### Task 21: Remove wireframe scaffold

**Files:**
- Delete: `apps/web/app/dev/gt-tactics-preview/`
- Modify: `apps/web/proxy.ts` (revert `/dev/` matcher exclusion)

- [ ] **Step 21.1: Delete preview folder**

```bash
rm -rf apps/web/app/dev/gt-tactics-preview/
# Remove the /dev/ folder if it's now empty
rmdir apps/web/app/dev/ 2>/dev/null || true
```

- [ ] **Step 21.2: Restore proxy matcher**

Edit `apps/web/proxy.ts` — remove `dev/|` from the matcher regex, restoring it to:
```typescript
matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
```

- [ ] **Step 21.3: Commit**

```bash
git add apps/web/app apps/web/proxy.ts
git commit -m "chore: remove wireframe scaffold and restore proxy matcher"
```

---

### Task 22: Update CLAUDE.md memory

**Files:**
- Modify: `~/.claude/projects/-Users-jonathanschummers-Documents-WattHunter/memory/MEMORY.md`

- [ ] **Step 22.1: Add a memory entry**

Append to MEMORY.md:

```markdown
## GT Tactics (shipped 2026-05-08)
- 5 tactics: Unleash (×1.5 domestiques), Overdrive (×2.0 stage hunters),
  Nemesis GC + Nemesis Sprint (PvP duel), Call the Bus (+ bench riders)
- Spec: `docs/plans/2026-05-08-gt-tactics-design.md`
- Plan: `docs/plans/2026-05-08-gt-tactics-implementation.md`
- New table: `gt_tactic_activations` (with usage-limit trigger)
- 4 new columns on `rider_xp_daily`: gt_role_mult, gt_classif_bonus,
  nemesis_modifier, tactic_applied → full scoring decomposition stored
- RPC: `place_tactic` (validation + insert), `resolve_nemesis_for_stage`
- Rule change: GT squad is now flexible (swap riders during active GT,
  cap 8) — prerequisite for Call the Bus
- Pipeline: tactics resolved BEFORE per-rider scoring loop reads them
```

- [ ] **Step 22.2: Commit (if MEMORY.md is in the repo, otherwise just save)**

---

## Self-Review Notes

After applying this plan end-to-end, run a coverage check against the spec:

| Spec section | Plan task |
|---|---|
| §2.1 Unleash | Task 6 (helper) + Task 8 (apply) + Task 14 (card) + Task 15 (modal) |
| §2.2 Overdrive | Task 6 + Task 8 + Task 14 + Task 15 |
| §2.3 Nemesis GC | Task 6 + Task 8 + Task 9 + Task 14 + Task 16 |
| §2.4 Nemesis Sprint | Task 6 + Task 8 + Task 9 + Task 14 + Task 16 |
| §2.5 Call the Bus | Task 6 + Task 8 + Task 14 + Task 15 |
| §3 Constraints | Task 2 (CHECK + trigger) + Task 18 (UI states) |
| §4.1 `gt_tactic_activations` | Task 2 |
| §4.2 `rider_xp_daily` columns | Task 1 |
| §5 Scoring formula | Task 8 |
| §6 Nemesis mechanics | Task 4 (RPC validation) + Task 9 (resolution) |
| §7.1 Placement on GT page | Task 19 |
| §7.2 Tactic cards | Task 14 |
| §7.3 Boost modal | Task 15 |
| §7.4 Nemesis modal | Task 16 |
| §7.5 Alerts | Task 17 + Task 19 |
| §8 Traceability | Task 1 + Task 8 |
| §9 Flexible squad | Task 3 |
| §10 Dependencies | Tasks 1-9 cover all backend, 14-19 cover all frontend |
| §11 Edge cases | Task 6 (DNF/DNS/locked stage), Task 9 (no resolution), Task 18 (disabled states) |
| §12 Deployment | Task 1 + Task 10 (backfill if late) |

---

## Open decisions (deferred — not blocking implementation)

These were flagged during brainstorming as out-of-scope for this plan but should be resolved before public launch:

- **Final tactic names** — currently using working names (Unleash, Overdrive, Nemesis GC/Sprint, Call the Bus). Decide before launch.
- **Icon migration** — wireframe uses Lucide; design system says Phosphor for gamification. Migrate to Phosphor at launch (search & replace in `lib/tactics.ts` only).
- **Cancelled stages refund** — spec §11 says "post-MVP". Currently a cancelled stage consumes the tactic usage.
- **Visibility of Nemesis to third parties** — current scope: only target sees the alert. Could later add a 🔥 badge on league ranking for active duels.
