# Phase Transition Payday Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the missing payday trigger by coupling `confirm_phase_setup` cascade to the resolution of Round 3, add auto-validation for non-actionable teams, skip late joiners, and clean up Phase 2/Phase 3 historical data.

**Architecture:** Single coherent change across 6 SQL migrations + 2 TS file edits. The cascade payday is extracted into a `triggerPhasePayday()` helper and called from `forceResolveRound` when there is no `nextAuction`. Auto-validation is implemented as a SQL helper invoked by `validate_round` (consensus path) and by `forceResolveRound` (round-open path). Phase 2/3 backfill is a separate idempotent SQL migration.

**Tech Stack:** Next.js 16 App Router (TypeScript strict), Supabase Postgres (PL/pgSQL SECURITY DEFINER RPCs), Vitest, pnpm.

**Reference spec:** [docs/superpowers/specs/2026-05-09-phase-transition-payday-design.md](/Users/jonathanschummers/Documents/WattHunter/docs/superpowers/specs/2026-05-09-phase-transition-payday-design.md)

---

## File Map

| File | Action | Task |
|------|--------|------|
| `supabase/migrations/20260509140000_round_validations_auto_validated.sql` | Create | 2 |
| `supabase/migrations/20260509140001_auto_validate_helper.sql` | Create | 3 |
| `supabase/migrations/20260509140002_validate_round_with_auto_validation.sql` | Create | 4 |
| `supabase/migrations/20260509140003_confirm_phase_setup_skip_late_joiners.sql` | Create | 5 |
| `apps/web/app/(game)/league/[leagueId]/auction/actions.ts` | Modify | 6, 7 |
| `apps/web/app/(game)/league/[leagueId]/auction/status/actions.test.ts` | Modify | 6, 7 |
| `apps/web/app/(game)/league/[leagueId]/auction/status/page.tsx` | Modify | 8 |
| `supabase/migrations/20260509140004_backfill_phase_2.sql` | Create | 9 |
| `supabase/migrations/20260509140005_backfill_phase_3.sql` | Create | 10 |
| `apps/web/lib/database.types.ts` | Regenerate | 2 |

---

## Task 1 — Branch

- [ ] **Step 1: Create feature branch**

  ```bash
  cd /Users/jonathanschummers/Documents/WattHunter
  git checkout -b feat/phase-transition-payday
  ```

- [ ] **Step 2: Verify clean baseline**

  ```bash
  git status
  pnpm test --filter=apps/web 2>&1 | tail -5
  ```
  Expected: clean working tree, vitest 157 tests pass.

---

## Task 2 — Add `auto_validated` column to `round_validations`

**Files:**
- Create: `supabase/migrations/20260509140000_round_validations_auto_validated.sql`
- Regenerate: `apps/web/lib/database.types.ts` (and `apps/web/lib/supabase/database.types.ts` if both exist)

- [ ] **Step 1: Write the migration**

  Create `supabase/migrations/20260509140000_round_validations_auto_validated.sql`:

  ```sql
  -- Add auto_validated flag on round_validations to distinguish manual
  -- user validation from automatic system marking (teams that can't bid).
  -- Default false preserves existing rows as manual validations.

  ALTER TABLE public.round_validations
    ADD COLUMN auto_validated boolean NOT NULL DEFAULT false;

  COMMENT ON COLUMN public.round_validations.auto_validated IS
    'True when the row was inserted by the auto-validation helper (team had nothing actionable). False for manual user validations.';
  ```

- [ ] **Step 2: Apply locally**

  Start local Supabase if not already:
  ```bash
  colima start --cpu 4 --memory 6
  supabase start --exclude vector,edge-runtime,logflare,imgproxy,studio,mailpit
  ```

  Apply migration:
  ```bash
  supabase db push --local
  ```
  Expected: migration applied, no errors.

- [ ] **Step 3: Verify column exists**

  ```bash
  docker exec -i supabase_db_WattHunter psql -U postgres -d postgres -c "
  SELECT column_name, data_type, column_default, is_nullable
  FROM information_schema.columns
  WHERE table_name = 'round_validations' AND column_name = 'auto_validated';
  "
  ```
  Expected: 1 row showing `auto_validated | boolean | false | NO`.

- [ ] **Step 4: Regenerate Supabase types**

  Generate from local DB (preferred — schema is already applied):
  ```bash
  cd /Users/jonathanschummers/Documents/WattHunter
  supabase gen types typescript --local > apps/web/lib/database.types.ts
  ```

  If `apps/web/lib/supabase/database.types.ts` also exists, regenerate it the same way:
  ```bash
  supabase gen types typescript --local > apps/web/lib/supabase/database.types.ts
  ```

  Verify: `grep -n "auto_validated" apps/web/lib/database.types.ts | head -3` should show entries.

- [ ] **Step 5: Commit**

  ```bash
  git add supabase/migrations/20260509140000_round_validations_auto_validated.sql apps/web/lib/database.types.ts
  git commit -m "feat(db): add auto_validated column to round_validations"
  ```

---

## Task 3 — Auto-validation helper SQL function

**Files:**
- Create: `supabase/migrations/20260509140001_auto_validate_helper.sql`

This function inserts auto-validation rows for any team in a league that cannot place a useful bid in the given auction (PP < 5000 OR slots full). Idempotent via `ON CONFLICT DO NOTHING`.

