# Manual Force-Resolve Round (Phase 1) — Design Spec

**Date:** 2026-05-08
**Status:** Draft
**Scope:** Status visualization + manual force-resolve button. Replaces the commissioner's local `python3 resolve_now.py` step with an in-app button accessible to any player.

---

## Problem

Today the workflow is:
1. Players validate their bids via the existing "Validate Round" button. `validate_round` snapshots `draft_bids` into `auction_bids`. The auction stays `'open'`. Players can re-validate freely.
2. To close the round and move to the next one, the commissioner runs `python3 resolve_now.py` from their terminal — this attributes winners, creates contracts, deducts treasury (Round 2+), closes the auction, opens the next.
3. If the commissioner is unavailable, the game is blocked.

**Note on validate_round behavior:** The migration file `20260508000000_round_lifecycle.sql` in the repo contains a buggy version that closes the auction on validation. The rollback (`_rollback/20260508000000_round_lifecycle_rollback.sql`) was applied to **remote** to fix this, so the **production behavior** matches the rollback (no auction close on validate). This spec aligns local and remote by writing a new migration that codifies the no-lifecycle final state.

## Solution

Two additions only:
1. **A "Status" tab** showing per-team validation status (Validated / Pending / Not yet bid).
2. **A "Resolve Round" button** that triggers the same logic as `python3 resolve_now.py` — but as a TypeScript server action callable by any league member.

**Out of scope (Phase 2, not implemented now):**
- Auto-resolve when all teams validate (consensus trigger)
- "Modify bids" button to unlock a validated state
- `'resolving'` status enum
- Real-time updates on the Status page

---

## Why a TS server action (not an RPC)

The audit identified RLS as a blocker for any non-RPC approach:
- `riders.is_active_in_game` has no UPDATE policy → silently no-ops
- `teams_protect_sensitive_fields` trigger blocks treasury updates outside `service_role` / `supabase_admin`
- `auction_bids` UPDATE policy only allows owner-mutations → cannot mark another team's bid as `outbid`

There are two ways to bypass these:
- **PL/pgSQL RPC with `SECURITY DEFINER`** — bypasses RLS, runs atomically.
- **TS server action with the service-role client** — bypasses RLS at the API level, runs as multiple HTTP calls (same pattern as Python today).

We choose **TS + service role** for Phase 1 because:
1. **Direct port of Python.** Same Supabase API calls, same order, same multi-call non-atomic pattern. Python today works; the TS port matches its semantics exactly. PL/pgSQL would require translating ~200 lines of Python idioms (Cloudflare-equivalent ranks, Date manipulation, conditional treasury logic) — more bug surface.
2. **Lower risk for one-shot deploy.** Translation bugs in PL/pgSQL are harder to spot than in TS. The user is shipping without local testing time.
3. **Service-role surface is contained.** A new file `apps/web/lib/supabase/admin.ts` exports a single client gated by `import "server-only"`. Imported only by `forceResolveRound`. No other code path uses it. Reviewable in isolation.

A future task can convert this to an RPC if/when atomic transactions become a hard requirement.

---

## DB Changes

### New table: `round_validations`

Purely a **display marker**. Existence of a row = "this team validated this auction at some point".

```sql
CREATE TABLE public.round_validations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id   uuid NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  team_id      uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  validated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (auction_id, team_id)
);

ALTER TABLE public.round_validations ENABLE ROW LEVEL SECURITY;

-- Read: any league member can see validation status for auctions in their league
CREATE POLICY "round_validations_select" ON public.round_validations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.auctions a
      JOIN public.league_members lm ON lm.league_id = a.league_id
      WHERE a.id = round_validations.auction_id
        AND lm.user_id = auth.uid()
    )
  );

-- Insert/Delete: via SECURITY DEFINER RPCs only — no client policy needed.
```

### Modified RPC: `validate_round`

**Goal of this migration:** finalize `validate_round` to the no-lifecycle state currently running in production (matches the rollback applied manually). Add a single `INSERT INTO round_validations` step. Nothing else changes.

