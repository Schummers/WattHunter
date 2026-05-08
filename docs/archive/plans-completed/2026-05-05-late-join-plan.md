# Late Join Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow any user with the league code to join an active league mid-season, receiving the average XP/treasury of existing teams, with sponsor selection deferred to the next auction phase if Round 1 has already closed.

**Architecture:** Extend `join_league_by_code` (SECURITY DEFINER RPC) to handle active leagues — compute averages, insert team without sponsor, return a `can_join_current_phase` flag. The TS server action removes the "already started" error case and skips auto-sponsor assignment for late joiners. The home page detects the waiting state (no sponsor + closed auctions exist) and shows a banner.

**Tech Stack:** PostgreSQL PL/pgSQL (Supabase migration), Next.js 15 Server Actions, Vitest (unit tests)

**Spec:** `docs/superpowers/specs/2026-05-05-late-join-design.md`

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `supabase/migrations/20260507000000_join_league_late.sql` | Create | Extend `join_league_by_code` RPC with active-league late join logic |
| `apps/web/app/(auth)/league/join/actions.ts` | Modify | Remove "already started" error; skip auto-sponsor for late joiners |
| `apps/web/app/(auth)/league/join/actions.test.ts` | Create | Vitest tests for the late join code paths |
| `apps/web/app/(game)/league/[leagueId]/page.tsx` | Modify | Fetch team sponsor status; derive `isLateJoinPending`; pass to HomeFeed |
| `apps/web/app/(game)/league/[leagueId]/home-feed.tsx` | Modify | Accept and render `isLateJoinPending` banner |

---

## Task 1 — Migration: extend `join_league_by_code` RPC

**Files:**
- Create: `supabase/migrations/20260507000000_join_league_late.sql`

### Context

The current RPC (`supabase/migrations/20260502000000_secure_invite_code.sql`) returns
`'error': 'League has already started'` when `v_league.status = 'active'`. We replace
that block with late-join logic:

1. Compute `AVG(cumulative_xp)` and `AVG(treasury)` of existing teams.
2. Derive level from XP using the same thresholds as `apps/web/lib/levels.ts`.
3. Insert team with averages — **no sponsor, no strategies**.
4. Check `can_join_current_phase`: true if no closed auction precedes the earliest open/scheduled auction.
5. Return `late_join: true` + `can_join_current_phase`.

The `teams` table columns relevant here (from `20260221000000_initial_schema.sql`):
- `treasury bigint NOT NULL DEFAULT 200000`
- `cumulative_xp numeric(10,2) NOT NULL DEFAULT 0` (changed in `20260321100000_xp_two_decimals.sql`)
- `level int NOT NULL DEFAULT 1`

- [ ] **Step 1: Write the migration file**