- [ ] **Step 1: Write the migration**

  Create `supabase/migrations/20260509140001_auto_validate_helper.sql`:

  ```sql
  -- Helper: mark teams that can't place any bid as auto-validated for an auction.
  -- A team is non-actionable when:
  --   * Its purchasing power is below min_salary (5000 EUR), OR
  --   * Its slots are full (active contracts + active auction_bids >= max_slots).
  -- Insert is idempotent: re-running on the same auction is a no-op.

  CREATE OR REPLACE FUNCTION public.auto_validate_unactionable_teams(
    p_auction_id uuid,
    p_league_id uuid,
    p_current_phase_id int
  ) RETURNS int
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
  DECLARE
    v_team record;
    v_pp bigint;
    v_active_salaries bigint;
    v_drafts_total bigint;
    v_sponsor_income bigint;
    v_max_slots int;
    v_used_slots int;
    v_inserted int := 0;
  BEGIN
    FOR v_team IN
      SELECT t.id, t.level, t.treasury, t.phase_confirmed_id, lm.league_id
      FROM public.teams t
      JOIN public.league_members lm ON lm.team_id = t.id
      WHERE lm.league_id = p_league_id
    LOOP
      -- Active salaries
      SELECT COALESCE(SUM(locked_salary), 0)
      INTO v_active_salaries
      FROM public.contracts
      WHERE team_id = v_team.id AND status = 'active';

      -- Draft bids total (this league)
      SELECT COALESCE(SUM(amount), 0)
      INTO v_drafts_total
      FROM public.draft_bids
      WHERE team_id = v_team.id AND league_id = p_league_id;

      -- Sponsor income (defaults to 0 if no team_sponsors row)
      v_sponsor_income := 0;
      SELECT COALESCE(s.monthly_budget, 0)
      INTO v_sponsor_income
      FROM public.team_sponsors ts
      JOIN public.sponsors s ON s.id = ts.sponsor_id
      WHERE ts.team_id = v_team.id;

      -- PP follows validate_round formula.
      -- Post-payday: treasury already includes sponsor and salaries.
      -- Pre-payday: project sponsor − salaries.
      IF v_team.phase_confirmed_id IS NOT NULL
         AND v_team.phase_confirmed_id = p_current_phase_id THEN
        v_pp := v_team.treasury - v_drafts_total;
      ELSE
        v_pp := v_team.treasury + v_sponsor_income - v_active_salaries - v_drafts_total;
      END IF;

      -- Max slots by level
      v_max_slots := CASE v_team.level
        WHEN 8 THEN 12 WHEN 7 THEN 12 WHEN 6 THEN 11
        WHEN 5 THEN 10 WHEN 4 THEN 9 WHEN 3 THEN 8
        WHEN 2 THEN 7 ELSE 6
      END;

      -- Used slots (active contracts + active bids in this auction)
      SELECT
        (SELECT COUNT(*) FROM public.contracts
          WHERE team_id = v_team.id AND status = 'active')
        +
        (SELECT COUNT(*) FROM public.auction_bids
          WHERE team_id = v_team.id AND auction_id = p_auction_id AND status = 'active')
      INTO v_used_slots;

      -- Auto-validate if non-actionable
      IF v_pp < 5000 OR v_used_slots >= v_max_slots THEN
        INSERT INTO public.round_validations (auction_id, team_id, validated_at, auto_validated)
        VALUES (p_auction_id, v_team.id, now(), true)
        ON CONFLICT (auction_id, team_id) DO NOTHING;

        IF FOUND THEN
          v_inserted := v_inserted + 1;
        END IF;
      END IF;
    END LOOP;

    RETURN v_inserted;
  END;
  $$;

  GRANT EXECUTE ON FUNCTION public.auto_validate_unactionable_teams(uuid, uuid, int)
    TO authenticated, service_role;
  ```

- [ ] **Step 2: Apply locally**

  ```bash
  supabase db push --local
  ```
  Expected: migration applied.

- [ ] **Step 3: Verify function exists**

  ```bash
  docker exec -i supabase_db_WattHunter psql -U postgres -d postgres -c "
  SELECT proname, pronargs FROM pg_proc WHERE proname = 'auto_validate_unactionable_teams';
  "
  ```
  Expected: 1 row showing function with 3 args.

- [ ] **Step 4: Commit**

  ```bash
  git add supabase/migrations/20260509140001_auto_validate_helper.sql
  git commit -m "feat(db): add auto_validate_unactionable_teams helper function"
  ```

---

## Task 4 — Update `validate_round` to call the helper

**Files:**
- Create: `supabase/migrations/20260509140002_validate_round_with_auto_validation.sql`

This recreates `validate_round` (CREATE OR REPLACE) with one extra call to `auto_validate_unactionable_teams` BEFORE the consensus check. The team's own validation is still inserted by validate_round itself; the helper covers the OTHER teams that can't bid.

- [ ] **Step 1: Read current `validate_round` to base the recreate on**

  ```bash
  cat /Users/jonathanschummers/Documents/WattHunter/supabase/migrations/20260508020000_round_validations_and_force_resolve.sql | head -180
  ```

  Note: the recreate must preserve all existing logic (sum drafts, sum salaries, sponsor income, PP check, slot check, cancel previous bids, insert auction_bids, insert round_validations, return) and ADD the helper call right before the round_validations insert.

- [ ] **Step 2: Write the migration**

  Create `supabase/migrations/20260509140002_validate_round_with_auto_validation.sql`:

  Copy the entire `CREATE OR REPLACE FUNCTION public.validate_round(...)` block from `20260508020000_round_validations_and_force_resolve.sql` (lines ~30-180), then before the line `-- 11. Record validation marker (idempotent)`, insert:

  ```sql
    -- 10b. Auto-validate any other team in the league that can't place a useful bid.
    --      The helper inserts round_validations with auto_validated=true.
    PERFORM public.auto_validate_unactionable_teams(v_auction.id, p_league_id, p_current_phase_id);
  ```

  Then keep the rest of the function unchanged (the manual `INSERT INTO round_validations (... auto_validated default false ...)` for the calling team, and the `RETURN`).

  Don't forget the trailing `GRANT EXECUTE ON FUNCTION public.validate_round(uuid, int) TO authenticated;`.