The new migration will `CREATE OR REPLACE FUNCTION validate_round` with:
- Steps 1-10 unchanged (auth, locks, budget check, slot check, cancel previous active, insert new auction_bids)
- **NEW step 11:** UPSERT into `round_validations`

```sql
-- New step 11: Record validation marker (idempotent)
INSERT INTO public.round_validations (auction_id, team_id, validated_at)
VALUES (v_auction.id, v_team.id, now())
ON CONFLICT (auction_id, team_id) DO UPDATE SET validated_at = now();

RETURN jsonb_build_object('ok', true, 'inserted', v_inserted);
```

**Important:** No close, no open, no consensus check. The function returns the same shape as today (`{ok, inserted}`) so the existing TS wrapper and tests keep working.

**Local/remote sync side benefit:** writing `CREATE OR REPLACE FUNCTION validate_round` with the final-state body brings local (which has the buggy lifecycle if reset from migrations) and remote (which has the rollback applied) to the same state.

### Backfill for in-flight auctions

Production has an active Giro 2026 auction with players already validated. Without backfill, the new Status page would show those teams as "Not yet bid". Backfill runs once in the same migration:

```sql
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

---

## TS Changes

### New file: `apps/web/lib/supabase/admin.ts`

Service-role Supabase client. Server-only.

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
 * `teams_protect_sensitive_fields`. ONLY for server-side mutations
 * that are equivalent to the Python pipeline.
 *
 * NEVER import this from a client component. The `import "server-only"`
 * guard above will fail the build if you do.
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

### New server action: `forceResolveRound`

Located in `apps/web/app/(game)/league/[leagueId]/auction/actions.ts`. The function is a direct port of `services/pcs-sync/auction.py::resolve_current_round` + `_close_auction` + `_cleanup_stale_drafts`.

**Auth flow:**
1. Use the **anon server client** (`createServerClient` from existing `lib/supabase/server.ts`) to verify the caller is authenticated and a member of the target league.
2. After auth check passes, switch to the **service-role client** for all mutations.

**Algorithm (matching Python exactly):**
1. Find the open auction for `p_league_id` (status = 'open').
2. Fetch all active `auction_bids` for that auction.
3. Group bids by `rider_id`.
4. For each rider:
   a. Sort by `amount` desc, `placed_at` asc; winner = first.
   b. **Level gating:** fetch rider `pcs_rank` + winner-team `level`. If `pcs_rank < poolMin[level]`, mark all bids for this rider `cancelled`, skip.
   c. **Duplicate contract guard:** if rider already has `active`/`notice` contract in this league, mark all bids `cancelled`, skip.
   d. Mark winner bid `won`; mark loser bids `outbid`.
   e. Insert into `contracts`: `{ team_id, rider_id, league_id, locked_salary: winner_amount, status: 'active', purchased_at: now(), last_salary_paid: today, phase_recruited_id: p_current_phase_id }`.
   f. Update `riders.is_active_in_game = true`.
   g. **Treasury deduction (Round 2+ only — same logic as Python):** if `auction.name` does NOT contain "Round 1", subtract `winner_amount` from `teams.treasury` and insert `treasury_log` row (type `payday_salary`, amount `-winner_amount`, description with rider + auction name).
5. Cleanup stale drafts: `DELETE FROM draft_bids` for `(team_id, rider_id)` pairs where the rider now has an `active` contract in the league.
6. Close auction: `auctions.status = 'closed'`, `resolved_at = now()`.
7. Open next scheduled auction: find by `opens_at` ascending where `league_id = p_league_id AND status = 'scheduled'`. If found, set `status = 'open'`, `opens_at = now()`.
8. `revalidatePath('/league/[leagueId]')`.

**Return shape:** `{ ok: true, resolved: number, next_auction_id: string | null }` on success, `{ error: string }` on failure.

**Pool min constants:** import from `apps/web/lib/levels.ts` (single source of truth on the TS side; Python has its own copy in `sync.py` with the same values).

**Phase ID:** use `getCurrentPhase()` from `lib/phases.ts` (same as the existing `validateRound` action does).

### TS file changes summary

| File | Change |
|------|--------|
| `apps/web/lib/supabase/admin.ts` | NEW — service-role client |
| `apps/web/app/(game)/league/[leagueId]/auction/actions.ts` | ADD `forceResolveRound`. No change to `validateRound`. |
| `apps/web/app/(game)/league/[leagueId]/auction/status/page.tsx` | NEW — Status tab page |
| `apps/web/app/(game)/league/[leagueId]/auction/status/status-client.tsx` | NEW — interactive bits (modal) |
| `apps/web/app/(game)/league/[leagueId]/auction/layout.tsx` | ADD "Status" tab |

`validateRound` action and `auctions-client.tsx` are NOT modified. The existing "Validate Round" button keeps its current behavior exactly.

---

## New Page: `/auction/status`

### Route

`apps/web/app/(game)/league/[leagueId]/auction/status/page.tsx` (server component for data fetching).

`apps/web/app/(game)/league/[leagueId]/auction/status/status-client.tsx` (client component for the modal + button click handler).

### Layout tab

In `auction/layout.tsx`, add to the SubTabs array:
```typescript
{ label: "Status", href: `/league/${leagueId}/auction/status` }
```

Tab order: **Auctions | Market | Status | History**.

The existing `hide` regex (`/\/auction\/(rounds|[0-9a-f-]{36})(\/|$)/`) does not need changes.

### Page data fetching (server component)

In parallel:
- All teams in the league with `team.name` and `team.user_id` (to derive display).
- The currently open auction for the league: `auctions WHERE league_id = X AND status = 'open' ORDER BY opens_at ASC LIMIT 1`. May be null (no round running).
- All `round_validations` for that auction.
- Per-team `draft_bids` count.
- Per-team purchasing power. Compute the same way `validate_round` does:
  - Post-payday (`team.phase_confirmed_id = current_phase.id`): `treasury`
  - Pre-payday: `treasury + sponsor_income - active_salaries`

### Page layout

1. **Header text:**
   > "When everyone has validated their bids, click 'Resolve Round' to attribute riders and open the next round."

2. **Progress indicator:** `3/4 teams validated`.

3. **Validation table:**

   | Team | Purchasing Power | Status |
   |------|------------------|--------|
   | Team Jonathan | 185 000 EUR | `<Tag variant="success">Validated</Tag>` |
   | Team Paul | 210 000 EUR | `<Tag variant="default">Not yet bid</Tag>` |
   | Team Marie | 142 000 EUR | `<Tag variant="highlighted">Pending</Tag>` |

   **Status mapping (uses `Tag` component from `components/pill.tsx`):**
   - `round_validations` row exists → **Validated** (`success` — green)
   - No row AND has `draft_bids` → **Pending** (`highlighted` — cyan)
   - No row AND no `draft_bids` → **Not yet bid** (`default` — grey)

4. **"Resolve Round" button (bottom of card):**
   - Style: secondary/outline (not the primary CTA on the page).
   - Visible to **all league members**.
   - Disabled when no auction is open.
   - On click → confirmation modal:
     - Title: "Resolve this round?"
     - Body: "Riders will be attributed to the highest bidders, contracts will be created, and the next round will open. This action cannot be undone."
     - If unvalidated teams exist: list them — "These teams haven't validated yet: Team Paul, Team Marie. Their bids will not be counted."
     - Confirm: "Resolve Round" → calls `forceResolveRound({ leagueId })`
     - Cancel: "Cancel"
   - On success → toast "Round resolved!" + `router.refresh()` (page re-fetches; auction is now closed, next auction is open or no auction shown).
   - On error → show error message inline.

5. **Empty state** (no open auction):
   - "No open round. Wait for the next round to begin."
   - Hide the Resolve button.

---

## Race Conditions

This Phase 1 has minimal race exposure because resolve is **only triggered manually**:

| Scenario | What happens |
|----------|--------------|
| Two players click "Resolve Round" simultaneously | Both call `forceResolveRound`. Both fetch the open auction. Both run the algorithm. Result: each rider's bids would be set to `won`/`outbid` twice; the second contract insert would fail on duplicate-contract guard for any rider already processed by the first call. The auction would be closed twice (idempotent). The next auction would be opened twice (idempotent). **Outcome:** no data corruption but messy logs and possibly orphan `won` rows on cancelled bids. |
| One player clicks Resolve while another is mid-`place_bid` | `place_bid` writes a new active bid. If it lands before resolve reads, it's processed. If after, it's processed in the next round (auction is now closed). Both paths are valid. |
| One player clicks Resolve while another is mid-`validate_round` | `validate_round` snapshot completes; resolve picks up those bids if they landed before the SELECT. Otherwise next round. Valid. |

**Mitigation (light):** the `forceResolveRound` action should select the open auction with `auctions.status = 'open'` and immediately set it to `'closed'` BEFORE doing the rider work. This serializes the two simultaneous clicks: the second click sees `status='closed'` and aborts. Add this check inside the action:

```typescript
const { data: auction } = await admin
  .from("auctions")
  .select("*")
  .eq("league_id", leagueId)
  .eq("status", "open")
  .single();

