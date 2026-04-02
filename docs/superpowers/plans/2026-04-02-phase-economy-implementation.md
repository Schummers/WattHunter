# Phase Economy & Release Rider — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the pending/phase-transition model with a player-triggered payday system: immediate releases with flat fee, sponsor/policy changes effective at next payday, and a 2-state Recruits page (Phase Setup → Bidding).

**Architecture:** The payday is a Next.js server action (`confirmPhaseSetup`) triggered when a player clicks "Confirm" at phase start. It credits sponsor income, deducts salaries, runs bankruptcy checks, and applies pending sponsor/policy changes. The Python `phase_finance.py` pipeline is removed — all finance logic moves into the server action. Release is immediate (no notice period), with a 5 000 EUR flat fee and optional transfer bonus.

**Tech Stack:** Next.js 16 App Router (server actions), Supabase Postgres (migrations), Vitest (web tests), Pytest (Python tests), Zod v4 (validation), Tailwind CSS v4

**Prerequisite:** Merge `feat/sponsors-rework` → `main` first. This plan assumes the sponsors rework migration (`20260402300000_sponsors_rework.sql`) is already applied: 13 sponsors seeded, `sponsor_bonuses` table, simplified `team_sponsors` (unique on team_id), `sponsor_bonus.py` pipeline. Create branch `feat/phase-economy` from `main` after merge.

**Design spec:** `docs/superpowers/specs/2026-04-02-phase-economy-and-release-design.md`

---

## File Structure

### New files
| File | Responsibility |
|------|---------------|
| `supabase/migrations/20260402400000_phase_economy.sql` | Schema: contracts cleanup, teams new columns, treasury_log new types |
| `apps/web/app/(game)/league/[leagueId]/team/recruts/actions.ts` | Server actions: confirmPhaseSetup, changeSponsor, changePolicy |
| `apps/web/app/(game)/league/[leagueId]/team/recruts/phase-setup.tsx` | Phase Setup UI (pre-confirmation state) |
| `apps/web/app/(game)/league/[leagueId]/team/recruts/actions.test.ts` | Vitest tests for confirmPhaseSetup + changeSponsor |

### Modified files
| File | Changes |
|------|---------|
| `apps/web/app/(game)/league/[leagueId]/rider/[riderId]/actions.ts` | Rewrite releaseRider: flat fee + transfer bonus + immediate |
| `apps/web/app/(game)/league/[leagueId]/rider/[riderId]/rider-detail-client.tsx` | Update release dialog + remove notice badge |
| `apps/web/app/(game)/league/[leagueId]/team/recruts/recruts-client.tsx` | Accept `phaseConfirmed` prop, pass-through to existing bidding UI |
| `apps/web/app/(game)/league/[leagueId]/team/recruts/page.tsx` | Fetch phase_confirmed_at, sponsor, roster, policies; route to PhaseSetup or Bidding |
| `apps/web/app/(game)/league/[leagueId]/budget/actions.ts` | Update saveSponsor to write pending_sponsor_id instead of direct upsert |
| `apps/web/app/(game)/league/[leagueId]/auctions/[auctionId]/actions.ts` | Gate placeBid behind phase confirmation |
| `apps/web/lib/format.ts` | Add calcTransferBonus helper |
| `apps/web/lib/phases.ts` | Add getCurrentPhaseId helper |
| `services/pcs-sync/tests/test_phase_finance.py` | Remove (pipeline removed) |

### Deleted files
| File | Reason |
|------|--------|
| `apps/web/lib/phase-transition.ts` | Replaced by confirmPhaseSetup server action |
| `services/pcs-sync/phase_finance.py` | Replaced by confirmPhaseSetup server action |
| `services/pcs-sync/tests/test_phase_finance.py` | Pipeline removed |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260402400000_phase_economy.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Migration: Phase Economy — payday confirmation model
-- Contracts: remove notice status, add released_at + phase_recruited_id
-- Teams: add phase_confirmed_at + pending_sponsor_id, fix defaults
-- Treasury_log: add release_fee, transfer_bonus, payday_salary types
-- Team_policies: drop effective_phase_id (payday replaces phase transitions)

-- ---------------------------------------------------------------------------
-- 1. Contracts — remove notice status, simplify
-- ---------------------------------------------------------------------------

-- Convert any existing 'notice' contracts to 'released'
UPDATE public.contracts SET status = 'released' WHERE status = 'notice';

-- Replace status check constraint (remove 'notice')
ALTER TABLE public.contracts DROP CONSTRAINT IF EXISTS contracts_status_check;
ALTER TABLE public.contracts
  ADD CONSTRAINT contracts_status_check CHECK (status IN ('active', 'released'));

-- Add released_at timestamp (replaces release_date)
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS released_at timestamptz;

-- Backfill released_at from release_date for existing released contracts
UPDATE public.contracts
  SET released_at = release_date::timestamptz
  WHERE status = 'released' AND release_date IS NOT NULL AND released_at IS NULL;

