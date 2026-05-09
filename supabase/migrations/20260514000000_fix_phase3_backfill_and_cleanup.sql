-- Fix Phase 3 backfill: remove salary entries for riders who were released
-- BEFORE the payday timestamp (2026-04-05 12:52:31+00). These riders should
-- not have been charged a Phase 3 salary because they were no longer active
-- at payday time.
--
-- Also remove all rider_revenue entries with amount=0 (legacy bonus system,
-- no longer used).
--
-- Idempotent: DELETE with precise WHERE clauses; re-running is a no-op.

-- 1. Remove incorrect Phase 3 salary backfills for released riders
DELETE FROM public.treasury_log
WHERE type = 'payday_salary'
  AND description LIKE '%[backfill]%'
  AND created_at = '2026-04-05 12:52:31+00'
  AND rider_id IN (
    SELECT c.rider_id
    FROM public.contracts c
    WHERE c.team_id = treasury_log.team_id
      AND c.rider_id = treasury_log.rider_id
      AND c.released_at < '2026-04-05 12:52:31+00'
      AND c.created_at < '2026-04-02'
  );

-- 2. Remove legacy rider_revenue entries (all 0€, unused bonus system)
DELETE FROM public.treasury_log
WHERE type = 'rider_revenue'
  AND amount = 0;