- [ ] **Step 3: Apply and verify**

  ```bash
  supabase db push --local
  ```

  Verify the helper is called:
  ```bash
  docker exec -i supabase_db_WattHunter psql -U postgres -d postgres -c "
  SELECT prosrc FROM pg_proc WHERE proname = 'validate_round';
  " | grep -c "auto_validate_unactionable_teams"
  ```
  Expected: `1`.

- [ ] **Step 4: Commit**

  ```bash
  git add supabase/migrations/20260509140002_validate_round_with_auto_validation.sql
  git commit -m "feat(db): validate_round invokes auto_validate helper before consensus check"
  ```

---

## Task 5 — Update `confirm_phase_setup` to skip late joiners

**Files:**
- Create: `supabase/migrations/20260509140003_confirm_phase_setup_skip_late_joiners.sql`

The current `confirm_phase_setup` does sponsor + salaries unconditionally. Add a guard: if `team.created_at >= phase_start_date`, skip the credit/deduct steps (just mark `phase_confirmed_id` for idempotency).

- [ ] **Step 1: Determine the phase start logic**

  Phase start dates are calendar-based and live in TS (`apps/web/lib/phases.ts` `AUCTION_PHASES`). We need an SQL equivalent — pass the phase start date as a parameter from the caller.

  Update RPC signature:
  ```
  confirm_phase_setup(p_team_id uuid, p_current_phase_id int, p_current_phase_label text, p_phase_start timestamptz)
  ```

  All callers (currently only the TS server action `confirmPhaseSetup` and the new cascade in `forceResolveRound`) must pass the start date.

- [ ] **Step 2: Write the migration**

  Create `supabase/migrations/20260509140003_confirm_phase_setup_skip_late_joiners.sql`:

  Copy the entire `CREATE OR REPLACE FUNCTION public.confirm_phase_setup(...)` from `20260508100000_confirm_phase_setup_payday.sql`, modify the signature to add `p_phase_start timestamptz`, and insert AFTER step 3 (already-confirmed guard):

  ```sql
    -- 3b. Late-joiner guard: if the team was created after the phase started,
    --     skip sponsor crediting and salary deduction. Just mark confirmed.
    IF v_team.created_at >= p_phase_start THEN
      UPDATE public.teams
      SET phase_confirmed_at = now(),
          phase_confirmed_id = p_current_phase_id
      WHERE id = p_team_id;

      RETURN jsonb_build_object(
        'ok', true,
        'phaseId', p_current_phase_id,
        'phaseLabel', p_current_phase_label,
        'sponsorIncome', 0,
        'totalSalary', 0,
        'skippedLateJoiner', true
      );
    END IF;
  ```

  Keep the rest unchanged. Update the GRANT to use the new signature:
  ```sql
  GRANT EXECUTE ON FUNCTION public.confirm_phase_setup(uuid, int, text, timestamptz) TO authenticated, service_role;
  ```

  Also DROP the old 3-arg signature so callers must update:
  ```sql
  DROP FUNCTION IF EXISTS public.confirm_phase_setup(uuid, int, text);
  ```
  (place the DROP BEFORE the CREATE OR REPLACE — Postgres allows replacing a function with a different signature only by dropping first.)

- [ ] **Step 3: Update the TS caller `confirmPhaseSetup`**

  Edit `apps/web/app/(game)/league/[leagueId]/auction/market/actions.ts:78-95` (the existing `confirmPhaseSetup` server action):

  Change the RPC call signature. Look for:
  ```ts
  const { data, error } = await supabase.rpc("confirm_phase_setup", {
    p_team_id: teamId,
    p_current_phase_id: currentPhase.id,
    p_current_phase_label: currentPhase.label,
  });
  ```

  Replace with:
  ```ts
  const phaseStart = getPhaseStartDate(currentPhase);  // see below
  const { data, error } = await supabase.rpc("confirm_phase_setup", {
    p_team_id: teamId,
    p_current_phase_id: currentPhase.id,
    p_current_phase_label: currentPhase.label,
    p_phase_start: phaseStart.toISOString(),
  });
  ```

  Add a helper at the top of the file (or in `apps/web/lib/phases.ts` if appropriate):
  ```ts
  function getPhaseStartDate(phase: AuctionPhase, year = new Date().getFullYear()): Date {
    return new Date(Date.UTC(year, phase.startMonth - 1, phase.startDay));
  }
  ```

- [ ] **Step 4: Apply and verify**

  ```bash
  supabase db push --local
  ```

  Verify the new signature:
  ```bash
  docker exec -i supabase_db_WattHunter psql -U postgres -d postgres -c "
  SELECT pg_get_function_arguments(oid)
  FROM pg_proc WHERE proname = 'confirm_phase_setup';
  "
  ```
  Expected: `p_team_id uuid, p_current_phase_id integer, p_current_phase_label text, p_phase_start timestamp with time zone`.

- [ ] **Step 5: Run existing TS tests**

  ```bash
  cd apps/web && pnpm test
  ```
  Expected: all tests pass. If `confirmPhaseSetup` test fails (because of new arg), update the test fixture in `apps/web/app/(game)/league/[leagueId]/auction/market/actions.test.ts` to include `p_phase_start`.