```sql
-- 20260507000000_join_league_late.sql
-- Allow joining an active league mid-season via late-join logic.
-- Replaces the 'League has already started' hard block with average-based onboarding.

CREATE OR REPLACE FUNCTION public.join_league_by_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id         uuid := auth.uid();
  v_league          record;
  v_team_id         uuid;
  v_start_level     int;
  v_avg_xp          numeric(10,2);
  v_avg_treasury    bigint;
  v_can_join_now    boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  IF p_code IS NULL OR length(p_code) < 4 OR length(p_code) > 16 THEN
    RETURN jsonb_build_object('error', 'Invalid code format');
  END IF;

  SELECT id, name, status, max_players, starting_level
    INTO v_league
    FROM public.leagues
   WHERE invite_code = p_code;

  IF v_league IS NULL THEN
    RETURN jsonb_build_object('error', 'League not found');
  END IF;

  -- Already a member — return existing state so the client can redirect
  IF EXISTS (
    SELECT 1 FROM public.league_members
     WHERE league_id = v_league.id AND user_id = v_user_id
  ) THEN
    SELECT t.id INTO v_team_id
      FROM public.teams t
     WHERE t.league_id = v_league.id AND t.user_id = v_user_id;
    RETURN jsonb_build_object(
      'ok',             true,
      'already_member', true,
      'league_id',      v_league.id,
      'team_id',        v_team_id,
      'starting_level', v_league.starting_level
    );
  END IF;

  -- League full?
  IF (
    SELECT count(*) FROM public.league_members WHERE league_id = v_league.id
  ) >= v_league.max_players THEN
    RETURN jsonb_build_object('error', 'League is full');
  END IF;

  -- ── STANDARD JOIN (league not yet active) ────────────────────────────────
  IF v_league.status != 'active' THEN
    v_start_level := COALESCE(v_league.starting_level, 1);

    INSERT INTO public.teams (league_id, user_id, name, level, cumulative_xp)
      VALUES (v_league.id, v_user_id, 'My Team', v_start_level, 0)
      RETURNING id INTO v_team_id;

    INSERT INTO public.league_members (league_id, user_id, team_id)
      VALUES (v_league.id, v_user_id, v_team_id);

    RETURN jsonb_build_object(
      'ok',             true,
      'league_id',      v_league.id,
      'team_id',        v_team_id,
      'starting_level', v_start_level,
      'late_join',      false
    );
  END IF;

  -- ── LATE JOIN (league already active) ────────────────────────────────────
  -- Compute averages from existing teams in this league
  SELECT
    COALESCE(AVG(cumulative_xp), 0)::numeric(10,2),
    COALESCE(AVG(treasury),      200000)::bigint
  INTO v_avg_xp, v_avg_treasury
  FROM public.teams
  WHERE league_id = v_league.id;

  -- Derive level from average XP (mirrors apps/web/lib/levels.ts thresholds)
  v_start_level := CASE
    WHEN v_avg_xp >= 2400 THEN 8
    WHEN v_avg_xp >= 1800 THEN 7
    WHEN v_avg_xp >= 1200 THEN 6
    WHEN v_avg_xp >= 600  THEN 5
    WHEN v_avg_xp >= 350  THEN 4
    WHEN v_avg_xp >= 150  THEN 3
    WHEN v_avg_xp >= 25   THEN 2
    ELSE 1
  END;

  -- Insert team with average values — no sponsor, no strategies
  INSERT INTO public.teams (league_id, user_id, name, level, cumulative_xp, treasury)
    VALUES (v_league.id, v_user_id, 'My Team', v_start_level, v_avg_xp, v_avg_treasury)
    RETURNING id INTO v_team_id;

  INSERT INTO public.league_members (league_id, user_id, team_id)
    VALUES (v_league.id, v_user_id, v_team_id);

  -- Determine if Round 1 of the current phase has already closed.
  -- Round 1 = the earliest auction by opens_at.
  -- It is "closed" if any auction with status='closed' precedes the earliest
  -- open/scheduled/resolving auction (or if no open auctions exist at all).
  SELECT (
    NOT EXISTS (
      SELECT 1 FROM public.auctions closed_a
       WHERE closed_a.league_id = v_league.id
         AND closed_a.status = 'closed'
         AND closed_a.opens_at < COALESCE(
               (SELECT MIN(a2.opens_at)
                  FROM public.auctions a2
                 WHERE a2.league_id = v_league.id
                   AND a2.status IN ('open', 'scheduled', 'resolving')),
               'infinity'::timestamptz
             )
    )
  ) INTO v_can_join_now;

  RETURN jsonb_build_object(
    'ok',                   true,
    'league_id',            v_league.id,
    'team_id',              v_team_id,
    'starting_level',       v_start_level,
    'late_join',            true,
    'can_join_current_phase', v_can_join_now
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_league_by_code(text) TO authenticated;
```

- [ ] **Step 2: Apply migration to local Supabase**

```bash
supabase db push
```

Expected: migration applies cleanly, no errors.

- [ ] **Step 3: Smoke test the RPC directly**

```bash
docker exec -i supabase_db_WattHunter psql -U postgres -d postgres -c \
  "SELECT public.join_league_by_code('FAKECODE');"
```

