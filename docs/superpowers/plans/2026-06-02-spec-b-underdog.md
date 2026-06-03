# Spec B — Underdog — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "underdog" GT role that lets trailing teams (XP < 75% of the league leader) boost low-ranked riders' stage points, field a 10-rider squad, and pay half salary on newly-recruited low-ranked riders — all reversible the moment they climb back out.

**Architecture:** One shared eligibility foundation (`teams.underdog_eligible` flag + `underdog_eligibility` audit snapshot, recomputed per phase by an RPC driven from the Python pipeline) feeds three perks: (1) a dynamic `gt_squad` cap 8→10, (2) a new rank-based scoring multiplier on the `underdog` role, (3) a per-payday salary discount gated by a contract flag. RLS is never bypassed; all writes go through SECURITY DEFINER RPCs/triggers. App text is English.

**Tech Stack:** Supabase Postgres migrations, Python 3.12 (`services/pcs-sync`, pytest), TypeScript (`apps/web`, vitest), `procyclingstats`.

**Source spec:** `docs/superpowers/specs/2026-06-01-spec-b-underdog-design.md`

**Project rules:** Rule #2 — schema changes via migration only. Migrations to **prod** (`supabase db push --linked`) require **explicit user confirmation** — never auto-push. Test locally first (`supabase db reset` on Colima). NEVER mutate `teams` protected columns outside SECURITY DEFINER. App text English.

**Dependencies — all DELIVERED on main (this plan targets the current code):**
- **Spec A P1** (levels L5=10/L7=2600/L8=5000) + **`riders.pcs_rank`** exist — no capture needed.
- **Spec A A9 "Race Team"** generalized `gt_squad` to carry `race_slug` (+ nullable `phase_id`, constraint `gt_squad_scope_check`); `gt_add_to_squad`/`gt_assign_role` are now **v2 6-param** (`p_race_slug DEFAULT NULL`, `v_use_slug` branch) in `20260604000300`. Task 3 **recreates those v2 bodies** (adds the underdog role) and makes the cap trigger `race_slug`-aware. 8→10 then extends to 1-week races for free.
- **Spec A P2** refactored scoring: `_role_multiplier(role, race_slug, is_itt, breakaway_kms, profile_icon)`; squad gating via `_is_squad_race` (GT **+ 1-week**); XP formula has `+ gt_distance_bonus`, no more remontada. Task 5 injects the boost as a **separate factor** (see precision note in Task 5).
- **Spec C** delivered (B5 Visma/RB goals live there — nothing to do here).
- **Spec D "prix au millier"** delivered: bids step 1 000 €, `calcMinSalary = floor(raw/1000)×1000`. → **B4 salary rounding is 1 000 € (not 100 €)**; the B2bis UI (`<RiderPrice>`) is unblocked but still out of this backend plan's scope (Task 4 only exposes the role in the squad builder).

**Migration numbering:** the latest existing migration is `20260604000300`; all new migrations below use the **`20260605xxx`** series (verify with `ls supabase/migrations | sort | tail -1` before creating).

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `supabase/migrations/20260605000000_underdog_eligibility.sql` | `underdog_eligibility` table, `teams.underdog_eligible`, `recompute_underdog_eligibility` RPC | Create |
| `supabase/migrations/20260605000100_underdog_role_and_squad_cap.sql` | Relax role CHECKs, `race_slug`-aware dynamic `enforce_gt_squad_cap`, recreate **v2** `gt_add_to_squad` + `gt_assign_role` (underdog cap 2 + eligibility gate) | Create |
| `supabase/migrations/20260605000200_underdog_salary_flag.sql` | `contracts.underdog_discount` + `BEFORE INSERT` flag trigger | Create |
| `supabase/migrations/20260605000250_rider_xp_daily_underdog_mult.sql` | `rider_xp_daily.underdog_mult NUMERIC(3,2)` audit column | Create |
| `supabase/migrations/20260605000300_underdog_payday_discount.sql` | Recreate latest `confirm_phase_setup` with the −50% (÷1000) payday discount | Create |
| `supabase/migrations/_rollback/20260605*.down.sql` | Rollbacks for each migration above | Create (×5) |
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
- Create: `supabase/migrations/20260605000000_underdog_eligibility.sql`
- Create: `supabase/migrations/_rollback/20260605000000_underdog_eligibility.down.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260605000000_underdog_eligibility.sql`:

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

