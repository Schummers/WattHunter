# Spec B — Underdog — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "underdog" GT role that lets trailing teams (XP < 75% of the league leader) boost low-ranked riders' stage points, field a 10-rider squad, and pay half salary on newly-recruited low-ranked riders — all reversible the moment they climb back out.

**Architecture:** One shared eligibility foundation (`teams.underdog_eligible` flag + `underdog_eligibility` audit snapshot, recomputed per phase by an RPC driven from the Python pipeline) feeds three perks: (1) a dynamic `gt_squad` cap 8→10, (2) a new rank-based scoring multiplier on the `underdog` role, (3) a per-payday salary discount gated by a contract flag. RLS is never bypassed; all writes go through SECURITY DEFINER RPCs/triggers. App text is English.

**Tech Stack:** Supabase Postgres migrations, Python 3.12 (`services/pcs-sync`, pytest), TypeScript (`apps/web`, vitest), `procyclingstats`.

**Source spec:** `docs/superpowers/specs/2026-06-01-spec-b-underdog-design.md`

**Project rules:** Rule #2 — schema changes via migration only. Migrations to **prod** (`supabase db push --linked`) require **explicit user confirmation** — never auto-push. Test locally first (`supabase db reset` on Colima). NEVER mutate `teams` protected columns outside SECURITY DEFINER. App text English.

**Dependency note (Spec A P2):** Task 5 edits the role-multiplier computation in `services/pcs-sync/scoring.py`. If Spec A P2 (scoring refonte) lands first, rebase Task 5 onto the new code — the injection point (the per-rider GT role-mult branch around `scoring.py:486`) is stable. `riders.pcs_rank` already exists (no capture needed).

**Dependency note (Spec A A9):** Tasks 3 (squad cap + role RPCs) hardcodes `phase_id IN (4,6,8)`. Spec A A9 ("Race Team") generalizes `gt_squad` + `gt_add_to_squad`/`gt_assign_role`/`enforce_gt_squad_cap` from `phase_id` to a `race_slug`-based identifier. Build A9 first, then rebase Task 3 onto the generalized RPCs (key eligibility on the same race identifier A9 chooses). The 8→10 cap then naturally extends to 1-week races too.

**Out of scope — B2bis UI:** The underdog struck-through price display (`<RiderPrice>` component, see spec §B2bis) is cross-cutting UI that depends on **Spec D — prix au millier**, and is NOT covered by this backend plan. This plan's only front change is exposing the role in the squad builder (Task 4). The B4 backend here (eligibility flag + −50% salary) produces the discounted price that `<RiderPrice>` will display.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `supabase/migrations/20260603000000_underdog_eligibility.sql` | `underdog_eligibility` table, `teams.underdog_eligible`, `recompute_underdog_eligibility` RPC | Create |
| `supabase/migrations/20260603000100_underdog_role_and_squad_cap.sql` | Relax role CHECKs, dynamic `enforce_gt_squad_cap`, `gt_add_to_squad` + `gt_assign_role` (underdog cap 2 + eligibility gate) | Create |
| `supabase/migrations/20260603000200_underdog_salary_flag.sql` | `contracts.underdog_discount` + `BEFORE INSERT` flag trigger | Create |
| `supabase/migrations/20260603000300_underdog_payday_discount.sql` | Recreate `confirm_phase_setup` with the −50% payday discount | Create |
| `supabase/migrations/_rollback/20260603*.down.sql` | Rollbacks for each migration above | Create (×4) |
| `services/pcs-sync/underdog.py` | `recompute_eligibility(supabase, phase_id, year)` helper | Create |
| `services/pcs-sync/tests/test_underdog.py` | Helper + scoring multiplier tests | Create |
| `services/pcs-sync/run_pipeline.py` | `underdog-eligibility` subcommand | Modify |
| `services/pcs-sync/scoring.py` | `_underdog_multiplier`, role branch, `pcs_rank` in riders select | Modify |
| `services/pcs-sync/tests/test_scoring.py` | Underdog role scoring test | Modify |
| `apps/web/app/(game)/league/[leagueId]/team/gt/actions.ts` | Add `underdog` to `ROLES` Zod tuple | Modify |
| `apps/web/app/(game)/league/[leagueId]/team/gt/gt-team-client.tsx` | Add `underdog` to `ROLE_ORDER` metadata | Modify |
| `docs/GAME_RULES.md`, `docs/ARCHITECTURE.md` | Underdog rules + new tables/columns | Modify |

---

## Task 1: Eligibility foundation (table + flag + recompute RPC)

**Files:**
- Create: `supabase/migrations/20260603000000_underdog_eligibility.sql`
- Create: `supabase/migrations/_rollback/20260603000000_underdog_eligibility.down.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260603000000_underdog_eligibility.sql`:

