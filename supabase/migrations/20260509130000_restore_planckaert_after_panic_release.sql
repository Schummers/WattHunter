-- Restore Edward Planckaert's contract on bigdaddy.
--
-- Context: bigdaddy released Planckaert on 2026-05-08 21:28:05 UTC
-- because the league status table was showing a negative purchasing
-- power (-19,500 €) caused by the Round 2/3 treasury double-counting
-- bug fixed in 20260509120000_fix_round2_treasury_double_count.sql.
-- The release was therefore made under a false premise, not as a
-- tactical decision.
--
-- The release was free (no money moved): status flip to 'released',
-- gt_squad.removed_at set, draft_bids cleaned. To undo, we just
-- reverse those state changes. No treasury or treasury_log change.
--
-- Idempotent: WHERE clauses match the exact released state. Re-running
-- is a no-op.

BEGIN;

-- 1. Restore the contract to active status
UPDATE public.contracts
SET status = 'active',
    released_at = NULL,
    available_from = NULL
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

-- 2. Restore his GT squad entry (was soft-deleted at release time)
UPDATE public.gt_squad
SET removed_at = NULL
WHERE rider_id = (SELECT id FROM public.riders WHERE full_name = 'Edward Planckaert')
  AND team_id = (SELECT id FROM public.teams WHERE name = 'bigdaddy')
  AND removed_at = '2026-05-08 21:28:05.560369+00';

COMMIT;