-- Add phase_recruited_id to enforce lock (can't release in same phase as recruitment)
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS phase_recruited_id int;

-- Drop deprecated columns
ALTER TABLE public.contracts DROP COLUMN IF EXISTS notice_date;
ALTER TABLE public.contracts DROP COLUMN IF EXISTS effective_phase_id;

-- Keep release_date for now (used by scoring date filter) — mark deprecated
COMMENT ON COLUMN public.contracts.release_date IS 'DEPRECATED — use released_at. Kept for scoring backward compat.';

-- ---------------------------------------------------------------------------
-- 2. Teams — add payday tracking + pending sponsor
-- ---------------------------------------------------------------------------

-- Track when player last confirmed phase setup
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS phase_confirmed_at timestamptz;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS phase_confirmed_id int;

COMMENT ON COLUMN public.teams.phase_confirmed_at IS 'Timestamp of last payday confirmation';
COMMENT ON COLUMN public.teams.phase_confirmed_id IS 'Phase ID of last confirmed payday';

-- Pending sponsor (effective at next payday)
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS pending_sponsor_id uuid
  REFERENCES public.sponsors(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.teams.pending_sponsor_id IS 'Sponsor to activate at next payday. NULL = no change pending.';

-- Fix default treasury for new teams (0 instead of 500K — first sponsor payment replaces starting fund)
ALTER TABLE public.teams ALTER COLUMN treasury SET DEFAULT 0;

-- Fix level check constraint (1-8 instead of 1-10)
ALTER TABLE public.teams DROP CONSTRAINT IF EXISTS teams_level_check;
ALTER TABLE public.teams ADD CONSTRAINT teams_level_check CHECK (level BETWEEN 1 AND 8);

-- ---------------------------------------------------------------------------
-- 3. Treasury_log — add new types for phase economy
-- ---------------------------------------------------------------------------

ALTER TABLE public.treasury_log DROP CONSTRAINT IF EXISTS treasury_log_type_check;
ALTER TABLE public.treasury_log
  ADD CONSTRAINT treasury_log_type_check
  CHECK (type IN (
    'starting_fund',
    'auction_purchase',
    'monthly_salary',      -- deprecated, kept for existing data
    'rider_revenue',       -- deprecated, kept for existing data
    'sponsor_payment',
    'bankruptcy_release',
    'monthly_bonus',       -- deprecated, kept for existing data
    'phase_salary',        -- deprecated, kept for existing data
    'phase_sponsor_base',  -- deprecated, kept for existing data
    'sponsor_bonus',
    'release_fee',         -- NEW: -5000 flat fee on release
    'transfer_bonus',      -- NEW: +bonus when releasing appreciated rider
    'payday_salary'        -- NEW: bulk salary deduction at phase confirmation
  ));

-- ---------------------------------------------------------------------------
-- 4. Team_policies — drop phase dependency
-- ---------------------------------------------------------------------------

ALTER TABLE public.team_policies DROP COLUMN IF EXISTS effective_phase_id;

COMMENT ON COLUMN public.team_policies.pending_is_active IS 'Pending state applied at next payday confirmation. NULL = no change pending.';
COMMENT ON COLUMN public.team_policies.pending_config IS 'Pending config applied at next payday confirmation. NULL = no change pending.';
```

- [ ] **Step 2: Apply migration locally**

Run: `supabase db push`

Expected: Migration applied successfully. No errors.

- [ ] **Step 3: Verify schema**

Run: `supabase db diff` — should show no pending changes.

Spot check with SQL:
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'teams' AND column_name IN ('phase_confirmed_at', 'phase_confirmed_id', 'pending_sponsor_id');
```
Expected: 3 rows returned.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260402400000_phase_economy.sql
git commit -m "feat: add phase economy migration — contracts cleanup, teams payday columns, treasury_log new types"
```

---

## Task 2: Release Rider Rewrite

**Files:**
- Modify: `apps/web/lib/format.ts` (add calcTransferBonus)
- Modify: `apps/web/app/(game)/league/[leagueId]/rider/[riderId]/actions.ts` (rewrite releaseRider)
- Test: `apps/web/app/(game)/league/[leagueId]/rider/[riderId]/actions.test.ts` (new file)

### Step 2a: Add calcTransferBonus helper

- [ ] **Step 1: Add helper to format.ts**

Add at end of `apps/web/lib/format.ts`:

```typescript
/** Release fee constant — flat 5 000 EUR per release */
export const RELEASE_FEE = 5_000;

/**
 * Calculate transfer bonus when releasing a rider.
 * Bonus = max(0, current_min_salary - locked_salary)
 */
export function calcTransferBonus(pcsPoints: number, lockedSalary: number): number {
  const currentMinSalary = calcMinSalary(pcsPoints);
  return Math.max(0, currentMinSalary - lockedSalary);
}
```

- [ ] **Step 2: Commit helper**

```bash
git add apps/web/lib/format.ts
git commit -m "feat: add calcTransferBonus helper and RELEASE_FEE constant"
```

### Step 2b: Write tests for releaseRider

- [ ] **Step 3: Write the failing tests**

Create `apps/web/app/(game)/league/[leagueId]/rider/[riderId]/actions.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Hoisted mocks (must be before imports) ---
const { mockFrom, mockGetUser } = vi.hoisted(() => {
  return {
    mockFrom: vi.fn(),
    mockGetUser: vi.fn(),
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: mockFrom,
    auth: { getUser: mockGetUser },
  })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { releaseRider } from "./actions";

// --- Helper: Supabase query chain mock ---
function makeChain(data: unknown = null, error: unknown = null) {
  const m: Record<string, unknown> = {};
  const chain = new Proxy(m, {
    get(target, prop) {
      if (prop === "execute") return () => Promise.resolve({ data, error });
      if (prop === "then") return undefined; // not a promise
      return (..._args: unknown[]) => chain;
    },
  });
  return chain;
}

const USER_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const TEAM_ID = "bbbbbbbb-0000-0000-0000-000000000001";
const CONTRACT_ID = "cccccccc-0000-0000-0000-000000000001";
const RIDER_ID = "dddddddd-0000-0000-0000-000000000001";

describe("releaseRider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
  });

  it("returns error when not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const result = await releaseRider(CONTRACT_ID);
    expect(result).toEqual({ error: "Not authenticated" });
  });

  it("returns error when contract not found", async () => {
    mockFrom.mockReturnValue(makeChain(null));
    const result = await releaseRider(CONTRACT_ID);
    expect(result).toEqual({ error: "Contract not found" });
  });

  it("returns error when not team owner", async () => {
    mockFrom.mockReturnValue(
      makeChain({
        id: CONTRACT_ID,
        team_id: TEAM_ID,
        status: "active",
        locked_salary: 50_000,
        phase_recruited_id: 1,
        teams: { user_id: "someone-else", treasury: 200_000, league_id: "lg-1" },
      })
    );
    const result = await releaseRider(CONTRACT_ID);
    expect(result).toEqual({ error: "Not authorized" });
  });

  it("returns error when releasing rider recruited this phase", async () => {
    // Mock getCurrentPhase to return phase 4
    vi.doMock("@/lib/phases", () => ({
      getCurrentPhase: () => ({ id: 4 }),
    }));
    const { releaseRider: release } = await import("./actions");

    mockFrom.mockReturnValue(
      makeChain({
        id: CONTRACT_ID,
        team_id: TEAM_ID,
        status: "active",
        locked_salary: 50_000,
        phase_recruited_id: 4, // same as current phase
        teams: { user_id: USER_ID, treasury: 200_000, league_id: "lg-1" },
        riders: { pcs_points_1yr: 300 },
      })
    );
    const result = await release(CONTRACT_ID);
    expect(result).toEqual({ error: "Cannot release a rider recruited during the current phase" });
  });

  it("returns error when treasury insufficient for release fee", async () => {
    mockFrom.mockReturnValue(
      makeChain({
        id: CONTRACT_ID,
        team_id: TEAM_ID,
        status: "active",
        locked_salary: 50_000,
        phase_recruited_id: 2,
        teams: { user_id: USER_ID, treasury: 3_000, league_id: "lg-1" },
        riders: { pcs_points_1yr: 100 },
      })
    );
    const result = await releaseRider(CONTRACT_ID);
    expect(result.error).toMatch(/insufficient/i);
  });

  it("successfully releases rider with flat fee and transfer bonus", async () => {
    const callLog: Array<{ table: string; method: string; args: unknown[] }> = [];
    let callCount = 0;

    mockFrom.mockImplementation((table: string) => {
      callCount++;

      // Call 1: contracts select (fetch contract details)
      if (callCount === 1) {
        return makeChain({
          id: CONTRACT_ID,
          team_id: TEAM_ID,
          rider_id: RIDER_ID,
          status: "active",
          locked_salary: 30_000,
          phase_recruited_id: 2,
          teams: { user_id: USER_ID, treasury: 200_000, league_id: "lg-1" },
          riders: { pcs_points_1yr: 500 },
        });
      }

      // Subsequent calls: updates and inserts (all succeed)
      callLog.push({ table, method: "mutation", args: [] });
      return makeChain(null);
    });

    const result = await releaseRider(CONTRACT_ID);

    expect(result).toHaveProperty("success", true);
    // Transfer bonus: calcMinSalary(500) = max(5000, floor(500*2000/12/100)*100) = max(5000, 83300) = 83300
    // bonus = 83300 - 30000 = 53300
    expect(result).toHaveProperty("transferBonus", 53_300);
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `cd apps/web && pnpm vitest run app/\(game\)/league/\[leagueId\]/rider/\[riderId\]/actions.test.ts`

Expected: FAIL — `releaseRider` function signature/behavior doesn't match new expectations.

### Step 2c: Implement releaseRider

- [ ] **Step 5: Rewrite releaseRider**

Replace the entire content of `apps/web/app/(game)/league/[leagueId]/rider/[riderId]/actions.ts`:

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getCurrentPhase } from "@/lib/phases";
import { calcTransferBonus, RELEASE_FEE } from "@/lib/format";

/**
 * Release a rider immediately.
 *
 * Rules:
 *   - Flat fee: 5 000 EUR, deducted immediately
 *   - Transfer bonus if rider appreciated (current min salary > locked salary)
 *   - Lock: cannot release a rider recruited during the current phase
 *   - Contract set to 'released' immediately, rider returns to pool
 */
export async function releaseRider(contractId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Fetch contract + team + rider data in one query
  const { data: contract } = await supabase
    .from("contracts")
    .select(
      "id, team_id, rider_id, status, locked_salary, phase_recruited_id, " +
      "teams:team_id(user_id, treasury, league_id), " +
      "riders:rider_id(pcs_points_1yr)"
    )
    .eq("id", contractId)
    .single();

  if (!contract) return { error: "Contract not found" };

  const team = Array.isArray(contract.teams) ? contract.teams[0] : contract.teams;
  if ((team as { user_id: string })?.user_id !== user.id) {
    return { error: "Not authorized" };
  }

  if (contract.status !== "active") {
    return { error: "Contract is not active" };
  }

  // Lock: can't release rider recruited this phase
  const currentPhase = getCurrentPhase();
  if (contract.phase_recruited_id === currentPhase.id) {
    return { error: "Cannot release a rider recruited during the current phase" };
  }

  const treasury = (team as { treasury: number }).treasury;
  const leagueId = (team as { league_id: string }).league_id;

  // Check treasury can cover release fee
  if (treasury < RELEASE_FEE) {
    return { error: "Insufficient treasury for release fee (5 000 EUR required)" };
  }

  // Calculate transfer bonus
  const rider = Array.isArray(contract.riders) ? contract.riders[0] : contract.riders;
  const pcsPoints = (rider as { pcs_points_1yr: number | null })?.pcs_points_1yr ?? 0;
  const transferBonus = calcTransferBonus(pcsPoints, contract.locked_salary);

  const now = new Date().toISOString();

  // 1. Update contract to released
  const { error: contractErr } = await supabase
    .from("contracts")
    .update({ status: "released", released_at: now })
    .eq("id", contractId);

  if (contractErr) return { error: contractErr.message };

  // 2. Deduct release fee
  await supabase.from("treasury_log").insert({
    team_id: contract.team_id,
    type: "release_fee",
    amount: -RELEASE_FEE,
    description: "Release fee (flat 5 000 EUR)",
    rider_id: contract.rider_id,
  });

  // 3. Credit transfer bonus (if any)
  if (transferBonus > 0) {
    await supabase.from("treasury_log").insert({
      team_id: contract.team_id,
      type: "transfer_bonus",
      amount: transferBonus,
      description: `Transfer bonus for rider (min salary appreciated)`,
      rider_id: contract.rider_id,
    });
  }

  // 4. Update treasury: -fee +bonus
  const newTreasury = treasury - RELEASE_FEE + transferBonus;
  await supabase
    .from("teams")
    .update({ treasury: newTreasury })
    .eq("id", contract.team_id);

  revalidatePath(`/league/${leagueId}`);
  return { success: true, transferBonus, releaseFee: RELEASE_FEE };
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd apps/web && pnpm vitest run app/\(game\)/league/\[leagueId\]/rider/\[riderId\]/actions.test.ts`

Expected: All tests PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/app/\(game\)/league/\[leagueId\]/rider/\[riderId\]/actions.ts \
       apps/web/app/\(game\)/league/\[leagueId\]/rider/\[riderId\]/actions.test.ts
git commit -m "feat: rewrite releaseRider — immediate release, 5K flat fee, transfer bonus"
```

---

## Task 3: confirmPhaseSetup Server Action

**Files:**
- Create: `apps/web/app/(game)/league/[leagueId]/team/recruts/actions.ts`
- Test: `apps/web/app/(game)/league/[leagueId]/team/recruts/actions.test.ts`

### Step 3a: Write tests for confirmPhaseSetup

- [ ] **Step 1: Write the failing tests**

Create `apps/web/app/(game)/league/[leagueId]/team/recruts/actions.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFrom, mockGetUser } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockGetUser: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: mockFrom,
    auth: { getUser: mockGetUser },
  })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/phases", () => ({
  getCurrentPhase: () => ({ id: 4, label: "Giro d'Italia" }),
}));

import { confirmPhaseSetup } from "./actions";

function makeChain(data: unknown = null, error: unknown = null) {
  const m: Record<string, unknown> = {};
  const chain = new Proxy(m, {
    get(target, prop) {
      if (prop === "execute") return () => Promise.resolve({ data, error, count: Array.isArray(data) ? data.length : 0 });
      if (prop === "then") return undefined;
      return (..._args: unknown[]) => chain;
    },
  });
  return chain;
}

const USER_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const TEAM_ID = "bbbbbbbb-0000-0000-0000-000000000001";
const LEAGUE_ID = "eeeeeeee-0000-0000-0000-000000000001";
const SPONSOR_ID = "ffffffff-0000-0000-0000-000000000001";

describe("confirmPhaseSetup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
  });

  it("returns error when not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const result = await confirmPhaseSetup(TEAM_ID);
    expect(result).toEqual({ error: "Not authenticated" });
  });

  it("returns error when already confirmed for current phase", async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return makeChain({
          id: TEAM_ID,
          treasury: 200_000,
          league_id: LEAGUE_ID,
          phase_confirmed_id: 4, // already confirmed for phase 4 (current)
          pending_sponsor_id: null,
        });
      }
      return makeChain(null);
    });

    const result = await confirmPhaseSetup(TEAM_ID);
    expect(result).toEqual({ error: "Already confirmed for this phase" });
  });

  it("performs payday: sponsor income, salary deduction, updates treasury", async () => {
    const inserts: Array<{ type: string; amount: number }> = [];
    let callCount = 0;

    mockFrom.mockImplementation((table: string) => {
      callCount++;

      // 1. Team fetch
      if (callCount === 1) {
        return makeChain({
          id: TEAM_ID,
          treasury: 100_000,
          league_id: LEAGUE_ID,
          phase_confirmed_id: 3, // last confirmed phase 3, current is 4
          pending_sponsor_id: null,
        });
      }

      // 2. team_sponsors fetch (with sponsor data)
      if (callCount === 2) {
        return makeChain({
          sponsor_id: SPONSOR_ID,
          sponsors: { id: SPONSOR_ID, name: "Groupama-FDJ", monthly_budget: 450_000 },
        });
      }

      // 3. contracts fetch (active contracts for salary)
      if (callCount === 3) {
        return makeChain([
          { id: "c1", locked_salary: 50_000 },
          { id: "c2", locked_salary: 30_000 },
        ]);
      }

      // 4. team_policies fetch (pending changes)
      if (callCount === 4) {
        return makeChain([]);
      }

      // Track treasury_log inserts
      if (table === "treasury_log") {
        const chainProxy = new Proxy({} as Record<string, unknown>, {
          get(_, prop) {
            if (prop === "insert") return (row: { type: string; amount: number }) => {
              inserts.push(row);
              return chainProxy;
            };
            if (prop === "execute") return () => Promise.resolve({ data: null, error: null });
            if (prop === "then") return undefined;
            return () => chainProxy;
          },
        });
        return chainProxy;
      }

      // All other calls succeed
      return makeChain(null);
    });

    const result = await confirmPhaseSetup(TEAM_ID);

    expect(result).toHaveProperty("success", true);
    // Treasury: 100K + 450K (sponsor) - 80K (salaries) = 470K
    expect(result).toHaveProperty("treasuryAfter", 470_000);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && pnpm vitest run app/\(game\)/league/\[leagueId\]/team/recruts/actions.test.ts`

Expected: FAIL — module `./actions` not found.

### Step 3b: Implement confirmPhaseSetup

- [ ] **Step 3: Write confirmPhaseSetup**

Create `apps/web/app/(game)/league/[leagueId]/team/recruts/actions.ts`:

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getCurrentPhase } from "@/lib/phases";
import { RELEASE_FEE, calcTransferBonus, calcMinSalary } from "@/lib/format";

/**
 * Confirm phase setup — triggers payday.
 *
 * Sequence:
 *   1. Apply pending sponsor change (if any)
 *   2. Apply pending policy changes (if any)
 *   3. Credit sponsor income
 *   4. Deduct salaries for all active contracts
 *   5. Update treasury
 *   6. Bankruptcy check (if treasury < -10 000)
 *   7. Mark phase as confirmed
 */
export async function confirmPhaseSetup(teamId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const currentPhase = getCurrentPhase();

  // Fetch team (verifies ownership via RLS)
  const { data: team } = await supabase
    .from("teams")
    .select("id, treasury, league_id, phase_confirmed_id, pending_sponsor_id")
    .eq("id", teamId)
    .eq("user_id", user.id)
    .single();

  if (!team) return { error: "Team not found" };

  // Guard: already confirmed for this phase
  if (team.phase_confirmed_id === currentPhase.id) {
    return { error: "Already confirmed for this phase" };
  }

  let treasury = team.treasury;

  // --- Step 1: Apply pending sponsor change ---
  if (team.pending_sponsor_id) {
    await supabase.from("team_sponsors").upsert(
      {
        team_id: teamId,
        sponsor_id: team.pending_sponsor_id,
        activated_at: new Date().toISOString(),
      },
      { onConflict: "team_id" }
    );

    await supabase
      .from("teams")
      .update({ pending_sponsor_id: null })
      .eq("id", teamId);
  }

  // --- Step 2: Apply pending policy changes ---
  const { data: pendingPolicies } = await supabase
    .from("team_policies")
    .select("id, pending_is_active, pending_config")
    .eq("team_id", teamId)
    .not("pending_is_active", "is", null);

  if (pendingPolicies && pendingPolicies.length > 0) {
    for (const p of pendingPolicies) {
      if (p.pending_is_active === false) {
        // Deactivate: delete the policy row
        await supabase.from("team_policies").delete().eq("id", p.id);
      } else {
        // Activate: apply pending state
        await supabase
          .from("team_policies")
          .update({
            is_active: p.pending_is_active,
            config: p.pending_config,
            activated_at: new Date().toISOString(),
            pending_is_active: null,
            pending_config: null,
          })
          .eq("id", p.id);
      }
    }
  }

  // --- Step 3: Credit sponsor income ---
  const { data: teamSponsor } = await supabase
    .from("team_sponsors")
    .select("sponsor_id, sponsors(id, name, monthly_budget)")
    .eq("team_id", teamId)
    .single();

  const sponsor = teamSponsor?.sponsors;
  const sponsorBudget = (sponsor as { monthly_budget: number } | null)?.monthly_budget ?? 250_000;
  const sponsorName = (sponsor as { name: string } | null)?.name ?? "Lotto (default)";

  treasury += sponsorBudget;

  await supabase.from("treasury_log").insert({
    team_id: teamId,
    type: "sponsor_payment",
    amount: sponsorBudget,
    description: `Payday — ${sponsorName} (Phase ${currentPhase.id}: ${currentPhase.label})`,
  });

  // --- Step 4: Deduct salaries ---
  const { data: contracts } = await supabase
    .from("contracts")
    .select("id, rider_id, locked_salary")
    .eq("team_id", teamId)
    .eq("status", "active");

  const totalSalary = (contracts ?? []).reduce(
    (sum, c) => sum + (c.locked_salary ?? 0),
    0
  );

  if (totalSalary > 0) {
    treasury -= totalSalary;

    await supabase.from("treasury_log").insert({
      team_id: teamId,
      type: "payday_salary",
      amount: -totalSalary,
      description: `Payday salaries — ${(contracts ?? []).length} riders (Phase ${currentPhase.id})`,
    });
  }

  // --- Step 5: Update treasury ---
  await supabase
    .from("teams")
    .update({ treasury })
    .eq("id", teamId);

  // --- Step 6: Bankruptcy check ---
  const BANKRUPTCY_THRESHOLD = -10_000;
  const released: string[] = [];

  if (treasury < BANKRUPTCY_THRESHOLD && contracts && contracts.length > 0) {
    // Fetch XP for each rider to determine release order
    const { data: xpData } = await supabase
      .from("rider_xp_daily")
      .select("rider_id, xp_gained")
      .eq("team_id", teamId);

    const riderXp: Record<string, number> = {};
    for (const row of xpData ?? []) {
      riderXp[row.rider_id] = (riderXp[row.rider_id] ?? 0) + row.xp_gained;
    }

    // Sort by highest XP first
    const sortedContracts = [...contracts].sort(
      (a, b) => (riderXp[b.rider_id] ?? 0) - (riderXp[a.rider_id] ?? 0)
    );

    for (const contract of sortedContracts) {
      if (treasury >= BANKRUPTCY_THRESHOLD) break;

      // Release contract
      await supabase
        .from("contracts")
        .update({ status: "released", released_at: new Date().toISOString() })
        .eq("id", contract.id);

      // Refund salary
      treasury += contract.locked_salary;

      // Release fee
      treasury -= RELEASE_FEE;

      // Treasury log entries
      await supabase.from("treasury_log").insert({
        team_id: teamId,
        type: "bankruptcy_release",
        amount: contract.locked_salary - RELEASE_FEE,
        description: `Bankruptcy auto-release — rider ${contract.rider_id}`,
        rider_id: contract.rider_id,
      });

      released.push(contract.rider_id);
    }

    // Update treasury after bankruptcy
    await supabase
      .from("teams")
      .update({ treasury })
      .eq("id", teamId);
  }

  // --- Step 7: Mark confirmed ---
  await supabase
    .from("teams")
    .update({
      phase_confirmed_at: new Date().toISOString(),
      phase_confirmed_id: currentPhase.id,
    })
    .eq("id", teamId);

  revalidatePath(`/league/${team.league_id}`);

  return {
    success: true,
    treasuryAfter: treasury,
    sponsorBudget,
    totalSalary,
    released,
    phaseId: currentPhase.id,
    phaseLabel: currentPhase.label,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && pnpm vitest run app/\(game\)/league/\[leagueId\]/team/recruts/actions.test.ts`

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(game\)/league/\[leagueId\]/team/recruts/actions.ts \
       apps/web/app/\(game\)/league/\[leagueId\]/team/recruts/actions.test.ts
git commit -m "feat: add confirmPhaseSetup server action — payday, bankruptcy, pending changes"
```

---

## Task 4: Update saveSponsor for Pending Model

**Files:**
- Modify: `apps/web/app/(game)/league/[leagueId]/budget/actions.ts`

- [ ] **Step 1: Rewrite saveSponsor**

The logic changes from "immediate upsert to team_sponsors" to "write teams.pending_sponsor_id". First sponsor selection (onboarding) remains immediate.

Replace the content of `apps/web/app/(game)/league/[leagueId]/budget/actions.ts`:

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod/v4";

const SaveSponsorSchema = z.object({
  teamId: z.uuid(),
  sponsorId: z.uuid(),
});

/**
 * Save sponsor selection.
 *
 * Two modes:
 *   - First sponsor (no existing team_sponsors row): immediate upsert + first payment
 *   - Change sponsor (has existing): sets teams.pending_sponsor_id, effective at next payday
 */
export async function saveSponsor(input: { teamId: string; sponsorId: string }) {
  const parsed = SaveSponsorSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: "Invalid input" };
  }

  const { teamId, sponsorId } = parsed.data;
  const supabase = await createClient();

  // Verify team ownership
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false as const, error: "Not authenticated" };

  const { data: team } = await supabase
    .from("teams")
    .select("id, level, league_id, treasury")
    .eq("id", teamId)
    .eq("user_id", user.id)
    .single();

  if (!team) return { success: false as const, error: "Team not found" };

  // Verify sponsor exists and is unlocked
  const { data: sponsor } = await supabase
    .from("sponsors")
    .select("id, name, unlock_level, monthly_budget")
    .eq("id", sponsorId)
    .single();

  if (!sponsor) return { success: false as const, error: "Sponsor not found" };
  if (sponsor.unlock_level > team.level) {
    return { success: false as const, error: `Requires level ${sponsor.unlock_level}` };
  }

  // Check if team already has a sponsor
  const { data: existingSponsor } = await supabase
    .from("team_sponsors")
    .select("id, sponsor_id")
    .eq("team_id", teamId)
    .maybeSingle();

  if (!existingSponsor) {
    // --- First sponsor selection (onboarding) ---
    // Immediate upsert + first payment (this IS the first payday)
    await supabase.from("team_sponsors").insert({
      team_id: teamId,
      sponsor_id: sponsorId,
      activated_at: new Date().toISOString(),
    });

    // First sponsor payment
    const newTreasury = team.treasury + sponsor.monthly_budget;
    await supabase
      .from("teams")
      .update({ treasury: newTreasury })
      .eq("id", teamId);

    await supabase.from("treasury_log").insert({
      team_id: teamId,
      type: "sponsor_payment",
      amount: sponsor.monthly_budget,
      description: `First sponsor payment — ${sponsor.name}`,
    });

    revalidatePath(`/league/${team.league_id}`);
    return { success: true as const, sponsorName: sponsor.name, immediate: true };
  }

  // --- Sponsor change (pending, effective next payday) ---
  if (existingSponsor.sponsor_id === sponsorId) {
    return { success: false as const, error: "Already your active sponsor" };
  }

  await supabase
    .from("teams")
    .update({ pending_sponsor_id: sponsorId })
    .eq("id", teamId);

  revalidatePath(`/league/${team.league_id}`);
  return { success: true as const, sponsorName: sponsor.name, pending: true };
}
```

- [ ] **Step 2: Run typecheck**

Run: `cd apps/web && pnpm typecheck`

Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(game\)/league/\[leagueId\]/budget/actions.ts
git commit -m "feat: saveSponsor — first selection immediate with payment, changes pending for next payday"
```

---

## Task 5: Gate Bidding Behind Phase Confirmation

**Files:**
- Modify: `apps/web/app/(game)/league/[leagueId]/auctions/[auctionId]/actions.ts`

- [ ] **Step 1: Add confirmation gate to placeBid**

In `apps/web/app/(game)/league/[leagueId]/auctions/[auctionId]/actions.ts`, add a check after the team fetch (around line 50) that verifies the team has confirmed for the current phase:

Add this import at top:
```typescript
import { getCurrentPhase } from "@/lib/phases";
```

Add this check after the existing team ownership verification (after `const team = ...`):
```typescript
  // Gate: must confirm phase setup before bidding
  const currentPhase = getCurrentPhase();
  if (team.phase_confirmed_id !== currentPhase.id) {
    return { error: "You must confirm your phase setup before placing bids" };
  }
```

Also add `phase_confirmed_id` to the team select query.

- [ ] **Step 2: Run existing auction tests**

Run: `cd apps/web && pnpm vitest run app/\(game\)/league/\[leagueId\]/auctions/\[auctionId\]/actions.test.ts`

Expected: Some tests may need updating to include `phase_confirmed_id` in mock data. Update mock team data to include `phase_confirmed_id: 4` (matching current phase mock).

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(game\)/league/\[leagueId\]/auctions/\[auctionId\]/actions.ts \
       apps/web/app/\(game\)/league/\[leagueId\]/auctions/\[auctionId\]/actions.test.ts
git commit -m "feat: gate placeBid behind phase confirmation"
```

---

## Task 6: Phase Setup UI Component

**Files:**
- Create: `apps/web/app/(game)/league/[leagueId]/team/recruts/phase-setup.tsx`
- Modify: `apps/web/app/(game)/league/[leagueId]/team/recruts/page.tsx`

**Prerequisite:** Read `docs/watthunter-design-system-v3.md` before writing any UI code.

### Step 6a: Build PhaseSetup component

- [ ] **Step 1: Create phase-setup.tsx**

Create `apps/web/app/(game)/league/[leagueId]/team/recruts/phase-setup.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatEuro, formatThousands, smartCountdown } from "@/lib/format";
import { confirmPhaseSetup } from "./actions";

