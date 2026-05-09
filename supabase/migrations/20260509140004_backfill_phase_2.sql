-- Backfill missing treasury_log entries for Phase 2 (Classics Part 1, Mar 2 2026).
-- All teams had a flat 200K sponsor and 200K total salaries (game decision).
-- We insert per-rider salary entries based on contracts active during that phase.
-- teams.treasury is NOT touched — assumed already correct historically.
--
-- Idempotent: skips if any sponsor_payment row already exists for Phase 2.

DO $$
DECLARE
  v_phase_2_start  timestamptz := '2026-03-02 12:00:00+00';
  v_phase_2_end    timestamptz := '2026-04-01 23:59:59+00';
  v_already_run    boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.treasury_log
    WHERE created_at >= v_phase_2_start
      AND created_at <  v_phase_2_end
      AND type = 'sponsor_payment'
  ) INTO v_already_run;

  IF v_already_run THEN
    RAISE NOTICE 'Phase 2 backfill already applied; skipping.';
    RETURN;
  END IF;

  -- 1. Sponsor income — flat 200K per team
  INSERT INTO public.treasury_log (team_id, type, amount, description, created_at)
  SELECT DISTINCT
    lm.team_id,
    'sponsor_payment',
    200000,
    'Sponsor income — Classics Part 1 [backfill]',
    v_phase_2_start
  FROM public.league_members lm
  JOIN public.teams t ON t.id = lm.team_id;

  -- 2. Per-rider salary entries from contracts active during Phase 2
  INSERT INTO public.treasury_log (team_id, type, amount, description, rider_id, created_at)
  SELECT
    c.team_id,
    'payday_salary',
    -c.locked_salary,
    format('Salary — %s [backfill]', r.full_name),
    c.rider_id,
    v_phase_2_start + interval '1 second'
  FROM public.contracts c
  JOIN public.riders r ON r.id = c.rider_id
  WHERE c.purchased_at < v_phase_2_end
    AND (c.released_at IS NULL OR c.released_at > v_phase_2_start);
END $$;