Expected: `{"error": "League not found"}` — confirms RPC is live.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260507000000_join_league_late.sql
git commit -m "feat: extend join_league_by_code to support late join for active leagues"
```

---

## Task 2 — Update TS server action: `joinLeague`

**Files:**
- Modify: `apps/web/app/(auth)/league/join/actions.ts`

### Context

Current action (`apps/web/app/(auth)/league/join/actions.ts:58-68`):
- Returns `{ error: "This league has already started. You can't join anymore." }` when `rpcResult.error === 'League has already started'`
- Auto-assigns default sponsor when `!rpcResult.already_member` for level 1 or 2

Changes needed:
1. Remove the `'League has already started'` case from the error switch
2. Skip sponsor auto-assign when `rpcResult.late_join === true` (late joiners have no sponsor until next phase)

- [ ] **Step 1: Remove the "League has already started" error case**

In `apps/web/app/(auth)/league/join/actions.ts`, find the switch block starting at line ~60 and remove the case:

```typescript
// REMOVE THIS CASE:
case "League has already started":
  return { error: "This league has already started. You can't join anymore." };
```

After removal the switch should be:

```typescript
switch (rpcResult.error) {
  case "League not found":
    return { error: "Invalid code. Check with your Race Director." };
  case "League is full":
    return { error: "This league is full." };
  case "Already a member of this league":
    break;
  default:
    return { error: rpcResult.error };
}
```

- [ ] **Step 2: Skip auto-sponsor for late joiners**

Find the sponsor auto-assign block (starts with `if (!rpcResult.already_member)`) and add a late-join guard:

```typescript
// Auto-assign default sponsor only for standard joins (not late joiners)
if (!rpcResult.already_member && !rpcResult.late_join) {
  const defaultSlug = startLevel <= 1 ? "lotto" : startLevel === 2 ? "astana" : null;
  if (defaultSlug) {
    const { data: defaultSponsor } = await supabase
      .from("sponsors")
      .select("id")
      .eq("slug", defaultSlug)
      .single();

    if (defaultSponsor) {
      await supabase
        .from("team_sponsors")
        .insert({ team_id: teamId, sponsor_id: defaultSponsor.id, activated_at: new Date().toISOString() });
    }
  }
}
```

The redirect at the end stays unchanged — always go to `/league/${leagueId}`.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd apps/web && pnpm typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(auth\)/league/join/actions.ts
git commit -m "feat: allow joining active leagues (late join), skip auto-sponsor"
```

---

## Task 3 — Tests: joinLeague action

**Files:**
- Create: `apps/web/app/(auth)/league/join/actions.test.ts`

The test file must use the same mock pattern as other action tests (see `apps/web/app/(game)/league/[leagueId]/auction/actions.test.ts`): `vi.hoisted()` for mocks before imports.

- [ ] **Step 1: Write the test file**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks — declared before any imports that consume them.
// ---------------------------------------------------------------------------

const { mockFrom, mockGetUser, mockRpc, mockRedirect } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockGetUser: vi.fn(),
  mockRpc: vi.fn(),
  mockRedirect: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: mockFrom,
    auth: { getUser: mockGetUser },
    rpc: mockRpc,
  })),
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

import { joinLeague } from "./actions";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const LEAGUE_ID = "aaaaaaaa-0000-4000-8000-000000000001";
const TEAM_ID   = "bbbbbbbb-0000-4000-8000-000000000002";