- [ ] **Step 6: Commit**

  ```bash
  git add supabase/migrations/20260509140003_confirm_phase_setup_skip_late_joiners.sql \
          apps/web/app/\(game\)/league/\[leagueId\]/auction/market/actions.ts \
          apps/web/app/\(game\)/league/\[leagueId\]/auction/market/actions.test.ts
  git commit -m "feat(db): confirm_phase_setup skips late joiners (team.created_at >= phase_start)"
  ```

---

## Task 6 — Wire helper at round-open in `forceResolveRound`

**Files:**
- Modify: `apps/web/app/(game)/league/[leagueId]/auction/actions.ts`

After opening the next auction (around line 530-536), call the helper RPC for that newly-opened auction. This ensures teams that became non-actionable during the closed round get marked auto-validated immediately at the open of the next round.

- [ ] **Step 1: Modify `forceResolveRound`**

  Open `apps/web/app/(game)/league/[leagueId]/auction/actions.ts` and locate the block at lines 519-536 (the "Open next scheduled auction" section).

  After the `if (nextAuction) { ... }` block, but BEFORE the revalidate calls at line 538, add:

  ```ts
  // 9b. Mark teams that can't place any bid as auto-validated on the new round.
  //     Helper is idempotent (ON CONFLICT DO NOTHING on round_validations).
  if (nextAuctionId) {
    const currentPhase = getCurrentPhase();
    await admin.rpc("auto_validate_unactionable_teams", {
      p_auction_id: nextAuctionId,
      p_league_id: leagueId,
      p_current_phase_id: currentPhase.id,
    });
  }
  ```

  Make sure `getCurrentPhase` is imported at the top of the file. If not present, add:
  ```ts
  import { getCurrentPhase } from "@/lib/phases";
  ```

- [ ] **Step 2: Run typecheck**

  ```bash
  cd apps/web && pnpm typecheck
  ```
  Expected: 0 errors. If `auto_validate_unactionable_teams` is missing from the generated types, regenerate (`pnpm gen:types`) and try again.

- [ ] **Step 3: Update affected vitest tests**

  Open `apps/web/app/(game)/league/[leagueId]/auction/status/actions.test.ts`. The existing tests don't mock `admin.rpc(...)`. Add a hoisted mock for it.

  At the top with the other hoisted mocks (around line 12), add:
  ```ts
  const { mockGetUser, mockAnonFrom, mockAdminFrom, mockAdminRpc, mockGetCurrentPhase } = vi.hoisted(() => ({
    mockGetUser: vi.fn(),
    mockAnonFrom: vi.fn(),
    mockAdminFrom: vi.fn(),
    mockAdminRpc: vi.fn().mockResolvedValue({ data: 0, error: null }),
    mockGetCurrentPhase: vi.fn(),
  }));
  ```

  Update the admin mock to include rpc:
  ```ts
  vi.mock("@/lib/supabase/admin", () => ({
    createAdminClient: vi.fn(() => ({
      from: mockAdminFrom,
      rpc: mockAdminRpc,
    })),
  }));
  ```

  In the existing tests where `nextAuction` returns a real id (the "ports Python" test), the helper will be called. The mock returns `{ data: 0, error: null }` so it doesn't break the flow. Verify the test still expects the same outcome (`ok: true, resolved: 1, next_auction_id: ...`).

  In tests where `nextAuction` returns null, the helper is NOT called. That's the regression test "resolution does not deduct treasury (deferred to payday)" — verify it still passes without changes.

- [ ] **Step 4: Run tests**

  ```bash
  cd apps/web && pnpm test status/actions.test
  ```
  Expected: all 8 tests pass.

- [ ] **Step 5: Commit**

  ```bash
  git add apps/web/app/\(game\)/league/\[leagueId\]/auction/actions.ts \
          apps/web/app/\(game\)/league/\[leagueId\]/auction/status/actions.test.ts
  git commit -m "feat(auction): mark unactionable teams as auto-validated when next round opens"
  ```

---

## Task 7 — Cascade payday at end of Round 3

**Files:**
- Modify: `apps/web/app/(game)/league/[leagueId]/auction/actions.ts`
- Modify: `apps/web/app/(game)/league/[leagueId]/auction/status/actions.test.ts`

When `forceResolveRound` finds no `nextAuction`, this means the last round of the phase just closed. Trigger the payday cascade for all teams in the league.

- [ ] **Step 1: Add a `triggerPhasePayday` helper above `forceResolveRound`**

  Open `apps/web/app/(game)/league/[leagueId]/auction/actions.ts` and add this function above the `forceResolveRound` declaration (around line 280, before the schema declaration):

  ```ts
  // ---------------------------------------------------------------------------
  // triggerPhasePayday — cascade confirm_phase_setup for every team in the
  // league. Called by forceResolveRound when the last round of a phase closes.
  // ---------------------------------------------------------------------------
  async function triggerPhasePayday(
    admin: SupabaseClient,
    leagueId: string,
  ): Promise<{ paid: number; skippedLateJoiners: number; errors: string[] }> {
    const phase = getCurrentPhase();
    const phaseStart = new Date(
      Date.UTC(new Date().getFullYear(), phase.startMonth - 1, phase.startDay),
    );

    const { data: teams } = await admin
      .from("teams")
      .select("id, name")
      .eq("league_id", leagueId);

    let paid = 0;
    let skippedLateJoiners = 0;
    const errors: string[] = [];

    for (const team of teams ?? []) {
      const { data, error } = await admin.rpc("confirm_phase_setup", {
        p_team_id: team.id,
        p_current_phase_id: phase.id,
        p_current_phase_label: phase.label,
        p_phase_start: phaseStart.toISOString(),
      });

      if (error) {
        errors.push(`${team.name}: ${error.message}`);
        continue;
      }
      const result = data as {
        ok?: boolean;
        skippedLateJoiner?: boolean;
        error?: string;
      } | null;
      if (!result?.ok) {
        // Idempotency rejection ("Already confirmed for this phase") is fine —
        // count as skip silently.
        if (result?.error?.includes("Already confirmed")) continue;
        errors.push(`${team.name}: ${result?.error ?? "unknown error"}`);
        continue;
      }
      if (result.skippedLateJoiner) skippedLateJoiners++;
      else paid++;
    }

    return { paid, skippedLateJoiners, errors };
  }
  ```

  Add the import for `SupabaseClient` if not already present:
  ```ts
  import type { SupabaseClient } from "@supabase/supabase-js";
  ```

