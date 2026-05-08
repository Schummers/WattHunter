# Manual Force-Resolve Round (Phase 1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the commissioner's local `python3 resolve_now.py` step with an in-app "Resolve Round" button accessible to any league member, plus a Status table showing per-team validation state.

**Architecture:** Adds a `round_validations` display table populated by the existing `validate_round` RPC. Adds a TypeScript server action `forceResolveRound` that ports the Python resolve algorithm using a new service-role Supabase client (`apps/web/lib/supabase/admin.ts`). The button lives in a new `/auction/status` route.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Supabase (Postgres + Auth), Vitest, Tailwind v4.

**Spec:** [`docs/superpowers/specs/2026-05-08-auto-resolve-consensus-design.md`](../specs/2026-05-08-auto-resolve-consensus-design.md)

---

## File Structure

### New files
- `supabase/migrations/20260508020000_round_validations_and_force_resolve.sql` — round_validations table + modified validate_round + RLS + backfill
- `supabase/migrations/_rollback/20260508020000_round_validations_and_force_resolve_rollback.sql` — rollback (drop table, restore prior validate_round, no backfill cleanup since drop cascades)
- `apps/web/lib/supabase/admin.ts` — service-role Supabase client, server-only
- `apps/web/app/(game)/league/[leagueId]/auction/status/page.tsx` — Status tab server component
- `apps/web/app/(game)/league/[leagueId]/auction/status/status-client.tsx` — interactive bits (modal, button)
- `apps/web/app/(game)/league/[leagueId]/auction/status/actions.test.ts` — vitest for forceResolveRound (new file to keep test ownership clear)

### Modified files
- `apps/web/app/(game)/league/[leagueId]/auction/actions.ts` — ADD `forceResolveRound` server action. NO change to `validateRound`.
- `apps/web/app/(game)/league/[leagueId]/auction/layout.tsx` — ADD "Status" tab
- `apps/web/lib/database.types.ts` — regenerated to include `round_validations` table

### Unchanged
- `apps/web/app/(game)/league/[leagueId]/auction/auctions-client.tsx` — Validate Round button keeps current behavior
- `services/pcs-sync/auction.py` and `resolve_now.py` — remain as CLI fallback
- All other RPCs and routes

---

## Pre-flight: environment check

### Task 0: Verify SUPABASE_SERVICE_ROLE_KEY is configured

**Files:**
- Read: `apps/web/.env.local`

- [ ] **Step 1: Check env var exists locally**

```bash
grep -c "^SUPABASE_SERVICE_ROLE_KEY=" /Users/jonathanschummers/Documents/WattHunter/.claude/worktrees/bold-tesla-ef3f83/apps/web/.env.local
```

Expected: `1` (or higher). If `0`, ABORT and ask the user to add `SUPABASE_SERVICE_ROLE_KEY=<value from supabase dashboard>` to `apps/web/.env.local` before continuing. The service-role client will throw at module import time if the var is missing, breaking every server action.

- [ ] **Step 2: Verify Vercel has the same env var (if deployed)**

If the project is deployed on Vercel, ask the user to confirm `SUPABASE_SERVICE_ROLE_KEY` is set in the Vercel project's environment variables (Production scope at minimum). The user must verify this manually — do not run `vercel env` without their explicit ask. Mark as confirmed before proceeding to Task 1.

---

## Phase A: Database migration

### Task 1: Write the migration file

**Files:**
- Create: `supabase/migrations/20260508020000_round_validations_and_force_resolve.sql`

- [ ] **Step 1: Create the migration file**

Write the following SQL to `supabase/migrations/20260508020000_round_validations_and_force_resolve.sql`:

```sql
-- Migration: round_validations table + force-resolve foundation
--
-- 1. Adds round_validations table (display marker for "team has validated")
-- 2. Replaces validate_round with the no-lifecycle final state + INSERT round_validations
--    (matches production behavior; aligns local repo with remote rollback applied 2026-05-08)
-- 3. Backfills round_validations from existing active auction_bids so the in-flight
--    Giro 2026 league shows correct statuses immediately after deploy.

-- ============================================================
-- Table: round_validations
-- ============================================================
CREATE TABLE IF NOT EXISTS public.round_validations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id   uuid NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  team_id      uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  validated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (auction_id, team_id)
);

ALTER TABLE public.round_validations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "round_validations_select" ON public.round_validations;
CREATE POLICY "round_validations_select" ON public.round_validations
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.auctions a
      JOIN public.league_members lm ON lm.league_id = a.league_id
      WHERE a.id = round_validations.auction_id
        AND lm.user_id = auth.uid()
    )
  );

-- INSERT/UPDATE/DELETE handled exclusively by SECURITY DEFINER RPCs and the
-- service-role client. No client-facing INSERT/UPDATE/DELETE policies.

-- ============================================================
-- RPC validate_round (final state — no auction lifecycle, with round_validations UPSERT)
-- ============================================================
CREATE OR REPLACE FUNCTION public.validate_round(
  p_league_id uuid,
  p_current_phase_id int
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_team record;
  v_auction record;
  v_auction_round int;
  v_drafts_total bigint := 0;
  v_drafts_count int := 0;
  v_active_salaries bigint := 0;
  v_sponsor_income bigint := 0;
  v_available bigint;
  v_purchasing_power bigint;
  v_max_slots int;
  v_roster_count int;
  v_inserted int := 0;
BEGIN
  -- 1. Auth
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  -- 2. Resolve team for this user in the league + LOCK row
  SELECT t.* INTO v_team
  FROM public.teams t
  JOIN public.league_members lm ON lm.team_id = t.id
  WHERE lm.league_id = p_league_id
    AND lm.user_id = v_user_id
    AND t.user_id = v_user_id
  FOR UPDATE OF t;

  IF v_team IS NULL THEN
    RETURN jsonb_build_object('error', 'Team not found');
  END IF;

  -- 3. Find open auction for this league + LOCK row
  SELECT * INTO v_auction
  FROM public.auctions
  WHERE league_id = p_league_id AND status = 'open'
  ORDER BY opens_at ASC
  LIMIT 1
  FOR UPDATE;

  IF v_auction IS NULL THEN
    RETURN jsonb_build_object('error', 'No open auction round found');
  END IF;

  -- Determine round (per-team submission version inside this auction)
  SELECT COALESCE(MAX(round), 0) + 1 INTO v_auction_round
  FROM public.auction_bids
  WHERE auction_id = v_auction.id AND team_id = v_team.id;

  -- 4. Sum draft bids for this team + league
  SELECT COALESCE(SUM(amount), 0), COUNT(*)
  INTO v_drafts_total, v_drafts_count
  FROM public.draft_bids
  WHERE team_id = v_team.id AND league_id = p_league_id;

  -- 5. Sum active contract salaries
  SELECT COALESCE(SUM(locked_salary), 0), COUNT(*)
  INTO v_active_salaries, v_roster_count
  FROM public.contracts
  WHERE team_id = v_team.id AND status = 'active';

  -- 6. Get sponsor income
  SELECT COALESCE(s.monthly_budget, 0) INTO v_sponsor_income
  FROM public.team_sponsors ts
  JOIN public.sponsors s ON s.id = ts.sponsor_id
  WHERE ts.team_id = v_team.id;

  IF NOT FOUND THEN
    v_sponsor_income := 0;
  END IF;

  -- 7. Budget check (pre-payday vs post-payday)
  IF v_team.phase_confirmed_id = p_current_phase_id THEN
    v_purchasing_power := v_team.treasury;
    v_available := v_team.treasury - v_drafts_total;
  ELSE
    v_purchasing_power := v_team.treasury + v_sponsor_income - v_active_salaries;
    v_available := v_purchasing_power - v_drafts_total;
  END IF;

  IF v_available < 0 THEN
    RETURN jsonb_build_object(
      'error',
      format(
        'Budget exceeded: your draft bids total %s € but your purchasing power is only %s €. Please reduce bids by %s €.',
        v_drafts_total,
        v_purchasing_power,
        -v_available
      )
    );
  END IF;

  -- 8. Slot check
  v_max_slots := CASE v_team.level
    WHEN 8 THEN 12 WHEN 7 THEN 12 WHEN 6 THEN 11
    WHEN 5 THEN 10 WHEN 4 THEN 9 WHEN 3 THEN 8
    WHEN 2 THEN 7 ELSE 6
  END;

  IF v_roster_count + v_drafts_count > v_max_slots THEN
    RETURN jsonb_build_object(
      'error',
      format('Roster limit exceeded: %s active + %s new bids = %s riders, but your level allows %s slots',
             v_roster_count, v_drafts_count, v_roster_count + v_drafts_count, v_max_slots)
    );
  END IF;

  -- 9. Cancel previous active bids for this team in this auction
  UPDATE public.auction_bids
  SET status = 'cancelled'
  WHERE auction_id = v_auction.id
    AND team_id = v_team.id
    AND status = 'active';

  -- 10. Insert new auction_bids from draft_bids
  INSERT INTO public.auction_bids (auction_id, team_id, rider_id, amount, round, status, placed_at)
  SELECT v_auction.id, v_team.id, db.rider_id, db.amount, v_auction_round, 'active', now()
  FROM public.draft_bids db
  WHERE db.team_id = v_team.id AND db.league_id = p_league_id;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  -- 11. Record validation marker (idempotent — re-validate just refreshes timestamp)
  INSERT INTO public.round_validations (auction_id, team_id, validated_at)
  VALUES (v_auction.id, v_team.id, now())
  ON CONFLICT (auction_id, team_id) DO UPDATE SET validated_at = now();

  RETURN jsonb_build_object('ok', true, 'inserted', v_inserted);
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_round(uuid, int) TO authenticated;

-- ============================================================
-- Backfill: mark teams with active bids as already validated
-- ============================================================
INSERT INTO public.round_validations (auction_id, team_id, validated_at)
SELECT
  ab.auction_id,
  ab.team_id,
  MIN(ab.placed_at)
FROM public.auction_bids ab
JOIN public.auctions a ON a.id = ab.auction_id
WHERE a.status = 'open'
  AND ab.status = 'active'
GROUP BY ab.auction_id, ab.team_id
ON CONFLICT (auction_id, team_id) DO NOTHING;
```