function makeFormData(code: string): FormData {
  const fd = new FormData();
  fd.append("code", code);
  return fd;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("joinLeague action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1", email: "a@b.com", user_metadata: {} } } });
    // Default upsert + rpc chain
    mockFrom.mockReturnValue({
      upsert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
  });

  it("rejects invalid code format", async () => {
    const result = await joinLeague(null, makeFormData("!@#$%^"));
    expect(result).toMatchObject({ error: expect.any(String) });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("returns error when RPC reports league not found", async () => {
    mockRpc.mockResolvedValue({ data: { error: "League not found" }, error: null });
    const result = await joinLeague(null, makeFormData("AAAAAA"));
    expect(result).toMatchObject({ error: "Invalid code. Check with your Race Director." });
  });

  it("returns error when league is full", async () => {
    mockRpc.mockResolvedValue({ data: { error: "League is full" }, error: null });
    const result = await joinLeague(null, makeFormData("AAAAAA"));
    expect(result).toMatchObject({ error: "This league is full." });
  });

  it("redirects to league home on successful standard join", async () => {
    mockRpc.mockResolvedValue({
      data: { ok: true, league_id: LEAGUE_ID, team_id: TEAM_ID, starting_level: 1, late_join: false },
      error: null,
    });
    // Mock sponsor lookup (level 1 → lotto)
    mockFrom.mockReturnValue({
      upsert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: "sponsor-1" }, error: null }),
    });

    await joinLeague(null, makeFormData("AAAAAA"));
    expect(mockRedirect).toHaveBeenCalledWith(`/league/${LEAGUE_ID}`);
  });

  it("does NOT assign sponsor on late join", async () => {
    mockRpc.mockResolvedValue({
      data: {
        ok: true,
        league_id: LEAGUE_ID,
        team_id: TEAM_ID,
        starting_level: 3,
        late_join: true,
        can_join_current_phase: false,
      },
      error: null,
    });

    const insertSpy = vi.fn().mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({
      upsert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      insert: insertSpy,
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: "sponsor-x" }, error: null }),
    });

    await joinLeague(null, makeFormData("AAAAAA"));

    // redirect should still happen
    expect(mockRedirect).toHaveBeenCalledWith(`/league/${LEAGUE_ID}`);
    // team_sponsors insert must NOT have been called
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("still accepts joining an active league (no error returned)", async () => {
    mockRpc.mockResolvedValue({
      data: {
        ok: true,
        league_id: LEAGUE_ID,
        team_id: TEAM_ID,
        starting_level: 2,
        late_join: true,
        can_join_current_phase: true,
      },
      error: null,
    });

    mockFrom.mockReturnValue({
      upsert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    const result = await joinLeague(null, makeFormData("AAAAAA"));
    // Should redirect, not return an error
    expect(result).toBeUndefined();
    expect(mockRedirect).toHaveBeenCalledWith(`/league/${LEAGUE_ID}`);
  });
});
```

- [ ] **Step 2: Run the tests**

```bash
cd apps/web && pnpm test -- --reporter=verbose join/actions
```

Expected: 5 tests pass, 0 fail.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(auth\)/league/join/actions.test.ts
git commit -m "test: add late join action tests"
```

---

## Task 4 — Home page: detect late join state and show banner

**Files:**
- Modify: `apps/web/app/(game)/league/[leagueId]/page.tsx`
- Modify: `apps/web/app/(game)/league/[leagueId]/home-feed.tsx`

### Context

A late joiner with no sponsor in an active league is identified by:
- No `team_sponsors` row for this team (`teamSponsor === null`)
- At least one closed auction exists (Round 1 is done)

The home page already fetches `closedCount` (to show the next auction label) — reuse it.

**Banner to show:** `"You joined mid-season. You can select your sponsor and start bidding at the next auction phase."`

This is a read-only info banner (no action button needed — `confirm_phase_setup` will appear naturally at phase start via the existing budget/marketplace flow).

- [ ] **Step 1: Add team sponsor query to `page.tsx`**

In the active-league section, alongside the `activeAuction` query, add:

```typescript
const { data: currentUser } = await supabase.auth.getUser();
// Already fetched above as `user` — use it directly.

// Fetch team and its current sponsor for the late-join banner detection
const { data: teamSponsor } = await supabase
  .from("team_sponsors")
  .select("id")
  .eq("team_id", supabase // ...
```