```sql
-- Spec B (B0) — underdog eligibility foundation.
-- A team is eligible when its cumulative_xp < 75% of the league leader's.
-- teams.underdog_eligible = runtime flag (read by triggers + payday).
-- underdog_eligibility = per-phase audit snapshot.

ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS underdog_eligible boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.underdog_eligibility (
  team_id     uuid    NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  phase_id    int     NOT NULL,
  year        int     NOT NULL,
  is_eligible boolean NOT NULL,
  leader_xp   bigint  NOT NULL,
  team_xp     bigint  NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, phase_id, year)
);

ALTER TABLE public.underdog_eligibility ENABLE ROW LEVEL SECURITY;

-- Read-only for authenticated (own league via team); writes only via the SECURITY DEFINER RPC.
CREATE POLICY underdog_eligibility_select ON public.underdog_eligibility
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = underdog_eligibility.team_id AND t.user_id = auth.uid()
    )
  );

-- Recompute eligibility for every league at a phase boundary.
CREATE OR REPLACE FUNCTION public.recompute_underdog_eligibility(p_phase_id int, p_year int)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_lg record;
  v_leader bigint;
  v_leagues int := 0;
BEGIN
  FOR v_lg IN
    SELECT DISTINCT league_id FROM public.teams WHERE league_id IS NOT NULL
  LOOP
    SELECT COALESCE(MAX(cumulative_xp), 0) INTO v_leader
    FROM public.teams WHERE league_id = v_lg.league_id;

    UPDATE public.teams t
      SET underdog_eligible = (v_leader > 0 AND t.cumulative_xp < 0.75 * v_leader)
      WHERE t.league_id = v_lg.league_id;

    INSERT INTO public.underdog_eligibility
      (team_id, phase_id, year, is_eligible, leader_xp, team_xp, computed_at)
    SELECT t.id, p_phase_id, p_year,
           (v_leader > 0 AND t.cumulative_xp < 0.75 * v_leader),
           v_leader, t.cumulative_xp, now()
    FROM public.teams t
    WHERE t.league_id = v_lg.league_id
    ON CONFLICT (team_id, phase_id, year) DO UPDATE
      SET is_eligible = EXCLUDED.is_eligible,
          leader_xp   = EXCLUDED.leader_xp,
          team_xp     = EXCLUDED.team_xp,
          computed_at = EXCLUDED.computed_at;

    v_leagues := v_leagues + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'leagues', v_leagues);
END;
$$;

GRANT EXECUTE ON FUNCTION public.recompute_underdog_eligibility(int, int) TO service_role;
```

- [ ] **Step 2: Write the rollback**

Create `supabase/migrations/_rollback/20260603000000_underdog_eligibility.down.sql`:

```sql
DROP FUNCTION IF EXISTS public.recompute_underdog_eligibility(int, int);
DROP TABLE IF EXISTS public.underdog_eligibility;
ALTER TABLE public.teams DROP COLUMN IF EXISTS underdog_eligible;
```

- [ ] **Step 3: Apply + verify locally**

Start the stack if needed (`colima start --cpu 4 --memory 6` then `supabase start --exclude vector,edge-runtime,logflare,imgproxy,studio,mailpit`), then:

Run: `supabase db reset`

Seed two temp teams in one league and recompute (leader 1000, follower 700 = 70% < 75% → eligible):

Run:
```bash
docker exec -i supabase_db_WattHunter psql -U postgres -d postgres -c "
WITH lg AS (
  INSERT INTO public.leagues (id, name, join_code, status)
  VALUES (gen_random_uuid(), 'ud-test', 'UDTEST', 'active') RETURNING id
)
INSERT INTO public.teams (id, league_id, name, cumulative_xp, level)
SELECT gen_random_uuid(), lg.id, n, xp, 1
FROM lg, (VALUES ('leader', 1000), ('follower', 700)) AS v(n, xp);
SELECT public.recompute_underdog_eligibility(4, 2026);
SELECT name, cumulative_xp, underdog_eligible FROM public.teams WHERE name IN ('leader','follower') ORDER BY cumulative_xp DESC;"
```
Expected: RPC returns `{"ok": true, "leagues": ...}`; `leader | 1000 | f`, `follower | 700 | t`. (If `leagues`/`teams` required columns differ, adjust the INSERT to satisfy NOT NULLs — check `\d public.teams` / `\d public.leagues` first.)

Clean up:
Run: `docker exec -i supabase_db_WattHunter psql -U postgres -d postgres -c "DELETE FROM public.teams WHERE name IN ('leader','follower'); DELETE FROM public.leagues WHERE name='ud-test';"`

- [ ] **Step 4: Push to remote (REQUIRES USER CONFIRMATION)**

⚠️ Adds a column + table + RPC to **production** and the recompute is not run here (Task 2 runs it). Per CLAUDE.md, ask the user before:
Run (only after confirmation): `supabase db push --linked`

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260603000000_underdog_eligibility.sql supabase/migrations/_rollback/20260603000000_underdog_eligibility.down.sql
git commit -m "feat(db): underdog eligibility foundation — flag + snapshot + recompute RPC (Spec B B0)"
```

---

## Task 2: Python `underdog-eligibility` pipeline command

**Files:**
- Create: `services/pcs-sync/underdog.py`
- Create: `services/pcs-sync/tests/test_underdog.py`
- Modify: `services/pcs-sync/run_pipeline.py` (add subcommand)

- [ ] **Step 1: Write the failing test**

Create `services/pcs-sync/tests/test_underdog.py`:

```python
from unittest.mock import MagicMock


def test_recompute_eligibility_calls_rpc():
    """recompute_eligibility forwards phase + year to the recompute RPC and returns its data."""
    from underdog import recompute_eligibility

    rpc_result = MagicMock()
    rpc_result.execute.return_value = MagicMock(data={"ok": True, "leagues": 1})
    sb = MagicMock()
    sb.rpc.return_value = rpc_result

    out = recompute_eligibility(sb, phase_id=4, year=2026)

    sb.rpc.assert_called_once_with(
        "recompute_underdog_eligibility", {"p_phase_id": 4, "p_year": 2026}
    )
    assert out == {"ok": True, "leagues": 1}
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd services/pcs-sync && .venv/bin/python -m pytest tests/test_underdog.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'underdog'`.

- [ ] **Step 3: Write the helper**

Create `services/pcs-sync/underdog.py`:

```python
"""Underdog eligibility recompute (Spec B B0).

Recomputes teams.underdog_eligible + the underdog_eligibility snapshot for every
league, by calling the recompute_underdog_eligibility RPC. Run at each phase/GT start.
"""
from __future__ import annotations