- [ ] **Step 2: Write the rollback file**

Create `supabase/migrations/_rollback/20260508020000_round_validations_and_force_resolve_rollback.sql`:

```sql
-- Rollback: round_validations table + restore prior validate_round (with no-lifecycle behavior).
-- This rollback restores the validate_round body that was in production via the manual
-- rollback applied 2026-05-08 (file: _rollback/20260508000000_round_lifecycle_rollback.sql).
-- After running this rollback the schema looks like before this migration was applied.

DROP TABLE IF EXISTS public.round_validations CASCADE;

CREATE OR REPLACE FUNCTION public.validate_round(
  p_league_id uuid,
  p_current_phase_id int
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_team record;
  v_auction record;
  v_auction_round int;
  v_drafts_total bigint := 0;
  v_drafts_count int := 0;
  v_active_salaries bigint := 0;
  v_sponsor_income bigint := 0;
  v_available bigint;
  v_purchasing_power bigint;
  v_max_slots int;
  v_roster_count int;
  v_inserted int := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT t.* INTO v_team
  FROM public.teams t
  JOIN public.league_members lm ON lm.team_id = t.id
  WHERE lm.league_id = p_league_id
    AND lm.user_id = v_user_id
    AND t.user_id = v_user_id
  FOR UPDATE OF t;

  IF v_team IS NULL THEN
    RETURN jsonb_build_object('error', 'Team not found');
  END IF;

  SELECT * INTO v_auction
  FROM public.auctions
  WHERE league_id = p_league_id AND status = 'open'
  ORDER BY opens_at ASC
  LIMIT 1
  FOR UPDATE;

  IF v_auction IS NULL THEN
    RETURN jsonb_build_object('error', 'No open auction round found');
  END IF;

  SELECT COALESCE(MAX(round), 0) + 1 INTO v_auction_round
  FROM public.auction_bids
  WHERE auction_id = v_auction.id AND team_id = v_team.id;

  SELECT COALESCE(SUM(amount), 0), COUNT(*)
  INTO v_drafts_total, v_drafts_count
  FROM public.draft_bids
  WHERE team_id = v_team.id AND league_id = p_league_id;

  SELECT COALESCE(SUM(locked_salary), 0), COUNT(*)
  INTO v_active_salaries, v_roster_count
  FROM public.contracts
  WHERE team_id = v_team.id AND status = 'active';

  SELECT COALESCE(s.monthly_budget, 0) INTO v_sponsor_income
  FROM public.team_sponsors ts
  JOIN public.sponsors s ON s.id = ts.sponsor_id
  WHERE ts.team_id = v_team.id;

  IF NOT FOUND THEN
    v_sponsor_income := 0;
  END IF;

  IF v_team.phase_confirmed_id = p_current_phase_id THEN
    v_purchasing_power := v_team.treasury;
    v_available := v_team.treasury - v_drafts_total;
  ELSE
    v_purchasing_power := v_team.treasury + v_sponsor_income - v_active_salaries;
    v_available := v_purchasing_power - v_drafts_total;
  END IF;

  IF v_available < 0 THEN
    RETURN jsonb_build_object(
      'error',
      format(
        'Budget exceeded: your draft bids total %s € but your purchasing power is only %s €. Please reduce bids by %s €.',
        v_drafts_total,
        v_purchasing_power,
        -v_available
      )
    );
  END IF;

  v_max_slots := CASE v_team.level
    WHEN 8 THEN 12 WHEN 7 THEN 12 WHEN 6 THEN 11
    WHEN 5 THEN 10 WHEN 4 THEN 9 WHEN 3 THEN 8
    WHEN 2 THEN 7 ELSE 6
  END;

  IF v_roster_count + v_drafts_count > v_max_slots THEN
    RETURN jsonb_build_object(
      'error',
      format('Roster limit exceeded: %s active + %s new bids = %s riders, but your level allows %s slots',
             v_roster_count, v_drafts_count, v_roster_count + v_drafts_count, v_max_slots)
    );
  END IF;

  UPDATE public.auction_bids
  SET status = 'cancelled'
  WHERE auction_id = v_auction.id
    AND team_id = v_team.id
    AND status = 'active';

  INSERT INTO public.auction_bids (auction_id, team_id, rider_id, amount, round, status, placed_at)
  SELECT v_auction.id, v_team.id, db.rider_id, db.amount, v_auction_round, 'active', now()
  FROM public.draft_bids db
  WHERE db.team_id = v_team.id AND db.league_id = p_league_id;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  RETURN jsonb_build_object('ok', true, 'inserted', v_inserted);
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_round(uuid, int) TO authenticated;
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260508020000_round_validations_and_force_resolve.sql supabase/migrations/_rollback/20260508020000_round_validations_and_force_resolve_rollback.sql
git commit -m "feat(db): add round_validations table + validate_round UPSERT"
```