Create `supabase/migrations/_rollback/20260605000000_underdog_eligibility.down.sql`:

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
git add supabase/migrations/20260605000000_underdog_eligibility.sql supabase/migrations/_rollback/20260605000000_underdog_eligibility.down.sql
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
- Create: `supabase/migrations/20260605000100_underdog_role_and_squad_cap.sql`
- Create: `supabase/migrations/_rollback/20260605000100_underdog_role_and_squad_cap.down.sql`

**What changes (post-A9):** (a) relax the role CHECK on `gt_squad` + `gt_role_assignments` to accept `'underdog'`; (b) recreate `enforce_gt_squad_cap()` (currently in `20260513000000`) so it (i) counts by the **right scope** — `race_slug` when `NEW.race_slug IS NOT NULL`, else `(phase_id, year)` — fixing the latent 1-week bug, and (ii) caps at **10 if the team is `underdog_eligible`, else 8**; (c) recreate the **v2** `gt_add_to_squad` + `gt_assign_role` (the 6-param `p_race_slug` bodies from `20260604000300`) adding the underdog role.

> **Do NOT paste stale bodies.** The v2 RPCs branch on `v_use_slug := p_race_slug IS NOT NULL` and the total cap now lives only in the trigger (the v2 RPCs no longer check total size). Recreate them by copying the **current** bodies from `supabase/migrations/20260604000300_gt_squad_rpcs_v2_race_slug.sql` and applying the three diffs below verbatim. Read that file first.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260605000100_underdog_role_and_squad_cap.sql` with three parts:

**Part 1 — relax both role CHECKs** (concrete):

```sql
-- Spec B (B1/B2/B3) — underdog role + dynamic, race_slug-aware squad cap.

ALTER TABLE public.gt_squad DROP CONSTRAINT IF EXISTS gt_squad_role_check;
ALTER TABLE public.gt_squad ADD CONSTRAINT gt_squad_role_check
  CHECK (role IN ('gc_leader','sprinter','climber','tt_specialist','stage_hunter','domestique','underdog'));

ALTER TABLE public.gt_role_assignments DROP CONSTRAINT IF EXISTS gt_role_assignments_role_check;
ALTER TABLE public.gt_role_assignments ADD CONSTRAINT gt_role_assignments_role_check
  CHECK (role IN ('gc_leader','sprinter','climber','tt_specialist','stage_hunter','domestique','underdog'));
```

**Part 2 — recreate the cap trigger, race_slug-aware + dynamic** (concrete, full body):

```sql
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
    INTO v_cap FROM public.teams WHERE id = NEW.team_id;
  v_cap := COALESCE(v_cap, 8);

  IF NEW.race_slug IS NOT NULL THEN
    SELECT COUNT(*) INTO current_size FROM public.gt_squad
    WHERE team_id = NEW.team_id AND race_slug = NEW.race_slug AND removed_at IS NULL;
  ELSE
    SELECT COUNT(*) INTO current_size FROM public.gt_squad
    WHERE team_id = NEW.team_id AND phase_id = NEW.phase_id AND year = NEW.year
      AND removed_at IS NULL;
  END IF;

  IF current_size >= v_cap THEN
    RAISE EXCEPTION 'Squad already at max (% riders)', v_cap USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
```

**Part 3 — recreate the v2 RPCs from `20260604000300` + apply these 3 diffs to BOTH `gt_add_to_squad` and `gt_assign_role`:**

- *Diff A — role allow-list:* in the `IF p_role NOT IN (...)` guard, add `,'underdog'` to the list.
- *Diff B — role cap CASE:* add a `WHEN 'underdog' THEN 2` arm to the `v_cap := CASE p_role` block.
- *Diff C — eligibility gate + read flag:* add `v_team_eligible boolean;` to the DECLARE block; change the team fetch to also select the flag (`SELECT user_id, underdog_eligible INTO v_team_user_id, v_team_eligible FROM public.teams WHERE id = p_team_id FOR UPDATE;`); and, right after the "Not team owner" check, insert:

```sql
  IF p_role = 'underdog' AND NOT COALESCE(v_team_eligible, false) THEN
    RETURN jsonb_build_object('error', 'Underdog role is only available to underdog-eligible teams');
  END IF;
```

Keep everything else (the `v_use_slug` branch, demotion logic, inserts) **exactly as in the current v2 bodies**. The total-size cap stays in the trigger (Part 2) — do not add a total-size check to the RPCs.

- [ ] **Step 2: Write the rollback**

Create `supabase/migrations/_rollback/20260605000100_underdog_role_and_squad_cap.down.sql`:

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

-- NOTE: re-apply 20260604000300 (gt_add_to_squad / gt_assign_role v2) and
-- 20260513000000 (enforce_gt_squad_cap) to restore the pre-underdog function bodies.
```