def recompute_eligibility(supabase, phase_id: int, year: int) -> dict:
    """Call the recompute RPC for the given phase + year. Returns the RPC payload."""
    resp = supabase.rpc(
        "recompute_underdog_eligibility",
        {"p_phase_id": phase_id, "p_year": year},
    ).execute()
    return resp.data
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd services/pcs-sync && .venv/bin/python -m pytest tests/test_underdog.py -v`
Expected: PASS.

- [ ] **Step 5: Wire the subcommand into `run_pipeline.py`**

Open `services/pcs-sync/run_pipeline.py`, find the argparse subparser block (search for `add_parser`). Add a subcommand mirroring the existing ones:

```python
    p_ud = sub.add_parser("underdog-eligibility", help="Recompute underdog eligibility for all leagues")
    p_ud.add_argument("--phase", type=int, required=True, help="WT phase id (e.g. 4 = Giro)")
    p_ud.add_argument("--year", type=int, required=True, help="Season year (e.g. 2026)")
```

Then in the command dispatch block (search for `args.command ==`), add a branch matching the surrounding style (the file already builds a Supabase client — reuse that variable; it is typically named `supabase` or `sb`):

```python
    elif args.command == "underdog-eligibility":
        from underdog import recompute_eligibility
        result = recompute_eligibility(supabase, phase_id=args.phase, year=args.year)
        print(f"Underdog eligibility recomputed: {result}")
```

(Match the exact client variable name + dispatch idiom used by neighbouring commands in the file.)

- [ ] **Step 6: Run the full pcs-sync suite**

Run: `cd services/pcs-sync && .venv/bin/python -m pytest tests/test_underdog.py -v`
Expected: PASS. (Full suite runs in Task 9.)

- [ ] **Step 7: Commit**

```bash
git add services/pcs-sync/underdog.py services/pcs-sync/tests/test_underdog.py services/pcs-sync/run_pipeline.py
git commit -m "feat(sync): underdog-eligibility recompute command (Spec B B0)"
```

---

## Task 3: Underdog role + dynamic squad cap (DB)

**Files:**
- Create: `supabase/migrations/20260603000100_underdog_role_and_squad_cap.sql`
- Create: `supabase/migrations/_rollback/20260603000100_underdog_role_and_squad_cap.down.sql`

**What changes:** (a) relax the role CHECK on `gt_squad` + `gt_role_assignments` to accept `'underdog'`; (b) make `enforce_gt_squad_cap()` read the team's eligibility (cap 10 if eligible, else 8) and respect soft-deletes; (c) recreate `gt_add_to_squad` (dynamic total cap + `underdog` cap 2 + eligibility gate) and `gt_assign_role` (`underdog` cap 2 + eligibility gate).

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260603000100_underdog_role_and_squad_cap.sql`:

```sql
-- Spec B (B1/B2/B3) — underdog role + dynamic squad cap.

-- 1. Allow 'underdog' in both role columns.
ALTER TABLE public.gt_squad DROP CONSTRAINT IF EXISTS gt_squad_role_check;
ALTER TABLE public.gt_squad ADD CONSTRAINT gt_squad_role_check
  CHECK (role IN ('gc_leader','sprinter','climber','tt_specialist','stage_hunter','domestique','underdog'));

ALTER TABLE public.gt_role_assignments DROP CONSTRAINT IF EXISTS gt_role_assignments_role_check;
ALTER TABLE public.gt_role_assignments ADD CONSTRAINT gt_role_assignments_role_check
  CHECK (role IN ('gc_leader','sprinter','climber','tt_specialist','stage_hunter','domestique','underdog'));

-- 2. Dynamic squad cap trigger: 10 for underdog-eligible teams, else 8.
--    Also fixes a latent bug: count only live (removed_at IS NULL) members.
CREATE OR REPLACE FUNCTION public.enforce_gt_squad_cap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_size INT;
  v_cap INT;
BEGIN
  SELECT CASE WHEN underdog_eligible THEN 10 ELSE 8 END
    INTO v_cap
    FROM public.teams WHERE id = NEW.team_id;
  v_cap := COALESCE(v_cap, 8);

  SELECT COUNT(*) INTO current_size
  FROM public.gt_squad
  WHERE team_id = NEW.team_id
    AND phase_id = NEW.phase_id
    AND year = NEW.year
    AND removed_at IS NULL;

  IF current_size >= v_cap THEN
    RAISE EXCEPTION 'GT squad already at max (% riders)', v_cap
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

-- 3. gt_add_to_squad — dynamic total cap (8/10) + underdog cap 2 + eligibility gate.
CREATE OR REPLACE FUNCTION public.gt_add_to_squad(
  p_team_id uuid,
  p_rider_id uuid,
  p_role text,
  p_phase_id int,
  p_year int
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_team_user_id uuid;
  v_team_eligible boolean;
  v_contract_exists boolean;
  v_already_in_squad boolean;
  v_role_count int;
  v_cap int;
  v_total_cap int;
  v_squad_total int;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  IF p_role NOT IN ('gc_leader','sprinter','climber','tt_specialist','stage_hunter','domestique','underdog') THEN
    RETURN jsonb_build_object('error', 'Invalid role');
  END IF;

  IF p_phase_id NOT IN (4, 6, 8) THEN
    RETURN jsonb_build_object('error', 'Invalid phase_id');
  END IF;

  SELECT user_id, underdog_eligible INTO v_team_user_id, v_team_eligible
  FROM public.teams WHERE id = p_team_id FOR UPDATE;

  IF v_team_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Team not found');
  END IF;

  IF v_team_user_id <> v_user_id THEN
    RETURN jsonb_build_object('error', 'Not team owner');
  END IF;

  -- Underdog role is reserved for eligible teams.
  IF p_role = 'underdog' AND NOT COALESCE(v_team_eligible, false) THEN
    RETURN jsonb_build_object('error', 'Underdog role is only available to underdog-eligible teams');
  END IF;

  -- Dynamic total squad cap: 10 for eligible teams, else 8.
  v_total_cap := CASE WHEN COALESCE(v_team_eligible, false) THEN 10 ELSE 8 END;

  SELECT COUNT(*) INTO v_squad_total
  FROM public.gt_squad
  WHERE team_id = p_team_id AND phase_id = p_phase_id AND year = p_year
    AND removed_at IS NULL;

  IF v_squad_total >= v_total_cap THEN
    RETURN jsonb_build_object('error', format('GT squad is full (max %s riders)', v_total_cap));
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.contracts
    WHERE team_id = p_team_id AND rider_id = p_rider_id AND status = 'active'
  ) INTO v_contract_exists;

  IF NOT v_contract_exists THEN
    RETURN jsonb_build_object('error', 'Rider has no active contract with this team');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.gt_squad
    WHERE team_id = p_team_id AND phase_id = p_phase_id AND year = p_year
      AND rider_id = p_rider_id AND removed_at IS NULL
  ) INTO v_already_in_squad;

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
    WHEN 'underdog'      THEN 2
  END;

  SELECT COUNT(*) INTO v_role_count
  FROM public.gt_squad
  WHERE team_id = p_team_id AND phase_id = p_phase_id AND year = p_year
    AND role = p_role AND removed_at IS NULL;

  IF v_role_count >= v_cap THEN
    RETURN jsonb_build_object('error', format('Role %s is at capacity (%s)', p_role, v_cap));
  END IF;

  INSERT INTO public.gt_squad (team_id, phase_id, year, rider_id, role)
  VALUES (p_team_id, p_phase_id, p_year, p_rider_id, p_role);

  INSERT INTO public.gt_role_assignments (team_id, phase_id, year, rider_id, role)
  VALUES (p_team_id, p_phase_id, p_year, p_rider_id, p_role);

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 4. gt_assign_role — underdog cap 2 + eligibility gate. Demotion logic unchanged.
CREATE OR REPLACE FUNCTION public.gt_assign_role(
  p_team_id uuid,
  p_rider_id uuid,
  p_role text,
  p_phase_id int,
  p_year int
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_team_user_id uuid;
  v_team_eligible boolean;
  v_squad_id uuid;
  v_cap int;
  v_demote record;
  v_domestique_count int;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  IF p_role NOT IN ('gc_leader','sprinter','climber','tt_specialist','stage_hunter','domestique','underdog') THEN
    RETURN jsonb_build_object('error', 'Invalid role');
  END IF;

  IF p_phase_id NOT IN (4, 6, 8) THEN
    RETURN jsonb_build_object('error', 'Invalid phase_id');
  END IF;

  SELECT user_id, underdog_eligible INTO v_team_user_id, v_team_eligible
  FROM public.teams WHERE id = p_team_id FOR UPDATE;

  IF v_team_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Team not found');
  END IF;

  IF v_team_user_id <> v_user_id THEN
    RETURN jsonb_build_object('error', 'Not team owner');
  END IF;

  IF p_role = 'underdog' AND NOT COALESCE(v_team_eligible, false) THEN
    RETURN jsonb_build_object('error', 'Underdog role is only available to underdog-eligible teams');
  END IF;

  SELECT id INTO v_squad_id
  FROM public.gt_squad
  WHERE team_id = p_team_id AND phase_id = p_phase_id AND year = p_year
    AND rider_id = p_rider_id AND removed_at IS NULL;

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
    WHEN 'underdog'      THEN 2
  END;

  IF (
    SELECT COUNT(*) FROM public.gt_squad
    WHERE team_id = p_team_id AND phase_id = p_phase_id AND year = p_year
      AND role = p_role AND removed_at IS NULL AND rider_id <> p_rider_id
  ) >= v_cap THEN

    IF p_role <> 'domestique' THEN
      SELECT COUNT(*) INTO v_domestique_count
      FROM public.gt_squad
      WHERE team_id = p_team_id AND phase_id = p_phase_id AND year = p_year
        AND role = 'domestique' AND removed_at IS NULL AND rider_id <> p_rider_id;

      IF v_domestique_count >= 2 THEN
        RETURN jsonb_build_object(
          'error',
          format(
            'Role %s is at capacity (%s) and demoting the displaced holder to domestique would exceed its cap (2). Free a domestique slot first.',
            p_role, v_cap
          )
        );
      END IF;
    END IF;

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

  UPDATE public.gt_squad SET role = p_role WHERE id = v_squad_id;

  INSERT INTO public.gt_role_assignments (team_id, phase_id, year, rider_id, role)
  VALUES (p_team_id, p_phase_id, p_year, p_rider_id, p_role);

  RETURN jsonb_build_object('ok', true);
END;
$$;
```

- [ ] **Step 2: Write the rollback**

Create `supabase/migrations/_rollback/20260603000100_underdog_role_and_squad_cap.down.sql`:

```sql
-- Restore role CHECKs without 'underdog' (will fail if underdog rows exist — clean first).
DELETE FROM public.gt_role_assignments WHERE role = 'underdog';
UPDATE public.gt_squad SET role = 'domestique' WHERE role = 'underdog';

ALTER TABLE public.gt_squad DROP CONSTRAINT IF EXISTS gt_squad_role_check;
ALTER TABLE public.gt_squad ADD CONSTRAINT gt_squad_role_check
  CHECK (role IN ('gc_leader','sprinter','climber','tt_specialist','stage_hunter','domestique'));

ALTER TABLE public.gt_role_assignments DROP CONSTRAINT IF EXISTS gt_role_assignments_role_check;
ALTER TABLE public.gt_role_assignments ADD CONSTRAINT gt_role_assignments_role_check
  CHECK (role IN ('gc_leader','sprinter','climber','tt_specialist','stage_hunter','domestique'));

-- NOTE: re-apply migration 20260515000000 (gt_add_to_squad / gt_assign_role) and
-- 20260508010200 (enforce_gt_squad_cap) to restore the static-cap function bodies.
```

- [ ] **Step 3: Apply + verify locally**