- [ ] **Step 2: Call the cascade from `forceResolveRound` when there is no next auction**

  Locate the block at lines 519-536. Modify the `if (nextAuction) { ... }` else path to trigger payday:

  Replace:
  ```ts
  let nextAuctionId: string | null = null;
  if (nextAuction) {
    nextAuctionId = nextAuction.id;
    await admin
      .from("auctions")
      .update({ status: "open", opens_at: new Date().toISOString() })
      .eq("id", nextAuction.id);
  }
  ```

  With:
  ```ts
  let nextAuctionId: string | null = null;
  let paydayResult: { paid: number; skippedLateJoiners: number; errors: string[] } | null = null;
  if (nextAuction) {
    nextAuctionId = nextAuction.id;
    await admin
      .from("auctions")
      .update({ status: "open", opens_at: new Date().toISOString() })
      .eq("id", nextAuction.id);
  } else {
    // Last round of the phase just closed — cascade payday for the league.
    paydayResult = await triggerPhasePayday(admin, leagueId);
    console.log(
      `[forceResolveRound] phase payday cascade: ${paydayResult.paid} paid, ${paydayResult.skippedLateJoiners} late joiners skipped, ${paydayResult.errors.length} errors`,
    );
  }
  ```

  Update the return:
  ```ts
  return {
    ok: true,
    resolved: resolvedCount,
    next_auction_id: nextAuctionId,
    payday: paydayResult,
  };
  ```

- [ ] **Step 3: Run typecheck**

  ```bash
  cd apps/web && pnpm typecheck
  ```
  Expected: 0 errors.

- [ ] **Step 4: Update the existing regression test so it doesn't trigger the cascade**

  The test "resolution does not deduct treasury (deferred to payday)" currently has `nextAuction` returning null. After Task 7, that triggers the cascade — we don't want that side-effect interfering with this test's intent.

  In `apps/web/app/(game)/league/[leagueId]/auction/status/actions.test.ts`, find this mock in the regression test:
  ```ts
  // 12. Find next scheduled auction (none — last round)
  mockAdminFrom.mockReturnValueOnce(chainable({ data: null, error: null }));
  ```

  Change it to return a real next auction so the cascade is NOT triggered:
  ```ts
  // 12. Find next scheduled auction (next round exists)
  mockAdminFrom.mockReturnValueOnce(
    chainable({ data: { id: NEXT_AUCTION_ID }, error: null })
  );
  // 13. UPDATE next auction → open
  mockAdminFrom.mockReturnValueOnce(chainable({ data: null, error: null }));
  ```

  Update the assertion:
  ```ts
  expect(mockAdminFrom).toHaveBeenCalledTimes(13);
  ```

  This keeps the test focused on "treasury not mutated", and we add a separate test for the cascade.

- [ ] **Step 5: Add a vitest test for the cascade**

  Add a new test BEFORE the closing `});` of the `describe` block:

  ```ts
  it("triggers payday cascade when last round of phase closes", async () => {
    // 1. Membership check
    mockAnonFrom.mockReturnValueOnce(
      chainable({ data: { team_id: TEAM_A }, error: null })
    );
    // 2. Optimistic lock returns Round 3 auction
    mockAdminFrom.mockReturnValueOnce(
      chainable({
        data: [{ id: AUCTION_ID, name: "Round 3", league_id: LEAGUE_ID }],
        error: null,
      })
    );
    // 3. Active bids: empty (no winners)
    mockAdminFrom.mockReturnValueOnce(chainable({ data: [], error: null }));
    // 4. Cleanup: SELECT contracts (empty)
    mockAdminFrom.mockReturnValueOnce(chainable({ data: [], error: null }));
    // 5. Find next scheduled auction → null (last round)
    mockAdminFrom.mockReturnValueOnce(chainable({ data: null, error: null }));
    // 6. SELECT teams in league for cascade
    mockAdminFrom.mockReturnValueOnce(
      chainable({
        data: [
          { id: TEAM_A, name: "Alpha" },
          { id: TEAM_B, name: "Beta" },
        ],
        error: null,
      })
    );

    // RPC mock for confirm_phase_setup × 2 (one per team)
    mockAdminRpc.mockResolvedValueOnce({
      data: { ok: true, skippedLateJoiner: false, sponsorIncome: 750000, totalSalary: 600000 },
      error: null,
    });
    mockAdminRpc.mockResolvedValueOnce({
      data: { ok: true, skippedLateJoiner: true },
      error: null,
    });

    const result = await forceResolveRound({ leagueId: LEAGUE_ID });

    expect(result).toMatchObject({
      ok: true,
      resolved: 0,
      next_auction_id: null,
      payday: { paid: 1, skippedLateJoiners: 1, errors: [] },
    });
    expect(mockAdminRpc).toHaveBeenCalledTimes(2);
    expect(mockAdminRpc).toHaveBeenCalledWith("confirm_phase_setup", expect.objectContaining({
      p_team_id: TEAM_A,
      p_current_phase_id: PHASE_ID,
    }));
  });
  ```