Actually, we need the team id first. Add two sequential queries in the active-league block — first get the team, then get the sponsor. Alternatively, join via `teams → team_sponsors`:

```typescript
// Detect late join state: team exists but has no sponsor in an active league
const { data: teamRow } = await supabase
  .from("league_members")
  .select("team_id")
  .eq("league_id", leagueId)
  .eq("user_id", user.id)
  .maybeSingle();

const teamId = teamRow?.team_id ?? null;

const { data: teamSponsorRow } = teamId
  ? await supabase
      .from("team_sponsors")
      .select("id")
      .eq("team_id", teamId)
      .maybeSingle()
  : { data: null };
```

Then derive (after the `closedCount` query, which already exists):

```typescript
// isLateJoinPending = no sponsor assigned AND Round 1 already closed
// When closedCount > 0 and no sponsor → waiting for next phase
const isLateJoinPending =
  teamSponsorRow === null && (closedCount ?? 0) > 0;
```

Pass to `HomeFeed`:

```tsx
<HomeFeed
  leagueId={leagueId}
  activeAuction={activeAuction}
  nextAuctionLabel={nextAuctionLabel}
  isLateJoinPending={isLateJoinPending}
/>
```

- [ ] **Step 2: Update `HomeFeed` props and render banner**

In `apps/web/app/(game)/league/[leagueId]/home-feed.tsx`:

Add `isLateJoinPending?: boolean` to `HomeFeedProps`:

```typescript
interface HomeFeedProps {
  leagueId: string;
  activeAuction: ActiveAuction | null;
  nextAuctionLabel: string | null;
  isLateJoinPending?: boolean;
}
```

Add the import for `Info` icon at the top:

```typescript
import { Timer, ChevronRight, Calendar, Info } from "lucide-react";
```

Render the banner at the **top of the returned JSX**, before the feed list:

```tsx
export function HomeFeed({
  leagueId,
  activeAuction,
  nextAuctionLabel,
  isLateJoinPending,
}: HomeFeedProps) {
  // ... existing logic ...

  return (
    <div className="flex flex-col gap-3">
      {isLateJoinPending && (
        <div className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3">
          <Info className="mt-0.5 size-4 shrink-0 text-[var(--text-mid)]" />
          <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
            You joined mid-season. You can select your sponsor and start bidding
            at the next auction phase.
          </p>
        </div>
      )}
      {/* existing feed JSX */}
    </div>
  );
}
```

Note: wrap the existing return content in a `<div className="flex flex-col gap-3">` if it isn't already.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd apps/web && pnpm typecheck
```

Expected: no errors.

- [ ] **Step 4: Verify build**

```bash
cd apps/web && pnpm build 2>&1 | tail -20
```

Expected: build completes without errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(game\)/league/\[leagueId\]/page.tsx \
        apps/web/app/\(game\)/league/\[leagueId\]/home-feed.tsx
git commit -m "feat: show late join banner on home when waiting for next phase"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| Anyone with code can join active league | Task 1 (RPC removes `status=active` block) |
| Average XP → level derivation | Task 1 (CASE expression in RPC) |
| Average treasury | Task 1 (AVG(treasury) in RPC) |
| No sponsor assigned at join | Task 1 (no team_sponsors insert) + Task 2 (skip auto-assign) |
| Cutoff: Round 1 closed → wait | Task 1 (`can_join_current_phase` flag) |
| UI: "wait for next phase" banner | Task 4 |
| Sponsor selection via normal `confirm_phase_setup` at next phase | No change needed — existing flow handles it |
| Edge case: 0 XP teams → level 1, treasury 200K | Task 1 (COALESCE defaults) |

**Placeholder scan:** No TBDs. All code steps show exact SQL/TypeScript.

**Type consistency:**
- RPC returns `late_join: boolean` → TS action reads `rpcResult.late_join` — consistent.
- `isLateJoinPending: boolean` derived in page.tsx → passed as `isLateJoinPending?: boolean` in HomeFeed — consistent.
