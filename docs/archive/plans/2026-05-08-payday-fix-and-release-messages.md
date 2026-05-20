# Payday Fix & Release Messages — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the `confirm_phase_setup` RPC with sponsor income credit + salary deduction, and replace misleading release rider messages with contextual ones.

**Architecture:** The payday logic is added entirely inside the existing `confirm_phase_setup` SQL RPC (no TS changes needed for Fix 1). For Fix 2, a shared `ReleaseConfirmModal` component replaces the native `confirm()` on the Rider Detail page and the inline modal on the Auctions page, with messaging that varies based on whether payday has already run.

**Tech Stack:** PostgreSQL (plpgsql RPC), React (client components), Next.js server components for data threading.

---

## Task 1: Add payday logic to `confirm_phase_setup` RPC

**Files:**
- Create: `supabase/migrations/20260508100000_confirm_phase_setup_payday.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- Migration: complete confirm_phase_setup with sponsor income credit + salary deduction
-- This adds steps 5bis (sponsor income) and 5ter (salary deduction) to the existing RPC.

CREATE OR REPLACE FUNCTION public.confirm_phase_setup(
  p_team_id uuid,
  p_current_phase_id int,
  p_current_phase_label text
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
BEGIN
  -- 1. Auth
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  -- 2. Fetch team (verifies ownership)
  SELECT * INTO v_team
  FROM public.teams
  WHERE id = p_team_id AND user_id = v_user_id
  FOR UPDATE;

  IF v_team IS NULL THEN
    RETURN jsonb_build_object('error', 'Team not found');
  END IF;

  -- 3. Guard: already confirmed for this phase
  IF v_team.phase_confirmed_id = p_current_phase_id THEN
    RETURN jsonb_build_object('error', 'Already confirmed for this phase');
  END IF;

  -- 4. Apply pending sponsor change
  IF v_team.pending_sponsor_id IS NOT NULL THEN
    INSERT INTO public.team_sponsors (team_id, sponsor_id, activated_at)
    VALUES (p_team_id, v_team.pending_sponsor_id, now())
    ON CONFLICT (team_id) DO UPDATE
    SET sponsor_id = EXCLUDED.sponsor_id, activated_at = EXCLUDED.activated_at;

    UPDATE public.teams
    SET pending_sponsor_id = NULL
    WHERE id = p_team_id;
  END IF;

  -- 5. Apply pending strategy changes
  FOR v_strat IN
    SELECT id, pending_is_active, pending_config
    FROM public.team_strategies
    WHERE team_id = p_team_id
      AND pending_is_active IS NOT NULL
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

  -- 6. Credit sponsor income
  SELECT s.name, s.monthly_budget, s.first_phase_budget, ts.payments_count
  INTO v_sponsor
  FROM public.team_sponsors ts
  JOIN public.sponsors s ON s.id = ts.sponsor_id
  WHERE ts.team_id = p_team_id;

  IF v_sponsor IS NOT NULL THEN
    IF v_sponsor.payments_count = 0 AND v_sponsor.first_phase_budget IS NOT NULL THEN
      v_income := v_sponsor.first_phase_budget;
    ELSE
      v_income := v_sponsor.monthly_budget;
    END IF;

    UPDATE public.teams
    SET treasury = treasury + v_income
    WHERE id = p_team_id;

    INSERT INTO public.treasury_log (team_id, type, amount, description)
    VALUES (
      p_team_id,
      'sponsor_payment',
      v_income,
      format('Sponsor income — %s (%s)', v_sponsor.name, p_current_phase_label)
    );

    UPDATE public.team_sponsors
    SET payments_count = payments_count + 1
    WHERE team_id = p_team_id;
  END IF;

  -- 7. Deduct roster salaries
  FOR v_contract IN
    SELECT c.id, c.locked_salary, c.rider_id, r.full_name
    FROM public.contracts c
    JOIN public.riders r ON r.id = c.rider_id
    WHERE c.team_id = p_team_id AND c.status = 'active'
  LOOP
    v_total_salary := v_total_salary + v_contract.locked_salary;

    INSERT INTO public.treasury_log (team_id, rider_id, type, amount, description)
    VALUES (
      p_team_id,
      v_contract.rider_id,
      'payday_salary',
      -v_contract.locked_salary,
      format('Salary — %s (%s)', v_contract.full_name, p_current_phase_label)
    );

    UPDATE public.contracts
    SET last_salary_paid = now()
    WHERE id = v_contract.id;
  END LOOP;

  UPDATE public.teams
  SET treasury = treasury - v_total_salary
  WHERE id = p_team_id;

  -- 8. Mark confirmed
  UPDATE public.teams
  SET phase_confirmed_at = now(),
      phase_confirmed_id = p_current_phase_id
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

GRANT EXECUTE ON FUNCTION public.confirm_phase_setup(uuid, int, text) TO authenticated;
```

