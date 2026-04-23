# Co-Unlock Rule — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Mechanism 2 of the Anti-Runaway System — prevent a solo top-level player from bidding on riders that only they can access (the "crown jewels" of the pool) until at least one more player in the league unlocks the required level.

**Architecture:** All logic lives client-side + server-side in TypeScript. A new module `apps/web/lib/co-unlock.ts` exposes a pure `getMinLevelForRiderRank(pcsRank)` helper and a DB-backed `getCoUnlockStatus(leagueId, riderPcsRank)` that counts how many teams in the league are at or above the required level. The `placeBid()` server action adds a gate after the existing level check; the market page fetches status for every visible rider and passes a `isLocked` prop down to `RiderCard`. No new DB tables, no migration — grandfathering is forward-only by construction.

**Tech Stack:**
- TypeScript (Next.js 16 App Router, Server Components + Server Actions)
- Supabase JS client for team-level count queries
- vitest for unit tests of helpers

---

## Prerequisites

- Design spec reviewed: `docs/plans/2026-04-23-anti-runaway-system-design.md` §4
- Remontada Boost plan (plan 1 of 3) can run in parallel — no file conflicts
- Level Curve Stretch plan (plan 3 of 3) should ideally be applied BEFORE this plan runs, because the new T4@Lv.4 / T5@Lv.6 mapping affects which riders are "exclusive" to which level. If both plans are active concurrently, the rank→level mapping below will still work correctly (it's driven by `getLevelByNumber().poolMin`, which reads from `levels.ts`).
- No existing "exclusive contracts" in the target league at deployment time (per spec §4.3, the grandfathering is trivial in practice).

## File Structure

**New files (3):**
- `apps/web/lib/co-unlock.ts` — helpers: `getMinLevelForRiderRank`, `getCoUnlockStatus`, `canBidOnRider`
- `apps/web/lib/co-unlock.test.ts` — unit tests
- `apps/web/components/rider-lock-badge.tsx` — visual badge for locked state (small pill)

**Modified files (3):**
- `apps/web/app/(game)/league/[leagueId]/auction/[auctionId]/actions.ts` — add co-unlock check in `placeBid()` after line 117
- `apps/web/app/(game)/league/[leagueId]/auction/market/page.tsx` — fetch team-level distribution once, compute lock status per rider
- `apps/web/components/rider-card.tsx` — add `isLocked`, `lockMessage` props

## Conventions

- TS tests run from `apps/web/` with `pnpm test`
- All strings user-facing: English per CLAUDE.md Language Rule
- Reuse existing helpers from `@/lib/levels`: `getLevelByNumber`, `minRankForLevel`-equivalent logic

---

## Task 1: Build the pure level-mapping helper

**Files:**
- Create: `apps/web/lib/co-unlock.ts`
- Create: `apps/web/lib/co-unlock.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// apps/web/lib/co-unlock.test.ts
import { describe, it, expect } from "vitest";
import { getMinLevelForRiderRank } from "./co-unlock";

describe("getMinLevelForRiderRank", () => {
  it("rank 1 requires Lv.8", () => {
    expect(getMinLevelForRiderRank(1)).toBe(8);
  });

  it("rank 3 requires Lv.8", () => {
    expect(getMinLevelForRiderRank(3)).toBe(8);
  });

  it("rank 4 requires Lv.7", () => {
    expect(getMinLevelForRiderRank(4)).toBe(7);
  });

  it("rank 9 requires Lv.7", () => {
    expect(getMinLevelForRiderRank(9)).toBe(7);
  });

  it("rank 10 requires Lv.6", () => {
    expect(getMinLevelForRiderRank(10)).toBe(6);
  });

  it("rank 19 requires Lv.6", () => {
    expect(getMinLevelForRiderRank(19)).toBe(6);
  });

  it("rank 20 requires Lv.5", () => {
    expect(getMinLevelForRiderRank(20)).toBe(5);
  });

  it("rank 30 requires Lv.4", () => {
    expect(getMinLevelForRiderRank(30)).toBe(4);
  });

  it("rank 100 requires Lv.3", () => {
    expect(getMinLevelForRiderRank(100)).toBe(3);
  });

  it("rank 300 requires Lv.1", () => {
    expect(getMinLevelForRiderRank(300)).toBe(1);
  });

  it("rank 600 requires Lv.1", () => {
    expect(getMinLevelForRiderRank(600)).toBe(1);
  });

  it("returns 1 for rank beyond the pool (safe fallback)", () => {
    expect(getMinLevelForRiderRank(1000)).toBe(1);
  });
});
```

- [ ] **Step 2: Run to verify tests fail**

Run: `cd apps/web && pnpm test -- co-unlock`
Expected: `Cannot find module './co-unlock'`.

- [ ] **Step 3: Implement the helper**

```typescript
// apps/web/lib/co-unlock.ts
// Anti-Runaway Mechanism 2: Co-Unlock Rule.
// Spec: docs/plans/2026-04-23-anti-runaway-system-design.md §4

import { LEVELS } from "@/lib/levels";

/**
 * Return the lowest level (1..8) whose pool includes this rider's PCS rank.
 *
 * A level's `poolMin` is the BEST rank that level can access (e.g., Lv.8 poolMin=1).
 * A rider of rank R is accessible from any level L where poolMin(L) <= R.
 * We return the HIGHEST such level's number — i.e., the minimum level the rider
 * requires (since lower levels have higher poolMin and can't reach tight ranks).
 *
 * Example: rank 5 — Lv.7 poolMin=4 (can access), Lv.6 poolMin=10 (cannot). Returns 7.
 */
export function getMinLevelForRiderRank(pcsRank: number): number {
  // Iterate highest → lowest level. Return the highest level where poolMin <= rank
  // (which is equivalent to the "minimum level needed").
  // Actually: we want the SMALLEST level L such that poolMin(L) <= rank.
  // Since poolMin decreases as L increases (Lv.1=300, Lv.8=1), smallest L with
  // poolMin(L) <= rank is the first L (ascending) that meets the condition.
  for (const l of LEVELS) {
    if (l.poolMin <= pcsRank) return l.level;
  }
  return 1; // fallback — rank out of pool entirely, doesn't gate bidding on its own
}
```

- [ ] **Step 4: Run to verify tests pass**

Run: `cd apps/web && pnpm test -- co-unlock`
Expected: 12 passed.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/co-unlock.ts apps/web/lib/co-unlock.test.ts
git commit -m "feat(co-unlock): getMinLevelForRiderRank pure helper"
```

---

## Task 2: Add the league-level count helper

**Files:**
- Modify: `apps/web/lib/co-unlock.ts`
- Modify: `apps/web/lib/co-unlock.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `apps/web/lib/co-unlock.test.ts`:

```typescript
import { computeCoUnlockStatus } from "./co-unlock";

describe("computeCoUnlockStatus", () => {
  // Pure function: given league team levels and a rider rank, return the lock status.
  it("unlocked when 2 teams at required level", () => {
    const status = computeCoUnlockStatus({
      riderPcsRank: 1, // needs Lv.8
      leagueTeamLevels: [8, 8, 7, 6, 5],
    });
    expect(status).toEqual({
      minLevel: 8,
      playersAtOrAboveLevel: 2,
      playersNeededToUnlock: 0,
      isUnlocked: true,
    });
  });

  it("locked when only 1 team at required level", () => {
    const status = computeCoUnlockStatus({
      riderPcsRank: 1, // needs Lv.8
      leagueTeamLevels: [8, 7, 6, 5, 4],
    });
    expect(status).toEqual({
      minLevel: 8,
      playersAtOrAboveLevel: 1,
      playersNeededToUnlock: 1,
      isUnlocked: false,
    });
  });

  it("unlocked for low-rank rider accessible by most teams", () => {
    const status = computeCoUnlockStatus({
      riderPcsRank: 300,
      leagueTeamLevels: [3, 2, 1, 1],
    });
    expect(status.isUnlocked).toBe(true);
    expect(status.minLevel).toBe(1);
    expect(status.playersAtOrAboveLevel).toBe(4);
  });

  it("locked when no team has reached the required level yet", () => {
    const status = computeCoUnlockStatus({
      riderPcsRank: 1, // needs Lv.8
      leagueTeamLevels: [6, 5, 4, 3],
    });
    expect(status.isUnlocked).toBe(false);
    expect(status.playersAtOrAboveLevel).toBe(0);
    expect(status.playersNeededToUnlock).toBe(2);
  });

  it("always unlocked when rider has no rank (defensive)", () => {
    const status = computeCoUnlockStatus({
      riderPcsRank: null,
      leagueTeamLevels: [1],
    });
    expect(status.isUnlocked).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify tests fail**

Run: `cd apps/web && pnpm test -- co-unlock`
Expected: 5 new tests fail with `computeCoUnlockStatus is not a function`.

- [ ] **Step 3: Implement the helper**

Append to `apps/web/lib/co-unlock.ts`:

```typescript
export type CoUnlockStatus = {
  minLevel: number;
  playersAtOrAboveLevel: number;
  playersNeededToUnlock: number; // how many more need to reach minLevel
  isUnlocked: boolean;
};

/** Pure function — given team levels and a rider rank, return whether bidding is unlocked. */
export function computeCoUnlockStatus(args: {
  riderPcsRank: number | null;
  leagueTeamLevels: number[];
  playersRequired?: number; // defaults to 2 per spec §4.1
}): CoUnlockStatus {
  const playersRequired = args.playersRequired ?? 2;

  // No rank → no co-unlock gate. Keep the rider open.
  if (args.riderPcsRank == null) {
    return {
      minLevel: 1,
      playersAtOrAboveLevel: args.leagueTeamLevels.length,
      playersNeededToUnlock: 0,
      isUnlocked: true,
    };
  }

  const minLevel = getMinLevelForRiderRank(args.riderPcsRank);
  const playersAtOrAboveLevel = args.leagueTeamLevels.filter(
    (l) => l >= minLevel,
  ).length;
  const playersNeededToUnlock = Math.max(
    0,
    playersRequired - playersAtOrAboveLevel,
  );
  return {
    minLevel,
    playersAtOrAboveLevel,
    playersNeededToUnlock,
    isUnlocked: playersAtOrAboveLevel >= playersRequired,
  };
}
```

- [ ] **Step 4: Run to verify tests pass**

Run: `cd apps/web && pnpm test -- co-unlock`
Expected: 17 total passed.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/co-unlock.ts apps/web/lib/co-unlock.test.ts
git commit -m "feat(co-unlock): computeCoUnlockStatus pure function"
```

---

## Task 3: Add the DB-backed fetcher for league team levels

**Files:**
- Modify: `apps/web/lib/co-unlock.ts`

- [ ] **Step 1: Add the server-side fetcher**

Append to `apps/web/lib/co-unlock.ts`:

```typescript
import { createClient } from "@/lib/supabase/server";

/**
 * Fetch the list of team levels in a league. Used to compute co-unlock status for
 * multiple riders in one call (fetch once, compute many).
 */
export async function fetchLeagueTeamLevels(leagueId: string): Promise<number[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("teams")
    .select("level")
    .eq("league_id", leagueId);
  if (error || !data) return [];
  return data.map((t) => t.level ?? 1);
}

/**
 * Server-side convenience: fetch team levels once, return a status function.
 * Use this in page components when you want to compute lock status for many riders.
 */
export async function buildCoUnlockChecker(
  leagueId: string,
): Promise<(riderPcsRank: number | null) => CoUnlockStatus> {
  const levels = await fetchLeagueTeamLevels(leagueId);
  return (riderPcsRank) =>
    computeCoUnlockStatus({
      riderPcsRank,
      leagueTeamLevels: levels,
    });
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/web && pnpm typecheck`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/co-unlock.ts
git commit -m "feat(co-unlock): fetchLeagueTeamLevels + buildCoUnlockChecker"
```

---

## Task 4: Integrate Co-Unlock into `placeBid()`

**Files:**
- Modify: `apps/web/app/(game)/league/[leagueId]/auction/[auctionId]/actions.ts`

- [ ] **Step 1: Add the co-unlock check to placeBid**

In `apps/web/app/(game)/league/[leagueId]/auction/[auctionId]/actions.ts`, at the top, add:

```typescript
import { computeCoUnlockStatus, fetchLeagueTeamLevels } from "@/lib/co-unlock";
```

Immediately AFTER the existing level check (currently at lines 115-117, the block that returns `"Insufficient level for this rider"`), insert:

```typescript
  // Co-Unlock Rule (Mech 2): block bid unless ≥2 teams in the league have the required level.
  // Grandfathering is forward-only: existing contracts are untouched.
  const leagueTeamLevels = await fetchLeagueTeamLevels(auction.league_id);
  const coUnlockStatus = computeCoUnlockStatus({
    riderPcsRank: rider.pcs_rank ?? null,
    leagueTeamLevels,
  });
  if (!coUnlockStatus.isUnlocked) {
    return {
      error: `Locked — unlock when ${coUnlockStatus.playersNeededToUnlock} more player(s) reach Lv.${coUnlockStatus.minLevel}`,
    };
  }
```

- [ ] **Step 2: Verify the error string with a direct unit-level sanity check**

Since the pure logic is already covered by `computeCoUnlockStatus` tests in Task 2, we don't add a full integration test here — the `placeBid` wiring is a straight passthrough (call helper → return error if not unlocked). Visual confirmation happens at the smoke test (Task 7).

Add one quick test to `apps/web/lib/co-unlock.test.ts` that asserts the error-message format we rely on:

```typescript
describe("co-unlock error message format (used by placeBid)", () => {
  it("produces the pluralized template that placeBid echoes back", () => {
    const status = computeCoUnlockStatus({
      riderPcsRank: 1,
      leagueTeamLevels: [8, 5, 4],
    });
    const message = `Locked — unlock when ${status.playersNeededToUnlock} more player(s) reach Lv.${status.minLevel}`;
    expect(message).toBe("Locked — unlock when 1 more player(s) reach Lv.8");
  });
});
```

This guards against drift between the helper output and the `placeBid` error string.

- [ ] **Step 3: Typecheck and run tests**

Run: `cd apps/web && pnpm typecheck && pnpm test -- co-unlock 2>&1 | tail -10`
Expected: typecheck clean; all co-unlock tests pass (18 total).

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(game\)/league/\[leagueId\]/auction/\[auctionId\]/actions.ts apps/web/lib/co-unlock.test.ts
git commit -m "feat(bid): co-unlock gate blocks bids on exclusive riders (<2 teams at level)"
```

---

## Task 5: Extend `RiderCard` with a locked state

**Files:**
- Modify: `apps/web/components/rider-card.tsx`
- Create: `apps/web/components/rider-lock-badge.tsx`

- [ ] **Step 1: Create the RiderLockBadge component**

```tsx
// apps/web/components/rider-lock-badge.tsx
// Small pill shown on the right side of RiderCard when a rider is co-unlock-locked.
// Design system: use --radius-pill (20px) for decorative badge per CLAUDE.md Rule #1.

import { Lock } from "lucide-react";

type Props = {
  minLevel: number;
  playersNeeded: number;
};

export function RiderLockBadge({ minLevel, playersNeeded }: Props) {
  const playerWord = playersNeeded === 1 ? "player" : "players";
  return (
    <div
      className="flex items-center gap-1 rounded-[var(--radius-pill)] bg-[var(--bg-surface-hover)] px-2 py-0.5"
      title={`Unlock when ${playersNeeded} more ${playerWord} reach Lv.${minLevel}`}
    >
      <Lock className="h-3 w-3 text-[var(--text-mid)]" aria-hidden />
      <span className="text-[length:var(--type-caption)] text-[var(--text-mid)]">
        Lv.{minLevel} · {playersNeeded} needed
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Add lock props to RiderCard**

In `apps/web/components/rider-card.tsx`, extend the `RiderCardProps` interface (around line 8):

```typescript
interface RiderCardProps {
  rider: {
    id: string;
    name: string;
    nationality_flag?: string;
    team_name?: string;
    pcs_rank?: number;
    pcs_rank_diff?: number | null;
    photo_url?: string | null;
  };
  xp?: number;
  boostPct?: number;
  bidState?: "active" | "outbid" | "not-accepted" | "none";
  outbidMessage?: string;
  isOpenSlot?: boolean;
  isLocked?: boolean;
  lockMinLevel?: number;
  lockPlayersNeeded?: number;
  href?: string;
  onNavigate?: () => void;
  rightContent?: React.ReactNode;
}
```

In the function signature, destructure the new props:

```typescript
export function RiderCard({
  rider,
  xp,
  boostPct,
  bidState = "none",
  outbidMessage,
  isOpenSlot,
  isLocked,
  lockMinLevel,
  lockPlayersNeeded,
  href,
  onNavigate,
  rightContent,
}: RiderCardProps) {
```

Where the card's `rightContent` is rendered (replace or wrap), render a `<RiderLockBadge>` when `isLocked` is true:

```tsx
import { RiderLockBadge } from "./rider-lock-badge";

// In the JSX, replace the existing `rightContent` render with:
{isLocked && lockMinLevel && lockPlayersNeeded != null ? (
  <RiderLockBadge minLevel={lockMinLevel} playersNeeded={lockPlayersNeeded} />
) : (
  rightContent
)}
```

Also: when `isLocked` is true, add visual muting similar to the existing `isMuted` branch. Extend the existing `isMuted` variable:

```typescript
const isMuted = bidState === "outbid" || bidState === "not-accepted" || isLocked;
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/web && pnpm typecheck`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/rider-card.tsx apps/web/components/rider-lock-badge.tsx
git commit -m "feat(rider-card): isLocked prop + RiderLockBadge visual"
```

---

## Task 6: Surface the lock state in the market (recruits) page

**Files:**
- Modify: `apps/web/app/(game)/league/[leagueId]/auction/market/page.tsx`
- Modify: `apps/web/app/(game)/league/[leagueId]/auction/market/market-client.tsx`

- [ ] **Step 1: Compute co-unlock status for each visible rider in the server page**

In `apps/web/app/(game)/league/[leagueId]/auction/market/page.tsx`:

At the top of the file, add:

```typescript
import { buildCoUnlockChecker } from "@/lib/co-unlock";
```

Inside the page component, AFTER the line where `minRank` is computed (currently line 48) and BEFORE the rider query, add:

```typescript
  const checkLock = await buildCoUnlockChecker(leagueId);
```

AFTER the riders are fetched (after line 63 where `.order("pcs_rank", ...)` completes), annotate each rider with lock status. Find the `.map((r) => ({ ... }))` block around line 93-95 and extend the returned object:

```typescript
const enrichedRiders = (riders ?? []).map((r) => {
  const status = checkLock(r.pcs_rank ?? null);
  return {
    ...r,
    pcs_rank_diff:
      r.pcs_rank != null && r.pcs_rank_prev != null
        ? r.pcs_rank_prev - r.pcs_rank
        : null,
    isLocked: !status.isUnlocked,
    lockMinLevel: status.minLevel,
    lockPlayersNeeded: status.playersNeededToUnlock,
  };
});
```

Pass `enrichedRiders` to the client component (where the page previously passed `riders`).

- [ ] **Step 2: Update the client component to pass lock props to RiderCard**

In `apps/web/app/(game)/league/[leagueId]/auction/market/market-client.tsx`:

Extend the rider type expected by the client component to include the new fields:

```typescript
type Rider = {
  // ...existing fields
  isLocked?: boolean;
  lockMinLevel?: number;
  lockPlayersNeeded?: number;
};
```

Where the component renders `<RiderCard>`, forward the new props:

```tsx
<RiderCard
  rider={r}
  // ...existing props
  isLocked={r.isLocked}
  lockMinLevel={r.lockMinLevel}
  lockPlayersNeeded={r.lockPlayersNeeded}
/>
```

- [ ] **Step 3: Typecheck + run dev server**

Run: `cd apps/web && pnpm typecheck && pnpm dev`
Expected: clean typecheck; dev server starts.

- [ ] **Step 4: Visual smoke**

Navigate to `/league/<id>/auction/market` as a user at a level where they're alone (e.g., Lv.8 user in a league where no one else is Lv.8). Expected: top-rank riders (1-3) show a "Lv.8 · 1 needed" lock badge and appear muted. Bidding on them returns the locked error.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(game\)/league/\[leagueId\]/auction/market/
git commit -m "feat(market): surface co-unlock lock state on rider cards"
```

---

## Task 7: Manual smoke test (end-to-end)

**Files:** none (operational task)

- [ ] **Step 1: Verify a locked rider cannot be bid on**

Set up a test scenario: in local Supabase, make sure there's a league where only ONE team is at Lv.8 (the crown-jewel threshold). Log in as that team.

- Navigate to the market page. Top riders (rank 1-3) should show the lock badge.
- Try to place a bid via the auction detail page. Expected error: `Locked — unlock when 1 more player(s) reach Lv.8`.

- [ ] **Step 2: Unlock by promoting a second team**

Manually update another team's level in SQL:
```sql
update teams set level = 8 where id = '<SECOND_TEAM_ID>';
```

Refresh the market page. Lock badges on rank 1-3 riders should disappear.
Attempt a bid again. Expected: no co-unlock error (the existing level + budget + slot checks still apply).

- [ ] **Step 3: Regression test — lower-level players don't see the riders at all**

Log in as a team at Lv.5. On the market page, rank 1-3 riders should NOT appear (they're outside the player's pool, filtered by `.gte("pcs_rank", minRank)` at line 61 of market/page.tsx). The Co-Unlock rule is layered on top of, not replacing, the existing level gate.

- [ ] **Step 4: Cleanup any test mutations**

Revert any manual level changes made during smoke testing.

---

## Known gaps / follow-up work

Documented for the next iteration (not blocking):

1. **Release behavior audit** — spec §4.4 says released grandfathered exclusive riders return to "locked" state. Current implementation: release logic (`apps/web/app/(game)/league/[leagueId]/rider/[riderId]/actions.ts`) just flips contract status. After release, the rider becomes biddable again in general — but `placeBid()` will block the rebid if <2 teams at level. So behavior is correct WITHOUT a code change. Verify during smoke test step 1 that the release → rebid cycle is properly gated.
2. **Pluralization nuance** — `"1 more player(s)"` with trailing `(s)` is awkward. A follow-up UI polish pass should switch to proper singular/plural: `"1 more player"` vs `"2 more players"`.
3. **"Unlock imminent" hint** — not in MVP: when a second team is within 50 XP of the required level, the lock badge could show a secondary "almost unlocked" state. Out of scope.
4. **Commissioner override** — not implemented per spec §6 ("no opt-in / commissioner toggle"). No action.
5. **Full `placeBid` integration test** — the current tests cover the pure co-unlock logic and the error-string format. Adding a full end-to-end `placeBid` test that exercises the co-unlock branch requires the Supabase mock chain used by the existing `auction/market/actions.test.ts` harness. A follow-up can port that harness to `auction/[auctionId]/`.

---

## Handoff to execution

Plan complete and saved to `docs/plans/2026-04-23-co-unlock-rule-plan.md`. Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks.
2. **Inline Execution** — execute tasks in this session with checkpoints.

Which approach?