- [ ] **Step 3: Apply + verify locally**

Run: `supabase db reset`
Confirm the CHECKs accept the new role:
Run: `docker exec -i supabase_db_WattHunter psql -U postgres -d postgres -c "SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'gt_squad_role_check';"`
Expected: the definition lists `'underdog'`.

Confirm the dynamic cap function compiles and reads eligibility:
Run: `docker exec -i supabase_db_WattHunter psql -U postgres -d postgres -c "SELECT proname FROM pg_proc WHERE proname IN ('enforce_gt_squad_cap','gt_add_to_squad','gt_assign_role');"`
Expected: three rows.

Confirm the v2 RPC signatures still carry `p_race_slug` (no regression):
Run: `docker exec -i supabase_db_WattHunter psql -U postgres -d postgres -c "SELECT pg_get_function_arguments('public.gt_add_to_squad'::regproc);"`
Expected: includes `p_race_slug text DEFAULT NULL`.

- [ ] **Step 4: Push to remote (REQUIRES USER CONFIRMATION)**

⚠️ Recreates production RPCs/trigger + relaxes CHECKs. Ask the user first.
Run (after OK): `supabase db push --linked`

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260605000100_underdog_role_and_squad_cap.sql supabase/migrations/_rollback/20260605000100_underdog_role_and_squad_cap.down.sql
git commit -m "feat(db): underdog role + dynamic 8/10 race_slug-aware squad cap, eligibility-gated (Spec B B1/B3)"
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

**Files (post-P2 line numbers — re-grep before editing, they drift):**
- Create: `supabase/migrations/20260605000250_rider_xp_daily_underdog_mult.sql` (+ rollback) — audit column
- Modify: `services/pcs-sync/scoring.py` — riders select (~l.388, add `pcs_rank`), `rider_info` dict (~l.550), helper after `_role_multiplier` (~l.246), per-rider role block (~l.588), XP formula (~l.656-664), upsert payload (~l.668-684)
- Modify: `services/pcs-sync/tests/test_scoring.py` (add multiplier + integration test)

> **Precision decision:** do NOT fold the boost into `gt_role_mult` — that column is `NUMERIC(3,1)` and would truncate `2.72 → 2.7`. Apply the underdog boost as a **separate factor** in the XP formula and store it in a new `rider_xp_daily.underdog_mult NUMERIC(3,2)` column. A rider in the `underdog` role gets `gt_role_mult = 1.0` from `_role_multiplier` (unknown role) and the real boost via `underdog_mult` — so `_role_multiplier` itself is left untouched.

- [ ] **Step 0: Add the audit column migration**

Create `supabase/migrations/20260605000250_rider_xp_daily_underdog_mult.sql`:

```sql
-- Spec B (B2) — record the underdog rank-based boost separately from gt_role_mult
-- (which is NUMERIC(3,1) and would truncate 2-decimal boosts).
ALTER TABLE public.rider_xp_daily
  ADD COLUMN IF NOT EXISTS underdog_mult NUMERIC(3,2) NOT NULL DEFAULT 1.0;
```

Rollback `_rollback/20260605000250_rider_xp_daily_underdog_mult.down.sql`:

```sql
ALTER TABLE public.rider_xp_daily DROP COLUMN IF EXISTS underdog_mult;
```

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

In `services/pcs-sync/scoring.py`, immediately after `_role_multiplier` (~line 246), add:

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

- [ ] **Step 4: Pull `pcs_rank` into the riders select + rider_info**

In `services/pcs-sync/scoring.py`, add `pcs_rank` to the embedded riders select (~l.388):

```python
    "riders:rider_id(specialty, nationality, real_team, birthdate, pcs_rank)"
```

and to the `rider_info` dict (~l.550): `"pcs_rank": rider_join.get("pcs_rank"),`.

- [ ] **Step 5: Compute the underdog factor + apply it as a separate multiplier**

In `services/pcs-sync/scoring.py`, the per-rider role resolution (~l.588) currently reads (post-P2, 5-arg signature):

```python
                    role = gt_roles.get((team_id, rider_id), "domestique")
                    gt_role_mult = _role_multiplier(
                        role, race_slug, entry.get("is_itt", False),
                        breakaway_kms, profile_icon,
                    )
```

