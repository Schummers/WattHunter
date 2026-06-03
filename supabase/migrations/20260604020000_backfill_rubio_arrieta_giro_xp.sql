-- Backfill GT scoring inputs: Einer Rubio (Muscat, climber) + Igor Arrieta (Peejee, stage-5 stage_hunter).
--
-- Context: discretionary commissioner correction for Giro 2026 (league adaec367).
--   - Rubio was bought via emergency bid on 2026-05-12 but never added to Muscat's GT squad
--     (winning a bid does not auto-add to the squad). He earned 0 XP despite real results.
--   - His GC final placement (rank 23, 55 pts) is ALSO genuinely missing from race_results
--     (the /gc import skipped rank 23). That row is backfilled here.
--   - Arrieta won stage 5 (80 pts) but was in no squad that day; per commissioner decision he is
--     added to Peejee's squad for stage 5 ONLY (narrow temporal window).
--
-- This migration only deposits the INPUTS. The XP itself is produced by re-running the scoring
-- pipeline (services/pcs-sync/scripts/rescore_rubio_arrieta_giro.py), keeping the determinism guarantee.
-- All inserts are guarded (WHERE NOT EXISTS) so the migration is safe to re-apply.

-- 1a. Backfill missing GC final result for Einer Rubio (import bug: rank 23 skipped).
INSERT INTO public.race_results
  (rider_id, race_slug, race_name, stage, race_date, pcs_points, rank, race_class, is_itt, breakaway_kms, profile_icon)
VALUES
  ('c45504a3-067e-4ff1-97db-f7eb53e15955', 'race/giro-d-italia/2026/gc', 'Giro d''Italia', 'gc',
   '2026-05-31', 55, 23, 'grand_tour', false, NULL, NULL)
ON CONFLICT (rider_id, race_slug) DO UPDATE
  SET pcs_points = EXCLUDED.pcs_points, rank = EXCLUDED.rank;

-- 1b. Rubio -> Muscat GT squad as tt_specialist (created at purchase date; covers all stages >= stage 5).
-- Muscat's climber slot is already occupied by Aular (productive, 119 XP) and the squad is otherwise
-- full; tt_specialist is the only free single-slot role. tt_specialist gives x1.0 on road stages
-- (no x1.5, no KOM match) -> Rubio nets ~97 XP, not 127. Commissioner-accepted trade-off.
INSERT INTO public.gt_squad (team_id, rider_id, phase_id, year, role, created_at, removed_at, race_slug)
SELECT '640a3f78-013f-467d-a0db-7b0403748951', 'c45504a3-067e-4ff1-97db-f7eb53e15955',
       4, 2026, 'tt_specialist', '2026-05-12T00:00:00Z'::timestamptz, NULL, NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.gt_squad
  WHERE team_id = '640a3f78-013f-467d-a0db-7b0403748951'
    AND rider_id = 'c45504a3-067e-4ff1-97db-f7eb53e15955'
    AND phase_id = 4 AND year = 2026 AND role = 'tt_specialist'
    AND created_at = '2026-05-12T00:00:00Z'::timestamptz
);

INSERT INTO public.gt_role_assignments (team_id, rider_id, phase_id, year, role, applied_at)
SELECT '640a3f78-013f-467d-a0db-7b0403748951', 'c45504a3-067e-4ff1-97db-f7eb53e15955',
       4, 2026, 'tt_specialist', '2026-05-12T00:00:00Z'::timestamptz
WHERE NOT EXISTS (
  SELECT 1 FROM public.gt_role_assignments
  WHERE team_id = '640a3f78-013f-467d-a0db-7b0403748951'
    AND rider_id = 'c45504a3-067e-4ff1-97db-f7eb53e15955'
    AND phase_id = 4 AND year = 2026 AND role = 'tt_specialist'
    AND applied_at = '2026-05-12T00:00:00Z'::timestamptz
);

-- 1c. STAGE-5 SWAP at Peejee: bench Enrico Zanoncello (domestique, 0 XP at stage 5) for stage 5
--     only, and field Igor Arrieta (stage win, 80 pts) as stage_hunter in his place. Peejee's
--     squad was full (8) at stage 5, so room is made by swapping rather than exceeding the cap.
--     Statement order matters for the BEFORE-INSERT cap trigger (counts active removed_at IS NULL):
--       (1) carve Zanoncello out -> 7 active; (2) insert Arrieta (pre-removed row, stays 7);
--       (3) re-add Zanoncello for stage 6+ -> 8 active. Never exceeds 8.

-- (1) Carve Zanoncello out of stage 5 only (removed just before the 05-13 09:00 UTC cutoff).
UPDATE public.gt_squad
SET removed_at = '2026-05-13T08:00:00Z'::timestamptz
WHERE id = '80d7afdc-6ea8-441f-8ade-87b1b8b59309' AND removed_at IS NULL;

-- (2) Arrieta in for stage 5 only. Window [00:00Z, 20:00Z] covers only the stage-5 cutoff.
INSERT INTO public.gt_squad (team_id, rider_id, phase_id, year, role, created_at, removed_at, race_slug)
SELECT 'd5be67d4-4229-4899-b735-1ac4de12494c', 'cd99ec8b-0d54-439d-a864-dade72715ea5',
       4, 2026, 'stage_hunter', '2026-05-13T00:00:00Z'::timestamptz, '2026-05-13T20:00:00Z'::timestamptz, NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.gt_squad
  WHERE team_id = 'd5be67d4-4229-4899-b735-1ac4de12494c'
    AND rider_id = 'cd99ec8b-0d54-439d-a864-dade72715ea5'
    AND phase_id = 4 AND year = 2026 AND role = 'stage_hunter'
    AND created_at = '2026-05-13T00:00:00Z'::timestamptz
);

-- (3) Re-add Zanoncello from stage 6 onward (created after the stage-5 cutoff, before stage-6).
--     Preserves his existing stage-6 XP (he is a member again at the 05-14 cutoff).
INSERT INTO public.gt_squad (team_id, rider_id, phase_id, year, role, created_at, removed_at, race_slug)
SELECT 'd5be67d4-4229-4899-b735-1ac4de12494c', '8b7c75c0-7e41-4026-b949-042c295a5556',
       4, 2026, 'domestique', '2026-05-13T20:00:00Z'::timestamptz, NULL, NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.gt_squad
  WHERE team_id = 'd5be67d4-4229-4899-b735-1ac4de12494c'
    AND rider_id = '8b7c75c0-7e41-4026-b949-042c295a5556'
    AND phase_id = 4 AND year = 2026 AND role = 'domestique'
    AND created_at = '2026-05-13T20:00:00Z'::timestamptz
);

-- (4) Arrieta stage_hunter role assignment, applied before the stage-5 cutoff.
INSERT INTO public.gt_role_assignments (team_id, rider_id, phase_id, year, role, applied_at)
SELECT 'd5be67d4-4229-4899-b735-1ac4de12494c', 'cd99ec8b-0d54-439d-a864-dade72715ea5',
       4, 2026, 'stage_hunter', '2026-05-13T00:00:00Z'::timestamptz
WHERE NOT EXISTS (
  SELECT 1 FROM public.gt_role_assignments
  WHERE team_id = 'd5be67d4-4229-4899-b735-1ac4de12494c'
    AND rider_id = 'cd99ec8b-0d54-439d-a864-dade72715ea5'
    AND phase_id = 4 AND year = 2026 AND role = 'stage_hunter'
    AND applied_at = '2026-05-13T00:00:00Z'::timestamptz
);
