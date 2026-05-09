-- Restore Edward Planckaert's contract on bigdaddy.
--
-- Context: bigdaddy released Planckaert on 2026-05-08 21:28:05 UTC
-- because the league status table was showing a negative purchasing
-- power (-19,500 €) caused by the Round 2/3 treasury double-counting
-- bug fixed in 20260509120000_fix_round2_treasury_double_count.sql.
-- The release was therefore made under a false premise, not as a
-- tactical decision.
--
-- Idempotent: WHERE clauses match the exact released state. Re-running
-- is a no-op.
--
-- Note: available_from and removed_at columns may not exist yet at this
-- point in the migration sequence (added by later migrations). The DO
-- block handles this gracefully.

DO $do$
BEGIN
  -- 1. Restore the contract to active status
  UPDATE public.contracts
  SET status = 'active',
      released_at = NULL
  WHERE id = (
    SELECT c.id
    FROM public.contracts c
    JOIN public.teams t ON t.id = c.team_id
    JOIN public.riders r ON r.id = c.rider_id
    WHERE t.name = 'bigdaddy'
      AND r.full_name = 'Edward Planckaert'
      AND c.status = 'released'
      AND c.released_at = '2026-05-08 21:28:05.560369+00'
  );

  -- 2. Clear available_from if column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contracts' AND column_name = 'available_from'
  ) THEN
    EXECUTE $inner$
      UPDATE public.contracts
      SET available_from = NULL
      WHERE id = (
        SELECT c.id
        FROM public.contracts c
        JOIN public.teams t ON t.id = c.team_id
        JOIN public.riders r ON r.id = c.rider_id
        WHERE t.name = 'bigdaddy'
          AND r.full_name = 'Edward Planckaert'
          AND c.status = 'active'
      )
    $inner$;
  END IF;

  -- 3. Restore GT squad entry if removed_at column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gt_squad' AND column_name = 'removed_at'
  ) THEN
    EXECUTE $inner$
      UPDATE public.gt_squad
      SET removed_at = NULL
      WHERE rider_id = (SELECT id FROM public.riders WHERE full_name = 'Edward Planckaert')
        AND team_id = (SELECT id FROM public.teams WHERE name = 'bigdaddy')
        AND removed_at = '2026-05-08 21:28:05.560369+00'
    $inner$;
  END IF;
END $do$;
