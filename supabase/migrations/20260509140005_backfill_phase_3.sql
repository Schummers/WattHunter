-- Backfill Phase 3 (Classics Part 2, Apr 2 2026): replace bulk payday_salary
-- entries with per-rider entries. Keep sponsor_payment as-is. teams.treasury
-- is NOT touched.
--
-- Idempotent: skip if any per-rider (rider_id IS NOT NULL) payday_salary row
-- already exists for Phase 3.

DO $$
DECLARE
  v_phase_3_start  timestamptz := '2026-04-02 12:00:00+00';
  v_phase_3_end    timestamptz := '2026-05-01 23:59:59+00';
  v_payday_at      timestamptz := '2026-04-05 12:52:31+00';
  v_already_run    boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.treasury_log
    WHERE created_at >= '2026-04-05'
      AND created_at <  '2026-04-06'
      AND type = 'payday_salary'
      AND rider_id IS NOT NULL
      AND description LIKE '%[backfill]%'
  ) INTO v_already_run;

  IF v_already_run THEN
    RAISE NOTICE 'Phase 3 backfill already applied; skipping.';
    RETURN;
  END IF;

  -- 1. Delete the bulk salary entries (descriptions like "Payday salaries — N riders")
  DELETE FROM public.treasury_log
  WHERE created_at >= '2026-04-05'
    AND created_at <  '2026-04-06'
    AND type = 'payday_salary'
    AND rider_id IS NULL
    AND description LIKE 'Payday salaries — % riders (Phase 3)';

  -- 2. Insert per-rider salary entries from contracts active during Phase 3
  INSERT INTO public.treasury_log (team_id, type, amount, description, rider_id, created_at)
  SELECT
    c.team_id,
    'payday_salary',
    -c.locked_salary,
    format('Salary — %s [backfill]', r.full_name),
    c.rider_id,
    v_payday_at
  FROM public.contracts c
  JOIN public.riders r ON r.id = c.rider_id
  WHERE c.purchased_at < v_phase_3_end
    AND (c.released_at IS NULL OR c.released_at > v_phase_3_start);
END $$;
