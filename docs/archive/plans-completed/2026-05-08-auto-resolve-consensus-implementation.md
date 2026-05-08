# Auto-Resolve on Consensus — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-trigger `forceResolveRound` when the last player validates, eliminating the manual "Resolve Round" click.

**Architecture:** After `validate_round` RPC succeeds, the `validateRound` TS wrapper counts `round_validations` vs `league_members`. If consensus → calls existing `forceResolveRound`. The UI shows a different success message when auto-resolved. No SQL changes.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Supabase (Postgres + Auth), Vitest.

**Spec:** [`docs/superpowers/specs/2026-05-08-auto-resolve-consensus-minimal-design.md`](../specs/2026-05-08-auto-resolve-consensus-minimal-design.md)

---

## File Structure

### Modified files
- `apps/web/app/(game)/league/[leagueId]/auction/actions.ts` — Add consensus check + conditional `forceResolveRound` call inside `validateRound`
- `apps/web/app/(game)/league/[leagueId]/auction/auctions-client.tsx` — Handle `resolved: true` in `handleValidate()` with different success message
- `apps/web/app/(game)/league/[leagueId]/auction/actions.test.ts` — Add 3 tests for consensus behavior

### Unchanged
- `forceResolveRound` in same file — no changes
- `validate_round` PL/pgSQL — no changes
- Status page — still works, manual button remains as fallback
- All other RPCs and routes

---

## Task 1: Add consensus check to `validateRound` server action

**Files:**
- Modify: `apps/web/app/(game)/league/[leagueId]/auction/actions.ts:222-244`

- [ ] **Step 1: Add the consensus check after the RPC success path**

Replace the current `validateRound` function (lines 222-244) with:

```typescript
export async function validateRound(input: { leagueId: string }) {
  const parsed = ValidateRoundSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid data" };
  }
  const { leagueId } = parsed.data;

  const supabase = await createClient();
  const currentPhase = getCurrentPhase();

  const { data, error } = await supabase.rpc("validate_round", {
    p_league_id: leagueId,
    p_current_phase_id: currentPhase.id,
  });

  if (error) return { error: error.message };

  const result = data as { ok?: boolean; error?: string; inserted?: number } | null;
  if (!result?.ok) return { error: result?.error ?? "Validation failed" };

  // --- Consensus check: did all league members validate? ---
  const { data: openAuction } = await supabase
    .from("auctions")
    .select("id")
    .eq("league_id", leagueId)
    .eq("status", "open")
    .limit(1)
    .maybeSingle();

  if (openAuction) {
    const [{ count: validatedCount }, { count: memberCount }] = await Promise.all([
      supabase
        .from("round_validations")
        .select("*", { count: "exact", head: true })
        .eq("auction_id", openAuction.id),
      supabase
        .from("league_members")
        .select("*", { count: "exact", head: true })
        .eq("league_id", leagueId),
    ]);

    if (
      validatedCount !== null &&
      memberCount !== null &&
      validatedCount >= memberCount
    ) {
      const resolveResult = await forceResolveRound({ leagueId });
      if ("ok" in resolveResult && resolveResult.ok) {
        return { success: true, resolved: true };
      }
      // Resolve failed (concurrent call already resolved) — still report validation success
    }
  }
  // openAuction is null → another call already resolved. Validation itself succeeded.

  revalidatePath(`/league/${leagueId}/auction`);
  return { success: true };
}
```

Key details:
- The `revalidatePath` before the final return stays — it's only reached when consensus is NOT met (or auction already gone).
- When consensus IS met, `forceResolveRound` does its own `revalidatePath` calls (lines 519-522 of the same file), so we skip the duplicate.
- `forceResolveRound` is already defined later in the same file — no new import needed.

- [ ] **Step 2: Verify the file has no TypeScript errors**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | grep -i "auction/actions" | head -10`

Expected: no errors referencing `auction/actions.ts`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(game\)/league/\[leagueId\]/auction/actions.ts
git commit -m "feat: auto-resolve round on consensus in validateRound"
```

---

## Task 2: Update UI feedback for auto-resolve

**Files:**
- Modify: `apps/web/app/(game)/league/[leagueId]/auction/auctions-client.tsx:197-206` and `405-411`

- [ ] **Step 1: Add `resolved` state and update `handleValidate`**

Add a state variable near the existing `validateSuccess` state (around line 112):

```typescript
const [validateSuccess, setValidateSuccess] = useState(false);
const [roundResolved, setRoundResolved] = useState(false);
```

Update `handleValidate` (lines 197-206):

```typescript
  async function handleValidate() {
    setValidateError(null);
    setRoundResolved(false);
    const result = await validateRound({ leagueId });
    if (result?.error) {
      setValidateError(result.error);
    } else {
      if ("resolved" in result && result.resolved) {
        setRoundResolved(true);
      }
      setValidateSuccess(true);
      router.refresh();
    }
  }
```

- [ ] **Step 2: Update the success message to show different text when resolved**

Replace the success banner (lines 405-411):

```tsx
        {validateSuccess && (
          <div className="px-4">
            <p className="rounded-lg border border-[var(--success-border)] bg-[var(--success-bg)] px-3 py-2 text-[length:var(--type-caption)] text-emerald-400">
              {roundResolved
                ? "All teams validated — round resolved! Contracts created."
                : "Round validated! Your bids have been submitted."}
            </p>
          </div>
        )}
```

- [ ] **Step 3: Reset `roundResolved` where `validateSuccess` is reset**

Find lines where `setValidateSuccess(false)` is called (lines 156, 166, 174) and add `setRoundResolved(false)` after each:

```typescript
setValidateSuccess(false);
setRoundResolved(false);
```

- [ ] **Step 4: Verify the file has no TypeScript errors**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | grep -i "auctions-client" | head -10`

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(game\)/league/\[leagueId\]/auction/auctions-client.tsx
git commit -m "feat: show auto-resolve success message in auction UI"
```

---

## Task 3: Add tests for consensus behavior

**Files:**
- Modify: `apps/web/app/(game)/league/[leagueId]/auction/actions.test.ts`

The existing test file mocks `mockFrom` and `mockRpc` via `vi.hoisted()`. The consensus check uses `supabase.from("auctions")`, `supabase.from("round_validations")`, and `supabase.from("league_members")` — all of which go through `mockFrom`. We also need to mock `forceResolveRound` since it's called from within the same module.

- [ ] **Step 1: Add `forceResolveRound` mock to the hoisted block**

At the top of the file, extend the hoisted block (line 7) to include a mock for `forceResolveRound`. Since `forceResolveRound` is in the same file as `validateRound`, we need to use `vi.spyOn` after import. Add after the imports:

```typescript
import * as auctionActions from "./actions";
```

And in the test setup, spy on `forceResolveRound`:

```typescript
const mockForceResolve = vi.spyOn(auctionActions, "forceResolveRound");
```

- [ ] **Step 2: Create a helper for the chained Supabase query mock**

The consensus check chains `.from("auctions").select().eq().eq().limit().maybeSingle()` and `.from("round_validations").select(_, { count, head }).eq()` and `.from("league_members").select(_, { count, head }).eq()`. Add this helper inside the describe block:

```typescript
  function mockConsensusQueries(opts: {
    auctionId: string | null;
    validatedCount: number;
    memberCount: number;
  }) {
    mockFrom.mockImplementation((table: string) => {
      if (table === "auctions") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                limit: () => ({
                  maybeSingle: async () => ({
                    data: opts.auctionId ? { id: opts.auctionId } : null,
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === "round_validations") {
        return {
          select: () => ({
            eq: () => ({ count: opts.validatedCount, error: null }),
          }),
        };
      }
      if (table === "league_members") {
        return {
          select: () => ({
            eq: () => ({ count: opts.memberCount, error: null }),
          }),
        };
      }
      return { select: () => ({ eq: () => ({}) }) };
    });
  }
```

- [ ] **Step 3: Add test — consensus reached triggers forceResolveRound**

```typescript
  describe("auto-resolve on consensus", () => {
    const AUCTION_ID = "aaaaaaaa-0000-4000-8000-000000000001";

    beforeEach(() => {
      mockForceResolve.mockResolvedValue({ ok: true, resolved: 1, next_auction_id: null });
    });

    it("calls forceResolveRound when all members have validated", async () => {
      mockRpc.mockResolvedValueOnce({ data: { ok: true, inserted: 2 }, error: null });
      mockConsensusQueries({ auctionId: AUCTION_ID, validatedCount: 4, memberCount: 4 });

      const result = await validateRound({ leagueId: LEAGUE_ID });

      expect(mockForceResolve).toHaveBeenCalledWith({ leagueId: LEAGUE_ID });
      expect(result).toEqual({ success: true, resolved: true });
    });

    it("does NOT call forceResolveRound when not all members validated", async () => {
      mockRpc.mockResolvedValueOnce({ data: { ok: true, inserted: 1 }, error: null });
      mockConsensusQueries({ auctionId: AUCTION_ID, validatedCount: 2, memberCount: 4 });

      const result = await validateRound({ leagueId: LEAGUE_ID });

      expect(mockForceResolve).not.toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it("returns success even if forceResolveRound fails (concurrent resolve)", async () => {
      mockRpc.mockResolvedValueOnce({ data: { ok: true, inserted: 1 }, error: null });
      mockConsensusQueries({ auctionId: AUCTION_ID, validatedCount: 3, memberCount: 3 });
      mockForceResolve.mockResolvedValueOnce({ error: "No open round to resolve (already closed?)" });

      const result = await validateRound({ leagueId: LEAGUE_ID });

      expect(mockForceResolve).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });
  });
```

- [ ] **Step 4: Run the tests**

Run: `cd apps/web && npx vitest run app/\(game\)/league/\[leagueId\]/auction/actions.test.ts --reporter=verbose`

Expected: all existing tests pass + 3 new tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(game\)/league/\[leagueId\]/auction/actions.test.ts
git commit -m "test: add consensus auto-resolve tests for validateRound"
```

---

## Task 4: Build check + final commit

**Files:**
- None (verification only)

- [ ] **Step 1: Run full typecheck**

Run: `cd apps/web && npx tsc --noEmit`

Expected: 0 errors.

- [ ] **Step 2: Run full test suite**

Run: `cd apps/web && npx vitest run --reporter=verbose 2>&1 | tail -20`

Expected: all tests pass.

- [ ] **Step 3: Run build**

Run: `cd apps/web && npx next build 2>&1 | tail -20`

Expected: build succeeds.

---

## Self-review

**Spec coverage:**
- [x] Consensus check in `validateRound` — Task 1
- [x] UI feedback for `resolved: true` — Task 2
- [x] Return type `{ success: true; resolved?: boolean }` — Task 1, backward compatible
- [x] Race condition handled by existing `forceResolveRound` guard — no additional code
- [x] Tests for consensus / no-consensus / concurrent — Task 3

**Placeholder scan:** None found.

**Type consistency:** `resolved` is consistently a boolean optional field on the success return path. `forceResolveRound` return type already has `ok` property checked with `"ok" in resolveResult`.