if (!auction) {
  return { error: "No open round to resolve (already closed?)" };
}

// Mark closed FIRST to prevent concurrent resolves.
const { error: lockErr } = await admin
  .from("auctions")
  .update({ status: "closed", resolved_at: new Date().toISOString() })
  .eq("id", auction.id)
  .eq("status", "open"); // optimistic concurrency guard

if (lockErr) return { error: lockErr.message };
```

The `.eq("status", "open")` on the UPDATE is the optimistic-concurrency check. If another session already set it to `closed`, this UPDATE matches 0 rows and we abort.

After the lock, do all rider work. At the end, open the next scheduled auction. If anything fails mid-rider, the auction is already closed (matching Python's behavior — Python also doesn't roll back).

---

## What Stays Unchanged

- **`validate_round` semantics** — per-player, no auction lifecycle. The only change is adding the round_validations INSERT.
- **`place_bid`, `release_rider`, `confirm_phase_setup`, `leave_league`** — no changes.
- **`auctions-client.tsx`** — the existing "Validate Round" button keeps its current behavior. No new states, no "Modify bids", no toast on auto-resolve.
- **Python `resolve_now.py`** — remains as fallback CLI. Produces identical outcomes since the TS port mirrors it.
- **Auction history page** — no changes (no `cancelled` bids are introduced by Phase 1 since there is no `unlock_round`).

---

## Pre-Existing Issues NOT Addressed in Phase 1

These were surfaced during the audit. They are NOT introduced by this PR and remain follow-ups:

1. **Round 1 salary deduction missing.** `confirm_phase_setup` does NOT deduct salaries. Round 1 contracts are currently free of treasury impact. Spec preserves this behavior (TS port matches Python's "skip if Round 1" logic). Filed as a separate ticket.
2. **Round 1 detection by string match.** Auction name `ILIKE '%Round 1%'` is fragile. Out of scope.
3. **Three sources of truth for `LEVEL_POOL_MIN`** (TS, Python, PL/pgSQL — though PL/pgSQL won't have it in Phase 1). TS and Python already drift-prone; not made worse here.
4. **Per-team submission round inflation.** `validate_round` increments `auction_bids.round` on every (re-)validation. Harmless given the partial unique index but messy. Out of scope.

---

## Test Plan

### Vitest (TS)

Add to `apps/web/app/(game)/league/[leagueId]/auction/actions.test.ts`:

1. `forceResolveRound`: success path — open auction with bids → returns `{ ok: true, resolved: N, next_auction_id }`, contracts created, treasury deducted (Round 2+), auction closed, next opened.
2. `forceResolveRound`: no open auction → returns `{ error: 'No open round to resolve' }`.
3. `forceResolveRound`: concurrent click race — second call after first has set `status='closed'` → returns error.
4. `forceResolveRound`: level gating cancel — rider with `pcs_rank < poolMin[winner.level]` → all bids cancelled, no contract.
5. `forceResolveRound`: duplicate contract cancel — rider already under contract → all bids cancelled, no new contract.
6. `forceResolveRound`: Round 1 vs Round 2 treasury — Round 1 = no deduction, Round 2 = deduction + `treasury_log` entry.
7. `forceResolveRound`: auth — non-member of league → returns auth error.

### SQL

1. New migration applies cleanly on a freshly reset local DB.
2. `round_validations` table exists with correct columns and RLS.
3. `validate_round` after migration: validates bids → row appears in `round_validations` → row updates `validated_at` on re-validate.
4. Backfill: pre-existing active bids → corresponding `round_validations` rows present.

### Manual smoke (post-deploy on remote)

1. Open the Status tab in the active Giro league. Verify the table shows correct statuses for teams that already validated.
2. As any team, click "Resolve Round" → modal appears → confirm → verify auction closes, next opens, contracts visible in My Team for winners.
3. Verify `treasury_log` has new `payday_salary` rows for Round 2+ (check via `supabase db query` or Studio).

---

## Files to Create / Modify

**New files:**
- `supabase/migrations/YYYYMMDDHHMMSS_round_validations_and_force_resolve.sql` — round_validations table + modified validate_round + backfill
- `supabase/migrations/_rollback/YYYYMMDDHHMMSS_round_validations_and_force_resolve.sql` — rollback (drop table, restore prior validate_round)
- `apps/web/lib/supabase/admin.ts` — service-role client
- `apps/web/app/(game)/league/[leagueId]/auction/status/page.tsx` — Status tab server component
- `apps/web/app/(game)/league/[leagueId]/auction/status/status-client.tsx` — Status tab client (modal + button)

**Modified files:**
- `apps/web/app/(game)/league/[leagueId]/auction/actions.ts` — ADD `forceResolveRound`. NO change to `validateRound`.
- `apps/web/app/(game)/league/[leagueId]/auction/layout.tsx` — ADD "Status" tab
- `apps/web/app/(game)/league/[leagueId]/auction/actions.test.ts` — ADD tests for `forceResolveRound`
- `apps/web/.env.local` — must already have `SUPABASE_SERVICE_ROLE_KEY` (already used by other tooling — verify before deploying)

**Unchanged:**
- `services/pcs-sync/auction.py` and `resolve_now.py` — remain as CLI fallback
- All other RPCs and UI pages
- `auctions-client.tsx` — no changes to existing "Validate" flow

---

## Phase 2 — Future Work (Plan Only, Not Implemented Now)

When Phase 1 is shipped, stable, and we want to go further:

### Auto-Resolve on Consensus

Trigger `forceResolveRound` automatically when the last team validates.

**DB changes:**
- Add `'resolving'` status enum value to `auctions.status` CHECK constraint.
- Modify `validate_round` to count `round_validations` vs `league_members`. If consensus reached, atomically transition the auction to `'resolving'` (under existing `FOR UPDATE` lock) and return `{ ok, all_validated: true, auction_id }` to the caller.
- `place_bid` and any new `unlock_round` would refuse on `status != 'open'` (already true for `place_bid` today).

**TS changes:**
- Modify `validateRound` server action: if `all_validated: true` in the RPC response, call `forceResolveRound` immediately. Return `{ success: true, resolved: true }` to the UI.
- `auctions-client.tsx`: show toast "All teams validated — round resolved!" when `resolved: true`.

**Why this is Phase 2:**
- Adds state machine complexity (`'resolving'` status).
- Adds race-condition surface (last-validator vs concurrent unlock).
- Phase 1's manual button is the safe MVP.

### Modify Bids (Unlock)

Allow a player who validated to roll back to the editing state.

**DB changes:**
- New RPC `unlock_round(p_league_id)`: cancels the team's active `auction_bids` for the open auction, deletes the `round_validations` row, leaves `draft_bids` untouched. Refuses if auction `status != 'open'`.

**TS changes:**
- New action `unlockRound`: thin wrapper.

**UI:**
- In `auctions-client.tsx`, replace the disabled "No modifications" button with "Modify bids" when `existingAuctionBids.length > 0` and no draft changes. Calling unlockRound returns the player to the draft-editing flow.
- Auction history page: filter `cancelled` bids by default with a "Show cancelled" toggle.

### Status Page Polling

Add a 5s `setInterval(() => router.refresh())` on the Status page so players see other teams validate without a manual refresh.

### Consolidation

If Phase 1 + 2 prove out, consider replacing the TS port with an RPC for atomic transactions, eliminating the service-role client surface.