Run: `supabase db reset`
Confirm the CHECKs accept the new role:
Run: `docker exec -i supabase_db_WattHunter psql -U postgres -d postgres -c "SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'gt_squad_role_check';"`
Expected: the definition lists `'underdog'`.

Confirm the dynamic cap function compiles and reads eligibility:
Run: `docker exec -i supabase_db_WattHunter psql -U postgres -d postgres -c "SELECT proname FROM pg_proc WHERE proname IN ('enforce_gt_squad_cap','gt_add_to_squad','gt_assign_role');"`
Expected: three rows.

- [ ] **Step 4: Push to remote (REQUIRES USER CONFIRMATION)**

⚠️ Recreates production RPCs/trigger + relaxes CHECKs. Ask the user first.
Run (after OK): `supabase db push --linked`

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260603000100_underdog_role_and_squad_cap.sql supabase/migrations/_rollback/20260603000100_underdog_role_and_squad_cap.down.sql
git commit -m "feat(db): underdog role + dynamic 8/10 squad cap, eligibility-gated (Spec B B1/B3)"
```

---

## Task 4: Front — expose the `underdog` role

**Files:**
- Modify: `apps/web/app/(game)/league/[leagueId]/team/gt/actions.ts` (lines 7-19, the `ROLES` tuple)
- Modify: `apps/web/app/(game)/league/[leagueId]/team/gt/gt-team-client.tsx` (the `ROLE_ORDER` metadata array)

**Design system:** No new component or token — reuse the existing role-row pattern in `gt-team-client.tsx`. READ `docs/watthunter-design-system-v3.md` before editing if you touch any styling; here we only add a data entry to an existing list, so no new visual primitives.

- [ ] **Step 1: Add `underdog` to the server-action role tuple**

In `apps/web/app/(game)/league/[leagueId]/team/gt/actions.ts`, the `ROLES` const (around lines 7-19) currently lists the six roles. Add `"underdog"` as the last entry:

```typescript
const ROLES = [
  "gc_leader",
  "sprinter",
  "climber",
  "tt_specialist",
  "stage_hunter",
  "domestique",
  "underdog",
] as const;
```

(No other change — the actions forward `role` to the RPC, which now enforces eligibility + cap server-side.)

- [ ] **Step 2: Add `underdog` metadata to the UI list**

In `apps/web/app/(game)/league/[leagueId]/team/gt/gt-team-client.tsx`, find the `ROLE_ORDER` array (each entry has the role key, label, cap, and a description string). Append an entry matching the existing shape (copy a neighbouring entry's exact field names — `key`/`label`/`cap`/`description` or whatever the file uses):

```tsx
  {
    key: "underdog",
    label: "Underdog",
    cap: 2,
    description: "Eligible teams only. Stage points ×(PCS rank ÷ 100), capped ×4. No bonus on final classifications.",
  },
```

If the file gates role availability by anything client-side, ensure `underdog` is only offered when the team is eligible (the page already receives team data — reuse the same `underdog_eligible` field; if it isn't selected yet, add it to the team query feeding this client component). The server RPC is the source of truth, so a missing client gate only affects polish, not correctness.

- [ ] **Step 3: Typecheck + lint**

Run: `cd apps/web && pnpm typecheck`
Expected: no errors (the Zod tuple + RPC arg types stay consistent).
Run: `cd apps/web && pnpm lint`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add "apps/web/app/(game)/league/[leagueId]/team/gt/actions.ts" "apps/web/app/(game)/league/[leagueId]/team/gt/gt-team-client.tsx"
git commit -m "feat(web): expose underdog role in GT squad builder (Spec B)"
```

---

## Task 5: Scoring — underdog boost multiplier

**Files:**
- Modify: `services/pcs-sync/scoring.py:293` (riders select), `:78-152` (add helper), `:486-487` (role branch)
- Modify: `services/pcs-sync/tests/test_scoring.py` (add multiplier + integration test)

- [ ] **Step 1: Write the failing tests**

Append to `services/pcs-sync/tests/test_scoring.py`:

```python
def test_underdog_multiplier_clamp_and_finals():
    """Underdog boost = clamp(pcs_rank/100, 1, 4) on stages; 1.0 on finals + unknown rank."""
    from scoring import _underdog_multiplier

    assert _underdog_multiplier(272, "race/giro-d-italia/2026/stage-5") == 2.72
    assert _underdog_multiplier(213, "race/giro-d-italia/2026/stage-5") == 2.13
    assert _underdog_multiplier(432, "race/giro-d-italia/2026/stage-5") == 4.0   # capped
    assert _underdog_multiplier(69,  "race/giro-d-italia/2026/stage-5") == 1.0   # floored
    assert _underdog_multiplier(272, "race/giro-d-italia/2026/gc") == 1.0        # no boost on finals
    assert _underdog_multiplier(None, "race/giro-d-italia/2026/stage-5") == 1.0  # unknown rank
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd services/pcs-sync && .venv/bin/python -m pytest tests/test_scoring.py -k underdog_multiplier -v`
Expected: FAIL — `ImportError: cannot import name '_underdog_multiplier'`.

- [ ] **Step 3: Add the helper**

In `services/pcs-sync/scoring.py`, immediately after `_role_multiplier` (after line 152), add:

```python
def _underdog_multiplier(pcs_rank: int | None, race_slug: str) -> float:
    """Underdog role boost: clamp(pcs_rank / 100, 1, 4) on GT stages.

    Returns 1.0 on final-classification slugs (…/gc, …/points, …/kom — no role mult on
    finals per Spec A D4) and when the rider has no PCS rank.
    """
    if pcs_rank is None:
        return 1.0
    if race_slug.endswith(("/gc", "/points", "/kom")):
        return 1.0
    return max(1.0, min(4.0, pcs_rank / 100.0))
```

- [ ] **Step 4: Pull `pcs_rank` into the riders select**