Leave that as-is (for `role == "underdog"`, `_role_multiplier` returns `1.0`). Immediately after it, add:

```python
                    underdog_mult = (
                        _underdog_multiplier(rider_info.get("pcs_rank"), race_slug)
                        if role == "underdog" else 1.0
                    )
```

Then multiply it into the XP formula (~l.656-664) alongside `nemesis_modifier`:

```python
                    xp = max(0, round(
                        (raw_points * gt_role_mult * (1 + bonus)
                         + gt_classif_bonus + gt_distance_bonus)
                        * nemesis_modifier * underdog_mult, 2))
```

And add `"underdog_mult": underdog_mult,` to the `rider_xp_daily.upsert({...})` payload (~l.668-684).

(`underdog_mult` defaults to 1.0 for every non-underdog rider, so all existing scoring is unchanged. Underdog riders earn no role-matched classif bonus — `_classif_bonus` has no underdog branch — which is intended. The `_is_squad_race` gate already covers GT **and** 1-week, so the boost works for both.)

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
git add supabase/migrations/20260605000250_rider_xp_daily_underdog_mult.sql supabase/migrations/_rollback/20260605000250_rider_xp_daily_underdog_mult.down.sql services/pcs-sync/scoring.py services/pcs-sync/tests/test_scoring.py
git commit -m "feat(scoring): underdog role boost clamp(pcs_rank/100,1,4) on stages, separate underdog_mult (Spec B B2)"
```

---

## Task 6: Salary — flag underdog-recruited contracts

**Files:**
- Create: `supabase/migrations/20260605000200_underdog_salary_flag.sql`
- Create: `supabase/migrations/_rollback/20260605000200_underdog_salary_flag.down.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260605000200_underdog_salary_flag.sql`:

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

Create `supabase/migrations/_rollback/20260605000200_underdog_salary_flag.down.sql`:

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
git add supabase/migrations/20260605000200_underdog_salary_flag.sql supabase/migrations/_rollback/20260605000200_underdog_salary_flag.down.sql
git commit -m "feat(db): flag underdog-recruited contracts for salary discount (Spec B B4)"
```

---

## Task 7: Salary — apply the reversible −50% at payday

**Files:**
- Create: `supabase/migrations/20260605000300_underdog_payday_discount.sql`
- Create: `supabase/migrations/_rollback/20260605000300_underdog_payday_discount.down.sql`

**What changes:** recreate the **latest** `confirm_phase_setup` (⚠️ verify which migration is newest before copying its body — `grep -rl confirm_phase_setup supabase/migrations | sort | tail -1`; candidates: `20260518000003_confirm_phase_setup_remove_late_joiner.sql` or newer) so the salary loop pays `floor(locked_salary × 0.5 / 1000) × 1000` (1 000 € step per shipped Spec D) for a contract that is `underdog_discount = true` **while the team is currently `underdog_eligible`**, else full `locked_salary`. Reversible: when the team climbs out (`underdog_eligible = false`), the next payday charges full price.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260605000300_underdog_payday_discount.sql`:

```sql
-- Spec B (B4) — apply the reversible underdog salary discount at payday.
-- Base = the LATEST confirm_phase_setup body (verify via grep, see "What changes"),
-- with the salary loop modified to halve eligible underdog-recruited salaries (÷1000 step).
-- The body below mirrors the 20260518000003 version; if a newer one exists, re-derive from it.

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
      v_effective_salary := FLOOR(v_contract.locked_salary * 0.5 / 1000) * 1000;
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