- [ ] **Step 6: Run tests**

  ```bash
  cd apps/web && pnpm test status/actions.test
  ```
  Expected: all 9 tests pass (8 existing + 1 new).

- [ ] **Step 7: Commit**

  ```bash
  git add apps/web/app/\(game\)/league/\[leagueId\]/auction/actions.ts \
          apps/web/app/\(game\)/league/\[leagueId\]/auction/status/actions.test.ts
  git commit -m "feat(auction): cascade payday for all teams when last round of phase closes"
  ```

---

## Task 8 — UI: show "Auto-validated" tag on Status page

**Files:**
- Modify: `apps/web/app/(game)/league/[leagueId]/auction/status/page.tsx`

The existing page reads `round_validations` to mark teams as `validated`. Now also expose `auto_validated` so the UI can render a different tag.

- [ ] **Step 1: Update the SELECT and TeamRow type**

  In `apps/web/app/(game)/league/[leagueId]/auction/status/page.tsx`, locate the `validations` query (around line 67-73):

  Replace:
  ```ts
  const { data: validations } = await supabase
    .from("round_validations")
    .select("team_id")
    .eq("auction_id", auction.id)
    .in("team_id", teamIds);
  for (const v of validations ?? []) {
    validatedTeamIds.add(v.team_id);
  }
  ```

  With:
  ```ts
  const { data: validations } = await supabase
    .from("round_validations")
    .select("team_id, auto_validated")
    .eq("auction_id", auction.id)
    .in("team_id", teamIds);
  const autoValidatedTeamIds = new Set<string>();
  for (const v of validations ?? []) {
    validatedTeamIds.add(v.team_id);
    if (v.auto_validated) {
      autoValidatedTeamIds.add(v.team_id);
    }
  }
  ```

  Update the `TeamRow` interface (line 10-20):
  ```ts
  interface TeamRow {
    team_id: string;
    team_name: string;
    level: number;
    pool_min: number;
    slots_used: number;
    slots_max: number;
    budget: number;
    purchasing_power: number;
    status: "validated" | "auto_validated" | "pending" | "not_yet_bid";
  }
  ```

  Update the status assignment logic (around line 141-148):
  ```ts
  let status: TeamRow["status"];
  if (autoValidatedTeamIds.has(team.id)) {
    status = "auto_validated";
  } else if (validatedTeamIds.has(team.id)) {
    status = "validated";
  } else if ((draftCount.get(team.id) ?? 0) > 0) {
    status = "pending";
  } else {
    status = "not_yet_bid";
  }
  ```

  Update the JSX to render the new state (around line 218-226):
  ```tsx
  {row.status === "validated" && (
    <Tag variant="success">Validated</Tag>
  )}
  {row.status === "auto_validated" && (
    <Tag variant="default">Auto-validated</Tag>
  )}
  {row.status === "pending" && (
    <Tag variant="highlighted">Pending</Tag>
  )}
  {row.status === "not_yet_bid" && (
    <Tag variant="default">Not yet bid</Tag>
  )}
  ```

- [ ] **Step 2: Run typecheck**

  ```bash
  cd apps/web && pnpm typecheck
  ```
  Expected: 0 errors.

- [ ] **Step 3: Visual smoke check on preview server**

  ```bash
  pnpm dev
  ```
  Navigate to `/league/<id>/auction/status` and verify rendering. (You can simulate auto-validation by inserting a row directly in local DB first.)

- [ ] **Step 4: Commit**

  ```bash
  git add apps/web/app/\(game\)/league/\[leagueId\]/auction/status/page.tsx
  git commit -m "feat(ui): show Auto-validated tag in league status table"
  ```

---

## Task 9 — Backfill Phase 2 (Classics Part 1)

**Files:**
- Create: `supabase/migrations/20260509140004_backfill_phase_2.sql`

Phase 2 has zero treasury_log entries. Insert sponsor (200K flat) + per-rider salary entries from contracts active during Mar 2 – Apr 1 2026. Don't touch `teams.treasury` — it already reflects historical reality.

- [ ] **Step 1: Write the migration**

  Create `supabase/migrations/20260509140004_backfill_phase_2.sql`:

  ```sql
  -- Backfill missing treasury_log entries for Phase 2 (Classics Part 1, Mar 2 2026).
  -- All teams had a flat 200K sponsor and 200K total salaries (game decision).
  -- We insert per-rider salary entries based on contracts active during that phase.
  -- teams.treasury is NOT touched — assumed already correct historically.
  --
  -- Idempotent: skips if any sponsor_payment row already exists for Phase 2.

  DO $$
  DECLARE
    v_phase_2_start  timestamptz := '2026-03-02 12:00:00+00';
    v_phase_2_end    timestamptz := '2026-04-01 23:59:59+00';
    v_already_run    boolean;
  BEGIN
    SELECT EXISTS (
      SELECT 1 FROM public.treasury_log
      WHERE created_at >= v_phase_2_start
        AND created_at <  v_phase_2_end
        AND type = 'sponsor_payment'
    ) INTO v_already_run;

    IF v_already_run THEN
      RAISE NOTICE 'Phase 2 backfill already applied; skipping.';
      RETURN;
    END IF;

    -- 1. Sponsor income — flat 200K per team
    INSERT INTO public.treasury_log (team_id, type, amount, description, created_at)
    SELECT DISTINCT
      lm.team_id,
      'sponsor_payment',
      200000,
      'Sponsor income — Classics Part 1 [backfill]',
      v_phase_2_start
    FROM public.league_members lm
    JOIN public.teams t ON t.id = lm.team_id;

    -- 2. Per-rider salary entries from contracts active during Phase 2
    INSERT INTO public.treasury_log (team_id, type, amount, description, rider_id, created_at)
    SELECT
      c.team_id,
      'payday_salary',
      -c.locked_salary,
      format('Salary — %s [backfill]', r.full_name),
      c.rider_id,
      v_phase_2_start + interval '1 second'
    FROM public.contracts c
    JOIN public.riders r ON r.id = c.rider_id
    WHERE c.purchased_at < v_phase_2_end
      AND (c.released_at IS NULL OR c.released_at > v_phase_2_start);
  END $$;
  ```

