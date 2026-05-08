# Payday Fix & Release Messages — Design Spec

**Date:** 2026-05-08
**Status:** Approved
**Priority:** Urgent (Giro Round 1 imminent)

## Problem

Two related issues with the phase economy and rider release flow:

1. **Payday never executes.** The `confirm_phase_setup` RPC was designed to be the single payday trigger (replacing the deleted Python `run_payday()`), but it only applies sponsor/strategy changes and marks the phase confirmed. It never credits sponsor income or deducts roster salaries. This means team treasuries never reflect actual salary costs.

2. **Release messages are misleading.** The confirmation message always says "The phase salary already paid will not be refunded" — even before Round 1 when no salary has been charged. The message is identical regardless of context.

## Root Cause

The Python `run_payday()` was removed (see `auction.py` lines 297-304) with the intent to replace it with in-app `confirm_phase_setup`. The RPC was implemented with steps 1 (sponsor change) and 2 (strategy changes), but steps 3 (sponsor income credit) and 4 (salary deduction) were never added.

## Fix 1 — Complete `confirm_phase_setup` Payday

### Changes to RPC

Add two steps to the existing `confirm_phase_setup` RPC, between the current strategy application (step 5) and the mark-confirmed (step 6):

**Step 5bis — Credit sponsor income:**
- Fetch the active sponsor for the team via `team_sponsors` JOIN `sponsors`
- Determine income amount:
  - If `team_sponsors.payments_count = 0` AND `sponsors.first_phase_budget IS NOT NULL` → use `sponsors.first_phase_budget`
  - Otherwise → use `sponsors.monthly_budget`
- Add the income amount to `teams.treasury`
- Increment `team_sponsors.payments_count` by 1
- Insert `treasury_log` entry with type `sponsor_payment`, positive amount
- Description format: `"Sponsor income — [sponsor_name] (Phase [N])"`

**Step 5ter — Deduct roster salaries:**
- Loop over all `contracts` where `team_id = p_team_id AND status = 'active'`
- For each contract:
  - Subtract `locked_salary` from `teams.treasury`
  - Insert `treasury_log` entry with type `payday_salary`, negative amount
  - Description format: `"Salary — [rider_full_name] (Phase [N])"`
  - Update `contracts.last_salary_paid` to `now()`

**No treasury floor check:** If treasury goes negative after payday, allow it. The player is already committed to their roster. A negative budget is a consequence of their choices and forces them to release riders.

### What does NOT change

- `forceResolveRound` Round 1 skip (`if (!isRound1)`) stays correct — new Round 1 contracts will be charged at the NEXT phase's payday
- `forceResolveRound` Round 2+ immediate deduction stays correct — mid-phase recruits are charged immediately
- `validate_round` budget projection stays correct — `lib/budget.ts` already projects sponsor income minus salaries before confirmation
- Double-confirm guard already exists (`phase_confirmed_id === currentPhase.id`)

### Data flow

```
Phase N starts
  |
  v
Player confirms phase setup (confirm_phase_setup RPC)
  |-- Apply pending sponsor change
  |-- Apply pending strategy changes
  |-- Credit sponsor income to treasury     <-- NEW
  |-- Deduct all active contract salaries    <-- NEW
  |-- Mark phase_confirmed_id = N
  |
  v
Round 1 opens (bids placed, validated, resolved)
  |-- New contracts created (salary NOT deducted — deferred to Phase N+1 payday)
  |
  v
Round 2 opens
  |-- New contracts created (salary deducted IMMEDIATELY in forceResolveRound)
  |
  v
Round 3 opens
  |-- Same as Round 2
  |
  v
Phase N+1 starts → next confirm_phase_setup deducts all active salaries including Round 1 recruits
```

## Fix 2 — Contextual Release Messages

### Pivot logic

The message depends on whether payday has run for the current phase:
- `team.phase_confirmed_id === currentPhase.id` → payday has run (Cas 2)
- Otherwise → payday has not run (Cas 1)

Exception: riders recruited in the current phase (`contract.phase_recruited_id === currentPhase.id`) have never been charged regardless of payday status → always Cas 1 messaging.

### Case 1 — Before payday (or rider recruited this phase)

**Modal title:** "Release rider?"

**Modal body:**
> Remove [Rider Name] from your roster? No salary has been charged yet for this phase — this release is free.

**Button:** "Release" (default style)

### Case 2 — After payday

**Modal title:** "Release rider?"

**Modal body:**
> Release [Rider Name]? The salary for this phase has already been deducted and will not be refunded.

**Button:** "Release" (destructive/danger style)

### Case 3 — RPC error: recruited this phase

Current message: "Cannot release a rider recruited during the current phase"

Replace with:
> [Rider Name] was recruited this phase and cannot be released yet. You can release them starting next phase.

### UI uniformisation

| Change | Detail |
|--------|--------|
| Rider Detail page | Replace native `confirm()` with custom modal (same component as Auctions page) |
| Auctions page | Add error display on RPC failure (currently silent) — inline `text-danger` below the release area |
| Rider name in messages | Use `rider.full_name` instead of generic "this rider" |
| Props needed | Pass `team.phase_confirmed_id`, `currentPhase.id`, and `contract.phase_recruited_id` to client components |

### Shared modal component

Extract a `ReleaseConfirmModal` component used by both pages:

**Props:**
- `riderName: string`
- `contractId: string`
- `isPaidPhase: boolean` (derived from pivot logic)
- `onConfirm: (contractId: string) => void`
- `onCancel: () => void`

This replaces:
- The native `confirm()` in `rider-detail-client.tsx`
- The inline modal JSX in `auctions-client.tsx`

## Edge Cases

| Case | Behavior |
|------|----------|
| Team never confirms phase | Payday doesn't run; `lib/budget.ts` projects salaries in available budget so player can't over-spend. Payday executes when they eventually confirm. |
| Round 1 recruit released before next payday | Free release (Cas 1). Rider was never charged. |
| Round 2/3 recruit release | RPC blocks with "recruited this phase" error (Cas 3). Cannot release until next phase. |
| Double confirm_phase_setup | Guarded by `phase_confirmed_id` check. No double deduction. |
| Treasury goes negative after payday | Allowed. Player sees negative budget and must release riders. |
| Release from Rider Detail vs Auctions page | Same modal, same logic, same messages. |

## Files to modify

### SQL
- `supabase/migrations/YYYYMMDD_fix_confirm_phase_setup_payday.sql` — ALTER the `confirm_phase_setup` function to add sponsor credit + salary deduction

### TypeScript
- `apps/web/components/release-confirm-modal.tsx` — NEW shared modal component
- `apps/web/app/(game)/league/[leagueId]/rider/[riderId]/rider-detail-client.tsx` — Use new modal, pass pivot data
- `apps/web/app/(game)/league/[leagueId]/auction/auctions-client.tsx` — Use new modal, add error display
- Server components / layouts that pass `phase_confirmed_id` to client components (if not already available)

### No changes to
- `forceResolveRound` logic
- `validate_round` RPC
- `release_rider` RPC
- `lib/budget.ts`
- Python pipelines
