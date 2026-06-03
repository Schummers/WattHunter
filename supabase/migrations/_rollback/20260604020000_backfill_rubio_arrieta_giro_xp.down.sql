-- Rollback for 20260604020000_backfill_rubio_arrieta_giro_xp.sql
--
-- NOTE: this only removes the INPUT rows. The XP (rider_xp_daily + teams.cumulative_xp) was
-- produced by the scoring pipeline, not by the up-migration. To fully revert the credited XP,
-- run this down-migration FIRST, then re-run scripts/rescore_rubio_arrieta_giro.py — with the
-- squad/role rows gone the scoring delta becomes negative and the XP is subtracted back out.

DELETE FROM public.gt_role_assignments
WHERE phase_id = 4 AND year = 2026
  AND (
    (team_id = '640a3f78-013f-467d-a0db-7b0403748951'
     AND rider_id = 'c45504a3-067e-4ff1-97db-f7eb53e15955'
     AND role = 'tt_specialist' AND applied_at = '2026-05-12T00:00:00Z'::timestamptz)
    OR
    (team_id = 'd5be67d4-4229-4899-b735-1ac4de12494c'
     AND rider_id = 'cd99ec8b-0d54-439d-a864-dade72715ea5'
     AND role = 'stage_hunter' AND applied_at = '2026-05-13T00:00:00Z'::timestamptz)
  );

DELETE FROM public.gt_squad
WHERE phase_id = 4 AND year = 2026
  AND (
    (team_id = '640a3f78-013f-467d-a0db-7b0403748951'
     AND rider_id = 'c45504a3-067e-4ff1-97db-f7eb53e15955'
     AND role = 'tt_specialist' AND created_at = '2026-05-12T00:00:00Z'::timestamptz)
    OR
    (team_id = 'd5be67d4-4229-4899-b735-1ac4de12494c'
     AND rider_id = 'cd99ec8b-0d54-439d-a864-dade72715ea5'
     AND role = 'stage_hunter' AND created_at = '2026-05-13T00:00:00Z'::timestamptz)
    OR  -- the stage-6+ re-add row for the swapped-out Zanoncello
    (team_id = 'd5be67d4-4229-4899-b735-1ac4de12494c'
     AND rider_id = '8b7c75c0-7e41-4026-b949-042c295a5556'
     AND role = 'domestique' AND created_at = '2026-05-13T20:00:00Z'::timestamptz)
  );

-- Restore Zanoncello's original squad row (undo the stage-5 carve).
UPDATE public.gt_squad
SET removed_at = NULL
WHERE id = '80d7afdc-6ea8-441f-8ade-87b1b8b59309'
  AND removed_at = '2026-05-13T08:00:00Z'::timestamptz;

-- Remove the backfilled GC final row for Rubio.
DELETE FROM public.race_results
WHERE rider_id = 'c45504a3-067e-4ff1-97db-f7eb53e15955'
  AND race_slug = 'race/giro-d-italia/2026/gc';