- [ ] **Step 2: Apply locally**

  ```bash
  supabase db push --local
  ```

- [ ] **Step 3: Verify counts**

  ```bash
  docker exec -i supabase_db_WattHunter psql -U postgres -d postgres -c "
  SELECT type, COUNT(*), SUM(amount)
  FROM public.treasury_log
  WHERE created_at >= '2026-03-02' AND created_at <  '2026-04-01'
  GROUP BY type ORDER BY type;
  "
  ```
  Expected: 2 rows — `payday_salary` (negative sum), `sponsor_payment` (positive sum equal to 200K × team count).

- [ ] **Step 4: Verify idempotency**

  Re-apply the migration manually:
  ```bash
  docker exec -i supabase_db_WattHunter psql -U postgres -d postgres < supabase/migrations/20260509140004_backfill_phase_2.sql
  ```
  Expected: NOTICE "Phase 2 backfill already applied; skipping." — counts unchanged.

- [ ] **Step 5: Commit**

  ```bash
  git add supabase/migrations/20260509140004_backfill_phase_2.sql
  git commit -m "feat(db): backfill Phase 2 treasury_log (sponsor 200K + per-rider salaries)"
  ```

---

## Task 10 — Backfill Phase 3 (cleanup bulk + insert per-rider)

**Files:**
- Create: `supabase/migrations/20260509140005_backfill_phase_3.sql`

Phase 3 has 8 bulk `payday_salary` entries (one per team, no `rider_id`) created by the old Python `run_payday()`. Replace them with per-rider entries. Keep the existing `sponsor_payment` rows.

- [ ] **Step 1: Write the migration**

  Create `supabase/migrations/20260509140005_backfill_phase_3.sql`:

  ```sql
  -- Backfill Phase 3 (Classics Part 2, Apr 2 2026): replace bulk payday_salary
  -- entries with per-rider entries. Keep sponsor_payment as-is. teams.treasury
  -- is NOT touched.
  --
  -- Idempotent: skip if any per-rider (rider_id IS NOT NULL) payday_salary row
  -- already exists for Phase 3.

  DO $$
  DECLARE
    v_phase_3_start  timestamptz := '2026-04-02 12:00:00+00';
    v_phase_3_end    timestamptz := '2026-05-01 23:59:59+00';
    v_payday_at      timestamptz := '2026-04-05 12:52:31+00';  -- when bulk was inserted
    v_already_run    boolean;
  BEGIN
    SELECT EXISTS (
      SELECT 1 FROM public.treasury_log
      WHERE created_at >= '2026-04-05'
        AND created_at <  '2026-04-06'
        AND type = 'payday_salary'
        AND rider_id IS NOT NULL
        AND description LIKE '%[backfill]%'
    ) INTO v_already_run;

    IF v_already_run THEN
      RAISE NOTICE 'Phase 3 backfill already applied; skipping.';
      RETURN;
    END IF;

    -- 1. Delete the bulk salary entries (descriptions like "Payday salaries — N riders")
    DELETE FROM public.treasury_log
    WHERE created_at >= '2026-04-05'
      AND created_at <  '2026-04-06'
      AND type = 'payday_salary'
      AND rider_id IS NULL
      AND description LIKE 'Payday salaries — % riders (Phase 3)';

    -- 2. Insert per-rider salary entries from contracts active during Phase 3
    INSERT INTO public.treasury_log (team_id, type, amount, description, rider_id, created_at)
    SELECT
      c.team_id,
      'payday_salary',
      -c.locked_salary,
      format('Salary — %s [backfill]', r.full_name),
      c.rider_id,
      v_payday_at
    FROM public.contracts c
    JOIN public.riders r ON r.id = c.rider_id
    WHERE c.purchased_at < v_phase_3_end
      AND (c.released_at IS NULL OR c.released_at > v_phase_3_start);
  END $$;
  ```

- [ ] **Step 2: Apply locally**

  ```bash
  supabase db push --local
  ```

- [ ] **Step 3: Verify the bulk entries were removed and per-rider added**

  ```bash
  docker exec -i supabase_db_WattHunter psql -U postgres -d postgres -c "
  SELECT
    COUNT(*) FILTER (WHERE rider_id IS NULL) AS bulk_count,
    COUNT(*) FILTER (WHERE rider_id IS NOT NULL) AS per_rider_count,
    SUM(amount) AS total_amount
  FROM public.treasury_log
  WHERE created_at >= '2026-04-05' AND created_at < '2026-04-06'
    AND type = 'payday_salary';
  "
  ```
  Expected: `bulk_count = 0`, `per_rider_count > 0`, `total_amount` matches the previous bulk total (within rounding).

