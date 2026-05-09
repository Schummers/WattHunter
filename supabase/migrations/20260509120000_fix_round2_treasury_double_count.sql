-- Fix Round 2/3 treasury double-counting bug.
--
-- Bug: forceResolveRound (TS) and resolve_current_round (Py) deducted
-- salary from teams.treasury at R2/R3 close. The contract's locked_salary
-- is also counted in active_salaries by the purchasing power formula
-- (treasury + sponsor − active_salaries), creating a double-count.
-- The CHECK constraint treasury >= 0 silently rejected some UPDATEs
-- while the matching treasury_log INSERT still ran, polluting the
-- transaction log with phantom entries.
--
-- This migration:
-- 1. Reverts the 4 successful R2 deductions from 2026-05-08 by adding back
--    the deducted amounts. WHERE clauses match exact corrupted treasury
--    values for safety/idempotency: if treasury was changed by other means
--    between the bug and this migration, the UPDATE will be a no-op.
-- 2. Deletes the 18 R2 Phase 4 payday_salary log entries from 2026-05-08
--    (5 successful + 13 phantom). Both kinds must go: the successful
--    entries lie about a deduction we just reverted, the phantoms are
--    bogus from the start.
--
-- Idempotent: re-running matches 0 rows (treasury already restored,
-- log entries already deleted).

BEGIN;

-- The trigger teams_protect_sensitive_fields blocks treasury UPDATEs from
-- any role except service_role / supabase_admin. Migrations run as the
-- migration role (not service_role), so we disable the trigger for the
-- duration of this transaction. Re-enabled at the bottom — and since
-- it's all inside one BEGIN/COMMIT, a rollback would also revert.
ALTER TABLE public.teams DISABLE TRIGGER teams_protect_sensitive_fields;

-- 1. Revert successful treasury deductions
UPDATE public.teams SET treasury = treasury + 55300
  WHERE name = 'bigdaddy' AND treasury = 35600;       -- Sheffield

UPDATE public.teams SET treasury = treasury + 40000
  WHERE name = 'Peejee' AND treasury = 22500;         -- Zanoncello

UPDATE public.teams SET treasury = treasury + 69200
  WHERE name = 'GoudalEnergies' AND treasury = 2000;  -- Poels + Svestad-Bardseng

UPDATE public.teams SET treasury = treasury + 22000
  WHERE name = 'TheAussieMate' AND treasury = 16750;  -- De La Cruz

ALTER TABLE public.teams ENABLE TRIGGER teams_protect_sensitive_fields;

-- 2. Delete all 18 R2 Phase 4 log entries (real + phantom).
--    The 21:00-22:00 UTC window matches exactly the buggy batch on 2026-05-08
--    (resolved at 21:16). The description pattern matches the format written
--    by forceResolveRound: "Salary — <name> (Round 2)".
DELETE FROM public.treasury_log
WHERE created_at >= '2026-05-08 21:00:00+00'
  AND created_at <  '2026-05-08 22:00:00+00'
  AND type = 'payday_salary'
  AND description LIKE 'Salary — %(Round 2)';

COMMIT;
