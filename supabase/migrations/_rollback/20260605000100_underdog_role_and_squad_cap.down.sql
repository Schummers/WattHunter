-- Rollback: restore role CHECKs without 'underdog' (will fail if underdog rows exist — clean first).
DELETE FROM public.gt_role_assignments WHERE role = 'underdog';
UPDATE public.gt_squad SET role = 'domestique' WHERE role = 'underdog';

ALTER TABLE public.gt_squad DROP CONSTRAINT IF EXISTS gt_squad_role_check;
ALTER TABLE public.gt_squad ADD CONSTRAINT gt_squad_role_check
  CHECK (role IN ('gc_leader','sprinter','climber','tt_specialist','stage_hunter','domestique'));

ALTER TABLE public.gt_role_assignments DROP CONSTRAINT IF EXISTS gt_role_assignments_role_check;
ALTER TABLE public.gt_role_assignments ADD CONSTRAINT gt_role_assignments_role_check
  CHECK (role IN ('gc_leader','sprinter','climber','tt_specialist','stage_hunter','domestique'));

-- NOTE: re-apply 20260604000300_gt_squad_rpcs_v2_race_slug.sql to restore the pre-underdog
-- v2 RPC bodies (gt_add_to_squad / gt_assign_role), and
-- re-apply 20260513000000_gt_squad_cleanup_ghost_riders.sql to restore the old
-- enforce_gt_squad_cap() body (phase_id-only, hardcoded 8).