- [ ] **Step 4: Verify treasury sums for one team are unchanged**

  Pick a team (e.g. bigdaddy) and re-run the formula:
  ```bash
  docker exec -i supabase_db_WattHunter psql -U postgres -d postgres -c "
  SELECT type, SUM(amount)
  FROM public.treasury_log tl
  JOIN public.teams t ON t.id = tl.team_id
  WHERE t.name = 'bigdaddy'
  GROUP BY type ORDER BY type;
  "
  ```
  Compare with the pre-migration totals (capture them before applying if needed).

- [ ] **Step 5: Commit**

  ```bash
  git add supabase/migrations/20260509140005_backfill_phase_3.sql
  git commit -m "feat(db): backfill Phase 3 per-rider salaries (replace bulk entries)"
  ```

---

## Task 11 — Apply migrations to remote DB

- [ ] **Step 1: Run typecheck + tests one more time**

  ```bash
  cd /Users/jonathanschummers/Documents/WattHunter
  cd apps/web && pnpm typecheck && pnpm test
  ```
  Expected: 0 type errors, all tests pass.

- [ ] **Step 2: Apply migrations to prod**

  ```bash
  cd /Users/jonathanschummers/Documents/WattHunter
  supabase db push --linked
  ```
  Expected: 6 migrations applied: `20260509140000`, `_140001`, `_140002`, `_140003`, `_140004`, `_140005`.

- [ ] **Step 3: Verify state on prod**

  Use `mcp__plugin_supabase_supabase__execute_sql` with project_id `uuvshpykvpnhpeondqjt`:

  ```sql
  -- Phase 2 should now have entries
  SELECT type, COUNT(*), SUM(amount) FROM treasury_log
  WHERE created_at >= '2026-03-02' AND created_at < '2026-04-01'
  GROUP BY type ORDER BY type;
  ```
  Expected: 2 rows (sponsor + salary).

  ```sql
  -- Phase 3 should now have per-rider entries (no bulk)
  SELECT
    COUNT(*) FILTER (WHERE rider_id IS NULL) AS bulk_count,
    COUNT(*) FILTER (WHERE rider_id IS NOT NULL) AS per_rider_count
  FROM treasury_log
  WHERE created_at >= '2026-04-05' AND created_at < '2026-04-06'
    AND type = 'payday_salary';
  ```
  Expected: `bulk_count = 0`, `per_rider_count` matches expectation.

  ```sql
  -- New auto_validated column exists
  SELECT column_name, data_type FROM information_schema.columns
  WHERE table_name = 'round_validations' AND column_name = 'auto_validated';
  ```
  Expected: 1 row.

  ```sql
  -- New helper function exists
  SELECT proname FROM pg_proc WHERE proname = 'auto_validate_unactionable_teams';
  ```
  Expected: 1 row.

  ```sql
  -- confirm_phase_setup has 4 args now
  SELECT pronargs FROM pg_proc WHERE proname = 'confirm_phase_setup';
  ```
  Expected: `4`.

- [ ] **Step 4: Smoke test on the live league**

  Navigate to `/league/<id>/budget?phase=1` (Phase 2 — Classics Part 1) on the production app. Verify the P&L card shows sponsor 200K and salaries breakdown (per-rider).

  Navigate to `/league/<id>/budget?phase=2` (Phase 3 — Classics Part 2). Verify the same.

  Navigate to `/league/<id>/auction/status`. Identify any team that should be auto-validated (PP < 5000): they should show the "Auto-validated" tag (after the next round opens, since the helper runs at round-open).

---

## Task 12 — Final commit + push to main

- [ ] **Step 1: Push branch and open PR**

  ```bash
  git push -u origin feat/phase-transition-payday
  gh pr create --title "feat: phase transition payday + auto-validation + backfill" \
    --body "$(cat <<'EOF'
  ## Summary
  - Cascade payday at end of Round 3 via forceResolveRound (single source of truth, no manual button)
  - Auto-validate teams with PP < 5000 or full slots (no consensus blocker)
  - Skip late joiners in confirm_phase_setup (Goudal-style)
  - Backfill Phase 2 (sponsor + per-rider salaries)
  - Backfill Phase 3 (replace bulk entries with per-rider)

  Spec: docs/superpowers/specs/2026-05-09-phase-transition-payday-design.md

  ## Test plan
  - [x] Vitest 9 tests in status/actions.test.ts pass
  - [x] Local Supabase: 6 migrations apply cleanly
  - [x] Production smoke test: budget page shows historical phases correctly
  - [x] Production smoke test: status page shows Auto-validated tag
  EOF
  )"
  ```

- [ ] **Step 2: Merge PR after approval**

  ```bash
  gh pr merge --squash --delete-branch
  ```

- [ ] **Step 3: Verify Vercel deployment**

  Wait for Vercel auto-deploy. Test on prod URL.

---

## Notes

- The cascade payday only runs when `forceResolveRound` finds no `nextAuction`. If a phase has fewer than 3 rounds for some reason, the cascade would still work (last round = no next).
- The auto-validation helper is idempotent (`ON CONFLICT DO NOTHING`). Safe to call multiple times per auction.
- The late-joiner skip uses `team.created_at >= phase_start`. If a team is created exactly at midnight of the phase start day, they're considered late joiners by this rule. Acceptable — phases never start at exactly that boundary in practice.
- `validate_round` and `forceResolveRound` are the only callers that need to update. The Python `auction.py` doesn't trigger payday — it's not a caller.