### Task 2: Apply migration locally and verify

**Files:** none (verification only)

- [ ] **Step 1: Start local Supabase if not already running**

Run: `supabase status 2>&1 | head -3`

If output says "Stopped" or errors out, start it:
```bash
colima start --cpu 4 --memory 6 2>/dev/null
supabase start --exclude vector,edge-runtime,logflare,imgproxy,studio,mailpit
```

If output shows API URL `http://127.0.0.1:54321`, Supabase is already running. Continue.

- [ ] **Step 2: Reset DB to apply all migrations from scratch**

Run: `supabase db reset`

Expected: completes without errors. Lists each migration applied including `20260508020000_round_validations_and_force_resolve.sql` at the end.

- [ ] **Step 3: Verify table exists**

Run:
```bash
docker exec -i supabase_db_WattHunter psql -U postgres -d postgres -c "\d round_validations"
```

Expected output: a table description showing 4 columns (id, auction_id, team_id, validated_at) and the unique constraint on `(auction_id, team_id)`.

- [ ] **Step 4: Verify validate_round body has the INSERT round_validations step**

Run:
```bash
docker exec -i supabase_db_WattHunter psql -U postgres -d postgres -c "\df+ validate_round" | grep -c "round_validations"
```

Expected output: `2` or higher (the INSERT statement and the conflict target both reference the table name).

If `0`: the migration's CREATE OR REPLACE didn't take effect. Re-run `supabase db reset`.

- [ ] **Step 5: Verify RLS is enabled**

Run:
```bash
docker exec -i supabase_db_WattHunter psql -U postgres -d postgres -c "SELECT relrowsecurity FROM pg_class WHERE relname = 'round_validations';"
```

Expected: `t`.

### Task 3: Regenerate Supabase database types

**Files:**
- Modify: `apps/web/lib/database.types.ts` (regenerated)

- [ ] **Step 1: Regenerate types from local DB**

From the worktree root:
```bash
supabase gen types typescript --local > apps/web/lib/database.types.ts
```

Expected: file is rewritten. No errors.

- [ ] **Step 2: Verify round_validations is in the regenerated file**

Run:
```bash
grep -c "round_validations" apps/web/lib/database.types.ts
```

Expected: `5` or higher (table definition + Row + Insert + Update + Relationships).

If `0`: regeneration failed. Re-run with `--debug` and inspect.

- [ ] **Step 3: Run typecheck to confirm no breakages elsewhere**

```bash
cd apps/web && pnpm typecheck
```

Expected: `Found 0 errors.` If new errors appear, they should ONLY be in files we'll modify in later tasks. If existing files break (unrelated to round_validations), STOP and investigate before proceeding.

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/database.types.ts
git commit -m "chore(types): regenerate database.types after round_validations migration"
```

---

## Phase B: Service-role client

### Task 4: Add the admin Supabase client

**Files:**
- Create: `apps/web/lib/supabase/admin.ts`

- [ ] **Step 1: Create the file**

Write to `apps/web/lib/supabase/admin.ts`:

```typescript
import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
  );
}

/**
 * Service-role Supabase client. Bypasses RLS and triggers like
 * `teams_protect_sensitive_fields`. Server-only — `import "server-only"` at
 * the top of this file makes the build fail if a client component imports it.
 *
 * Used exclusively by mutation flows that mirror the Python pipeline
 * (forceResolveRound). Do NOT add new callers without review.
 */