Create `supabase/migrations/_rollback/20260605000300_underdog_payday_discount.down.sql`:

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
git add supabase/migrations/20260605000300_underdog_payday_discount.sql supabase/migrations/_rollback/20260605000300_underdog_payday_discount.down.sql
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
- **Squad cap:** 8 → 10 for eligible teams (GT + 1-week, via the `race_slug`-aware cap trigger; bounded by roster = level Slots, so L5+ to use all 10). Reverts to 8 next race on exit.
- **Salary:** −50% (rounded to **1 000 €**, per shipped Spec D) on riders `pcs_rank > 100` **recruited while eligible** (`contracts.underdog_discount`). Applied at payday only while the team stays eligible; full price the phase after climbing out.
```

- [ ] **Step 2: ARCHITECTURE — record the new schema + RPCs**

In `docs/ARCHITECTURE.md`, add:
- Table `underdog_eligibility(team_id, phase_id, year, is_eligible, leader_xp, team_xp, computed_at)` — per-phase eligibility snapshot.
- Column `teams.underdog_eligible boolean` — runtime eligibility flag.
- Column `contracts.underdog_discount boolean` — contract recruited under underdog terms.
- Column `rider_xp_daily.underdog_mult NUMERIC(3,2)` — recorded underdog boost (separate from `gt_role_mult`).
- RPC `recompute_underdog_eligibility(phase_id, year)` — recompute flag + snapshot for all leagues.
- Note that `enforce_gt_squad_cap` (now `race_slug`-aware), the v2 `gt_add_to_squad`/`gt_assign_role`, and `confirm_phase_setup` were modified for underdog; role enum now includes `underdog`.
- Trigger `trg_flag_underdog_contract` on `contracts`.
- The five migration filenames (`20260605000000`–`20260605000300`) with a one-line purpose each.

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
Expected: all migrations apply with no error (the five new `20260605xxx` ones included), confirming a from-scratch rebuild stays consistent (Rule #2).

- [ ] **Step 4: End-to-end eligibility smoke (local)**

With two temp teams (leader 1000 / follower 700) as in Task 1 Step 3, after `recompute_underdog_eligibility(4,2026)`:
- `follower.underdog_eligible = true`, `leader = false`.
- A `contracts` INSERT for the follower on a rider with `pcs_rank = 250` sets `underdog_discount = true`; for `pcs_rank = 50` it stays `false`.
- Insert 9 then 10 `gt_squad` rows for the follower (phase 4) → the 10th succeeds; the 11th raises `Squad already at max (10 riders)`. For the leader the 9th raises `... (8 riders)`. Repeat with `race_slug`-keyed rows (a 1-week race) to confirm the cap counts the right scope.
Clean up the temp rows afterwards.

- [ ] **Step 5: Confirm prod state (if migrations were pushed)**

If the user authorised the pushes, confirm on remote: the new objects exist, `recompute_underdog_eligibility(<current_phase>, 2026)` was run for the test league (`adaec367…`), and `teams.underdog_eligible` matches the projected standings (e.g. bigdaddy/Muscat eligible vs Klimax/Leopard not).

---

## Self-Review

- **Spec coverage:** B0 eligibility → Tasks 1, 2. B1 rider definition → Tasks 3, 5, 6 (rank>100). B2 boost → Task 5. B3 squad cap 8→10 → Task 3. B4 salary −50% reversible → Tasks 6 (flag) + 7 (payday). Front exposure → Task 4. Docs → Task 8. B5 (Visma/RB goals) is explicitly Spec C, not here. No B-section gap.
- **No placeholders:** every SQL/Python/TS step has concrete code + exact commands + expected output. The two spots that say "match the file's existing harness/idiom" (Task 2 dispatch wiring, Task 5 integration-test setup) reference real, existing in-file patterns rather than inventing new ones, and each ships a concrete unit-level assertion alongside.
- **Type/name consistency:** `teams.underdog_eligible` (bool) read identically in the cap trigger, both v2 squad RPCs, the contract-flag trigger, and `confirm_phase_setup`. `contracts.underdog_discount` (bool) set in Task 6, read in Task 7. `rider_xp_daily.underdog_mult` (NUMERIC(3,2)) added in Task 5 Step 0, written in Step 5. `recompute_underdog_eligibility(int,int)` matches the Python `recompute_eligibility` args `{p_phase_id,p_year}`. Role string `"underdog"` consistent across CHECK constraints, both RPC allow-lists + cap CASE, the TS `ROLES` tuple, the UI `ROLE_ORDER`, and the `scoring.py` branch. `_underdog_multiplier(pcs_rank, race_slug)` matches its call site + tests. The boost is a **separate factor** (`underdog_mult`), NOT folded into `gt_role_mult` (NUMERIC(3,1) truncation avoided).
- **Reversibility check:** salary discount keys off the *current* `teams.underdog_eligible` at payday (not frozen into `locked_salary`), so climbing out restores full price next phase — matches spec B4. Squad cap likewise reads the live flag, so it reverts to 8 the next race.
- **Post-A9/P2/Spec D rebase:** migrations are `20260605xxx` (after the latest `20260604000300`); Task 3 targets the v2 race_slug RPCs + race_slug-aware cap trigger; Task 5 uses post-P2 line anchors + separate factor; salary rounding is 1 000 € everywhere (B4 + payday + GAME_RULES) per shipped Spec D.
```