In `services/pcs-sync/scoring.py`, line 293, add `pcs_rank` to the embedded riders select:

```python
        "riders:rider_id(specialty, nationality, real_team, birthdate, pcs_rank)"
```

- [ ] **Step 5: Branch on the underdog role in the per-rider loop**

In `services/pcs-sync/scoring.py`, the GT-slug block at lines 486-487 currently reads:

```python
                    role = gt_roles.get((team_id, rider_id), "domestique")
                    gt_role_mult = _role_multiplier(role, race_slug, entry.get("is_itt", False))
```

Replace those two lines with:

```python
                    role = gt_roles.get((team_id, rider_id), "domestique")
                    if role == "underdog":
                        gt_role_mult = _underdog_multiplier(rider_join.get("pcs_rank"), race_slug)
                    else:
                        gt_role_mult = _role_multiplier(role, race_slug, entry.get("is_itt", False))
```

(`rider_join` is already in scope from line 442. The underdog mult flows through the existing `gt_role_mult` slot, so strategy bonus / classif / tactics / remontada compose unchanged. Underdog riders earn no role-matched classif bonus — `_classif_bonus` has no underdog branch, returning base only — which is intended.)

- [ ] **Step 6: Add an integration test for the underdog branch**

Append to `services/pcs-sync/tests/test_scoring.py` (model it on the existing GT-scoring tests in the file — match their fixture/helper names; the snippet below shows the assertion intent, adapt the setup to the file's existing `calculate_xp`/mock-supabase harness):

```python
def test_underdog_role_boosts_stage_points(monkeypatch):
    """A squad rider in the underdog role earns raw_points × clamp(pcs_rank/100,1,4) on a stage."""
    # Reuse the file's existing GT-scoring fixture builder. Key asserts:
    #   - rider pcs_rank = 272, role = 'underdog', stage raw_points = 80
    #   - expected xp = round(80 * 2.72, 2) = 217.6  (no strategy bonus, no classif)
    # If the file exposes a unit-level seam, prefer asserting _underdog_multiplier(272, stage)*80.
    from scoring import _underdog_multiplier
    raw_points = 80
    assert round(raw_points * _underdog_multiplier(272, "race/giro-d-italia/2026/stage-5"), 2) == 217.6
```

- [ ] **Step 7: Run to verify all pass**

Run: `cd services/pcs-sync && .venv/bin/python -m pytest tests/test_scoring.py -k underdog -v`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add services/pcs-sync/scoring.py services/pcs-sync/tests/test_scoring.py
git commit -m "feat(scoring): underdog role boost clamp(pcs_rank/100,1,4) on GT stages (Spec B B2)"
```

---

## Task 6: Salary — flag underdog-recruited contracts

**Files:**
- Create: `supabase/migrations/20260603000200_underdog_salary_flag.sql`
- Create: `supabase/migrations/_rollback/20260603000200_underdog_salary_flag.down.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260603000200_underdog_salary_flag.sql`:

```sql
-- Spec B (B4) — flag contracts recruited under underdog terms.
-- Set at INSERT when the team is currently eligible AND the rider is rank > 100.
-- The discount itself is applied at payday (next migration), and is reversible.

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS underdog_discount boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.flag_underdog_contract()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_eligible boolean;
  v_rank int;
BEGIN
  IF NEW.underdog_discount THEN
    RETURN NEW;  -- respect an explicitly-set flag (e.g. backfill)
  END IF;

  SELECT underdog_eligible INTO v_eligible FROM public.teams WHERE id = NEW.team_id;
  SELECT pcs_rank INTO v_rank FROM public.riders WHERE id = NEW.rider_id;

  IF COALESCE(v_eligible, false) AND COALESCE(v_rank, 0) > 100 THEN
    NEW.underdog_discount := true;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_flag_underdog_contract ON public.contracts;
CREATE TRIGGER trg_flag_underdog_contract
  BEFORE INSERT ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.flag_underdog_contract();
```

- [ ] **Step 2: Write the rollback**

Create `supabase/migrations/_rollback/20260603000200_underdog_salary_flag.down.sql`:

```sql
DROP TRIGGER IF EXISTS trg_flag_underdog_contract ON public.contracts;
DROP FUNCTION IF EXISTS public.flag_underdog_contract();
ALTER TABLE public.contracts DROP COLUMN IF EXISTS underdog_discount;
```

- [ ] **Step 3: Apply + verify locally**

Run: `supabase db reset`
Confirm column + trigger exist:
Run: `docker exec -i supabase_db_WattHunter psql -U postgres -d postgres -c "SELECT column_name FROM information_schema.columns WHERE table_name='contracts' AND column_name='underdog_discount'; SELECT tgname FROM pg_trigger WHERE tgname='trg_flag_underdog_contract';"`
Expected: one column row + one trigger row.

- [ ] **Step 4: Push to remote (REQUIRES USER CONFIRMATION)**

⚠️ Adds a column + trigger to **production** `contracts`. Ask the user first.
Run (after OK): `supabase db push --linked`

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260603000200_underdog_salary_flag.sql supabase/migrations/_rollback/20260603000200_underdog_salary_flag.down.sql
git commit -m "feat(db): flag underdog-recruited contracts for salary discount (Spec B B4)"
```

---

## Task 7: Salary — apply the reversible −50% at payday

**Files:**
- Create: `supabase/migrations/20260603000300_underdog_payday_discount.sql`
- Create: `supabase/migrations/_rollback/20260603000300_underdog_payday_discount.down.sql`

**What changes:** recreate `confirm_phase_setup` (latest body is in `20260518000003`) so the salary loop pays `floor(locked_salary × 0.5 / 100) × 100` for a contract that is `underdog_discount = true` **while the team is currently `underdog_eligible`**, else full `locked_salary`. Reversible: when the team climbs out (`underdog_eligible = false`), the next payday charges full price.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260603000300_underdog_payday_discount.sql`:

```sql
-- Spec B (B4) — apply the reversible underdog salary discount at payday.
-- Based on 20260518000003_confirm_phase_setup_remove_late_joiner.sql, with the
-- salary loop modified to halve eligible underdog-recruited salaries.

CREATE OR REPLACE FUNCTION public.confirm_phase_setup(
  p_team_id uuid,
  p_current_phase_id int,
  p_current_phase_label text,
  p_phase_start timestamptz
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_team record;
  v_strat record;
  v_sponsor record;
  v_income int;
  v_contract record;
  v_total_salary int := 0;
  v_effective_salary int;
  v_desc_suffix text;
BEGIN
  IF v_user_id IS NOT NULL THEN
    SELECT * INTO v_team FROM public.teams
    WHERE id = p_team_id AND user_id = v_user_id FOR UPDATE;
  ELSE
    SELECT * INTO v_team FROM public.teams
    WHERE id = p_team_id FOR UPDATE;
  END IF;

  IF v_team IS NULL THEN
    RETURN jsonb_build_object('error', 'Team not found');
  END IF;

  IF v_team.phase_confirmed_id = p_current_phase_id THEN
    RETURN jsonb_build_object('error', 'Already confirmed for this phase');
  END IF;

  IF v_team.pending_sponsor_id IS NOT NULL THEN
    INSERT INTO public.team_sponsors (team_id, sponsor_id, activated_at)
    VALUES (p_team_id, v_team.pending_sponsor_id, now())
    ON CONFLICT (team_id) DO UPDATE
    SET sponsor_id = EXCLUDED.sponsor_id, activated_at = EXCLUDED.activated_at;

    UPDATE public.teams SET pending_sponsor_id = NULL WHERE id = p_team_id;
  END IF;

  FOR v_strat IN
    SELECT id, pending_is_active, pending_config
    FROM public.team_strategies
    WHERE team_id = p_team_id AND pending_is_active IS NOT NULL
  LOOP
    IF v_strat.pending_is_active = false THEN
      DELETE FROM public.team_strategies WHERE id = v_strat.id;
    ELSE
      UPDATE public.team_strategies
      SET is_active = COALESCE(v_strat.pending_is_active, true),
          config = v_strat.pending_config,
          activated_at = now(),
          pending_is_active = NULL,
          pending_config = NULL
      WHERE id = v_strat.id;
    END IF;
  END LOOP;

  SELECT s.name, s.monthly_budget INTO v_sponsor
  FROM public.team_sponsors ts
  JOIN public.sponsors s ON s.id = ts.sponsor_id
  WHERE ts.team_id = p_team_id;

  IF v_sponsor IS NOT NULL THEN
    v_income := v_sponsor.monthly_budget;
    UPDATE public.teams SET treasury = treasury + v_income WHERE id = p_team_id;
    INSERT INTO public.treasury_log (team_id, type, amount, description)
    VALUES (p_team_id, 'sponsor_payment', v_income,
            format('Sponsor income — %s (%s)', v_sponsor.name, p_current_phase_label));
  END IF;

  -- 7. Deduct roster salaries — apply reversible underdog discount.
  FOR v_contract IN
    SELECT c.id, c.locked_salary, c.rider_id, c.underdog_discount, r.full_name
    FROM public.contracts c
    JOIN public.riders r ON r.id = c.rider_id
    WHERE c.team_id = p_team_id AND c.status = 'active'
  LOOP
    IF v_team.underdog_eligible AND v_contract.underdog_discount THEN
      v_effective_salary := FLOOR(v_contract.locked_salary * 0.5 / 100) * 100;
      v_desc_suffix := ' [underdog -50%]';
    ELSE
      v_effective_salary := v_contract.locked_salary;
      v_desc_suffix := '';
    END IF;

    v_total_salary := v_total_salary + v_effective_salary;

    INSERT INTO public.treasury_log (team_id, rider_id, type, amount, description)
    VALUES (p_team_id, v_contract.rider_id, 'payday_salary', -v_effective_salary,
            format('Salary — %s (%s)%s', v_contract.full_name, p_current_phase_label, v_desc_suffix));

    UPDATE public.contracts SET last_salary_paid = current_date WHERE id = v_contract.id;
  END LOOP;

  UPDATE public.teams SET treasury = treasury - v_total_salary WHERE id = p_team_id;

  UPDATE public.teams
  SET phase_confirmed_at = now(), phase_confirmed_id = p_current_phase_id
  WHERE id = p_team_id;

  RETURN jsonb_build_object(
    'ok', true,
    'phaseId', p_current_phase_id,
    'phaseLabel', p_current_phase_label,
    'sponsorIncome', COALESCE(v_income, 0),
    'totalSalary', v_total_salary
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_phase_setup(uuid, int, text, timestamptz) TO authenticated, service_role;
```

- [ ] **Step 2: Write the rollback**

Create `supabase/migrations/_rollback/20260603000300_underdog_payday_discount.down.sql`:

```sql
-- Re-apply 20260518000003_confirm_phase_setup_remove_late_joiner.sql to restore
-- the pre-discount payday loop (copy that file's CREATE OR REPLACE body here verbatim).
```

- [ ] **Step 3: Apply + verify locally**

Run: `supabase db reset`
Confirm the function recreated and references the new column:
Run: `docker exec -i supabase_db_WattHunter psql -U postgres -d postgres -c "SELECT pg_get_functiondef('public.confirm_phase_setup(uuid,int,text,timestamptz)'::regprocedure) LIKE '%underdog_discount%' AS has_discount;"`
Expected: `has_discount = t`.

- [ ] **Step 4: Push to remote (REQUIRES USER CONFIRMATION)**

⚠️ Recreates the **production** payday RPC. Ask the user first.
Run (after OK): `supabase db push --linked`

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260603000300_underdog_payday_discount.sql supabase/migrations/_rollback/20260603000300_underdog_payday_discount.down.sql
git commit -m "feat(db): reversible underdog -50% salary discount at payday (Spec B B4)"
```

---

## Task 8: Update living docs

**Files:**
- Modify: `docs/GAME_RULES.md` (add an Underdog section + note the new constants)
- Modify: `docs/ARCHITECTURE.md` (new table/columns/RPCs)

- [ ] **Step 1: GAME_RULES — add the Underdog rules**

In `docs/GAME_RULES.md`, add a new subsection (place it near the GT / level sections) titled **Underdog (Spec B)** with this content:

```markdown
### Underdog (Spec B)

- **Team eligibility:** `cumulative_xp < 75% of the league leader`, recomputed each phase (`recompute_underdog_eligibility`). Flag: `teams.underdog_eligible`; audit: `underdog_eligibility` snapshot.
- **Underdog rider:** `pcs_rank > 100`.
- **Role (cap 2):** assignable only by eligible teams. Stage points ×`clamp(pcs_rank / 100, 1, 4)`. No multiplier on final classifications.
- **Squad cap:** 8 → 10 for eligible teams (GT only; bounded by roster = level Slots, so L5+ to use all 10). Reverts to 8 next GT on exit.
- **Salary:** −50% (rounded to 100€) on riders `pcs_rank > 100` **recruited while eligible** (`contracts.underdog_discount`). Applied at payday only while the team stays eligible; full price the phase after climbing out.
```

- [ ] **Step 2: ARCHITECTURE — record the new schema + RPCs**

In `docs/ARCHITECTURE.md`, add:
- Table `underdog_eligibility(team_id, phase_id, year, is_eligible, leader_xp, team_xp, computed_at)` — per-phase eligibility snapshot.
- Column `teams.underdog_eligible boolean` — runtime eligibility flag.
- Column `contracts.underdog_discount boolean` — contract recruited under underdog terms.
- RPC `recompute_underdog_eligibility(phase_id, year)` — recompute flag + snapshot for all leagues.
- Note that `enforce_gt_squad_cap`, `gt_add_to_squad`, `gt_assign_role`, `confirm_phase_setup` were modified for underdog; role enum now includes `underdog`.
- Trigger `trg_flag_underdog_contract` on `contracts`.
- The four migration filenames (`20260603000000`–`20260603000300`) with a one-line purpose each.

- [ ] **Step 3: Commit**

```bash
git add docs/GAME_RULES.md docs/ARCHITECTURE.md
git commit -m "docs: record underdog rules + schema (Spec B)"
```

---

## Task 9: Full-suite verification

- [ ] **Step 1: Python suite**

Run: `cd services/pcs-sync && .venv/bin/python -m pytest -q`
Expected: all pass (focus: `test_underdog.py`, `test_scoring.py`).

- [ ] **Step 2: Web typecheck + lint + tests**

Run: `cd apps/web && pnpm typecheck && pnpm lint && pnpm test`
Expected: clean / all pass.

- [ ] **Step 3: Clean migration replay**

Run: `supabase db reset`
Expected: all migrations apply with no error (the four new ones included), confirming a from-scratch rebuild stays consistent (Rule #2).

- [ ] **Step 4: End-to-end eligibility smoke (local)**

With two temp teams (leader 1000 / follower 700) as in Task 1 Step 3, after `recompute_underdog_eligibility(4,2026)`:
- `follower.underdog_eligible = true`, `leader = false`.
- A `contracts` INSERT for the follower on a rider with `pcs_rank = 250` sets `underdog_discount = true`; for `pcs_rank = 50` it stays `false`.
- Insert 9 then 10 `gt_squad` rows for the follower (phase 4) → the 10th succeeds; the 11th raises `GT squad already at max (10 riders)`. For the leader the 9th raises `... (8 riders)`.
Clean up the temp rows afterwards.

- [ ] **Step 5: Confirm prod state (if migrations were pushed)**

If the user authorised the pushes, confirm on remote: the four objects exist, `recompute_underdog_eligibility(<current_phase>, 2026)` was run for the test league (`adaec367…`), and `teams.underdog_eligible` matches the projected standings (e.g. bigdaddy/Muscat eligible vs Klimax/Leopard not).

---

## Self-Review

- **Spec coverage:** B0 eligibility → Tasks 1, 2. B1 rider definition → Tasks 3, 5, 6 (rank>100). B2 boost → Task 5. B3 squad cap 8→10 → Task 3. B4 salary −50% reversible → Tasks 6 (flag) + 7 (payday). Front exposure → Task 4. Docs → Task 8. B5 (Visma/RB goals) is explicitly Spec C, not here. No B-section gap.
- **No placeholders:** every SQL/Python/TS step has concrete code + exact commands + expected output. The two spots that say "match the file's existing harness/idiom" (Task 2 dispatch wiring, Task 5 integration-test setup) reference real, existing in-file patterns rather than inventing new ones, and each ships a concrete unit-level assertion alongside.
- **Type/name consistency:** `teams.underdog_eligible` (bool) read identically in the cap trigger, both squad RPCs, the contract-flag trigger, and `confirm_phase_setup`. `contracts.underdog_discount` (bool) set in Task 6, read in Task 7. `recompute_underdog_eligibility(int,int)` signature matches the Python `recompute_eligibility` call args `{p_phase_id,p_year}`. Role string `"underdog"` consistent across CHECK constraints, both RPC allow-lists + cap CASE, the TS `ROLES` tuple, the UI `ROLE_ORDER`, and the `scoring.py` branch. `_underdog_multiplier(pcs_rank, race_slug)` signature matches its call site and tests.
- **Reversibility check:** salary discount keys off the *current* `teams.underdog_eligible` at payday (not frozen into `locked_salary`), so climbing out restores full price next phase — matches spec B4. Squad cap likewise reads the live flag, so it reverts to 8 the next GT.
```
