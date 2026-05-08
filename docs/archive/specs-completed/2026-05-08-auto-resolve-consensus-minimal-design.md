# Auto-Resolve on Consensus — Minimal Design

**Date:** 2026-05-08
**Status:** Draft
**Predecessor:** Phase 1 (PR #15) — manual force-resolve button
**Scope:** When all league members have validated their bids, auto-trigger the existing `forceResolveRound` — no new DB objects, no SQL changes.

---

## Problem

Today, after every player clicks "Validate Round", someone still has to manually go to the Status tab and click "Resolve Round". In a 4-player league where everyone validates quickly, this is unnecessary friction. The resolve should happen automatically when the last player validates.

## Solution

Add ~15 lines to the existing `validateRound` TS server action. After the RPC returns successfully, count `round_validations` vs `league_members`. If consensus is reached, call `forceResolveRound` (which already exists and handles everything). Return `{ resolved: true }` so the UI can show a toast.

**No SQL changes.** `validate_round` PL/pgSQL stays as-is. The consensus check lives entirely in TS.

---

## Changes

### 1. `validateRound` server action (TS only)

**File:** `apps/web/app/(game)/league/[leagueId]/auction/actions.ts`

After the existing `supabase.rpc("validate_round", ...)` succeeds, add:

```typescript
// Consensus check: did everyone validate?
const [{ count: validatedCount }, { count: memberCount }] = await Promise.all([
  supabase
    .from("round_validations")
    .select("*", { count: "exact", head: true })
    .eq("auction_id", auctionId),
  supabase
    .from("league_members")
    .select("*", { count: "exact", head: true })
    .eq("league_id", leagueId),
]);

if (validatedCount !== null && memberCount !== null && validatedCount >= memberCount) {
  const resolveResult = await forceResolveRound({ leagueId });
  if (resolveResult.ok) {
    revalidatePath(`/league/${leagueId}/auction`);
    return { success: true, resolved: true };
  }
  // If resolve fails (concurrent call already resolved), still report validation success
}
```

**To get `auctionId`:** query the open auction before the consensus check (same pattern as status/page.tsx):

```typescript
const { data: openAuction } = await supabase
  .from("auctions")
  .select("id")
  .eq("league_id", leagueId)
  .eq("status", "open")
  .limit(1)
  .maybeSingle();
```

If `openAuction` is null at this point, it means another concurrent call already resolved. Return `{ success: true }` normally.

### 2. `auctions-client.tsx` (UI feedback)

**File:** `apps/web/app/(game)/league/[leagueId]/auction/auctions-client.tsx`

In `handleValidate()`, check the return value for `resolved: true`:

```typescript
async function handleValidate() {
  setValidateError(null);
  const result = await validateRound({ leagueId });
  if (result?.error) {
    setValidateError(result.error);
  } else {
    if (result?.resolved) {
      // All teams validated — round was auto-resolved
      toast or setValidateSuccess with a different message
    }
    setValidateSuccess(true);
    router.refresh();
  }
}
```

The exact feedback (toast vs banner) is flexible. Minimum: change the success message from "Bids validated" to "All teams validated — round resolved!" when `resolved: true`.

### 3. Return type update

Current `validateRound` returns `{ success: true }` or `{ error: string }`.

New: `{ success: true; resolved?: boolean }` or `{ error: string }`.

No breaking change — `resolved` is optional.

---

## Race Conditions

| Scenario | Outcome |
|----------|---------|
| Two players validate simultaneously, both see consensus | Both call `forceResolveRound`. The first locks the auction (`status = 'open' → 'closed'`). The second sees 0 matching rows and returns `{ error: "No open round to resolve" }`. The `validateRound` wrapper catches this and still returns `{ success: true }` (validation itself succeeded). |
| Player validates, consensus reached, but resolve fails mid-way | `forceResolveRound` has per-rider try/catch. Auction is already marked `closed` by the optimistic lock. Partial resolution is the same as manual resolve behavior today. |
| Player validates after someone already force-resolved manually | `validate_round` RPC fails with "No open auction round found" because the auction is closed. Returns `{ error }` — correct behavior. |

**The optimistic concurrency guard in `forceResolveRound` (step 4, `.eq("status", "open")`) is the serialization point.** No additional locking needed.

---

## What Does NOT Change

- `validate_round` PL/pgSQL function — no modification
- `forceResolveRound` TS function — no modification
- Status page — still works, still shows the manual button as fallback
- `round_validations` table — no schema change
- Python `resolve_now.py` — remains as CLI fallback
- All other RPCs (`place_bid`, `release_rider`, `confirm_phase_setup`, `leave_league`, `grant_xp`)

## Files to Modify

| File | Change |
|------|--------|
| `apps/web/app/(game)/league/[leagueId]/auction/actions.ts` | Add ~15 lines to `validateRound`: open-auction lookup + consensus check + conditional `forceResolveRound` call |
| `apps/web/app/(game)/league/[leagueId]/auction/auctions-client.tsx` | Handle `resolved: true` in `handleValidate()` — different success message |

**Total: 2 files, ~25 lines of new code.**

---

## Test Plan

### Vitest

1. `validateRound` with consensus → mock RPC success + mock round_validations count == league_members count → verify `forceResolveRound` is called → returns `{ success: true, resolved: true }`
2. `validateRound` without consensus → mock counts differ → verify `forceResolveRound` is NOT called → returns `{ success: true }` (no `resolved`)
3. `validateRound` with consensus but resolve fails (concurrent) → mock `forceResolveRound` returning error → returns `{ success: true }` (validation still succeeded)

### Manual smoke

1. Create a 2-player league. Player A validates. Check: no auto-resolve.
2. Player B validates. Check: round auto-resolves, contracts created, next round opens.
3. Verify status page shows correct state after auto-resolve.