interface RosterRider {
  contractId: string;
  riderId: string;
  fullName: string;
  lockedSalary: number;
}

interface PhaseSetupProps {
  leagueId: string;
  teamId: string;
  phase: { id: number; label: string };
  phaseStarted: boolean;
  phaseStartDate: string;
  sponsor: { name: string; monthlyBudget: number } | null;
  pendingSponsor: { name: string } | null;
  roster: RosterRider[];
  activePolicies: Array<{ id: string; name: string; config: string }>;
  maxPolicies: number;
  treasury: number;
  rounds: Array<{ name: string; date: string }>;
}

export function PhaseSetup({
  leagueId,
  teamId,
  phase,
  phaseStarted,
  phaseStartDate,
  sponsor,
  pendingSponsor,
  roster,
  activePolicies,
  maxPolicies,
  treasury,
  rounds,
}: PhaseSetupProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const totalSalary = roster.reduce((sum, r) => sum + r.lockedSalary, 0);
  const sponsorBudget = sponsor?.monthlyBudget ?? 0;
  const treasuryAfter = treasury + sponsorBudget - totalSalary;

  async function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await confirmPhaseSetup(teamId);
      if ("error" in result) {
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-5 px-4 pt-4 pb-24">
      {/* Phase header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[length:var(--type-title)] font-bold text-[var(--text-high)]">
            Phase {phase.id} — {phase.label}
          </h2>
        </div>
        {!phaseStarted && (
          <span className="text-[length:var(--type-body)] text-[var(--text-mid)]">
            Starts {smartCountdown(phaseStartDate)}
          </span>
        )}
      </div>

      {/* Round dates */}
      {rounds.length > 0 && (
        <div>
          <h3 className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)] mb-1">
            Rounds
          </h3>
          <div className="flex gap-3 text-[length:var(--type-body)] text-[var(--text-mid)]">
            {rounds.map((r, i) => (
              <span key={i}>
                R{i + 1}: {new Date(r.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            ))}
          </div>
        </div>
      )}

      <hr className="border-[var(--border-subtle)]" />

      {/* Sponsor */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)] mb-0.5">
            Sponsor
          </h3>
          <p className="text-[length:var(--type-body)] text-[var(--text-high)]">
            {sponsor?.name ?? "None"}{" "}
            {pendingSponsor && (
              <span className="text-[var(--text-mid)]">
                → {pendingSponsor.name} next phase
              </span>
            )}
          </p>
          <p className="text-[length:var(--type-caption)] text-[var(--text-mid)] font-mono">
            +{formatThousands(sponsorBudget)} €
          </p>
        </div>
        <Link
          href={`/league/${leagueId}/budget`}
          className="text-[length:var(--type-body)] text-[var(--accent-default)]"
        >
          Change
        </Link>
      </div>

      <hr className="border-[var(--border-subtle)]" />

      {/* Roster */}
      <div>
        <h3 className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)] mb-2">
          My Roster ({roster.length} riders)
        </h3>
        <div className="space-y-1">
          {roster.map((r) => (
            <div
              key={r.contractId}
              className="flex items-center justify-between py-1.5"
            >
              <Link
                href={`/league/${leagueId}/rider/${r.riderId}?from=team`}
                className="text-[length:var(--type-body)] text-[var(--text-high)]"
              >
                {r.fullName}
              </Link>
              <div className="flex items-center gap-3">
                <span className="text-[length:var(--type-body)] text-[var(--text-mid)] font-mono">
                  {formatThousands(r.lockedSalary)} €
                </span>
                <Link
                  href={`/league/${leagueId}/rider/${r.riderId}?from=team`}
                  className="text-[length:var(--type-caption)] text-[var(--status-danger)]"
                >
                  Release
                </Link>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[length:var(--type-body)] text-[var(--text-mid)] font-mono">
          Total salaries: -{formatThousands(totalSalary)} €
        </p>
      </div>

      <hr className="border-[var(--border-subtle)]" />

      {/* Policies */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)] mb-1">
            Policies ({activePolicies.length}/{maxPolicies} active)
          </h3>
          {activePolicies.map((p) => (
            <p key={p.id} className="text-[length:var(--type-body)] text-[var(--text-mid)]">
              {p.name}: {p.config}
            </p>
          ))}
          {activePolicies.length === 0 && (
            <p className="text-[length:var(--type-body)] text-[var(--text-ghost)]">
              No active policies
            </p>
          )}
        </div>
        <Link
          href={`/league/${leagueId}/team/policies`}
          className="text-[length:var(--type-body)] text-[var(--accent-default)]"
        >
          Change
        </Link>
      </div>

      <hr className="border-[var(--border-subtle)]" />

      {/* Forecast */}
      <div>
        <h3 className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)] mb-2">
          Forecast
        </h3>
        <div className="space-y-1 text-[length:var(--type-body)] font-mono">
          <div className="flex justify-between">
            <span className="text-[var(--text-mid)]">Treasury now</span>
            <span className="text-[var(--text-high)]">{formatEuro(treasury)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--text-mid)]">+ Sponsor</span>
            <span className="text-[var(--accent-default)]">+{formatEuro(sponsorBudget)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--text-mid)]">- Salaries</span>
            <span className="text-[var(--status-danger)]">-{formatEuro(totalSalary)}</span>
          </div>
          <hr className="border-[var(--border-subtle)]" />
          <div className="flex justify-between font-bold">
            <span className="text-[var(--text-high)]">After payday</span>
            <span className={treasuryAfter >= 0 ? "text-[var(--text-high)]" : "text-[var(--status-danger)]"}>
              {formatEuro(treasuryAfter)}
            </span>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <p className="text-[length:var(--type-body)] text-[var(--status-danger)]">{error}</p>
      )}

      {/* Confirm button */}
      <Button
        onClick={handleConfirm}
        disabled={!phaseStarted || isPending}
        className="w-full"
        size="lg"
      >
        {isPending
          ? "Confirming..."
          : phaseStarted
            ? "Confirm & Start Bidding"
            : `Phase starts ${new Date(phaseStartDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/\(game\)/league/\[leagueId\]/team/recruts/phase-setup.tsx
git commit -m "feat: add PhaseSetup component — forecast, roster, sponsor, confirm button"
```

### Step 6b: Update Recruts page for 2-state routing

- [ ] **Step 3: Rewrite page.tsx data fetching**

Modify `apps/web/app/(game)/league/[leagueId]/team/recruts/page.tsx` to:
1. Fetch `phase_confirmed_id` from team
2. Compare with current phase
3. If not confirmed → render PhaseSetup
4. If confirmed → render RecrutsClient (existing bidding UI)

The full replacement for `page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/supabase/get-user";
import { RecrutsClient } from "./recruts-client";
import { PhaseSetup } from "./phase-setup";
import { getLevelByNumber, getMaxSlots, getLevelForXp } from "@/lib/levels";
import { getCurrentPhase, getPhaseRange, getNextAuctionDate, formatAuctionDate } from "@/lib/phases";

export default async function RecrutsPage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return (
      <div className="px-4 py-8">
        <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
          Please sign in to view recruits.
        </p>
      </div>
    );
  }

  const { data: member } = await supabase
    .from("league_members")
    .select(
      "id, team_id, teams:team_id(id, level, cumulative_xp, treasury, phase_confirmed_id, pending_sponsor_id)"
    )
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .single();

  if (!member) {
    return (
      <div className="px-4 py-8">
        <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
          You are not a member of this league.
        </p>
      </div>
    );
  }

  const team = Array.isArray(member.teams) ? member.teams[0] : member.teams;
  const xp = team?.cumulative_xp ?? 0;
  const level = getLevelForXp(xp);
  const currentPhase = getCurrentPhase();
  const phaseConfirmed = team?.phase_confirmed_id === currentPhase.id;

  // ===== STATE 1: Phase Setup (not yet confirmed) =====
  if (!phaseConfirmed) {
    // Fetch sponsor, roster, policies for phase setup display
    const [
      { data: teamSponsor },
      { data: contracts },
      { data: policies },
      { data: pendingSponsor },
      { data: auctions },
    ] = await Promise.all([
      supabase
        .from("team_sponsors")
        .select("sponsor_id, sponsors(name, monthly_budget)")
        .eq("team_id", team?.id ?? "")
        .maybeSingle(),
      supabase
        .from("contracts")
        .select("id, rider_id, locked_salary, riders:rider_id(full_name)")
        .eq("team_id", team?.id ?? "")
        .eq("status", "active"),
      supabase
        .from("team_policies")
        .select("id, is_active, config, policies:policy_id(name)")
        .eq("team_id", team?.id ?? "")
        .eq("is_active", true),
      team?.pending_sponsor_id
        ? supabase
            .from("sponsors")
            .select("name")
            .eq("id", team.pending_sponsor_id)
            .single()
        : Promise.resolve({ data: null }),
      supabase
        .from("auctions")
        .select("id, name, opens_at")
        .eq("league_id", leagueId)
        .in("status", ["scheduled", "open"])
        .order("opens_at", { ascending: true })
        .limit(3),
    ]);

    const sponsor = teamSponsor?.sponsors as { name: string; monthly_budget: number } | null;
    const { start: phaseStart } = getPhaseRange(currentPhase, new Date().getFullYear());
    const phaseStarted = new Date() >= phaseStart;

    const roster = (contracts ?? []).map((c) => {
      const rider = Array.isArray(c.riders) ? c.riders[0] : c.riders;
      return {
        contractId: c.id,
        riderId: c.rider_id,
        fullName: (rider as { full_name: string } | null)?.full_name ?? "Unknown",
        lockedSalary: c.locked_salary,
      };
    });

    const activePolicies = (policies ?? [])
      .filter((p) => p.is_active)
      .map((p) => {
        const policy = Array.isArray(p.policies) ? p.policies[0] : p.policies;
        return {
          id: p.id,
          name: (policy as { name: string } | null)?.name ?? "Unknown",
          config: p.config ? JSON.stringify(p.config) : "—",
        };
      });

    const rounds = (auctions ?? []).map((a) => ({
      name: a.name,
      date: a.opens_at,
    }));

    const levelData = getLevelByNumber(level);

    return (
      <PhaseSetup
        leagueId={leagueId}
        teamId={team?.id ?? ""}
        phase={{ id: currentPhase.id, label: currentPhase.label }}
        phaseStarted={phaseStarted}
        phaseStartDate={phaseStart.toISOString()}
        sponsor={sponsor}
        pendingSponsor={pendingSponsor as { name: string } | null}
        roster={roster}
        activePolicies={activePolicies}
        maxPolicies={levelData.maxActive}
        treasury={team?.treasury ?? 0}
        rounds={rounds}
      />
    );
  }

  // ===== STATE 2: Bidding (already confirmed) =====
  const minRank = getLevelByNumber(level).poolMin;

  const [{ data: riders }, { data: leagueTeams }] = await Promise.all([
    supabase
      .from("riders")
      .select(
        "id, full_name, nationality, real_team, pcs_rank, pcs_rank_prev, photo_url, specialty, pcs_points_1yr"
      )
      .gte("pcs_rank", minRank)
      .lte("pcs_rank", 600)
      .order("pcs_rank", { ascending: true })
      .limit(600),
    supabase.from("teams").select("id").eq("league_id", leagueId),
  ]);

  const leagueTeamIds = (leagueTeams ?? []).map((t) => t.id);

  const { data: leagueContracts } = await supabase
    .from("contracts")
    .select("rider_id, team_id")
    .in("team_id", leagueTeamIds)
    .eq("status", "active");

  const ownedRiderIds = new Set(
    (leagueContracts ?? []).map((c) => c.rider_id)
  );

  const ownTeamSlots = (leagueContracts ?? []).filter(
    (c) => c.team_id === team?.id
  ).length;

  const availableRiders = (riders ?? [])
    .filter((r) => !ownedRiderIds.has(r.id))
    .map((r) => ({
      ...r,
      pcs_rank_diff:
        r.pcs_rank != null && r.pcs_rank_prev != null
          ? r.pcs_rank_prev - r.pcs_rank
          : null,
    }));

  const [
    { data: activeRound },
    { data: scheduledRoundData },
    { count: closedCount },
  ] = await Promise.all([
    supabase
      .from("auctions")
      .select("id, name, opens_at, closes_at")
      .eq("league_id", leagueId)
      .eq("status", "open")
      .order("opens_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("auctions")
      .select("id, name, opens_at")
      .eq("league_id", leagueId)
      .eq("status", "scheduled")
      .order("opens_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("auctions")
      .select("id", { count: "exact", head: true })
      .eq("league_id", leagueId)
      .eq("status", "closed"),
  ]);

  let nextRound: { id: string; name: string; opens_at: string } | null = null;
  let nextAuctionLabel: string | null = null;
  if (!activeRound) {
    nextRound = scheduledRoundData;
    if (!nextRound) {
      if (closedCount && closedCount > 0) {
        const next = getNextAuctionDate();
        if (next) {
          nextAuctionLabel = `Next round · ${formatAuctionDate(next.date)}`;
        }
      }
    }
  }

  let initialBids: Array<{ bid_id: string; rider_id: string; amount: number }> = [];
  if (activeRound && team?.id) {
    const { data: existingBids } = await supabase
      .from("auction_bids")
      .select("id, rider_id, amount")
      .eq("team_id", team.id)
      .eq("auction_id", activeRound.id)
      .eq("status", "active");

    initialBids = (existingBids ?? []).map((b) => ({
      bid_id: b.id,
      rider_id: b.rider_id,
      amount: b.amount,
    }));
  }

  return (
    <RecrutsClient
      leagueId={leagueId}
      riders={availableRiders}
      activeRound={activeRound}
      nextRound={nextRound}
      nextAuctionLabel={nextAuctionLabel}
      maxSlots={getMaxSlots(level)}
      currentSlots={ownTeamSlots}
      initialBids={initialBids}
      treasury={team?.treasury ?? 0}
    />
  );
}
```

- [ ] **Step 4: Run typecheck + build**

Run: `cd apps/web && pnpm typecheck`

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(game\)/league/\[leagueId\]/team/recruts/page.tsx
git commit -m "feat: recruts page 2-state routing — Phase Setup (pre-confirm) or Bidding (post-confirm)"
```

---

## Task 7: Update Rider Detail Release UI

**Files:**
- Modify: `apps/web/app/(game)/league/[leagueId]/rider/[riderId]/rider-detail-client.tsx`

- [ ] **Step 1: Update release dialog**

In `rider-detail-client.tsx`, find the release section (around lines 396–437).

Replace the old release logic:

Old text: `"Release this rider? They will leave at the start of ${phaseName}."`

New text:  
```
Release this rider?
• Fee: 5 000 EUR (deducted immediately)
• Transfer bonus: {bonus} EUR (if rider appreciated)
• Rider returns to recruitment pool immediately
```

Remove the `notice` badge section (lines 429–437 that render `"On notice — leaving {phaseName}"`).

Remove the `canRelease` prop dependency (release is always available for active contracts, unless same phase recruited).

Update the `contractData` interface to include `pcsPoints` and remove `effectivePhaseName`.

Key changes:
- Remove `canRelease` and `nextPhaseName` props
- Add `pcsPoints` to contractData
- Calculate and display transfer bonus inline
- Remove notice badge

- [ ] **Step 2: Run typecheck**

Run: `cd apps/web && pnpm typecheck`

Expected: No errors (may need to update parent page that passes props).

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(game\)/league/\[leagueId\]/rider/\[riderId\]/rider-detail-client.tsx
git commit -m "feat: update rider detail — immediate release UI with fee and transfer bonus display"
```

---

## Task 8: Remove Dead Code

**Files:**
- Delete: `apps/web/lib/phase-transition.ts`
- Delete: `services/pcs-sync/phase_finance.py`
- Delete: `services/pcs-sync/tests/test_phase_finance.py`

- [ ] **Step 1: Verify no imports of phase-transition.ts**

Run: `grep -r "phase-transition" apps/web/`

Expected: No results (or only this file itself). If other files import it, update them to remove the import.

- [ ] **Step 2: Verify no imports of phase_finance.py**

Run: `grep -r "phase_finance" services/pcs-sync/`

Expected: Only in `tests/test_phase_finance.py` and `run_pipeline.py`. Update `run_pipeline.py` to remove the `phase-finance` command.

- [ ] **Step 3: Delete files**

```bash
rm apps/web/lib/phase-transition.ts
rm services/pcs-sync/phase_finance.py
rm services/pcs-sync/tests/test_phase_finance.py
```

- [ ] **Step 4: Update run_pipeline.py**

Remove the `phase-finance` command from the CLI dispatcher. The `confirmPhaseSetup` server action replaces it.

- [ ] **Step 5: Run tests**

Run: `cd apps/web && pnpm typecheck && cd ../../services/pcs-sync && python -m pytest tests/ -v`

Expected: All tests pass. No broken imports.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: remove phase-transition.ts, phase_finance.py — replaced by confirmPhaseSetup server action"
```

---

## Task 9: Update Recruts Client (minor — contract status filter)

**Files:**
- Modify: `apps/web/app/(game)/league/[leagueId]/team/recruts/recruts-client.tsx`

- [ ] **Step 1: Remove 'notice' status references**

In `recruts-client.tsx`, the contracts filter in `page.tsx` already changed from `.in("status", ["active", "notice"])` to `.eq("status", "active")`. Verify the client component has no references to `notice` status.

Search for "notice" in the file — expected: none found in the client component (the server page was already updated in Task 6).

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/\(game\)/league/\[leagueId\]/team/recruts/recruts-client.tsx
git commit -m "chore: remove notice status references from recruts client"
```

---

## Task 10: Final Verification

- [ ] **Step 1: Run full test suite**

```bash
cd apps/web && pnpm typecheck && pnpm vitest run
cd ../../services/pcs-sync && python -m pytest tests/ -v
```

Expected: All tests pass.

- [ ] **Step 2: Run build**

```bash
pnpm build
```

Expected: Build succeeds with no errors.

- [ ] **Step 3: Manual smoke test**

1. Open the app, navigate to Recruits tab
2. Verify Phase Setup screen shows (if not yet confirmed)
3. Verify sponsor, roster, policies, forecast display correctly
4. Click "Confirm & Start Bidding" → verify payday runs, treasury updates
5. Navigate to a rider detail → verify release button works with new fee display
6. Release a rider → verify flat fee deducted, transfer bonus credited

- [ ] **Step 4: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: address smoke test issues"
```