export function createAdminClient() {
  return createClient<Database>(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
```

- [ ] **Step 2: Confirm typecheck still passes**

```bash
cd apps/web && pnpm typecheck
```

Expected: `Found 0 errors.`

If it fails on `import "server-only"`, the package may not be installed. Run:
```bash
cd apps/web && pnpm add server-only
```

then re-run typecheck.

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/supabase/admin.ts apps/web/package.json apps/web/pnpm-lock.yaml 2>/dev/null
git commit -m "feat(lib): add service-role Supabase admin client (server-only)"
```

(The `2>/dev/null` swallows errors if package.json/lock didn't change.)

---

## Phase C: forceResolveRound server action

This is the largest task. Port `services/pcs-sync/auction.py::resolve_current_round` + `_close_auction` + `_cleanup_stale_drafts` to TypeScript.

### Task 5: Write the failing tests for forceResolveRound

**Files:**
- Create: `apps/web/app/(game)/league/[leagueId]/auction/status/actions.test.ts`

- [ ] **Step 1: Create the test file**

Write to `apps/web/app/(game)/league/[leagueId]/auction/status/actions.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  mockGetUser,
  mockAnonFrom,
  mockAdminFrom,
  mockGetCurrentPhase,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockAnonFrom: vi.fn(),
  mockAdminFrom: vi.fn(),
  mockGetCurrentPhase: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockAnonFrom,
  })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: mockAdminFrom,
  })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/phases", () => ({
  getCurrentPhase: mockGetCurrentPhase,
}));

import { forceResolveRound } from "../actions";

// ---------------------------------------------------------------------------
// Test UUIDs (RFC-4122 v4)
// ---------------------------------------------------------------------------

const LEAGUE_ID = "cccccccc-0000-4000-8000-000000000001";
const USER_ID = "aaaaaaaa-0000-4000-8000-000000000001";
const TEAM_A = "11111111-0000-4000-8000-000000000001";
const TEAM_B = "22222222-0000-4000-8000-000000000002";
const RIDER_X = "33333333-0000-4000-8000-000000000003";
const AUCTION_ID = "44444444-0000-4000-8000-000000000004";
const NEXT_AUCTION_ID = "55555555-0000-4000-8000-000000000005";

const PHASE_ID = 4; // Giro

// ---------------------------------------------------------------------------
// Shared chainable-query helper
// ---------------------------------------------------------------------------

interface QueryResult<T = unknown> {
  data: T | null;
  error: { message: string } | null;
}

/**
 * Build a chainable mock that matches Supabase's PostgREST query builder.
 * Each method returns `this` until a terminal method is called.
 *
 * Use `.terminate(result)` to set the resolved value of the final await.
 */
function chainable(result: QueryResult): unknown {
  const proxy: Record<string, unknown> = {};
  const passthroughs = [
    "select", "insert", "upsert", "update", "delete",
    "eq", "in", "lt", "gt", "is", "neq", "or",
    "order", "limit", "single", "maybeSingle",
  ];
  for (const m of passthroughs) {
    proxy[m] = vi.fn(() => proxy);
  }
  // `.then` makes the proxy thenable (resolves to the result) for `await`.
  proxy.then = (onFulfilled: (r: QueryResult) => unknown) =>
    Promise.resolve(result).then(onFulfilled);
  return proxy;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("forceResolveRound", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentPhase.mockReturnValue({ id: PHASE_ID, label: "Giro d'Italia" });
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
  });

  it("rejects non-UUID leagueId", async () => {
    const result = await forceResolveRound({ leagueId: "not-a-uuid" });
    expect(result).toMatchObject({ error: expect.any(String) });
  });

  it("rejects unauthenticated callers", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const result = await forceResolveRound({ leagueId: LEAGUE_ID });
    expect(result).toMatchObject({ error: expect.stringMatching(/auth/i) });
  });

  it("rejects callers who are not members of the league", async () => {
    // First chained query (league membership check) returns null
    mockAnonFrom.mockReturnValueOnce(
      chainable({ data: null, error: null })
    );
    const result = await forceResolveRound({ leagueId: LEAGUE_ID });
    expect(result).toMatchObject({ error: expect.stringMatching(/member/i) });
  });

  it("returns error if no open auction exists", async () => {
    // Membership check passes
    mockAnonFrom.mockReturnValueOnce(
      chainable({ data: { team_id: TEAM_A }, error: null })
    );
    // Optimistic lock: UPDATE auctions SET status='closed' WHERE status='open' returns 0 rows
    mockAdminFrom.mockReturnValueOnce(
      chainable({ data: [], error: null })
    );
    const result = await forceResolveRound({ leagueId: LEAGUE_ID });
    expect(result).toMatchObject({
      error: expect.stringMatching(/no open round/i),
    });
  });

  it("ports Python: highest bid wins, losers marked outbid", async () => {
    // 1. Membership check
    mockAnonFrom.mockReturnValueOnce(
      chainable({ data: { team_id: TEAM_A }, error: null })
    );
    // 2. Optimistic lock + return locked auction
    mockAdminFrom.mockReturnValueOnce(
      chainable({
        data: [{ id: AUCTION_ID, name: "Round 2", league_id: LEAGUE_ID }],
        error: null,
      })
    );
    // 3. Fetch active bids
    mockAdminFrom.mockReturnValueOnce(
      chainable({
        data: [
          {
            id: "bid-a",
            rider_id: RIDER_X,
            team_id: TEAM_A,
            amount: 12_000,
            placed_at: "2026-05-08T10:00:00Z",
          },
          {
            id: "bid-b",
            rider_id: RIDER_X,
            team_id: TEAM_B,
            amount: 10_000,
            placed_at: "2026-05-08T09:00:00Z",
          },
        ],
        error: null,
      })
    );
    // 4. Fetch rider for level gating
    mockAdminFrom.mockReturnValueOnce(
      chainable({
        data: { id: RIDER_X, full_name: "Test Rider", pcs_rank: 50 },
        error: null,
      })
    );
    // 5. Fetch team for level gating
    mockAdminFrom.mockReturnValueOnce(
      chainable({ data: { id: TEAM_A, level: 4, treasury: 100_000 }, error: null })
    );
    // 6. Existing-contract check (none)
    mockAdminFrom.mockReturnValueOnce(
      chainable({ data: null, error: null })
    );
    // 7. UPDATE winner bid
    mockAdminFrom.mockReturnValueOnce(chainable({ data: null, error: null }));
    // 8. UPDATE loser bids
    mockAdminFrom.mockReturnValueOnce(chainable({ data: null, error: null }));
    // 9. INSERT contract
    mockAdminFrom.mockReturnValueOnce(chainable({ data: null, error: null }));
    // 10. UPDATE rider is_active_in_game
    mockAdminFrom.mockReturnValueOnce(chainable({ data: null, error: null }));
    // 11. UPDATE team treasury (Round 2+)
    mockAdminFrom.mockReturnValueOnce(chainable({ data: null, error: null }));
    // 12. INSERT treasury_log
    mockAdminFrom.mockReturnValueOnce(chainable({ data: null, error: null }));
    // 13. Cleanup: SELECT contracts (returns the new contract for RIDER_X)
    mockAdminFrom.mockReturnValueOnce(
      chainable({ data: [{ rider_id: RIDER_X }], error: null })
    );
    // 14. Cleanup: DELETE draft_bids
    mockAdminFrom.mockReturnValueOnce(chainable({ data: null, error: null }));
    // 15. Find next scheduled auction
    mockAdminFrom.mockReturnValueOnce(
      chainable({ data: { id: NEXT_AUCTION_ID }, error: null })
    );
    // 16. UPDATE next auction → open
    mockAdminFrom.mockReturnValueOnce(chainable({ data: null, error: null }));

    const result = await forceResolveRound({ leagueId: LEAGUE_ID });

    expect(result).toMatchObject({
      ok: true,
      resolved: 1,
      next_auction_id: NEXT_AUCTION_ID,
    });
  });

  it("Round 1 skips treasury deduction", async () => {
    // 1. Membership check
    mockAnonFrom.mockReturnValueOnce(
      chainable({ data: { team_id: TEAM_A }, error: null })
    );
    // 2. Optimistic lock returns Round 1 auction
    mockAdminFrom.mockReturnValueOnce(
      chainable({
        data: [{ id: AUCTION_ID, name: "Round 1", league_id: LEAGUE_ID }],
        error: null,
      })
    );
    // 3. Active bids: one rider, one bidder
    mockAdminFrom.mockReturnValueOnce(
      chainable({
        data: [
          {
            id: "bid-a",
            rider_id: RIDER_X,
            team_id: TEAM_A,
            amount: 12_000,
            placed_at: "2026-05-08T10:00:00Z",
          },
        ],
        error: null,
      })
    );
    // 4. Rider
    mockAdminFrom.mockReturnValueOnce(
      chainable({
        data: { id: RIDER_X, full_name: "Test Rider", pcs_rank: 50 },
        error: null,
      })
    );
    // 5. Team
    mockAdminFrom.mockReturnValueOnce(
      chainable({ data: { id: TEAM_A, level: 4, treasury: 100_000 }, error: null })
    );
    // 6. Contract check
    mockAdminFrom.mockReturnValueOnce(chainable({ data: null, error: null }));
    // 7. Mark winner won
    mockAdminFrom.mockReturnValueOnce(chainable({ data: null, error: null }));
    // 8. Mark losers outbid (no losers; still chainable)
    mockAdminFrom.mockReturnValueOnce(chainable({ data: null, error: null }));
    // 9. INSERT contract
    mockAdminFrom.mockReturnValueOnce(chainable({ data: null, error: null }));
    // 10. Update rider
    mockAdminFrom.mockReturnValueOnce(chainable({ data: null, error: null }));
    // ROUND 1: no treasury update, no treasury_log insert
    // 11. Cleanup: SELECT contracts (returns the new contract for RIDER_X)
    mockAdminFrom.mockReturnValueOnce(
      chainable({ data: [{ rider_id: RIDER_X }], error: null })
    );
    // 12. Cleanup: DELETE draft_bids
    mockAdminFrom.mockReturnValueOnce(chainable({ data: null, error: null }));
    // 13. Find next scheduled auction (none — last round)
    mockAdminFrom.mockReturnValueOnce(chainable({ data: null, error: null }));

    const result = await forceResolveRound({ leagueId: LEAGUE_ID });

    expect(result).toMatchObject({ ok: true, resolved: 1 });
  });

  it("level-gated rider has all bids cancelled, no contract", async () => {
    mockAnonFrom.mockReturnValueOnce(
      chainable({ data: { team_id: TEAM_A }, error: null })
    );
    mockAdminFrom.mockReturnValueOnce(
      chainable({
        data: [{ id: AUCTION_ID, name: "Round 2", league_id: LEAGUE_ID }],
        error: null,
      })
    );
    mockAdminFrom.mockReturnValueOnce(
      chainable({
        data: [
          {
            id: "bid-a",
            rider_id: RIDER_X,
            team_id: TEAM_A,
            amount: 12_000,
            placed_at: "2026-05-08T10:00:00Z",
          },
        ],
        error: null,
      })
    );
    // Rider has pcs_rank=2 (very high); team is level 1 → poolMin=300 → BLOCKED
    mockAdminFrom.mockReturnValueOnce(
      chainable({
        data: { id: RIDER_X, full_name: "Top Rider", pcs_rank: 2 },
        error: null,
      })
    );
    mockAdminFrom.mockReturnValueOnce(
      chainable({ data: { id: TEAM_A, level: 1, treasury: 100_000 }, error: null })
    );
    // Cancel all bids for this rider (level-gated)
    mockAdminFrom.mockReturnValueOnce(chainable({ data: null, error: null }));
    // Cleanup: SELECT contracts (no contracts → no DELETE)
    mockAdminFrom.mockReturnValueOnce(chainable({ data: [], error: null }));
    // Find next scheduled auction
    mockAdminFrom.mockReturnValueOnce(chainable({ data: null, error: null }));

    const result = await forceResolveRound({ leagueId: LEAGUE_ID });

    expect(result).toMatchObject({ ok: true, resolved: 0 });
  });

  it("rider with existing contract has all bids cancelled", async () => {
    mockAnonFrom.mockReturnValueOnce(
      chainable({ data: { team_id: TEAM_A }, error: null })
    );
    mockAdminFrom.mockReturnValueOnce(
      chainable({
        data: [{ id: AUCTION_ID, name: "Round 2", league_id: LEAGUE_ID }],
        error: null,
      })
    );
    mockAdminFrom.mockReturnValueOnce(
      chainable({
        data: [
          {
            id: "bid-a",
            rider_id: RIDER_X,
            team_id: TEAM_A,
            amount: 12_000,
            placed_at: "2026-05-08T10:00:00Z",
          },
        ],
        error: null,
      })
    );
    mockAdminFrom.mockReturnValueOnce(
      chainable({
        data: { id: RIDER_X, full_name: "Test", pcs_rank: 50 },
        error: null,
      })
    );
    mockAdminFrom.mockReturnValueOnce(
      chainable({ data: { id: TEAM_A, level: 4, treasury: 100_000 }, error: null })
    );
    // Existing contract found
    mockAdminFrom.mockReturnValueOnce(
      chainable({ data: { id: "existing-contract" }, error: null })
    );
    // Cancel all bids
    mockAdminFrom.mockReturnValueOnce(chainable({ data: null, error: null }));
    // Cleanup: SELECT contracts (the existing contract is still active in this league)
    mockAdminFrom.mockReturnValueOnce(
      chainable({ data: [{ rider_id: RIDER_X }], error: null })
    );
    // Cleanup: DELETE draft_bids
    mockAdminFrom.mockReturnValueOnce(chainable({ data: null, error: null }));
    // Find next scheduled auction
    mockAdminFrom.mockReturnValueOnce(chainable({ data: null, error: null }));

    const result = await forceResolveRound({ leagueId: LEAGUE_ID });

    expect(result).toMatchObject({ ok: true, resolved: 0 });
  });
});
```

- [ ] **Step 2: Run the tests to verify they ALL fail**

```bash
cd apps/web && pnpm vitest run app/\(game\)/league/\[leagueId\]/auction/status/actions.test.ts
```

Expected: tests FAIL with errors like `forceResolveRound is not exported from '../actions'` or `Cannot find module`.

If any test passes accidentally, the test infrastructure is broken — STOP and fix before continuing.

- [ ] **Step 3: Commit failing tests**

```bash
git add apps/web/app/\(game\)/league/\[leagueId\]/auction/status/actions.test.ts
git commit -m "test(forceResolveRound): add failing tests for resolve port"
```

### Task 6: Implement forceResolveRound server action

**Files:**
- Modify: `apps/web/app/(game)/league/[leagueId]/auction/actions.ts`

- [ ] **Step 1: Append the imports and helper at the top of actions.ts**

In `apps/web/app/(game)/league/[leagueId]/auction/actions.ts`, add to the existing import block at the top of the file:

```typescript
import { createAdminClient } from "@/lib/supabase/admin";
import { LEVELS } from "@/lib/levels";
```

(The file already imports `createClient` from `@/lib/supabase/server`, `revalidatePath`, `z`, `getCurrentPhase`. Just add the two new lines.)

- [ ] **Step 2: Append the `forceResolveRound` action at the end of actions.ts**

Append this code at the end of `apps/web/app/(game)/league/[leagueId]/auction/actions.ts`:

```typescript
// ---------------------------------------------------------------------------
// forceResolveRound — port of services/pcs-sync/auction.py::resolve_current_round
// ---------------------------------------------------------------------------

const ForceResolveSchema = z.object({
  leagueId: z.string().uuid(),
});

interface ResolvedAuction {
  id: string;
  name: string;
  league_id: string;
}

interface ActiveBid {
  id: string;
  rider_id: string;
  team_id: string;
  amount: number;
  placed_at: string;
}

/**
 * Returns the minimum PCS rank a rider must have for a team at this level
 * to be allowed to bid. e.g. level 1 → 300 means riders ranked 1-299 are
 * blocked. Mirrors `LEVEL_POOL_MIN` in services/pcs-sync/sync.py.
 */
function poolMinForLevel(level: number): number {
  const idx = Math.max(0, Math.min(level, 8) - 1);
  return LEVELS[idx].poolMin;
}

export async function forceResolveRound(input: { leagueId: string }) {
  const parsed = ForceResolveSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid data" };
  }
  const { leagueId } = parsed.data;

  // 1. Auth (anon client)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // 2. Membership check (anon client + RLS)
  const { data: membership } = await supabase
    .from("league_members")
    .select("team_id")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    return { error: "Not a member of this league" };
  }

  // 3. Switch to admin client for mutations
  const admin = createAdminClient();
  const phase = getCurrentPhase();
  const today = new Date().toISOString().slice(0, 10);

  // 4. Optimistic lock: claim the open auction by transitioning to 'closed'.
  //    Concurrent calls will match 0 rows on this UPDATE (since status is
  //    no longer 'open' after the first call commits) and return [].
  const { data: lockedRows, error: lockErr } = await admin
    .from("auctions")
    .update({ status: "closed", resolved_at: new Date().toISOString() })
    .eq("league_id", leagueId)
    .eq("status", "open")
    .select("id, name, league_id");

  if (lockErr) return { error: lockErr.message };

  const auctions = (lockedRows ?? []) as ResolvedAuction[];
  if (auctions.length === 0) {
    return { error: "No open round to resolve (already closed?)" };
  }
  // Should only ever be 1 open auction per league; iterate defensively.
  const auction = auctions[0];

  // 5. Fetch all active bids for this auction
  const { data: bidsRaw, error: bidsErr } = await admin
    .from("auction_bids")
    .select("id, rider_id, team_id, amount, placed_at")
    .eq("auction_id", auction.id)
    .eq("status", "active");

  if (bidsErr) return { error: bidsErr.message };

  const bids = (bidsRaw ?? []) as ActiveBid[];

  // 6. Group by rider_id
  const byRider = new Map<string, ActiveBid[]>();
  for (const bid of bids) {
    const list = byRider.get(bid.rider_id) ?? [];
    list.push(bid);
    byRider.set(bid.rider_id, list);
  }

  const isRound1 = /round 1/i.test(auction.name);
  let resolvedCount = 0;

  // 7. For each rider — winner + losers
  for (const [riderId, riderBids] of byRider.entries()) {
    // Sort: highest amount first, tiebreak earliest placed_at
    riderBids.sort((a, b) => {
      if (b.amount !== a.amount) return b.amount - a.amount;
      return a.placed_at.localeCompare(b.placed_at);
    });
    const winner = riderBids[0];
    const losers = riderBids.slice(1);

    // 7a. Fetch rider for level gating
    const { data: rider } = await admin
      .from("riders")
      .select("id, full_name, pcs_rank")
      .eq("id", riderId)
      .maybeSingle();

    // 7b. Fetch winner team for level
    const { data: team } = await admin
      .from("teams")
      .select("id, level, treasury")
      .eq("id", winner.team_id)
      .maybeSingle();

    const teamLevel = team?.level ?? 1;
    const riderRank = rider?.pcs_rank ?? null;
    const poolMin = poolMinForLevel(teamLevel);

    // 7c. Level gating
    if (riderRank !== null && riderRank < poolMin) {
      // Cancel all bids for this rider
      await admin
        .from("auction_bids")
        .update({ status: "cancelled" })
        .eq("auction_id", auction.id)
        .eq("rider_id", riderId)
        .eq("status", "active");
      continue;
    }

    // 7d. Duplicate-contract guard
    const { data: existing } = await admin
      .from("contracts")
      .select("id")
      .eq("rider_id", riderId)
      .eq("league_id", leagueId)
      .in("status", ["active", "notice"])
      .maybeSingle();

    if (existing) {
      await admin
        .from("auction_bids")
        .update({ status: "cancelled" })
        .eq("auction_id", auction.id)
        .eq("rider_id", riderId)
        .eq("status", "active");
      continue;
    }

    // 7e. Mark winner won
    await admin
      .from("auction_bids")
      .update({ status: "won" })
      .eq("id", winner.id);

    // 7f. Mark loser bids outbid (only if there are any)
    if (losers.length > 0) {
      await admin
        .from("auction_bids")
        .update({ status: "outbid" })
        .in(
          "id",
          losers.map((l) => l.id)
        );
    }

    // 7g. Create contract
    await admin.from("contracts").insert({
      team_id: winner.team_id,
      rider_id: riderId,
      league_id: leagueId,
      locked_salary: winner.amount,
      status: "active",
      purchased_at: new Date().toISOString(),
      last_salary_paid: today,
      phase_recruited_id: phase.id,
    });

    // 7h. Mark rider active in game
    await admin
      .from("riders")
      .update({ is_active_in_game: true })
      .eq("id", riderId);

    // 7i. Treasury deduction (Round 2+ only — Round 1 deferred to confirmPhaseSetup)
    if (!isRound1 && team) {
      const newTreasury = (team.treasury ?? 0) - winner.amount;
      await admin
        .from("teams")
        .update({ treasury: newTreasury })
        .eq("id", winner.team_id);

      await admin.from("treasury_log").insert({
        team_id: winner.team_id,
        rider_id: riderId,
        type: "payday_salary",
        amount: -winner.amount,
        description: `Salary — ${rider?.full_name ?? riderId} (${auction.name})`,
      });
    }

    resolvedCount++;
  }

  // 8. Cleanup stale draft_bids for riders that now have active contracts
  //    in this league. Mirrors auction.py::_cleanup_stale_drafts.
  const { data: contracts } = await admin
    .from("contracts")
    .select("rider_id")
    .eq("league_id", leagueId)
    .eq("status", "active");

  const contractedRiderIds = (contracts ?? []).map((c) => c.rider_id);

  if (contractedRiderIds.length > 0) {
    // Filter draft_bids by league + rider_id list. Drafts are bound to a
    // (team, rider) pair; a single .in() on rider_id is enough since drafts
    // are scoped by league_id too.
    await admin
      .from("draft_bids")
      .delete()
      .eq("league_id", leagueId)
      .in("rider_id", contractedRiderIds);
  }

  // 9. Open next scheduled auction in this league (if any)
  const { data: nextAuction } = await admin
    .from("auctions")
    .select("id")
    .eq("league_id", leagueId)
    .eq("status", "scheduled")
    .order("opens_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  let nextAuctionId: string | null = null;
  if (nextAuction) {
    nextAuctionId = nextAuction.id;
    await admin
      .from("auctions")
      .update({ status: "open", opens_at: new Date().toISOString() })
      .eq("id", nextAuction.id);
  }

  // 10. Revalidate
  revalidatePath(`/league/${leagueId}`);
  revalidatePath(`/league/${leagueId}/auction`);
  revalidatePath(`/league/${leagueId}/auction/status`);
  revalidatePath(`/league/${leagueId}/auction/history`);

  return { ok: true, resolved: resolvedCount, next_auction_id: nextAuctionId };
}
```

- [ ] **Step 3: Run typecheck**

```bash
cd apps/web && pnpm typecheck
```

Expected: `Found 0 errors.` If `payday_salary` type is rejected, check that `database.types.ts` was regenerated in Task 3.

- [ ] **Step 4: Run the tests**

```bash
cd apps/web && pnpm vitest run app/\(game\)/league/\[leagueId\]/auction/status/actions.test.ts
```

Expected: ALL tests pass.

If any test fails, read the failure carefully:
- "Cannot read properties of undefined" usually means a chained mock returned wrong shape
- Wrong order of `mockAdminFrom.mockReturnValueOnce` calls in a test → check test setup matches the action's call order in the algorithm

- [ ] **Step 5: Run the existing actions tests to confirm no regression**

```bash
cd apps/web && pnpm vitest run app/\(game\)/league/\[leagueId\]/auction/actions.test.ts
```

Expected: all existing `validateRound` tests still pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/\(game\)/league/\[leagueId\]/auction/actions.ts
git commit -m "feat(actions): add forceResolveRound port of resolve_now.py"
```

---

## Phase D: Status page UI

### Task 7: Add the "Status" tab to the auction layout

**Files:**
- Modify: `apps/web/app/(game)/league/[leagueId]/auction/layout.tsx`

- [ ] **Step 1: Edit layout.tsx to add the Status tab**

In `apps/web/app/(game)/league/[leagueId]/auction/layout.tsx`, find the SubTabs `tabs` array (currently 3 entries: Auctions, Market, History) and insert a Status entry between Market and History.

Old:
```typescript
        <SubTabs
          tabs={[
            { label: "Auctions", href: `/league/${leagueId}/auction` },
            { label: "Market", href: `/league/${leagueId}/auction/market` },
            { label: "History", href: `/league/${leagueId}/auction/history` },
          ]}
        />
```

New:
```typescript
        <SubTabs
          tabs={[
            { label: "Auctions", href: `/league/${leagueId}/auction` },
            { label: "Market", href: `/league/${leagueId}/auction/market` },
            { label: "Status", href: `/league/${leagueId}/auction/status` },
            { label: "History", href: `/league/${leagueId}/auction/history` },
          ]}
        />
```

- [ ] **Step 2: Confirm typecheck still passes**

```bash
cd apps/web && pnpm typecheck
```

Expected: `Found 0 errors.`

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(game\)/league/\[leagueId\]/auction/layout.tsx
git commit -m "feat(auction): add Status tab to auction sub-navigation"
```

### Task 8: Build the Status page (server component)

**Files:**
- Create: `apps/web/app/(game)/league/[leagueId]/auction/status/page.tsx`

- [ ] **Step 1: Create the page**

Write to `apps/web/app/(game)/league/[leagueId]/auction/status/page.tsx`:

```typescript
import { createClient } from "@/lib/supabase/server";
import { getCurrentPhase } from "@/lib/phases";
import { formatEuro } from "@/lib/format";
import { Tag } from "@/components/pill";
import { StatusClient } from "./status-client";

interface TeamRow {
  team_id: string;
  team_name: string;
  purchasing_power: number;
  status: "validated" | "pending" | "not_yet_bid";
}

export default async function StatusPage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="px-4 py-8">
        <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
          Please sign in to view this page.
        </p>
      </div>
    );
  }

  const phase = getCurrentPhase();

  // 1. Open auction (may be null)
  const { data: auction } = await supabase
    .from("auctions")
    .select("id, name, opens_at, league_id")
    .eq("league_id", leagueId)
    .eq("status", "open")
    .order("opens_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  // 2. All teams in the league
  const { data: teams } = await supabase
    .from("teams")
    .select("id, name, treasury, level, phase_confirmed_id")
    .eq("league_id", leagueId)
    .order("name", { ascending: true });

  const teamList = teams ?? [];
  const teamIds = teamList.map((t) => t.id);

  // 3. round_validations for this auction (if any)
  const validatedTeamIds = new Set<string>();
  if (auction && teamIds.length > 0) {
    const { data: validations } = await supabase
      .from("round_validations")
      .select("team_id")
      .eq("auction_id", auction.id)
      .in("team_id", teamIds);
    for (const v of validations ?? []) {
      validatedTeamIds.add(v.team_id);
    }
  }

  // 4. draft_bids count per team (to distinguish "pending" vs "not_yet_bid")
  const draftCount = new Map<string, number>();
  if (teamIds.length > 0) {
    const { data: drafts } = await supabase
      .from("draft_bids")
      .select("team_id")
      .eq("league_id", leagueId)
      .in("team_id", teamIds);
    for (const d of drafts ?? []) {
      draftCount.set(d.team_id, (draftCount.get(d.team_id) ?? 0) + 1);
    }
  }

  // 5. Active contract salaries per team (for purchasing power)
  const activeSalaries = new Map<string, number>();
  if (teamIds.length > 0) {
    const { data: contracts } = await supabase
      .from("contracts")
      .select("team_id, locked_salary")
      .in("team_id", teamIds)
      .eq("status", "active");
    for (const c of contracts ?? []) {
      activeSalaries.set(
        c.team_id,
        (activeSalaries.get(c.team_id) ?? 0) + (c.locked_salary ?? 0)
      );
    }
  }

  // 6. Sponsor income per team
  const sponsorIncome = new Map<string, number>();
  if (teamIds.length > 0) {
    const { data: tsRows } = await supabase
      .from("team_sponsors")
      .select("team_id, sponsors:sponsor_id(monthly_budget)")
      .in("team_id", teamIds);
    for (const ts of tsRows ?? []) {
      const sponsor = Array.isArray(ts.sponsors) ? ts.sponsors[0] : ts.sponsors;
      const budget = (sponsor as { monthly_budget?: number } | null)
        ?.monthly_budget ?? 0;
      sponsorIncome.set(ts.team_id, budget);
    }
  }

  // 7. Build the rows
  const rows: TeamRow[] = teamList.map((team) => {
    const salaries = activeSalaries.get(team.id) ?? 0;
    const sponsor = sponsorIncome.get(team.id) ?? 0;

    // Same formula as validate_round
    const purchasingPower =
      team.phase_confirmed_id === phase.id
        ? team.treasury
        : team.treasury + sponsor - salaries;

    let status: TeamRow["status"];
    if (validatedTeamIds.has(team.id)) {
      status = "validated";
    } else if ((draftCount.get(team.id) ?? 0) > 0) {
      status = "pending";
    } else {
      status = "not_yet_bid";
    }

    return {
      team_id: team.id,
      team_name: team.name,
      purchasing_power: purchasingPower,
      status,
    };
  });

  const validatedCount = rows.filter((r) => r.status === "validated").length;
  const totalTeams = rows.length;

  return (
    <div className="px-4 py-6 space-y-6">
      <header className="space-y-2">
        <h1 className="text-[length:var(--type-section)] font-semibold text-[var(--text-high)]">
          Round Status
        </h1>
        <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
          When everyone has validated their bids, click &ldquo;Resolve
          Round&rdquo; to attribute riders and open the next round.
        </p>
      </header>

      {auction ? (
        <>
          <div className="text-[length:var(--type-caption)] text-[var(--text-low)]">
            <span className="text-[var(--text-mid)]">{auction.name}</span>
            {" — "}
            <span>
              {validatedCount}/{totalTeams} teams validated
            </span>
          </div>

          <table className="w-full text-[length:var(--type-body)]">
            <thead>
              <tr className="text-left text-[length:var(--type-caption)] text-[var(--text-low)]">
                <th className="py-2">Team</th>
                <th className="py-2 text-right">Purchasing Power</th>
                <th className="py-2 text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.team_id} className="border-t border-[var(--border-subtle)]">
                  <td className="py-3 text-[var(--text-high)]">{row.team_name}</td>
                  <td className="py-3 text-right font-mono text-[var(--text-mid)]">
                    {formatEuro(row.purchasing_power)}
                  </td>
                  <td className="py-3 text-right">
                    {row.status === "validated" && (
                      <Tag variant="success">Validated</Tag>
                    )}
                    {row.status === "pending" && (
                      <Tag variant="highlighted">Pending</Tag>
                    )}
                    {row.status === "not_yet_bid" && (
                      <Tag variant="default">Not yet bid</Tag>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <StatusClient
            leagueId={leagueId}
            unvalidatedTeams={rows
              .filter((r) => r.status !== "validated")
              .map((r) => r.team_name)}
          />
        </>
      ) : (
        <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] p-6 text-center">
          <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
            No open round. Wait for the next round to begin.
          </p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Confirm typecheck passes**

```bash
cd apps/web && pnpm typecheck
```

Expected: `Found 0 errors.` Note: the StatusClient import will fail until Task 9 — that's fine for now if you commit at the end of Task 9.

If there are unrelated errors, fix them before continuing.

- [ ] **Step 3: Hold commit until Task 9** — these two files form one feature.

### Task 9: Build the Status client component

**Files:**
- Create: `apps/web/app/(game)/league/[leagueId]/auction/status/status-client.tsx`

- [ ] **Step 1: Create the client component**

Write to `apps/web/app/(game)/league/[leagueId]/auction/status/status-client.tsx`:

```typescript
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { forceResolveRound } from "../actions";

interface Props {
  leagueId: string;
  unvalidatedTeams: string[];
}

export function StatusClient({ leagueId, unvalidatedTeams }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await forceResolveRound({ leagueId });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex justify-end pt-4">
        <Button
          variant="outline"
          onClick={() => {
            setError(null);
            setOpen(true);
          }}
        >
          Resolve Round
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve this round?</DialogTitle>
            <DialogDescription>
              Riders will be attributed to the highest bidders, contracts will be
              created, and the next round will open. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {unvalidatedTeams.length > 0 && (
            <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-3 text-[length:var(--type-caption)] text-[var(--text-mid)]">
              These teams haven&rsquo;t validated yet. Their bids will not be counted:
              <ul className="mt-1 list-disc pl-5">
                {unvalidatedTeams.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            </div>
          )}

          {error && (
            <div className="rounded-[var(--radius-md)] border border-[var(--warning)] bg-[var(--warning-bg)] p-3 text-[length:var(--type-caption)] text-[var(--warning)]">
              {error}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={isPending}
            >
              {isPending ? "Resolving..." : "Resolve Round"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

- [ ] **Step 2: Verify required UI primitives exist**

The component imports `Button` from `@/components/ui/button` and several Dialog primitives from `@/components/ui/dialog`. These are part of the Shadcn install.

Verify:
```bash
ls apps/web/components/ui/button.tsx apps/web/components/ui/dialog.tsx
```

Expected: both files exist. If `dialog.tsx` is missing, run from the worktree root:
```bash
cd apps/web && pnpm dlx shadcn@latest add dialog
```

- [ ] **Step 3: Run typecheck**

```bash
cd apps/web && pnpm typecheck
```

Expected: `Found 0 errors.`

- [ ] **Step 4: Run lint**

```bash
cd apps/web && pnpm lint
```

Expected: no new lint errors. Pre-existing warnings unrelated to status/* are fine.

- [ ] **Step 5: Commit Tasks 8 + 9 together**

```bash
git add apps/web/app/\(game\)/league/\[leagueId\]/auction/status/page.tsx apps/web/app/\(game\)/league/\[leagueId\]/auction/status/status-client.tsx
git commit -m "feat(auction): add Status page with team validation table + resolve button"
```

---

## Phase E: End-to-end verification

### Task 10: Reset DB, run all tests, manual smoke test

**Files:** none (verification only)

- [ ] **Step 1: Reset local DB to apply migration cleanly**

```bash
supabase db reset
```

Expected: applies all migrations including the new one without errors.

- [ ] **Step 2: Run the full vitest suite**

```bash
cd apps/web && pnpm test
```

Expected: all tests pass. New failures should ONLY be tests we added in Task 5 (and they should now pass after Task 6).

- [ ] **Step 3: Run typecheck across the workspace**

From the worktree root:
```bash
pnpm typecheck
```

Expected: `Found 0 errors.` across all packages.

- [ ] **Step 4: Run the dev server and smoke test the Status page**

From `apps/web`:
```bash
pnpm dev
```

Then in a browser:
1. Sign in with a test user.
2. Navigate to `/league/{leagueId}/auction/status` for an active league.
3. Verify the table shows correct statuses for each team based on their current state.
4. Click "Resolve Round" → modal appears → click "Resolve Round" inside the modal.
5. Verify the action completes (no error banner).
6. Verify the page refreshes:
   - The auction is now closed (Status page shows "No open round" OR a fresh open auction with everyone unvalidated).
   - In the Auctions tab, the previous round is gone or marked closed.
   - In the History tab, the resolved round appears with winners listed.

If anything fails at step 5 or 6:
- Check `console.log` in the server (terminal running `pnpm dev`) for the error message
- Check the browser network tab for the action's response
- Most likely culprits: missing `SUPABASE_SERVICE_ROLE_KEY` (admin client throws on import), wrong column name in a query (typecheck would have caught this), or a Round 1 detection mismatch

- [ ] **Step 5: Commit any verification findings (if needed)**

If Step 4 surfaced any small fix (e.g. a typo in a label), commit it as a `fix:` commit. If the smoke test succeeds without changes, no commit needed.

### Task 11: Apply migration to remote (PRODUCTION)

**Files:** none

⚠️ **Verify with the user before this task.** This task pushes the migration to production Supabase. If the user prefers to do this themselves, STOP and let them.

- [ ] **Step 1: Confirm with user**

Ask the user:
> "Ready to apply the migration to remote Supabase? I'll run `supabase db push --linked`. This will apply migration `20260508020000_round_validations_and_force_resolve.sql` to production. The active Giro 2026 league will be backfilled — teams that already validated their bids will appear as 'Validated' on the new Status page. Confirm to proceed?"

Wait for explicit "yes" / "go ahead" / equivalent. Do NOT push without confirmation.

- [ ] **Step 2: Push to remote**

```bash
supabase db push --linked
```

Expected: applies the new migration. May warn about the diff between local and remote if `20260508000000_round_lifecycle.sql` is in remote's history but its rollback was applied manually — that's expected. The new migration's `CREATE OR REPLACE FUNCTION` will overwrite whatever validate_round body is currently in remote.

- [ ] **Step 3: Verify the table exists on remote**

Use the Supabase dashboard SQL editor (the user can do this) OR:
```bash
supabase db diff --linked
```

Expected: empty diff (or only changes to migration history table).

The user should verify in the dashboard that:
- `round_validations` table exists with the expected schema
- `validate_round` function body has `INSERT INTO round_validations`
- The active Giro auction has rows in `round_validations` for teams that previously bid

- [ ] **Step 4: Deploy frontend to Vercel**

If the user uses Vercel auto-deploy on merge: merge the PR. Otherwise, the user runs:
```bash
vercel --prod
```

(Or the user does this themselves — this task ends here and the user takes over.)

---

## Self-Review Checklist (run before declaring complete)

After all tasks finish:
1. **Spec coverage** — every spec section has an implementing task:
   - round_validations table (Task 1) ✓
   - Modified validate_round with INSERT round_validations (Task 1) ✓
   - Backfill (Task 1) ✓
   - Service-role client (Task 4) ✓
   - forceResolveRound port (Task 6) ✓
   - Race condition mitigation (Task 6 — optimistic UPDATE on `status='open'`) ✓
   - Status tab (Task 7) ✓
   - Status page (Task 8) ✓
   - Modal + button (Task 9) ✓
   - Tests (Task 5+6) ✓
2. **No placeholders** — re-search for `TBD`, `TODO`, `FIXME`, `<...>` in new files.
3. **Commits frequent** — yes (one per task or sub-task).
4. **Rollback exists** — yes (Task 1 step 2).
5. **Phase 2 unchanged** — no auto-resolve, no unlock_round, no `'resolving'` status, no polling.

---

## Phase 2 (NOT in this plan — for future reference)

When this Phase 1 is shipped and stable, follow-up work to make resolve automatic:
- Add `'resolving'` status enum value
- Modify `validate_round` to count validations and atomically transition `open → resolving` when all teams validated
- Modify TS `validateRound` wrapper to call `forceResolveRound` when the RPC returns `all_validated: true`
- Add `unlock_round` RPC + "Modify bids" button
- Add 5s polling on Status page (or Realtime subscription)

See spec section "Phase 2 — Future Work" for details.