- [ ] **Step 2: Apply the migration to remote**

Run: `supabase db push --linked`

Expected: Migration applied successfully. The `confirm_phase_setup` function is replaced with the new version including payday logic.

- [ ] **Step 3: Verify the migration applied**

Run: `supabase migration list --linked`

Expected: `20260508100000_confirm_phase_setup_payday` shows as `applied`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260508100000_confirm_phase_setup_payday.sql
git commit -m "fix(economy): add payday to confirm_phase_setup — sponsor income + salary deduction"
```

---

## Task 2: Create shared `ReleaseConfirmModal` component

**Files:**
- Create: `apps/web/components/release-confirm-modal.tsx`

- [ ] **Step 1: Create the modal component**

```tsx
"use client";

import { useState } from "react";

interface ReleaseConfirmModalProps {
  riderName: string;
  contractId: string;
  isPaidPhase: boolean;
  onConfirm: (contractId: string) => void;
  onCancel: () => void;
  error?: string | null;
}

export function ReleaseConfirmModal({
  riderName,
  contractId,
  isPaidPhase,
  onConfirm,
  onCancel,
  error,
}: ReleaseConfirmModalProps) {
  const [releasing, setReleasing] = useState(false);

  function handleConfirm() {
    setReleasing(true);
    onConfirm(contractId);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[var(--scrim)] px-4 pb-6">
      <div className="w-full max-w-md rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 space-y-4">
        <div>
          <p className="text-[length:var(--type-section)] font-semibold text-[var(--text-high)]">
            Release rider?
          </p>
          <p className="mt-1 text-[length:var(--type-body)] text-[var(--text-mid)]">
            {isPaidPhase
              ? `Release ${riderName}? The salary for this phase has already been deducted and will not be refunded.`
              : `Remove ${riderName} from your roster? No salary has been charged yet for this phase — this release is free.`}
          </p>
        </div>
        {error && (
          <p className="text-[length:var(--type-caption)] text-[var(--status-danger)]">
            {error}
          </p>
        )}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={releasing}
            className="flex-1 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface-active)] py-2.5 text-[length:var(--type-emphasis)] font-semibold text-[var(--text-mid)] transition-colors hover:bg-[var(--bg-surface-hover)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={releasing}
            className={`flex-1 rounded-[var(--radius-md)] py-2.5 text-[length:var(--type-emphasis)] font-semibold transition-colors disabled:opacity-50 ${
              isPaidPhase
                ? "border border-[var(--danger-border)] bg-[var(--danger-bg)] text-red-400 hover:bg-[var(--danger-bg)]"
                : "border border-[var(--border-default)] bg-[var(--bg-surface-active)] text-[var(--text-high)] hover:bg-[var(--bg-surface-hover)]"
            }`}
          >
            {releasing ? "Releasing..." : "Release"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/release-confirm-modal.tsx
git commit -m "feat(ui): add ReleaseConfirmModal with contextual messaging"
```

---

## Task 3: Integrate modal in Rider Detail page

**Files:**
- Modify: `apps/web/app/(game)/league/[leagueId]/rider/[riderId]/page.tsx` — pass `phaseConfirmed` + `phaseRecruitedThisPhase` to client
- Modify: `apps/web/app/(game)/league/[leagueId]/rider/[riderId]/rider-detail-client.tsx` — replace `confirm()` with `ReleaseConfirmModal`

- [ ] **Step 1: Pass payday state from server to client**

In `apps/web/app/(game)/league/[leagueId]/rider/[riderId]/page.tsx`, the contract query already fetches the contract but doesn't include `phase_recruited_id`. Update the contract select to include it, and pass new props.

Find in `page.tsx` (around line 133-148):
```typescript
      const [{ data: contract }, { data: activeBid }] = await Promise.all([
        supabase
          .from("contracts")
          .select("id, locked_salary, status")
          .eq("team_id", member.team_id)
          .eq("rider_id", riderId)
          .eq("status", "active")
          .maybeSingle(),
```

Replace with:
```typescript
      const [{ data: contract }, { data: activeBid }] = await Promise.all([
        supabase
          .from("contracts")
          .select("id, locked_salary, status, phase_recruited_id")
          .eq("team_id", member.team_id)
          .eq("rider_id", riderId)
          .eq("status", "active")
          .maybeSingle(),
```

Then after line 157 where `contractData` is built, add `phaseRecruitedId`:
```typescript
      if (contract) {
        if (from !== "market" && from !== "team") context = "team";
        contractData = {
          locked_salary: contract.locked_salary,
          status: contract.status,
          contractId: contract.id,
          pcsPoints: rider.pcs_points_1yr ?? undefined,
          phaseRecruitedId: contract.phase_recruited_id ?? undefined,
        };
      }
```

At the bottom of the server component, before the `return`, compute `isPaidPhase` and add it alongside `phaseConfirmed` to the return. First, fetch team data (it's already fetched at line 268 for budget in market context, but we need it for all contexts when there's a contract). After the `budgetInfo` block (around line 323), add:

```typescript
  // Phase confirmed state for release modal messaging
  let releasePhaseConfirmed = false;
  if (contractData && userTeamId) {
    const { data: teamForPhase } = await supabase
      .from("teams")
      .select("phase_confirmed_id")
      .eq("id", userTeamId)
      .single();
    const confirmedId = teamForPhase?.phase_confirmed_id ?? null;
    releasePhaseConfirmed = confirmedId === getCurrentPhase().id;
  }
```

Then pass it to `RiderDetailClient`:
```typescript
      releaseIsPaidPhase={
        contractData
          ? releasePhaseConfirmed && contractData.phaseRecruitedId !== getCurrentPhase().id
          : false
      }
```

- [ ] **Step 2: Update `RiderDetailClientProps` and replace `confirm()`**

In `rider-detail-client.tsx`, add the new prop to the interface (around line 55):

```typescript
interface RiderDetailClientProps {
  // ... existing props ...
  releaseIsPaidPhase?: boolean;
}
```

Add it to destructured props (around line 108):

```typescript
export function RiderDetailClient({
  // ... existing props ...
  releaseIsPaidPhase,
}: RiderDetailClientProps) {
```

Add state for the release modal (after the existing state declarations around line 132):

```typescript
  const [releaseConfirm, setReleaseConfirm] = useState(false);
  const [releaseError, setReleaseError] = useState<string | null>(null);
```

Add the import at the top of the file:

```typescript
import { ReleaseConfirmModal } from "@/components/release-confirm-modal";
```

Replace the `handleRelease` function (lines 173-186) with:

```typescript
  function handleReleaseClick() {
    if (!contractData?.contractId) return;
    setReleaseError(null);
    setReleaseConfirm(true);
  }

  async function handleReleaseConfirm(contractId: string) {
    setSaving(true);
    setReleaseError(null);
    const result = await releaseRider(contractId);
    if (result.error) {
      const errorMsg = result.error === "Cannot release a rider recruited during the current phase"
        ? `${rider.full_name} was recruited this phase and cannot be released yet. You can release them starting next phase.`
        : result.error;
      setReleaseError(errorMsg);
      setSaving(false);
    } else {
      router.refresh();
      setSaving(false);
    }
  }
```

Replace the release button `onClick` (line 520) from `handleRelease` to `handleReleaseClick`:

```typescript
          {!inRail && isInRoster && (
            <button
              type="button"
              disabled={saving}
              onClick={handleReleaseClick}
              className="w-full rounded-[var(--radius-md)] border border-[var(--danger-border)] text-red-400 py-2.5 text-[length:var(--type-body)] font-medium hover:bg-[var(--danger-bg)] transition-colors disabled:opacity-50"
            >
              {saving ? "Releasing..." : "Release Rider"}
            </button>
          )}
```

Remove the inline `error` display for release (the modal handles it now). Keep the existing error display for bid-related errors.

Add the modal render at the end of the component, right before the closing `</>` (after the StickyBar):

```tsx
    {releaseConfirm && contractData?.contractId && (
      <ReleaseConfirmModal
        riderName={rider.full_name}
        contractId={contractData.contractId}
        isPaidPhase={releaseIsPaidPhase ?? false}
        onConfirm={handleReleaseConfirm}
        onCancel={() => { setReleaseConfirm(false); setReleaseError(null); }}
        error={releaseError}
      />
    )}
```

- [ ] **Step 3: Verify the build compiles**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | head -30`

Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(game\)/league/\[leagueId\]/rider/\[riderId\]/page.tsx apps/web/app/\(game\)/league/\[leagueId\]/rider/\[riderId\]/rider-detail-client.tsx
git commit -m "feat(release): contextual release modal on rider detail page"
```

---

## Task 4: Integrate modal in Auctions page

**Files:**
- Modify: `apps/web/app/(game)/league/[leagueId]/auction/auctions-client.tsx` — replace inline modal with `ReleaseConfirmModal`, add error handling

- [ ] **Step 1: Add import and state**

Add the import at the top of `auctions-client.tsx`:

```typescript
import { ReleaseConfirmModal } from "@/components/release-confirm-modal";
```

Add `phaseConfirmed` to the pivot logic. The `AuctionsClient` already receives `phaseConfirmed` as a prop. We also need rider names for the modal. The `RosterRider` interface already has `name`.

Add `releaseError` state (after `releaseConfirm` state, around line 111):

```typescript
  const [releaseError, setReleaseError] = useState<string | null>(null);
```

- [ ] **Step 2: Update the release handlers**

Replace `handleReleaseConfirm` (lines 189-195) with:

```typescript
  async function handleReleaseConfirm(contractId: string) {
    const result = await releaseRider(contractId);
    if (result.error) {
      const riderEntry = rosterRiders.find((r) => r.contractId === contractId);
      const riderName = riderEntry?.name ?? "This rider";
      const errorMsg = result.error === "Cannot release a rider recruited during the current phase"
        ? `${riderName} was recruited this phase and cannot be released yet. You can release them starting next phase.`
        : result.error;
      setReleaseError(errorMsg);
    } else {
      setReleaseConfirm(null);
      setReleaseError(null);
      router.refresh();
    }
  }
```

- [ ] **Step 3: Replace the inline modal with `ReleaseConfirmModal`**

Replace the entire release confirmation dialog block (lines 434-464):

```tsx
{/* old inline modal */}
{releaseConfirm && (
  <div className="fixed inset-0 z-50 ...">
    ...
  </div>
)}
```

With:

```tsx
      {releaseConfirm && (() => {
        const riderEntry = rosterRiders.find((r) => r.contractId === releaseConfirm);
        return (
          <ReleaseConfirmModal
            riderName={riderEntry?.name ?? "this rider"}
            contractId={releaseConfirm}
            isPaidPhase={phaseConfirmed}
            onConfirm={handleReleaseConfirm}
            onCancel={() => { setReleaseConfirm(null); setReleaseError(null); }}
            error={releaseError}
          />
        );
      })()}
```

Note: `isPaidPhase={phaseConfirmed}` works here because all roster riders on the Auctions page are from previous phases (current-phase recruits are blocked by the RPC). The `phaseConfirmed` prop already exists on `AuctionsClient`.

- [ ] **Step 4: Verify the build compiles**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | head -30`

Expected: No type errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(game\)/league/\[leagueId\]/auction/auctions-client.tsx
git commit -m "feat(release): contextual release modal on auctions page"
```

---

## Task 5: Manual smoke test

**Files:** None (testing only)

- [ ] **Step 1: Start dev server**

Run: `cd apps/web && pnpm dev`

- [ ] **Step 2: Test release modal on Rider Detail (before payday)**

Navigate to a rider detail page for a rider in your roster (e.g. `/league/<id>/rider/<riderId>?from=team`).

Verify:
- The "Release Rider" button opens a custom modal (not a browser `confirm()` dialog)
- If the team has NOT confirmed the phase, the message says "No salary has been charged yet for this phase — this release is free."
- The Release button uses the default (non-destructive) style
- The rider's full name appears in the message

- [ ] **Step 3: Test release modal on Auctions page**

Navigate to the Auctions page. Click the X button on a roster rider.

Verify:
- The modal appears with the same contextual messaging
- If the team has NOT confirmed the phase, message says "free"
- If the team HAS confirmed, message mentions "already been deducted and will not be refunded" and the Release button is danger-styled
- If the RPC returns an error, it displays inline in the modal (not silently ignored)

- [ ] **Step 4: Test confirm_phase_setup payday**

Go to the Market page and trigger "Confirm Phase Setup". Check:
- Treasury increases by sponsor income amount
- Treasury decreases by total roster salaries
- `treasury_log` has new `sponsor_payment` and `payday_salary` entries (check via Supabase dashboard or `supabase db query`)

- [ ] **Step 5: Final commit if any adjustments were needed**

```bash
git add -A && git commit -m "fix: smoke test adjustments for payday + release messages"
```

Skip this step if no changes were needed.
